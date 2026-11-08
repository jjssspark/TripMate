/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// PlannerFlow 각 단계가 쓰는 고정 선택지. 라벨은 그대로 AI 프롬프트에 실려 나간다.

export const companions = [
  { label: "혼자", icon: "person" },
  { label: "친구", icon: "group" },
  { label: "커플", icon: "favorite" },
  { label: "가족", icon: "family_restroom" }
];

// 라벨은 그대로 AI 프롬프트에 실려 나가므로 서로 겹치지 않는 축으로만 늘린다.
// (예: "바다"를 "자연"과 나눈 이유는 국내 여행에서 동선이 완전히 달라지기 때문)
// 일정 속도는 아래 '여행 강도'가 전담한다. 여기에 "여유로운 일정" 같은 항목을 두면
// 같은 질문을 한 화면에서 두 번 하게 된다.
export const travelStyles = [
  { label: "맛집", icon: "restaurant" },
  { label: "카페", icon: "local_cafe" },
  { label: "쇼핑", icon: "shopping_bag" },
  { label: "자연", icon: "forest" },
  { label: "바다/해변", icon: "beach_access" },
  { label: "역사/문화", icon: "history_edu" },
  { label: "전시/예술", icon: "palette" },
  { label: "액티비티", icon: "hiking" },
  { label: "야경/밤거리", icon: "nightlife" },
  { label: "온천/힐링", icon: "hot_tub" },
  { label: "사진 스팟", icon: "photo_camera" }
];

// 전부 고르면 취향이 아니라 백화점이 된다. AI가 우선순위를 잡을 수 있도록 상한을 둔다.
export const MAX_STYLES = 5;
