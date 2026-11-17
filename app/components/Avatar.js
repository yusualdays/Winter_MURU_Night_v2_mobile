'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import EmoteBubble from './EmoteBubble';
import ChatBubble from './ChatBubble';
import EatingFx from './EatingFx';
import PixelCharacter from './PixelCharacter';
import { GRID_W, GRID_H } from '../lib/pixelCharacter';

// 캐릭터 크기: 18x25 도트를 몇 배로 키울지 (예전 4 → 지금 7, 약 1.75배)
//  - 정수(5, 6, 7, 8...)로 해야 도트가 또렷해요
export const AVATAR_SCALE = 7;
export const AVATAR_WIDTH = GRID_W * AVATAR_SCALE; // 126
export const AVATAR_HEIGHT = GRID_H * AVATAR_SCALE; // 175

// 앉았을 때: 다리(아래 5줄)는 의자·식탁에 가려진 것처럼 숨기고, 몸을 그만큼 내려서 엉덩이를 의자에 붙여요
const SIT_ROWS = 20; // 보이는 줄 수 (25줄 중 위 20줄)
const SIT_H = SIT_ROWS * AVATAR_SCALE; // 보이는 높이
const SIT_DROP = AVATAR_HEIGHT - SIT_H; // 내려가는 만큼

// 픽셀아트 캐릭터 + 닉네임 + 표정 말풍선 + 채팅 말풍선 (+ 앉아서 냠냠)
// dir: "down" | "up" | "left" | "right"
export default function Avatar({
  nickname,
  x,
  y,
  isMoving,
  dir = 'down',
  look,
  smooth = false,
  emote = null,
  chat = null,
  sitting = false,
  isMe = false,
  owner = false, // 사장님 모드: 앞치마 + 닉네임 옆 🍵 배지
  eating = true, // 앉아 있을 때 냠냠 효과 (찻집 단체석에서는 끄기)
  focus = false, // 📖 공부 집중 모드: 머리 위 "📖 집중 중..."
  action = null, // 찻집 식음료 모션 { type: "pouring" | "drinking" | "eating", at }
}) {
  const cheering = emote?.type === 'toast'; // 건배 중이면 잔을 번쩍 드는 포즈

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10"
      style={{
        width: AVATAR_WIDTH,
        height: AVATAR_HEIGHT,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        transition: smooth ? 'transform 0.12s linear' : 'none',
      }}
    >
      {/* 안쪽 전체: 앉으면 SIT_DROP만큼 아래로 (닉네임·말풍선도 머리를 따라 같이 내려가요) */}
      <div
        className="absolute inset-0"
        style={{ transform: sitting ? `translateY(${SIT_DROP}px)` : undefined }}
      >
        {/* 표정/건배 말풍선 (3초) */}
        <AnimatePresence>
          {emote && (
            <EmoteBubble key={emote.id ?? emote.type} type={emote.type} />
          )}
        </AnimatePresence>

        {/* 채팅 말풍선 (5초) — chat = { text, key } */}
        <AnimatePresence>
          {chat && (
            <ChatBubble key={chat.key} text={chat.text} raised={!!emote} />
          )}
        </AnimatePresence>

        {/* 📖 공부 집중 중 표시 (닉네임 위) */}
        {focus && (
          <div className="absolute -top-[68px] left-1/2 -translate-x-1/2 whitespace-nowrap border-2 border-[#1a110e] bg-[#f5e6c8] px-2 py-0.5 text-xs font-black text-[#2b1d1a] shadow-[2px_2px_0_0_rgba(0,0,0,0.4)]" style={{ scale: 'var(--ui-boost, 1)', transformOrigin: '50% 100%' }}>
            📖 집중 중...
          </div>
        )}

        {/* 닉네임 (내 캐릭터는 노란 테두리) */}
        <div
          className={`absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/80 px-3 py-1 text-sm font-bold text-white shadow-lg ring-1 ${
            isMe ? 'ring-amber-300' : 'ring-white/20'
          }`}
          style={{ scale: 'var(--ui-boost, 1)', transformOrigin: '50% 100%' }} // 휴대폰에서는 닉네임을 키워요
        >
          {nickname}
          {owner && <span className="ml-1" title="사장님">🍵</span>}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-900/80" />
        </div>

        {/* 바닥 그림자 (앉아 있을 때는 숨김) */}
        {!sitting && (
          <div className="absolute bottom-0 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-black/30" />
        )}

        {/* 캐릭터 (앉아 있으면 위 20줄만 보여줘요) */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={
            sitting
              ? { top: 0, height: SIT_H, overflow: 'hidden' }
              : { bottom: 0 }
          }
          aria-label={`${nickname}의 캐릭터`}
        >
          <PixelCharacter
            look={look}
            dir={dir}
            moving={isMoving && !cheering && !sitting}
            cheering={cheering}
            scale={AVATAR_SCALE}
          />
          {/* 사장님 앞치마 (캐릭터 그림 위에 겹쳐 그려요) */}
          {owner && <OwnerApron dir={dir} cheering={cheering} />}
        </div>

        {/* 앉아서 냠냠 (음식이 바라보는 쪽에서 통통) */}
        {/* 찻집: 차 따르기 · 마시기 · 다식 먹기 */}
        {action && <ActionFx key={`${action.type}-${action.at}`} action={action} dir={dir} />}

        {sitting && eating && !cheering && (
          <EatingFx side={dir === 'left' ? 'left' : 'right'} />
        )}
      </div>
    </div>
  );
}

// ---------- 사장님 앞치마 ----------
// 캐릭터 그림(18x25 도트)과 같은 칸에 겹쳐 그리는 모던한 캔버스 앞치마 + 가죽 끈
//  - 좌표는 pixelCharacter.js와 같은 "디자인 좌표" (실제 칸 = +1)
const APRON = { base: '#4b5445', shade: '#3a4136', strap: '#c8a27a' };
function apronPixels(dir) {
  const px = [];
  const rect = (x1, y1, x2, y2, c) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) px.push([x + 1, y + 1, c]);
  };
  if (dir === 'up') {
    // 뒷모습: X자 끈 + 허리 리본
    rect(6, 12, 6, 12, APRON.strap);
    rect(7, 13, 8, 13, APRON.strap);
    rect(9, 12, 9, 12, APRON.strap);
    rect(4, 15, 11, 15, APRON.strap);
    rect(7, 16, 8, 16, APRON.strap);
  } else if (dir === 'left' || dir === 'right') {
    // 옆모습(오른쪽 보기 기준): 앞쪽에 앞치마, 등 뒤에 리본
    rect(9, 12, 10, 14, APRON.base);
    rect(5, 15, 10, 15, APRON.strap);
    rect(9, 16, 10, 20, APRON.base);
    rect(9, 20, 10, 20, APRON.shade);
    rect(4, 15, 4, 16, APRON.strap);
  } else {
    // 앞모습: 목끈 + 가슴판 + 허리끈 + 치마 + 주머니
    rect(6, 11, 6, 11, APRON.strap);
    rect(9, 11, 9, 11, APRON.strap);
    rect(6, 12, 9, 14, APRON.base);
    rect(4, 15, 11, 15, APRON.strap);
    rect(5, 16, 10, 20, APRON.base);
    rect(6, 17, 9, 17, APRON.shade);
    rect(5, 20, 10, 20, APRON.shade);
  }
  return px;
}

function OwnerApron({ dir, cheering }) {
  const view = cheering ? 'down' : dir;
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={GRID_W * AVATAR_SCALE}
      height={GRID_H * AVATAR_SCALE}
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      shapeRendering="crispEdges"
      style={{ transform: !cheering && dir === 'left' ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      {apronPixels(view).map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="1.02" height="1.02" fill={c} />
      ))}
    </svg>
  );
}

// ---------- 찻집 식음료 모션 ----------
//  pouring(2초): 다관을 기울여 차 따르기 / drinking(1.6초): 잔을 들어 한 모금 + 🎵·❤️
//  eating(1.6초): 다식을 오물오물 + "냠"
export const ACTION_MS = { pouring: 2000, drinking: 1600, eating: 1600 };
function ActionFx({ action, dir }) {
  const ms = ACTION_MS[action.type] ?? 1600;
  const [alive, setAlive] = useState(() => Date.now() - (action.at ?? 0) < ms + 400);
  useEffect(() => {
    const left = ms - (Date.now() - (action.at ?? 0));
    if (left <= 0) {
      setAlive(false);
      return;
    }
    const t = setTimeout(() => setAlive(false), left);
    return () => clearTimeout(t);
  }, [action, ms]);
  if (!alive) return null;

  // 입 근처 (바라보는 쪽으로 살짝)
  const side = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const mouthX = AVATAR_WIDTH / 2 + side * 26;
  const mouthY = 72;
  const heart = (action.at ?? 0) % 2 === 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3]">
      <style>{`
        @keyframes fx-sip { 0% { transform: translate(0, 34px) rotate(0deg); } 35%, 70% { transform: translate(0, 0) rotate(-28deg); } 100% { transform: translate(0, 34px) rotate(0deg); } }
        @keyframes fx-float { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { opacity: 1; transform: translateY(-14px) scale(1); } 100% { transform: translateY(-60px) scale(1); opacity: 0; } }
        @keyframes fx-chew { 0%, 100% { transform: translateY(0); } 25%, 75% { transform: translateY(-5px); } 50% { transform: translateY(2px); } }
        @keyframes fx-pour { 0% { transform: rotate(0deg); } 25%, 80% { transform: rotate(-40deg); } 100% { transform: rotate(0deg); } }
        @keyframes fx-stream { 0%, 20% { transform: scaleY(0); } 35%, 75% { transform: scaleY(1); } 90%, 100% { transform: scaleY(0); } }
      `}</style>

      {action.type === 'drinking' && (
        <>
          {/* 하얀 찻잔을 입으로 */}
          <svg className="absolute" width="28" height="22" viewBox="0 0 8 6" shapeRendering="crispEdges" style={{ left: mouthX - 14, top: mouthY - 4, animation: 'fx-sip 1.6s ease-in-out both' }}>
            <rect x="0" y="0" width="6" height="1" fill="#2b1d1a" />
            <rect x="0" y="1" width="6" height="4" fill="#ffffff" stroke="#2b1d1a" strokeWidth="0.3" />
            <rect x="1" y="1" width="4" height="1" fill="#7a9a55" />
            <rect x="6" y="2" width="1.5" height="2" fill="none" stroke="#2b1d1a" strokeWidth="0.5" />
          </svg>
          <span className="absolute text-2xl" style={{ left: mouthX + (side >= 0 ? 18 : -46), top: mouthY - 46, animation: 'fx-float 1.6s ease-out 0.3s both' }}>
            {heart ? '❤️' : '🎵'}
          </span>
        </>
      )}

      {action.type === 'eating' && (
        <>
          <span className="absolute h-4 w-4 border-2 border-[#2b1d1a] bg-[#f9a8d4]" style={{ left: mouthX - 8, top: mouthY + 4, borderRadius: 4, animation: 'fx-chew 0.4s steps(2, jump-none) 4' }} />
          <span className="absolute whitespace-nowrap border-2 border-[#2b1d1a] bg-white px-1.5 text-sm font-black text-[#2b1d1a]" style={{ left: mouthX + (side >= 0 ? 16 : -60), top: mouthY - 40, animation: 'fx-float 1.6s ease-out both' }}>
            오물오물
          </span>
        </>
      )}

      {action.type === 'pouring' && (
        <span className="absolute text-3xl" style={{ left: mouthX + (side >= 0 ? 6 : -40), top: mouthY + 30, transformOrigin: '20% 80%', animation: 'fx-pour 2s ease-in-out both' }}>
          🫖
        </span>
      )}
    </div>
  );
}
