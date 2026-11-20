"use client";

import { useEffect } from "react";

// 📜 전시 안내문 (입구 옆에 세워 둔 안내판)
//  - 처음 들어온 손님에게는 안내판 위에 "!"가 통통 → 누르면 바로 안내문이 열려요 (한 번 보면 사라져요: localStorage galleryGuideSeen)
//  - 안내판 자체를 눌러도, 가까이 가서 [📜 전시 안내문]을 눌러도 열려요
//  - 내용은 app/spaceData.js 의 galleryData.guide 에서 고쳐요
export const GUIDE_SEEN_KEY = "galleryGuideSeen";

// 지도 위 안내판 (픽셀 SVG) — at: 안내판 발(받침) 가운데 {x, y} (0~1 비율)
export function GuideBoard({ at, alert, onOpen, mapW = 1600, mapH = 1200 }) {
  const W = 84;
  const H = 120;
  return (
    <div className="absolute" style={{ left: at.x * mapW - W / 2, top: at.y * mapH - H, width: W, height: H, zIndex: alert ? 2450 : 100 + Math.round(at.y * mapH) }}>
      <style>{`@keyframes guide-alert{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>
      <button type="button" onClick={onOpen} aria-label="안내문 보기" className="block h-full w-full cursor-pointer bg-transparent p-0">
        <svg viewBox="0 0 28 40" width="100%" height="100%" shapeRendering="crispEdges">
          {/* 그림자 */}
          <rect x="4" y="37" width="20" height="3" fill="#00000033" />
          {/* 이젤 다리 */}
          <rect x="5" y="22" width="2" height="16" fill="#2b1d1a" />
          <rect x="21" y="22" width="2" height="16" fill="#2b1d1a" />
          <rect x="13" y="24" width="2" height="12" fill="#4a2a16" />
          <rect x="6" y="22" width="1" height="15" fill="#8a5530" />
          <rect x="21" y="22" width="1" height="15" fill="#8a5530" />
          {/* 안내판 */}
          <rect x="1" y="1" width="26" height="25" fill="#2b1d1a" />
          <rect x="2" y="2" width="24" height="23" fill="#6e3b1f" />
          <rect x="3" y="3" width="22" height="21" fill="#f5e6c8" />
          <rect x="3" y="3" width="22" height="4" fill="#5b1420" />
          <rect x="6" y="4" width="16" height="2" fill="#c9a24a" />
          {[9, 12, 15, 18].map((y, i) => (
            <rect key={y} x="5" y={y} width={i === 3 ? 10 : 18} height="1" fill="#8a7a66" />
          ))}
          <rect x="5" y="21" width="2" height="2" fill="#c9a24a" />
          <rect x="21" y="21" width="2" height="2" fill="#c9a24a" />
          {/* 받침 */}
          <rect x="3" y="25" width="22" height="2" fill="#2b1d1a" />
          <rect x="4" y="25" width="20" height="1" fill="#93532d" />
        </svg>
      </button>
      {alert && (
        <div className="absolute bottom-full left-1/2 mb-2 flex w-0 justify-center" style={{ scale: "var(--ui-boost, 1)", transformOrigin: "50% 100%" }}>
          <button
            type="button"
            onClick={onOpen}
            aria-label="안내문 바로 보기"
            className="flex h-[74px] w-[58px] shrink-0 items-center justify-center border-[5px] border-[#2b1d1a] bg-[#facc15] text-[52px] font-black leading-none text-[#2b1d1a] shadow-[5px_5px_0_0_rgba(0,0,0,0.35)] hover:bg-[#fde047]"
            style={{ animation: "guide-alert 0.9s steps(3, jump-none) infinite" }}
          >
            !
          </button>
        </div>
      )}
    </div>
  );
}

// 안내문 내용 (모달 안)
export function GuideContent({ guide = {}, onClose, onSeen }) {
  useEffect(() => {
    onSeen?.(); // 한 번 열어 보면 "!" 끄기
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const steps = guide.steps ?? [];
  return (
    <div className="text-[#f5e6c8]">
      <div className="border-4 border-[#1a110e] bg-[#f5e6c8] p-4 text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]">
        <p className="text-xs font-black tracking-widest text-[#7c2d12]">EXHIBITION</p>
        <p className="mt-0.5 text-xl font-black">{guide.title || "추후 작성 예정"}</p>
        <div className="mt-3 border-t-4 border-dashed border-[#2b1d1a]/15 pt-2">
          <p className="text-xs font-black text-[#7c2d12]">전시의 주제</p>
          <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">{guide.theme || "추후 작성 예정"}</p>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-black text-amber-200">🧭 전시 관람 순서</p>
          <ol className="mt-2 flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 border-4 border-[#1a110e] bg-[#2b1d1a] px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-[#1a110e] bg-amber-400 text-sm font-black text-[#2b1d1a]">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-black">
                    {s.icon} {s.title}
                  </span>
                  {s.desc && <span className="block text-xs leading-relaxed text-white/70">{s.desc}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <button type="button" onClick={onClose} className="mt-4 w-full border-4 border-[#1a110e] bg-amber-400 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
        관람 시작하기 ▶
      </button>
    </div>
  );
}
