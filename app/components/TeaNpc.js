"use client";

import { useEffect, useState } from "react";
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
//  scale: 도트 1칸 크기 (기본 7 = 손님 캐릭터와 같은 크기)
export function TeaNpc({ x, y, z, scale = NPC_SCALE }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x, top: y, width: 18 * scale, height: 25 * scale, zIndex: z }}>
      <DayeonSprite scale={scale} />
    </div>
  );
}

// 타자 치듯 한 글자씩 나오는 대사 (done이면 바로 전부)
function Typewriter({ text, done, onDone }) {
  const [n, setN] = useState(done ? text.length : 0);
  useEffect(() => {
    if (done) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        clearInterval(t);
        onDone?.();
      }
    }, 32);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, done]);
  return (
    <>
      {text.slice(0, n)}
      {/* 자리 맞춤용 (말풍선 크기가 처음부터 다 나온 크기로) */}
      <span className="invisible">{text.slice(n)}</span>
    </>
  );
}

// 다연 머리 위: 첫 방문 "!" · 짧은 인사 말풍선 · 이용 안내 대화 (게임처럼 한 줄씩)
//  - alert: 첫 방문이면 true → 커다란 "!" (누르면 onAlert)
//  - bubble: { text, key } 잠깐 뜨는 인사
//  - talk: { lines, index } 이용 안내 대화 → onNext(다음) / onSkip(그만 듣기)
export function TeaNpcLabel({ x, y, bubble, width = NPC_W, alert = false, onAlert, talk, onNext, onSkip }) {
  const [typed, setTyped] = useState(false);
  const line = talk ? talk.lines[talk.index] : null;
  const last = talk ? talk.index >= talk.lines.length - 1 : false;
  useEffect(() => setTyped(false), [talk?.index, !!talk]);

  return (
    <div className="pointer-events-none absolute" style={{ left: x + width / 2, top: y, zIndex: 2500 }}>
      <style>{`
        @keyframes npc-alert { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        .npc-alert { animation: npc-alert 0.9s steps(3, jump-none) infinite; }
      `}</style>

      <div className="absolute bottom-[14px] left-0 flex w-0 justify-center" style={{ scale: "var(--ui-boost, 1)", transformOrigin: "50% 100%" }}>
        {/* 🍵 이용 안내 대화 (말풍선을 누르면 다음 대사) */}
        {line ? (
          <div className="relative flex w-[380px] shrink-0 flex-col">
            <button
              type="button"
              onClick={() => (typed ? onNext?.() : setTyped(true))}
              className="pointer-events-auto relative border-4 border-[#2b1d1a] bg-white px-4 pb-2 pt-2.5 text-left text-lg font-bold leading-snug text-[#2b1d1a] shadow-[5px_5px_0_0_rgba(0,0,0,0.3)]"
            >
              <span className="mb-1 block text-xs font-black text-[#3f6212]">🍵 다연 · {talk.index + 1}/{talk.lines.length}</span>
              <Typewriter key={talk.index} text={line} done={typed} onDone={() => setTyped(true)} />
              <span className={`mt-1 block text-right text-sm font-black ${typed ? "animate-pulse text-[#b45309]" : "text-transparent"}`}>{last ? "끝 ✓" : "다음 ▶"}</span>
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[12px] border-t-[12px] border-x-transparent border-t-[#2b1d1a]" />
            </button>
            {!last && (
              <button type="button" onClick={onSkip} className="pointer-events-auto absolute -top-9 right-0 border-2 border-[#2b1d1a] bg-[#f5e6c8] px-2 py-0.5 text-xs font-black text-[#2b1d1a]">
                건너뛰기 ⏭
              </button>
            )}
          </div>
        ) : alert ? (
          /* ❗ 첫 방문: 커다란 느낌표 (누르면 이용 안내 시작) */
          <button
            type="button"
            onClick={onAlert}
            aria-label="다연에게 이용 방법 듣기"
            className="npc-alert pointer-events-auto flex h-[74px] w-[58px] shrink-0 items-center justify-center border-[5px] border-[#2b1d1a] bg-[#facc15] text-[52px] font-black leading-none text-[#2b1d1a] shadow-[5px_5px_0_0_rgba(0,0,0,0.35)] hover:bg-[#fde047]"
          >
            !
          </button>
        ) : (
          /* 잠깐 뜨는 인사 말풍선 */
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
        )}
      </div>
    </div>
  );
}
