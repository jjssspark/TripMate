/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 홈 화면의 좌우 여백을 채우는 장식 레이어.
 *
 * 콘텐츠는 1200px로 묶여 있어 넓은 화면에서는 양옆이 비어 버린다. 이 레이어가 그 자리를
 * 세로 워드마크, 지도 눈금 레일, 점선 항로로 채운다.
 *
 * 여백이 충분히 넓을 때(1536px~)만 나타난다. 그보다 좁으면 여백이 120px대로 줄어
 * 세로 워드마크와 눈금자가 서로 겹친다.
 * 순수 장식이므로 스크린리더에서 숨기고 클릭도 통과시킨다.
 */

const SEASONS = ["WINTER", "SPRING", "SUMMER", "AUTUMN"] as const;

/** 12~2월 겨울, 3~5월 봄, 6~8월 여름, 9~11월 가을 */
function getSeasonLabel(now: Date): string {
  return SEASONS[Math.floor(((now.getMonth() + 1) % 12) / 3)];
}

/** 레일을 따라 늘어놓는 지도 눈금. 5칸마다 길어져 자를 닮게 한다. */
function Ticks({ align }: { align: "left" | "right" }) {
  return (
    <div className="flex flex-col gap-[14px]">
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className={`block h-px ${align === "right" ? "self-end" : "self-start"} ${
            i % 5 === 0 ? "w-4 bg-primary/40" : "w-2 bg-primary/25"
          }`}
        />
      ))}
    </div>
  );
}

export default function HomeSideRails() {
  const now = new Date();
  const meta = `${now.getFullYear()} · ${getSeasonLabel(now)} · SOUTH KOREA`;

  return (
    <div
      aria-hidden="true"
      className="hidden min-[1536px]:block fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {/* 여백을 가로지르는 점선 항로. 화면 밖에서 들어와 화면 밖으로 빠져나간다. */}
      <svg
        className="absolute inset-0 w-full h-full text-primary/20"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
        fill="none"
      >
        <path
          d="M-40 760 C 180 700, 240 460, 150 180"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="5 9"
          strokeLinecap="round"
        />
        <path
          d="M1480 120 C 1280 200, 1240 470, 1330 800"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="5 9"
          strokeLinecap="round"
        />
        <circle cx="150" cy="180" r="3.5" fill="currentColor" />
        <circle cx="1330" cy="800" r="3.5" fill="currentColor" />
      </svg>

      {/* ── 왼쪽 여백 ── */}
      <div className="absolute left-0 top-0 bottom-0 w-[calc((100vw-1200px)/2)] flex items-center justify-center">
        <span
          className="font-headline-lg font-extrabold tracking-[0.06em] whitespace-nowrap select-none"
          style={{
            writingMode: "vertical-rl",
            fontSize: "clamp(58px, 6.5vw, 104px)",
            color: "transparent",
            WebkitTextStroke: "1.1px rgba(0, 101, 141, 0.16)",
          }}
        >
          TRIPMATE
        </span>

        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-3">
          <Ticks align="right" />
          <span className="w-px h-[420px] bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
        </div>
      </div>

      {/* ── 오른쪽 여백 ── */}
      <div className="absolute right-0 top-0 bottom-0 w-[calc((100vw-1200px)/2)] flex items-center justify-center">
        <span
          className="text-[11px] font-extrabold tracking-[0.42em] text-primary/35 whitespace-nowrap select-none"
          style={{ writingMode: "vertical-rl" }}
        >
          {meta}
        </span>

        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex items-center gap-3">
          <span className="w-px h-[420px] bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
          <Ticks align="left" />
        </div>

        {/* 아래쪽 나침반 워터마크 — 브랜드 심볼을 한 번 더 반복해 여백에 무게를 준다 */}
        <svg
          className="absolute bottom-16 right-10 w-24 h-24 text-primary/12"
          viewBox="0 0 40 40"
          fill="none"
        >
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="0.8" />
          <g transform="rotate(-34 20 20)">
            <path d="M20 5 L24.5 20 L20 20 Z" fill="currentColor" />
            <path d="M20 5 L15.5 20 L20 20 Z" fill="currentColor" opacity="0.55" />
            <path d="M20 35 L15.5 20 L20 20 Z" fill="currentColor" opacity="0.35" />
            <path d="M20 35 L24.5 20 L20 20 Z" fill="currentColor" opacity="0.2" />
          </g>
        </svg>
      </div>
    </div>
  );
}
