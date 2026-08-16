/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ItineraryActivity {
  id?: string;
  time: string;
  title: string;
  description: string;
  location: string;
  category: "관광" | "맛집" | "카페" | "쇼핑" | "숙소" | "이동" | string;
  imageUrl?: string;
  mustVisit?: boolean;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  isMeal?: boolean;
  mealType?: "아침" | "점심" | "저녁" | string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  description: string;
  activities: ItineraryActivity[];
}

export interface TravelPlan {
  id: string;
  userId: string;
  userSeq?: number;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: string;
  budget: string;
  companion: string;
  intensity?: "여유롭게" | "빡빡하게" | string;
  transportMode?: string;
  styles: string[];
  mustVisitPlaces: string;
  planContent: ItineraryDay[];
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  /** 장소·동선·시간은 검증됐지만 설명 문구 생성에 실패한 경우 true. 일정 자체는 진짜다. */
  narrationDegraded?: boolean;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  userSeq?: number;
}
