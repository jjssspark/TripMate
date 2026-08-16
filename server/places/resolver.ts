import type { ResolvedPlace } from "../itinerary/types";

export type KakaoCategoryCode = "FD6" | "CE7" | "AT4";

export interface PlaceResolver {
  resolve(name: string, destination: string): Promise<ResolvedPlace | null>;
  searchNearby(
    lat: number,
    lng: number,
    categoryCode: KakaoCategoryCode,
    radiusMeters: number,
  ): Promise<ResolvedPlace[]>;
}
