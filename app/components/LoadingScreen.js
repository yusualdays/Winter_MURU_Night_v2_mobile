"use client";

import { useEffect, useState } from "react";
import PixelCharacter from "./PixelCharacter";
import { getLook } from "../lib/session";
import { normalizeLook } from "../lib/pixelCharacter";

// 화면이 넘어가는 동안 보여주는 픽셀 로딩 화면 — 가는 곳(kind)마다 달라요
//  - cafe    : ☕ 찻집 — 차가 담긴 찻잔에 김이 모락모락
//  - gallery : 🖼️ 전시실 — 내 캐릭터가 걸어가요
//  - forest  : 🌳 무해림 — 숲 그림이 옆으로 흐르고, 내 캐릭터가 걸어가요
//  - living  : 🛋️ 거실(은아네 집) — 내 캐릭터가 걸어가요
//  - 아래 막대(게이지)가 차올라요
const KINDS = {
  cafe: { title: "찻집 문을 여는 중", sub: "따뜻한 차를 우리고 있어요", bg: "radial-gradient(circle at 50% 42%, #5b3a29 0%, #2b1d1a 70%)", text: "#f5e6c8", bar: "#c9a23a", frame: "#f5e6c8" },
  gallery: { title: "전시실로 걸어가는 중", sub: "새로운 전시가 기다리고 있어요", bg: "radial-gradient(ellipse at 50% 0%, #fffaf0 0%, #efe8dd 55%, #d9cfc0 100%)", text: "#3b3129", bar: "#c89b5a", frame: "#8a5a2b" },
  forest: { title: "무해림으로 가는 중", sub: "", bg: "linear-gradient(#1d3a32, #0e2420)", text: "#e7f5d8", bar: "#86c26a", frame: "#e7f5d8" },
  living: { title: "은아네 집으로 가는 중", sub: "보일러 돌아가는 중", bg: "radial-gradient(circle at 50% 60%, #7c2d12 0%, #2a1410 70%)", text: "#fde7c7", bar: "#f97316", frame: "#fde7c7" },
};

// 내 캐릭터가 걷는 모습 (꾸민 모습이 없으면 기본 캐릭터)
function Walker({ scale = 5 }) {
  const [look, setLook] = useState(null);
  useEffect(() => {
    try {
      setLook(normalizeLook(getLook() || {}));
    } catch {
      setLook(normalizeLook({}));
    }
  }, []);
  if (!look) return <div style={{ height: 25 * scale }} />;
  return <PixelCharacter look={look} dir="right" moving scale={scale} />;
}

export default function LoadingScreen({ kind = "cafe" }) {
  const K = KINDS[kind] ?? KINDS.cafe;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 overflow-hidden px-4 text-center" style={{ background: K.bg, color: K.text, fontFamily: "Galmuri11, sans-serif" }}>
      <style>{`
        @font-face{font-family:Galmuri11;src:url(/fonts/Galmuri11.woff2) format("woff2");font-weight:400;font-display:swap}
        @font-face{font-family:Galmuri11;src:url(/fonts/Galmuri11-Bold.woff2) format("woff2");font-weight:700;font-display:swap}
        @keyframes load-dot { 0%,100% { opacity: .2 } 50% { opacity: 1 } }
        .load-dot { animation: load-dot 1.2s steps(2, jump-none) infinite; }
        @keyframes load-fill { from { width: 0 } to { width: 100% } }
        .load-fill { animation: load-fill 1.3s steps(14, end) forwards; }
        @keyframes load-steam { 0% { transform: translateY(0) scale(.6); opacity: 0; } 30% { opacity: .85; } 100% { transform: translateY(-30px) scale(1.3); opacity: 0; } }
        .load-steam { animation: load-steam 2.2s ease-out infinite; }
        @keyframes load-scroll { to { transform: translateX(-50%); } }
        .load-layer { animation: load-scroll linear infinite; }
      `}</style>

      {/* 🌳 무해림: 숲 그림이 옆으로 흘러가요 */}
      {kind === "forest" && (
        <div className="pointer-events-none absolute inset-0">
          <div className="load-layer absolute bottom-[12%] left-0 h-[78%] w-[400%] opacity-85" style={{ backgroundImage: "url(/forest/forest_far.png)", backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", imageRendering: "pixelated", animationDuration: "60s" }} />
          <div className="load-layer absolute bottom-[12%] left-0 h-[62%] w-[400%]" style={{ backgroundImage: "url(/forest/forest_mid.png)", backgroundRepeat: "repeat-x", backgroundSize: "auto 100%", imageRendering: "pixelated", animationDuration: "30s" }} />
          <div className="absolute inset-x-0 bottom-0 h-[13%] border-t-4 border-[#46663a] bg-[#2f4a2a]" />
        </div>
      )}

      <div className={`relative z-[1] flex flex-col items-center gap-3 ${kind === "forest" ? "bg-[#0e2420]/70 px-6 py-4" : ""}`}>
        {kind === "cafe" ? (
          /* ☕ 차가 담긴 찻잔 + 김 */
          <div className="relative h-28 w-28">
            <img src="/craft/table_cup_full.png" alt="" className="h-full w-full" style={{ imageRendering: "pixelated" }} onError={(e) => (e.currentTarget.style.display = "none")} />
            {[0, 1, 2].map((i) => (
              <span key={i} className="load-steam absolute top-1 block h-5 w-2.5 rounded-full bg-white/75 blur-[2px]" style={{ left: 38 + i * 14, animationDelay: `${i * 0.6}s` }} />
            ))}
          </div>
        ) : kind !== "forest" ? (
          <Walker />
        ) : null}

        <p className="text-xl font-bold sm:text-2xl">
          {K.title}
          <span className="load-dot">.</span>
          <span className="load-dot" style={{ animationDelay: "0.2s" }}>.</span>
          <span className="load-dot" style={{ animationDelay: "0.4s" }}>.</span>
        </p>
        {K.sub && <p className="-mt-1 text-sm opacity-80">{K.sub}</p>}

        {/* 도트 로딩 막대 (차올라요) */}
        <div className="h-5 w-56 border-4 p-0.5" style={{ borderColor: K.frame }}>
          <div className="load-fill h-full" style={{ background: K.bar }} />
        </div>
      </div>

      {/* 🌳 무해림: 땅 위를 걷는 내 캐릭터 */}
      {kind === "forest" && (
        <div className="absolute bottom-[12%] left-1/2 z-[1] -translate-x-1/2">
          <Walker scale={4} />
        </div>
      )}
    </div>
  );
}
