/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { ItineraryDay } from "../../types";

// Leaflet은 CDN <script>로 window.L에 올라오고 @types/leaflet은 설치하지 않았다.
// 여기서 실제로 호출하는 부분만 구조적으로 선언해 any 없이 쓴다.
type LatLng = [number, number];

interface LeafletLayer {
  addTo(map: LeafletMap): this;
}

interface LeafletMarker extends LeafletLayer {
  bindPopup(html: string): this;
}

interface LeafletBounds {
  pad(bufferRatio: number): LeafletBounds;
}

interface LeafletMap {
  setView(center: LatLng, zoom: number): LeafletMap;
  fitBounds(bounds: LeafletBounds): LeafletMap;
  remove(): void;
}

interface Leaflet {
  map(el: HTMLElement, options: { zoomControl: boolean; attributionControl: boolean }): LeafletMap;
  tileLayer(urlTemplate: string, options: { maxZoom: number; attribution: string }): LeafletLayer;
  control: {
    attribution(options: { position: string; prefix: boolean }): LeafletLayer;
  };
  divIcon(options: { html: string; className: string; iconSize: LatLng; iconAnchor: LatLng }): unknown;
  marker(latlng: LatLng, options: { icon: unknown }): LeafletMarker;
  polyline(
    latlngs: LatLng[],
    options: { color: string; weight: number; dashArray: string; opacity: number; lineJoin: string },
  ): LeafletLayer;
  featureGroup: new (layers: LeafletMarker[]) => { getBounds(): LeafletBounds };
}

const geocodeCache: { [key: string]: [number, number] } = {};

interface PlanMapProps {
  day: ItineraryDay;
  destination: string;
}

export default function PlanMap({ day, destination }: PlanMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  // Leaflet 지도 초기화 및 마커 렌더링
  useEffect(() => {
    const L = (window as unknown as { L?: Leaflet }).L;
    if (!L || !mapContainerRef.current) return;

    let isMounted = true;

    // 기존 지도 인스턴스가 있다면 제거 (메모리 누수 및 지도 중복 에러 방지)
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn("Error removing previous map instance:", e);
      }
      mapInstanceRef.current = null;
    }

    const activities = day?.activities || [];
    if (activities.length === 0) return;

    // 도시별 위경도 사전
    const CITY_COORDS: { [key: string]: [number, number] } = {
      대전: [36.3504, 127.3845],
      서울: [37.5665, 126.9780],
      제주: [33.4996, 126.5312],
      도쿄: [35.6762, 139.6503],
      tokyo: [35.6762, 139.6503],
      오사카: [34.6937, 135.5023],
      osaka: [34.6937, 135.5023],
      파리: [48.8566, 2.3522],
      paris: [48.8566, 2.3522],
      시드니: [-33.8688, 151.2093],
      sydney: [-33.8688, 151.2093],
    };

    // 목적지에 따른 중심좌표 획득
    let centerLat = 37.5665;
    let centerLng = 126.9780;
    const dest = destination || "";
    for (const key in CITY_COORDS) {
      if (dest.includes(key)) {
        [centerLat, centerLng] = CITY_COORDS[key];
        break;
      }
    }

    const loadMapAndMarkers = async () => {
      const latlngs: [number, number][] = [];

      for (let idx = 0; idx < activities.length; idx++) {
        const act = activities[idx];
        let lat = act.latitude;
        let lng = act.longitude;

        // 좌표 정보가 부실하거나 유효하지 않은 경우 실시간 주소 지오코딩 조회
        if (typeof lat !== "number" || typeof lng !== "number" || lat === 0 || lng === 0) {
          const searchTitle = act.title;
          const cacheKey = `${dest}_${searchTitle}`;

          if (geocodeCache[cacheKey]) {
            [lat, lng] = geocodeCache[cacheKey];
          } else {
            try {
              // 로컬 프록시 API 호출하여 CORS와 429 에러 방어
              const url = `/api/geocode?city=${encodeURIComponent(dest)}&query=${encodeURIComponent(searchTitle)}`;
              const res = await fetch(url);
              if (res.ok) {
                const data = await res.json();
                if (data && data.lat && data.lon) {
                  lat = data.lat;
                  lng = data.lon;
                  geocodeCache[cacheKey] = [lat, lng];
                }
              }
            } catch (err) {
              console.error("Geocoding proxy fetch failed for:", searchTitle, err);
            }
          }
        }

        // 지오코딩 실패 또는 좌표 미존재 시 대략적인 fallback 오프셋 생성
        if (typeof lat !== "number" || typeof lng !== "number" || lat === 0 || lng === 0) {
          lat = centerLat + (idx * 0.005) - 0.01;
          lng = centerLng + (idx * 0.005) - 0.01;
        }

        latlngs.push([lat, lng]);
      }

      if (!isMounted || !mapContainerRef.current) return;

      try {
        // 지도 객체 생성 (배경은 OpenStreetMap 이용)
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView(latlngs[0] || [centerLat, centerLng], 13);

        mapInstanceRef.current = map;

        // CARTO 무료 타일은 API 키가 없으면 지도 대신 "API KEY REQUIRED" 그림을 내려준다(2026-11 확인).
        // OSM 공식 타일은 키 없이 쓸 수 있는 대신 출처 표기가 필수라 attribution을 켠다.
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

        // 마커 추가
        const markers: LeafletMarker[] = [];
        activities.forEach((act, idx) => {
          const coord = latlngs[idx];
          const category = act.category || "관광";
          const color = category === "맛집" ? "#ef4444" : category === "카페" ? "#f59e0b" : category === "쇼핑" ? "#10b981" : category === "숙소" ? "#8b5cf6" : "#3b82f6";
          
          const customIcon = L.divIcon({
            html: `
              <div style="
                background-color: ${color};
                color: white;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 11px;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                transition: all 0.2s ease;
              " class="hover:scale-115">
                ${idx + 1}
              </div>
            `,
            className: "custom-leaflet-marker",
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker(coord, { icon: customIcon }).addTo(map);
          
          // 마커 클릭 시 팝업 노출
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 2px; width: 130px;">
              <h5 style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; color: #1e293b;">${idx + 1}. ${act.title}</h5>
              <p style="margin: 0; font-size: 10px; color: #64748b;">${act.time} • ${category}</p>
            </div>
          `);

          markers.push(marker);
        });

        // 마커들을 이어주는 폴리라인(동선선) 추가
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: "#3b82f6",
            weight: 3.5,
            dashArray: "6, 6",
            opacity: 0.85,
            lineJoin: "round",
          }).addTo(map);
        }

        // 마커들 전체가 한눈에 보이도록 지도 뷰 영역 맞추기
        if (latlngs.length > 0) {
          const group = new L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.15));
        }
      } catch (err) {
        console.error("Leaflet map initialization error:", err);
      }
    };

    loadMapAndMarkers();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("Error on cleanup map instance:", e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [day, destination]);

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-md group z-10">
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "220px" }} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 pt-6 flex justify-between items-center text-white z-[1000] pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs font-bold flex items-center justify-center text-white">
            location_on
          </span>
          <span className="font-label-md text-[11px] font-bold">{destination} 여정 동선</span>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            day.activities?.[0]?.title || destination
          )}`}
          target="_blank"
          rel="noreferrer"
          className="bg-white/20 hover:bg-white/35 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-label-md text-white border-none transition-all font-bold select-none pointer-events-auto shadow-sm"
        >
          지도에서 검색
        </a>
      </div>
    </div>
  );
}
