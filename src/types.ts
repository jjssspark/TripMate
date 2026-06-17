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
  styles: string[];
  mustVisitPlaces: string;
  planContent: ItineraryDay[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  userSeq?: number;
}
