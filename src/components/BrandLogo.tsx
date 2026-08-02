/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useId } from "react";

type LogoSize = "sm" | "md" | "lg";

interface BrandLogoProps {
  size?: LogoSize;
  /** false면 심볼만 렌더한다 (좁은 헤더용) */
  showWordmark?: boolean;
  className?: string;
}

const SIZES: Record<LogoSize, { tile: string; radius: string; word: string; badge: string }> = {
  sm: { tile: "w-8 h-8", radius: "rounded-[9px]", word: "text-[17px]", badge: "text-[9px] px-1.5" },
  md: { tile: "w-9 h-9", radius: "rounded-[11px]", word: "text-[19px]", badge: "text-[10px] px-1.5" },
  lg: { tile: "w-14 h-14", radius: "rounded-[17px]", word: "text-[28px]", badge: "text-xs px-2" },
};

/**
 * TripMate 브랜드 마크.
 *
 * 심볼은 나침반 바늘이다. 네 조각의 명도를 다르게 줘서 작은 크기에서도 방향이 읽히고,
 * 살짝 기울여 정적인 배지가 아니라 움직이는 인상을 준다.
 */
export default function BrandLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: BrandLogoProps) {
  // 한 페이지에 여러 번 렌더될 수 있어 그라데이션 id가 겹치면 안 된다.
  const gradientId = useId();
  const s = SIZES[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative ${s.tile} ${s.radius} shrink-0 overflow-hidden shadow-[0_4px_10px_-3px_rgba(0,101,141,0.55)] ring-1 ring-inset ring-white/25`}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4ec8f5" />
              <stop offset="45%" stopColor="#00aeef" />
              <stop offset="100%" stopColor="#004c6b" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${gradientId})`} />
          {/* 상단 하이라이트 — 유리 타일처럼 보이게 하는 얇은 빛 */}
          <path d="M0 0h40v13C27 20 12 20 0 13Z" fill="white" opacity="0.16" />
          <circle
            cx="20"
            cy="20"
            r="13.5"
            fill="none"
            stroke="white"
            strokeOpacity="0.28"
            strokeWidth="1.1"
          />
          <g transform="rotate(-34 20 20)">
            <path d="M20 7.5 L25.2 20 L20 20 Z" fill="white" />
            <path d="M20 7.5 L14.8 20 L20 20 Z" fill="white" opacity="0.7" />
            <path d="M20 32.5 L14.8 20 L20 20 Z" fill="white" opacity="0.42" />
            <path d="M20 32.5 L25.2 20 L20 20 Z" fill="white" opacity="0.24" />
          </g>
        </svg>
      </span>

      {showWordmark && (
        <span className="inline-flex items-baseline gap-1.5">
          <span
            className={`font-headline-lg font-extrabold ${s.word} tracking-[-0.035em] text-on-surface leading-none`}
          >
            TripMate
          </span>
          <span
            className={`${s.badge} py-0.5 rounded-md bg-primary/10 text-primary font-extrabold tracking-[0.08em] leading-none`}
          >
            AI
          </span>
        </span>
      )}
    </span>
  );
}
