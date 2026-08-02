/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 홈 화면 전용 정적 콘텐츠와 파생값 계산.
 *
 * 사진은 Wikimedia Commons의 자유 이용 이미지를 원본 URL로 참조한다.
 * 주의: Commons는 미리 만들어 둔 폭만 응답한다. 960/1280 외의 값을 넣으면 400이 떨어지므로
 * URL의 `NNNpx-` 부분을 임의로 바꾸지 말 것.
 */

import { TravelPlan } from "../types";

export interface FeaturedDestination {
  /** 클릭 시 일정 만들기 폼에 그대로 채워지는 값. destinations.ts의 항목과 일치해야 한다. */
  name: string;
  region: string;
  tagline: string;
  /** 사진에 찍힌 실제 장소 */
  spot: string;
  imageUrl: string;
  /** 사진 저작자 (CC 라이선스 표기 의무) */
  photographer: string;
  /** 베이스는 2열, lg부터 4열 벤토 그리드에 배치되는 스팬 */
  spanClass: string;
}

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/thumb";

/** 히어로 배경 — 제주 성산일출봉 항공 전경 */
export const HERO_IMAGE = {
  url: `${COMMONS}/6/61/Seongsan_Ilchulbong_from_the_air.jpg/1280px-Seongsan_Ilchulbong_from_the_air.jpg`,
  spot: "제주 성산일출봉",
  photographer: "Korea.net / Korean Culture and Information Service",
};

export const FEATURED_DESTINATIONS: readonly FeaturedDestination[] = [
  {
    name: "제주도",
    region: "제주",
    tagline: "수국이 피는 계절, 분화구 아래를 걷다",
    spot: "성산일출봉",
    imageUrl: `${COMMONS}/1/19/Hydrangea_macrophylla_in_front_of_Seongsan_Ilchulbong_volcano_at_blue_hour_in_Jeju_Island_South_Korea.jpg/960px-Hydrangea_macrophylla_in_front_of_Seongsan_Ilchulbong_volcano_at_blue_hour_in_Jeju_Island_South_Korea.jpg`,
    photographer: "Basile Morin",
    spanClass: "col-span-2 lg:col-span-2 lg:row-span-2",
  },
  {
    name: "부산",
    region: "경상",
    tagline: "산비탈을 물들인 색색의 지붕",
    spot: "감천문화마을",
    imageUrl: `${COMMONS}/b/b8/Colorful_houses_in_Gamcheon_Culture_Village_at_sunset_in_Busan_South_Korea.jpg/960px-Colorful_houses_in_Gamcheon_Culture_Village_at_sunset_in_Busan_South_Korea.jpg`,
    photographer: "Basile Morin",
    spanClass: "col-span-1 lg:col-span-1 lg:row-span-1",
  },
  {
    name: "경주",
    region: "경상",
    tagline: "천년의 계단을 오르는 하루",
    spot: "불국사",
    imageUrl: `${COMMONS}/e/ed/Bulguksa_temple_entrance_gate_stairs_flower_bed_and_blue_sky_in_Gyeongju_South_Korea.jpg/960px-Bulguksa_temple_entrance_gate_stairs_flower_bed_and_blue_sky_in_Gyeongju_South_Korea.jpg`,
    photographer: "Basile Morin",
    spanClass: "col-span-1 lg:col-span-1 lg:row-span-2",
  },
  {
    name: "강릉",
    region: "강원",
    tagline: "가장 먼저 해가 닿는 백사장",
    spot: "정동진 해변",
    imageUrl: `${COMMONS}/e/e6/Jeongdongjin_Beach.jpg/960px-Jeongdongjin_Beach.jpg`,
    photographer: "Loewelad",
    spanClass: "col-span-1 lg:col-span-1 lg:row-span-1",
  },
  {
    name: "속초",
    region: "강원",
    tagline: "능선 위로 솟은 화강암 봉우리",
    spot: "설악산 울산바위",
    imageUrl: `${COMMONS}/a/ab/Seoraksan_National_Park_panorama_3.jpg/960px-Seoraksan_National_Park_panorama_3.jpg`,
    photographer: "kallerna",
    spanClass: "col-span-1 lg:col-span-2 lg:row-span-1",
  },
  {
    name: "여수",
    region: "전라",
    tagline: "암자 너머로 트이는 남해 바다",
    spot: "향일암",
    imageUrl: `${COMMONS}/5/56/The_Namhae_sea_through_the_Temple_of_Hyangiram_20091205.JPG/960px-The_Namhae_sea_through_the_Temple_of_Hyangiram_20091205.JPG`,
    photographer: "날개",
    spanClass: "col-span-1 lg:col-span-1 lg:row-span-1",
  },
  {
    name: "전주",
    region: "전라",
    tagline: "기와 물결 사이를 천천히",
    spot: "전주한옥마을",
    imageUrl: `${COMMONS}/2/22/Jeonju_Hanok_Maeul_02.jpg/960px-Jeonju_Hanok_Maeul_02.jpg`,
    photographer: "Bernard Gagnon",
    spanClass: "col-span-1 lg:col-span-1 lg:row-span-1",
  },
  {
    name: "통영",
    region: "경상",
    tagline: "섬을 감아 도는 바닷가 도로",
    spot: "욕지도 해안도로",
    imageUrl: `${COMMONS}/e/e1/A_bus_stop_on_the_coastal_road_of_Yokjido_Island.jpg/960px-A_bus_stop_on_the_coastal_road_of_Yokjido_Island.jpg`,
    photographer: "Pranay chakraborty 2004",
    spanClass: "col-span-1 lg:col-span-2 lg:row-span-1",
  },
];

/** 사진 크레딧 한 줄. 중복 저작자는 합친다. */
export const PHOTO_CREDIT = Array.from(
  new Set([HERO_IMAGE.photographer, ...FEATURED_DESTINATIONS.map((d) => d.photographer)]),
).join(", ");

/** 접속 시각대에 맞춘 인사. 하루 중 언제 들어와도 화면이 다르게 읽히도록. */
export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "고요한 새벽이에요";
  if (hour < 11) return "좋은 아침이에요";
  if (hour < 17) return "화창한 오후예요";
  if (hour < 21) return "노을 지는 저녁이에요";
  return "여행을 상상하기 좋은 밤이에요";
}

export interface Countdown {
  plan: TravelPlan;
  /** 출발까지 남은 일수. 이미 출발했으면 0 이하이며 inTrip이 true가 된다. */
  daysLeft: number;
  inTrip: boolean;
}

/** 로컬 자정 기준 일수 차이. 시각 성분이 섞이면 D-day가 하루씩 어긋난다. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** 진행 중이거나 가장 가까운 미래의 여행 하나. 지난 여행만 있으면 null. */
export function getUpcomingTrip(
  plans: readonly TravelPlan[],
  now: Date = new Date(),
): Countdown | null {
  const next = plans
    .filter((p) => p.startDate && p.endDate)
    .map((p) => ({
      plan: p,
      daysLeft: daysBetween(now, new Date(p.startDate)),
      daysUntilEnd: daysBetween(now, new Date(p.endDate)),
    }))
    .filter((c) => c.daysUntilEnd >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  if (!next) return null;
  return { plan: next.plan, daysLeft: next.daysLeft, inTrip: next.daysLeft <= 0 };
}

export interface TripStats {
  planCount: number;
  cityCount: number;
  nightCount: number;
}

export function getTripStats(plans: readonly TravelPlan[]): TripStats {
  const nights = plans.reduce((sum, p) => {
    if (!p.startDate || !p.endDate) return sum;
    return sum + Math.max(0, daysBetween(new Date(p.startDate), new Date(p.endDate)));
  }, 0);

  return {
    planCount: plans.length,
    cityCount: new Set(plans.map((p) => p.destination).filter(Boolean)).size,
    nightCount: nights,
  };
}
