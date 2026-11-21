"use client";

import { useEffect, useState } from "react";
import { seasonByDate } from "./SeasonWindow";

// 🍵 첫 화면 — 불 켜진 찻집(無害林) 가게 앞
//  - 건물(픽셀 그림)은 그대로, 배경만 계절마다 바뀌어요 (접속한 날짜 기준 · 11월은 미리 겨울)
//      봄: 분홍 노을 + 벚꽃잎 / 여름: 푸른 밤 + 반딧불 / 가을: 주황 노을 + 낙엽 / 겨울: 눈 오는 밤 + 지붕의 눈
//  - 확인용: 주소 끝에 ?season=spring 처럼 붙이면 그 계절
const LOOK = {
  spring: { sky: "linear-gradient(#3b3265 0%, #8d5a8c 55%, #f2a7b5 100%)", ground: "#a9cf8a", groundLine: "#8fbf73", groundTop: "#c4e3a6", moon: "#fff1f2", fall: "petal" },
  summer: { sky: "linear-gradient(#061833 0%, #0f2f57 60%, #1f4d4a 100%)", ground: "#3f7a3a", groundLine: "#336b30", groundTop: "#5a9a4f", moon: "#fef9c3", fall: "firefly" },
  autumn: { sky: "linear-gradient(#2a1f45 0%, #7a3b4a 55%, #e3824a 100%)", ground: "#9a6a3a", groundLine: "#82582f", groundTop: "#b98547", moon: "#fde68a", fall: "leaf" },
  winter: { sky: "linear-gradient(#0b1026 0%, #1b1840 55%, #2a1e3a 100%)", ground: "#e9eef7", groundLine: "#cbd5e1", groundTop: "#ffffff", moon: "#fef3c7", fall: "snow" },
};

// 가게 그림 (픽셀) — snow: 지붕·창틀에 눈
function Store({ snow }) {
  const R = (x, y, w, h, c, k) => <rect key={k ?? `${x}-${y}-${w}-${h}-${c}`} x={x} y={y} width={w} height={h} fill={c} />;
  const S = (x, y, w, h) => (snow ? R(x, y, w, h, "#f8fafc") : null);
  return (
    <svg viewBox="-6 0 132 90" width="100%" height="100%" shapeRendering="crispEdges" aria-hidden="true">
      {/* 지붕 */}
      {R(0, 18, 120, 10, "#3b2a24")}
      {R(-4, 14, 128, 6, "#4a332b")}
      {S(-4, 11, 128, 4)}
      {S(6, 9, 30, 3)}
      {S(70, 8, 36, 4)}
      {/* 벽 */}
      {R(2, 28, 116, 62, "#7a4a30")}
      {R(2, 28, 116, 3, "#5e3d28")}
      {Array.from({ length: 8 }, (_, i) => R(2 + i * 15, 31, 1, 59, "#6b402a", `w${i}`))}
      {/* 간판 */}
      {R(36, 32, 48, 12, "#f5e6c8")}
      {R(36, 32, 48, 1, "#2b1d1a")}
      {R(36, 43, 48, 1, "#2b1d1a")}
      {R(36, 32, 1, 12, "#2b1d1a")}
      {R(83, 32, 1, 12, "#2b1d1a")}
      <text x="60" y="41.2" fontSize="8" textAnchor="middle" fill="#2b1d1a" fontWeight="700" style={{ fontFamily: "Galmuri11, serif", letterSpacing: "1px" }}>
        無害林
      </text>
      {/* 왼쪽 창문 (불빛) */}
      {R(8, 50, 26, 26, "#2b1d1a")}
      <g className="entry-glow">{R(10, 52, 22, 22, "#fcd68a")}</g>
      {R(20, 52, 1, 22, "#7a4a30")}
      {R(10, 62, 22, 1, "#7a4a30")}
      {R(12, 66, 6, 7, "#8b5a3c")}
      {R(23, 64, 5, 9, "#6b7f5a")}
      {R(6, 76, 30, 3, "#5e3d28")}
      {S(7, 74, 28, 2)}
      {/* 미닫이문 + 노렌(茶) */}
      {R(44, 48, 32, 42, "#2b1d1a")}
      <g className="entry-glow">
        {R(46, 50, 13, 40, "#f6c66d")}
        {R(61, 50, 13, 40, "#f6c66d")}
      </g>
      {R(59, 50, 2, 40, "#5e3d28")}
      {R(44, 47, 32, 2, "#3b2a24")}
      {R(45, 49, 30, 12, "#1f3b5c")}
      {R(52, 49, 1, 12, "#162c45")}
      {R(60, 49, 1, 12, "#162c45")}
      {R(68, 49, 1, 12, "#162c45")}
      <text x="60" y="58" fontSize="7" textAnchor="middle" fill="#f8fafc" fontWeight="700">
        茶
      </text>
      {/* 오른쪽 창문 */}
      {R(86, 50, 26, 26, "#2b1d1a")}
      <g className="entry-glow">{R(88, 52, 22, 22, "#fcd68a")}</g>
      {R(98, 52, 1, 22, "#7a4a30")}
      {R(88, 62, 22, 1, "#7a4a30")}
      {R(92, 66, 12, 3, "#e7e5e4")}
      {R(95, 63, 6, 3, "#a7c9b3")}
      {R(84, 76, 30, 3, "#5e3d28")}
      {S(85, 74, 28, 2)}
      {/* 화분 + 돌 */}
      {R(100, 80, 10, 10, "#8a5a2b")}
      {R(101, 72, 8, 8, "#3f6b45")}
      {S(101, 71, 8, 2)}
      {R(8, 84, 14, 6, "#64748b")}
      {S(8, 83, 14, 2)}
    </svg>
  );
}

// 계절마다 내리는 것 (눈 · 벚꽃잎 · 낙엽 · 반딧불)
function Falling({ kind }) {
  return Array.from({ length: kind === "firefly" ? 18 : 36 }, (_, i) => {
    const left = `${(i * 37) % 100}%`;
    const delay = `${-(i % 9) * 0.9}s`;
    if (kind === "firefly") {
      return <span key={i} className="entry-fly absolute h-1.5 w-1.5 bg-[#fef08a]" style={{ left, top: `${30 + ((i * 23) % 55)}%`, animationDelay: delay, boxShadow: "0 0 8px 3px rgba(254,240,138,0.55)" }} />;
    }
    const size = kind === "snow" ? 2 + (i % 3) : 5 + (i % 3);
    const color = kind === "snow" ? "#ffffff" : kind === "petal" ? ["#fbcfe8", "#f9a8d4", "#fff1f2"][i % 3] : ["#f97316", "#dc2626", "#facc15"][i % 3];
    return (
      <span
        key={i}
        className="entry-fall absolute top-0"
        style={{ left, width: size, height: kind === "leaf" ? size * 0.8 : size, background: color, borderRadius: kind === "petal" ? "60% 0" : 0, opacity: kind === "snow" ? 0.35 + (i % 5) * 0.13 : 0.9, animationDuration: `${(kind === "snow" ? 7 : 9) + (i % 6)}s`, animationDelay: delay, "--sway": `${((i % 5) - 2) * 14}px` }}
      />
    );
  });
}

export default function EntranceScene({ onEnter, disabled = false }) {
  const [season, setSeason] = useState("winter");
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("season");
      // 11월부터는 겨울 분위기 (곧 겨울이라) — 나머지는 찻집 창밖과 같은 계절
      const m = new Date().getMonth() + 1;
      setSeason(LOOK[t] ? t : m === 11 ? "winter" : seasonByDate(new Date()));
    } catch {}
  }, []);
  const L = LOOK[season] ?? LOOK.winter;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: L.sky, fontFamily: "Galmuri11, sans-serif" }}>
      <style>{`
        @font-face{font-family:Galmuri11;src:url(/fonts/Galmuri11.woff2) format("woff2");font-weight:400;font-display:swap}
        @font-face{font-family:Galmuri11;src:url(/fonts/Galmuri11-Bold.woff2) format("woff2");font-weight:700;font-display:swap}
        @keyframes entry-fall { 0% { transform: translate(0,-12vh) rotate(0deg); } 50% { transform: translate(var(--sway),45vh) rotate(180deg); } 100% { transform: translate(0,110vh) rotate(360deg); } }
        .entry-fall { animation: entry-fall linear infinite; }
        @keyframes entry-fly { 0%,100% { transform: translate(0,0); opacity: .9; } 50% { transform: translate(14px,-18px); opacity: .25; } }
        .entry-fly { animation: entry-fly 3.4s ease-in-out infinite; }
        @keyframes entry-glow { 50% { opacity: .78; } }
        .entry-glow { animation: entry-glow 2.4s ease-in-out infinite; }
        @keyframes entry-steam { 0% { transform: translateY(0) scale(.6); opacity: 0; } 30% { opacity: .9; } 100% { transform: translateY(-34px) scale(1.3); opacity: 0; } }
        .entry-steam { animation: entry-steam 2.4s ease-out infinite; }
        @keyframes entry-breathe { 50% { box-shadow: 4px 4px 0 rgba(0,0,0,.45), 0 0 40px rgba(251,191,36,.7); } }
        .entry-btn { animation: entry-breathe 1.8s ease-in-out infinite; }
      `}</style>

      {/* 달 (봄·가을 노을에는 흐리게) */}
      <div className="absolute right-[6%] top-[calc(var(--sat,0px)+3%)] h-9 w-9 sm:h-14 sm:w-14" style={{ background: L.moon, boxShadow: `0 0 34px 12px ${L.moon}44`, opacity: season === "spring" || season === "autumn" ? 0.6 : 1 }} />
      <div className="pointer-events-none absolute inset-0">
        <Falling kind={L.fall} />
      </div>

      {/* 땅 */}
      <div className="absolute inset-x-0 bottom-0 h-[15%]" style={{ background: L.ground, boxShadow: `inset 0 6px 0 ${L.groundTop}` }}>
        <div className="absolute inset-x-0 top-[30%] h-1" style={{ background: `repeating-linear-gradient(90deg, ${L.groundLine} 0 14px, transparent 14px 30px)` }} />
      </div>

      {/* 가게 */}
      <div className="absolute bottom-[14%] left-1/2 w-[92%] -translate-x-1/2 sm:w-[52%]" style={{ aspectRatio: "132 / 90", maxWidth: "min(560px, calc(50vh * 132 / 90))" }}>
        <Store snow={season === "winter"} />
        <div className="pointer-events-none absolute left-[73%] top-[56%]">
          <span className="entry-steam absolute block h-3.5 w-1.5 rounded-full bg-white/70 blur-[2px]" />
          <span className="entry-steam absolute left-2 block h-3.5 w-1.5 rounded-full bg-white/70 blur-[2px]" style={{ animationDelay: "0.8s" }} />
        </div>
      </div>

      {/* 제목 */}
      <div className="absolute inset-x-0 top-[calc(var(--sat,0px)+9%)] px-4 text-center">
        <span className="inline-block border-2 border-amber-300/60 px-2 py-0.5 text-[11px] tracking-[0.2em] text-amber-300 sm:text-xs">저녁에만 문을 여는 온라인 찻집</span>
        <h1 className="mb-1 mt-2 text-[30px] font-bold text-[#fff7e6] sm:text-[40px]" style={{ textShadow: "3px 3px 0 #2b1d1a", letterSpacing: "0.12em" }}>
          無害林
        </h1>
        {/* 한 줄 문구는 휴대폰에서만 */}
        <p className="text-[13px] text-[#f1e3c6] sm:hidden">문을 열면, 따뜻한 차 한 잔이 기다려요</p>
      </div>

      {/* 입장하기 */}
      <div className="absolute inset-x-0 bottom-[calc(var(--sab,0px)+3.5%)] text-center">
        <button
          type="button"
          disabled={disabled}
          onClick={onEnter}
          className="entry-btn inline-flex items-center gap-2 border-4 border-[#2b1d1a] bg-amber-400 px-6 py-2.5 text-base font-bold text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.45),0_0_26px_rgba(251,191,36,0.45)] transition active:translate-y-0.5 sm:text-lg"
          style={{ touchAction: "manipulation", fontFamily: "Galmuri11, sans-serif" }}
        >
          🍵 입장하기
        </button>
      </div>
    </div>
  );
}
