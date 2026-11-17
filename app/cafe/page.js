"use client";

import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { cafeData } from "../spaceData";

// ☕ 온라인 찻집 (처음 들어오는 곳)
//  - 위쪽 가운데 문 → 🛋️ 거실 / 오른쪽 문 → 🖼️ 전시장
//  - 그림은 아직 코드로 그린 임시 그림이에요. 배경 그림이 생기면 CafeScene을 그림 한 장으로 바꾸면 돼요
//  - 좌표는 모두 0~1 비율 (x: 왼쪽→오른쪽, y: 위→아래)
const MAP_W = 1600;
const MAP_H = 1200;
const WALL_H = 0.24; // 위쪽 벽 높이

// 테이블 (가운데 좌표) — 의자는 테이블 양옆에 그려져요
const TABLES = [
  { x: 0.2, y: 0.62 },
  { x: 0.2, y: 0.86 },
  { x: 0.8, y: 0.86 },
  { x: 0.78, y: 0.36 },
];

const BLOCKERS = [
  { x: 0, y: 0, w: 1, h: WALL_H }, // 위쪽 벽
  { x: 0.04, y: WALL_H, w: 0.3, h: 0.14 }, // 카운터
  ...TABLES.map((t) => ({ x: t.x - 0.085, y: t.y - 0.035, w: 0.17, h: 0.06 })), // 테이블 + 의자
  { x: 0, y: 0.9, w: 0.06, h: 0.1 }, // 왼쪽 아래 화분
  { x: 0.94, y: 0.9, w: 0.06, h: 0.1 }, // 오른쪽 아래 화분
];

const SPOTS = [
  { id: "menu", rect: { x: 0.26, y: 0.05, w: 0.13, h: 0.13 }, near: { x: 0.24, y: 0.44 }, icon: "☕", title: "오늘의 메뉴" },
];

const EXITS = [
  { to: "living", zone: { x: 0.43, y: 0.22, w: 0.14, h: 0.04 } }, // 위쪽 문
  { to: "gallery", zone: { x: 0.965, y: 0.5, w: 0.035, h: 0.18 } }, // 오른쪽 문
];

// 시작 위치 (발 가운데) — 어느 문으로 들어왔는지에 따라
const SPAWNS = {
  default: { x: 0.5, y: 0.92 }, // 입장 (아래쪽 현관)
  living: { x: 0.5, y: 0.3 }, // 거실에서 내려옴 → 위쪽 문 앞
  gallery: { x: 0.92, y: 0.6 }, // 전시장에서 돌아옴 → 오른쪽 문 앞
};

const pct = (r) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
const OUTLINE = "#2b1d1a";

// 문 위 나무 표지판
function Sign({ children, style }) {
  return (
    <div className="absolute flex items-center justify-center whitespace-nowrap border-4 px-3 py-0.5 text-xl font-black text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]" style={{ borderColor: OUTLINE, background: "#f5e6c8", ...style }}>
      {children}
    </div>
  );
}

// 둥근 테이블 + 양옆 의자
function Table({ x, y }) {
  return (
    <div className="absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {/* 의자 */}
      {[-1, 1].map((side) => (
        <div key={side} className="absolute border-4" style={{ left: side * 98 - 26, top: -30, width: 52, height: 64, borderColor: OUTLINE, background: "#8a5a3b", boxShadow: "inset 0 -10px 0 #6e4530" }} />
      ))}
      {/* 테이블 */}
      <div className="absolute rounded-full border-[5px]" style={{ left: -72, top: -50, width: 144, height: 96, borderColor: OUTLINE, background: "#d9a066", boxShadow: "inset 0 -12px 0 #b97d48, 0 10px 0 rgba(0,0,0,0.18)" }} />
      <div className="absolute text-3xl" style={{ left: -34, top: -32 }}>☕</div>
      <div className="absolute text-2xl" style={{ left: 8, top: -26 }}>🍪</div>
    </div>
  );
}

// 코드로 그린 임시 찻집
function CafeScene() {
  return (
    <div className="absolute inset-0">
      {/* 나무 바닥 */}
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, #c08a57 0 56px, #b37c4a 56px 60px), #c08a57" }} />
      <div className="absolute inset-0 opacity-40" style={{ background: "repeating-linear-gradient(90deg, transparent 0 236px, #9c6a3c 236px 240px)" }} />

      {/* 러그 */}
      <div className="absolute border-[6px]" style={{ ...pct({ x: 0.38, y: 0.5, w: 0.24, h: 0.32 }), borderColor: "#7a2e2e", background: "repeating-linear-gradient(45deg, #b0484a 0 16px, #a03e40 16px 32px)", boxShadow: "inset 0 0 0 10px #d9a066" }} />

      {/* 위쪽 벽 (세로 줄무늬 벽지 + 아래 나무 판넬) */}
      <div className="absolute left-0 top-0 w-full" style={{ height: `${WALL_H * 100}%`, background: "repeating-linear-gradient(90deg, #8fa98a 0 40px, #86a081 40px 80px)" }} />
      <div className="absolute left-0 w-full" style={{ top: `${(WALL_H - 0.06) * 100}%`, height: "6%", background: "#7b5236", boxShadow: "inset 0 6px 0 #946545, inset 0 -8px 0 #5e3d28" }} />

      {/* 창문 2개 (밤하늘) */}
      {[0.62, 0.82].map((x) => (
        <div key={x} className="absolute border-[6px]" style={{ ...pct({ x, y: 0.035, w: 0.12, h: 0.12 }), borderColor: "#f5e6c8", background: "linear-gradient(#1e2a5a, #3b4a8a)", boxShadow: `0 0 0 4px ${OUTLINE}` }}>
          <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#f5e6c8]" />
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-[#f5e6c8]" />
          <span className="absolute h-1.5 w-1.5 bg-white" style={{ left: "20%", top: "25%" }} />
          <span className="absolute h-1.5 w-1.5 bg-white" style={{ left: "70%", top: "65%" }} />
          <span className="absolute h-2 w-2 bg-amber-100" style={{ left: "75%", top: "18%" }} />
        </div>
      ))}

      {/* 메뉴판 (칠판) */}
      <div className="absolute flex flex-col items-center gap-2 border-[6px] pt-2" style={{ ...pct(SPOTS[0].rect), borderColor: "#7b5236", background: "#2f4a3a", boxShadow: `0 0 0 4px ${OUTLINE}` }}>
        <span className="text-lg font-black tracking-widest text-[#f5e6c8]">MENU</span>
        {[80, 60, 70, 50].map((w, i) => (
          <span key={i} className="h-1.5 bg-[#f5e6c8]/70" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* 위쪽 가운데 문 → 거실 */}
      <div className="absolute border-[6px]" style={{ ...pct({ x: 0.44, y: 0.05, w: 0.12, h: WALL_H - 0.05 }), borderColor: OUTLINE, background: "#6e4530", boxShadow: "inset 0 0 0 8px #85563b" }}>
        <div className="absolute left-1/2 top-[14%] h-[30%] w-[56%] -translate-x-1/2 border-4" style={{ borderColor: OUTLINE, background: "#f9d58a" }} />
        <div className="absolute right-[14%] top-[58%] h-3 w-3 rounded-full bg-amber-300" />
      </div>
      <Sign style={{ left: "50%", top: "1%", transform: "translateX(-50%)" }}>⬆ 🛋️ 거실</Sign>

      {/* 카운터 + 커피 머신 */}
      <div className="absolute border-[6px]" style={{ ...pct({ x: 0.04, y: WALL_H, w: 0.3, h: 0.14 }), borderColor: OUTLINE, background: "#8a5a3b", boxShadow: "inset 0 22px 0 #d9a066, inset 0 28px 0 #b97d48" }}>
        <div className="absolute border-4" style={{ left: "8%", top: -46, width: 80, height: 70, borderColor: OUTLINE, background: "#9ca3af", boxShadow: "inset 0 -14px 0 #6b7280" }} />
        <div className="absolute text-4xl" style={{ left: "44%", top: -34 }}>🍰</div>
        <div className="absolute text-4xl" style={{ left: "70%", top: -34 }}>🧁</div>
      </div>

      {/* 테이블 */}
      {TABLES.map((t, i) => (
        <Table key={i} {...t} />
      ))}

      {/* 화분 */}
      {[0.03, 0.97].map((x) => (
        <div key={x} className="absolute -translate-x-1/2 text-[72px] leading-none" style={{ left: `${x * 100}%`, top: "88%" }}>🪴</div>
      ))}

      {/* 오른쪽 문 → 전시장 */}
      <div className="absolute border-[6px]" style={{ ...pct({ x: 0.975, y: 0.5, w: 0.025, h: 0.18 }), borderColor: OUTLINE, background: "#6e4530" }} />
      <Sign style={{ right: "3.5%", top: "44%" }}>🖼️ 전시장 ➡</Sign>

      {/* 아래쪽 현관 매트 */}
      <div className="absolute flex items-center justify-center border-4 text-sm font-black tracking-[0.3em] text-[#f5e6c8]" style={{ ...pct({ x: 0.43, y: 0.955, w: 0.14, h: 0.045 }), borderColor: OUTLINE, background: "#7a2e2e" }}>
        WELCOME
      </div>
    </div>
  );
}

export default function CafePage() {
  return (
    <SimpleRoom
      roomId="cafe"
      roomName="☕ 찻집"
      welcome="위쪽 문 = 🛋️ 거실 · 오른쪽 문 = 🖼️ 전시장"
      mapW={MAP_W}
      mapH={MAP_H}
      outside="#3b2a20"
      blockers={BLOCKERS}
      spots={SPOTS}
      exits={EXITS}
      spawns={SPAWNS}
      renderModals={(openId, close) => (
        <PixelModal open={openId === "menu"} onClose={close} label="☕ 찻집" title="오늘의 메뉴" width={460}>
          <ul className="flex flex-col gap-3">
            {cafeData.menu.map((m) => (
              <li key={m.name} className="flex gap-3 border-4 border-[#1a110e] bg-[#f5e6c8] p-3 text-[#2b1d1a]">
                <span className="text-3xl leading-none">{m.emoji}</span>
                <div>
                  <p className="font-black">{m.name}</p>
                  <p className="text-sm text-[#2b1d1a]/70">{m.description}</p>
                </div>
              </li>
            ))}
          </ul>
          {cafeData.note && <p className="mt-4 text-sm text-amber-100/80">{cafeData.note}</p>}
        </PixelModal>
      )}
    >
      <CafeScene />
    </SimpleRoom>
  );
}
