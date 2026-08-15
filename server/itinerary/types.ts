export type PlaceCategory = "관광" | "자연" | "문화" | "쇼핑" | "맛집" | "카페" | "액티비티";
export type MealType = "아침" | "점심" | "저녁";
export type TransportMode = "도보" | "대중교통" | "자차";
export type Intensity = "여유롭게" | "빡빡하게";

export type Coord = { lat: number; lng: number };

export type Candidate = { name: string; category: PlaceCategory };

export type ResolvedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  address: string;
  placeUrl?: string;
  mustVisit: boolean;
};

export type ScheduledActivity = {
  place: ResolvedPlace;
  startMinutes: number;
  stayMinutes: number;
  travelFromPrevMinutes: number;
  isMeal: boolean;
  mealType?: MealType;
};

export type ScheduledDay = { day: number; activities: ScheduledActivity[] };

// 식사 3개를 제외한 하루 일반 활동 개수 범위
export const INTENSITY_RANGE: Record<Intensity, { min: number; max: number }> = {
  여유롭게: { min: 1, max: 3 },
  빡빡하게: { min: 4, max: 8 },
};
