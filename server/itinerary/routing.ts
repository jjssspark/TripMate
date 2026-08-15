import { haversineKm } from "./geo";
import { INTENSITY_RANGE } from "./types";
import type { Coord, Intensity, ResolvedPlace } from "./types";

const DUPLICATE_METERS = 50;

export function normalizeName(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/** 앞에 온 것을 남긴다. 필수 방문지를 먼저 넣어야 살아남는다. */
export function dedupe(places: readonly ResolvedPlace[]): ResolvedPlace[] {
  const kept: ResolvedPlace[] = [];
  for (const p of places) {
    const isDup = kept.some(
      (k) =>
        normalizeName(k.name) === normalizeName(p.name) ||
        haversineKm(k, p) * 1000 <= DUPLICATE_METERS,
    );
    if (!isDup) kept.push(p);
  }
  return kept;
}

export type DayAssignment = {
  buckets: ResolvedPlace[][];
  centers: Coord[];
  leftover: ResolvedPlace[];
};

// 난수를 쓰지 않는다. 같은 입력에 같은 출력이 나와야 테스트가 재현된다.
function farthestPointSeeds(places: readonly ResolvedPlace[], k: number): Coord[] {
  const seeds: Coord[] = [{ lat: places[0].lat, lng: places[0].lng }];
  while (seeds.length < k) {
    let best = places[0];
    let bestDist = -1;
    for (const p of places) {
      const d = Math.min(...seeds.map((s) => haversineKm(s, p)));
      if (d > bestDist) {
        bestDist = d;
        best = p;
      }
    }
    seeds.push({ lat: best.lat, lng: best.lng });
  }
  return seeds;
}

function assignOnce(
  places: readonly ResolvedPlace[],
  centers: readonly Coord[],
  capacity: number,
): number[] {
  const load = new Array(centers.length).fill(0);
  const result = new Array(places.length).fill(-1);

  // 필수 방문지를 먼저 꽂는다. 그다음은 중심에 가까워 확신이 큰 것부터 자리를 잡아야
  // 뒤에 오는 점이 엉뚱한 클러스터로 밀려나지 않는다.
  const order = places
    .map((p, i) => ({ i, must: p.mustVisit, d: Math.min(...centers.map((c) => haversineKm(c, p))) }))
    .sort((a, b) => Number(b.must) - Number(a.must) || a.d - b.d);

  for (const { i } of order) {
    const ranked = centers
      .map((c, ci) => ({ ci, d: haversineKm(c, places[i]) }))
      .sort((a, b) => a.d - b.d);
    const target = ranked.find((r) => load[r.ci] < capacity);
    if (!target) continue; // 정원 초과분은 leftover로 남긴다
    result[i] = target.ci;
    load[target.ci] += 1;
  }
  return result;
}

function recenter(
  places: readonly ResolvedPlace[],
  assignment: readonly number[],
  prev: readonly Coord[],
): Coord[] {
  const sums = prev.map(() => ({ lat: 0, lng: 0, n: 0 }));
  assignment.forEach((ci, i) => {
    if (ci < 0) return;
    sums[ci].lat += places[i].lat;
    sums[ci].lng += places[i].lng;
    sums[ci].n += 1;
  });
  return sums.map((s, ci) => (s.n === 0 ? prev[ci] : { lat: s.lat / s.n, lng: s.lng / s.n }));
}

export function assignToDays(
  places: readonly ResolvedPlace[],
  days: number,
  intensity: Intensity,
): DayAssignment {
  if (places.length === 0) {
    return {
      buckets: Array.from({ length: days }, () => []),
      centers: Array.from({ length: days }, () => ({ lat: 0, lng: 0 })),
      leftover: [],
    };
  }

  const capacity = INTENSITY_RANGE[intensity].max;
  let centers = farthestPointSeeds(places, Math.min(days, places.length));
  while (centers.length < days) centers.push({ ...centers[centers.length - 1] });

  let assignment: number[] = [];
  for (let iter = 0; iter < 20; iter += 1) {
    const next = assignOnce(places, centers, capacity);
    const same = next.length === assignment.length && next.every((v, i) => v === assignment[i]);
    assignment = next;
    centers = recenter(places, assignment, centers);
    if (same) break;
  }

  const buckets: ResolvedPlace[][] = Array.from({ length: days }, () => []);
  const leftover: ResolvedPlace[] = [];
  assignment.forEach((ci, i) => (ci < 0 ? leftover.push(places[i]) : buckets[ci].push(places[i])));
  return { buckets, centers, leftover };
}

/** 하한에 못 미치는 클러스터를 leftover 중 중심에 가장 가까운 것으로 채운다. */
export function fillToMinimum(assignment: DayAssignment, min: number): DayAssignment {
  const buckets = assignment.buckets.map((b) => [...b]);
  const pool = [...assignment.leftover];

  buckets.forEach((bucket, ci) => {
    while (bucket.length < min && pool.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      pool.forEach((p, i) => {
        const d = haversineKm(assignment.centers[ci], p);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      bucket.push(pool.splice(bestIdx, 1)[0]);
    }
  });

  return { buckets, centers: assignment.centers, leftover: pool };
}
