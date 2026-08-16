import type { Coord, PlaceCategory, TransportMode } from "./types";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 직선거리는 실제 이동보다 짧다. 도로 우회를 보정한다.
const DETOUR_FACTOR = 1.3;
const SPEED_KMH: Record<TransportMode, number> = { 도보: 4, 대중교통: 20, 자차: 40 };
const MIN_TRAVEL_MINUTES = 10;

export function travelMinutes(a: Coord, b: Coord, mode: TransportMode): number {
  const km = haversineKm(a, b) * DETOUR_FACTOR;
  return Math.max(MIN_TRAVEL_MINUTES, Math.round((km / SPEED_KMH[mode]) * 60));
}

const STAY_MINUTES: Record<PlaceCategory, number> = {
  자연: 120, 액티비티: 120, 관광: 90, 문화: 90, 쇼핑: 90, 카페: 60, 맛집: 60,
};

export function stayMinutes(category: PlaceCategory): number {
  return STAY_MINUTES[category] ?? 60;
}
