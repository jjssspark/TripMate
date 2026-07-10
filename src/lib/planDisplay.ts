/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TravelPlan } from "../types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500&auto=format&fit=crop";

// 일정 카드의 대표 썸네일: 사용자가 필수 방문(mustVisit)으로 지정한, 그 코스에서 가장
// 네임드(랜드마크격)인 장소의 사진을 우선 사용하고, 없으면 첫 활동 사진으로 대체한다.
export function getPlanCoverImage(plan: TravelPlan): string {
  const allActivities = plan.planContent?.flatMap((day) => day.activities || []) || [];
  const landmarkActivity = allActivities.find((act) => act.mustVisit && act.imageUrl);
  return landmarkActivity?.imageUrl || allActivities[0]?.imageUrl || FALLBACK_IMAGE;
}
