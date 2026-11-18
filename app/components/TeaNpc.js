"use client";

import { AnimatePresence, motion } from "framer-motion";

// 🍵 찻집 알바생 NPC '다연' — 순수 SVG 픽셀 그림 (그림 파일 없이 코드로 그려요)
//  - 단정한 린넨 앞치마 + 하얀 찻잔을 들고 행주로 쓱쓱 닦는 반복 애니메이션
//  - 아바타와 같은 크기(18x25 도트 × 7배)라 친구들 캐릭터 옆에 서도 자연스러워요
export const NPC_SCALE = 7;
export const NPC_W = 18 * NPC_SCALE; // 126
export const NPC_H = 25 * NPC_SCALE; // 175

// 글자 하나 = 도트 하나 (. 은 빈칸)
const PALETTE = {
  K: "#2b1d1a", // 테두리
  H: "#4a2c1d", // 머리
  h: "#6b3f28", // 머리 반짝
  S: "#f6d0b1", // 피부
  s: "#e3b08f", // 피부 그림자
  E: "#2b1d1a", // 눈
  P: "#f4a3a3", // 볼터치
  W: "#f5f1ea", // 흰 셔츠
  w: "#ddd6ca", // 셔츠 그림자
  A: "#cbb99c", // 린넨 앞치마
  a: "#b4a283", // 앞치마 그림자·주머니
  L: "#8c7a5f", // 앞치마 끈
  B: "#44403c", // 차콜 슬랙스
  F: "#1c1917", // 구두
};

// 몸 (찻잔·행주를 든 손은 아래에서 따로 그려서 움직여요)
const BODY = [
  "......KKKKKK......",
  ".....KHHHHHHK.....",
  "....KHHHhhHHHK....",
  "...KHHHHHHHHHHK...",
  "..KHHHhHHHHHHHHK..",
  "..KHHHHHHHHHHHHK..",
  "..KHHSSSSSSSSHHK..",
  "..KHSSSSSSSSSSHK..",
  "..KHSSESSSSESSHK..",
  "..KHSSESSSSESSHK..",
  "..KHSPSSSSSSPSHK..",
  "..KHHSSSssSSSHHK..",
  "...KKKSSSSSSKKK...",
  "....KWWKSSKWWK....",
  "...KWWLWKKWLWWK...",
  "..KWWWLAAAALWWWK..",
  "..KWWKAAAAAAKWWK..",
  "..KWWKAAAAAAKWWK..",
  "..KwwKAaaaaAKwwK..",
  "...KKKAAAAAAKKK...",
  ".....KAAAAAAK.....",
  ".....KaAAAAaK.....",
  ".....KBBKKBBK.....",
  ".....KBBKKBBK.....",
  "....KFFFK.KFFFK...",
];

// 하얀 찻잔 (양손으로 받쳐 든 모습)
const CUP = [
  ".KKKKKK.",
  "KCCCCCCK",
  "KCTTTTCK",
  "KCCCCCCKK",
  "KScCCCcSK",
  ".KKKKKK..",
];
const CUP_COLORS = { K: "#2b1d1a", C: "#ffffff", c: "#d4d4d8", T: "#7a9a55", S: "#f6d0b1" };

// 행주 (체크무늬 천)
const CLOTH = ["KKKKK", "KDdDK", "KdDdK", "KKKKK"];
const CLOTH_COLORS = { K: "#2b1d1a", D: "#93c5fd", d: "#eff6ff" };

function Pixels({ rows, colors, x0 = 0, y0 = 0 }) {
  const rects = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = colors[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x0 + x} y={y0 + y} width="1.02" height="1.02" fill={fill} />);
    });
  });
  return rects;
}

// 다연 그림 (scale: 도트 1칸 크기)
export function DayeonSprite({ scale = NPC_SCALE }) {
  return (
    <svg width={18 * scale} height={25 * scale} viewBox="0 0 18 25" shapeRendering="crispEdges" style={{ overflow: "visible" }} aria-hidden="true">
      <style>{`
        @keyframes npc-breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(0.35px); } }
        @keyframes npc-wipe { 0%, 100% { transform: translate(-2px, 0); } 25% { transform: translate(0, -0.6px); } 50% { transform: translate(2px, 0); } 75% { transform: translate(0, 0.6px); } }
        .npc-breathe { animation: npc-breathe 2.4s steps(2, jump-none) infinite; }
        .npc-wipe { animation: npc-wipe 1.1s steps(4, jump-none) infinite; }
      `}</style>
      <g className="npc-breathe">
        <Pixels rows={BODY} colors={PALETTE} />
        {/* 하얀 찻잔 (가슴 앞) */}
        <Pixels rows={CUP} colors={CUP_COLORS} x0={5} y0={14} />
        {/* 행주를 쥔 손 → 찻잔 위를 좌우로 쓱쓱 */}
        <g className="npc-wipe">
          <Pixels rows={CLOTH} colors={CLOTH_COLORS} x0={7} y0={13} />
          <rect x="8" y="16.6" width="2" height="1" fill="#f6d0b1" />
        </g>
      </g>
    </svg>
  );
}

// 지도 위의 다연 (x, y = 그림 왼쪽 위, 맵 좌표)
export function TeaNpc({ x, y, z }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y, width: NPC_W, height: NPC_H, zIndex: z }}>
      <DayeonSprite />
    </div>
  );
}

// 다연의 이름표 + 말풍선 (카운터보다 위에 보이도록 따로 그려요)
export function TeaNpcLabel({ x, y, bubble }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x + NPC_W / 2, top: y, zIndex: 2500 }}>
      {/* 말풍선 */}
      <div className="absolute bottom-[52px] left-0 flex w-0 justify-center">
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble.key}
              initial={{ opacity: 0, y: 10, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className="relative w-max max-w-[340px] shrink-0 border-4 border-[#2b1d1a] bg-white px-4 py-2.5 text-lg font-bold leading-snug text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]"
            >
              {bubble.text}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[10px] border-t-[10px] border-x-transparent border-t-[#2b1d1a]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* 이름표 */}
      <div className="absolute -top-10 left-0 flex w-0 justify-center">
        <span className="shrink-0 whitespace-nowrap rounded-full bg-[#3f6212]/90 px-3 py-1 text-sm font-bold text-white shadow-lg ring-2 ring-lime-200/70">🍵 다연</span>
      </div>
    </div>
  );
}
