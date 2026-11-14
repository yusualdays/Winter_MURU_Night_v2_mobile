'use client';

import { useRef, useState } from 'react';

// 휴대폰·태블릿용 화면 조작 버튼 (PC에서는 안 보여요)
//  - 왼쪽: 방향 패드 — 누른 채로 손가락을 움직이면 8방향(대각선 포함)으로 걸어요
//  - 오른쪽 옆: 행동 버튼 = PC의 E키 (가까운 물건 보기 / 앉기 / 일어나기)
//
//  onDirs(["up","left"]) : 지금 눌린 방향들 (손을 떼면 [])
//  onAction()            : 행동 버튼을 눌렀을 때
//  actionIcon            : 행동 버튼에 보일 아이콘 (가까운 물건이 없으면 null → 흐리게)
//  onEmote(type)         : 😊 버튼에서 표정을 골랐을 때 (PC의 숫자키 1·2·3)
//
// 오른쪽 아래 버튼 자리는 globals.css의 .mhud-* 클래스가 정해요
//   (세로 화면: 아래 → 위 = 행동 / 💬 / 😊 / 🥂 / 📜,  가로 화면: 행동 버튼 왼쪽으로 한 줄)

const PAD = 138; // 방향 패드 크기 (px)
const DEADZONE = 14; // 가운데에서 이만큼은 안 움직여요

// 손가락 위치 → 방향들
function dirsFrom(dx, dy) {
  if (Math.hypot(dx, dy) < DEADZONE) return [];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // 오른쪽 0°, 아래 90°
  const sector = Math.round(angle / 45); // -4 ~ 4 (8방향)
  return {
    0: ['right'],
    1: ['right', 'down'],
    2: ['down'],
    3: ['left', 'down'],
    4: ['left'],
    '-4': ['left'],
    '-3': ['left', 'up'],
    '-2': ['up'],
    '-1': ['right', 'up'],
  }[sector];
}

// 도트 화살표 하나
function Arrow({ rotate, active }) {
  return (
    <svg
      viewBox="0 0 5 3"
      width="26"
      height="16"
      shapeRendering="crispEdges"
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="0"
        width="1"
        height="1"
        fill={active ? '#2b1d1a' : '#f5e6c8'}
      />
      <rect
        x="1"
        y="1"
        width="3"
        height="1"
        fill={active ? '#2b1d1a' : '#f5e6c8'}
      />
      <rect
        x="0"
        y="2"
        width="5"
        height="1"
        fill={active ? '#2b1d1a' : '#f5e6c8'}
      />
    </svg>
  );
}

// 표정 고르기 (PC의 숫자키 1·2·3)
const EMOTE_CHOICES = [
  { type: 'smile', icon: '😊', label: '웃기' },
  { type: 'heart', icon: '❤️', label: '하트' },
  { type: 'hurray', icon: '🙌', label: '만세' },
];

const buzz = () => {
  try {
    navigator.vibrate?.(8); // 안드로이드: 톡 하는 진동 (아이폰은 지원 안 함)
  } catch {}
};

export default function MobileControls({ onDirs, onAction, actionIcon, onEmote }) {
  const padRef = useRef(null);
  const [dirs, setDirs] = useState([]);
  const [emoteOpen, setEmoteOpen] = useState(false);

  const update = (e) => {
    const rect = padRef.current.getBoundingClientRect();
    const next = dirsFrom(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2)
    );
    setDirs((prev) => (prev.join() === next.join() ? prev : next));
    onDirs(next);
  };
  const release = () => {
    setDirs([]);
    onDirs([]);
  };

  const on = (d) => dirs.includes(d);
  const cell = (d) =>
    `flex items-center justify-center ${
      on(d) ? 'bg-amber-400' : 'bg-[#6e4833]'
    }`;

  return (
    <>
      {/* 방향 패드 (십자 모양) — 왼쪽 아래 */}
      <div
        className="pointer-events-none fixed z-40 select-none"
        style={{
          left: 'calc(var(--sal, 0px) + 0.75rem)',
          bottom: 'calc(var(--sab, 0px) + 1rem)',
          WebkitTouchCallout: 'none',
        }}
      >
        <div
          ref={padRef}
          role="group"
          aria-label="방향 패드"
          className="pointer-events-auto relative grid grid-cols-3 grid-rows-3 opacity-90"
          style={{ width: PAD, height: PAD, touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            update(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span />
          <span className={`${cell('up')} border-4 border-b-0 border-[#1a110e]`}>
            <Arrow rotate={0} active={on('up')} />
          </span>
          <span />
          <span
            className={`${cell('left')} border-4 border-r-0 border-[#1a110e]`}
          >
            <Arrow rotate={-90} active={on('left')} />
          </span>
          <span className="bg-[#6e4833] border-y-4 border-[#1a110e]" />
          <span
            className={`${cell('right')} border-4 border-l-0 border-[#1a110e]`}
          >
            <Arrow rotate={90} active={on('right')} />
          </span>
          <span />
          <span
            className={`${cell('down')} border-4 border-t-0 border-[#1a110e]`}
          >
            <Arrow rotate={180} active={on('down')} />
          </span>
          <span />
        </div>
      </div>

      {/* 행동 버튼 (= E키) — 오른쪽 아래 */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault(); // 버튼에 포커스가 남지 않게
          buzz();
          onAction();
        }}
        aria-label="행동 (E키)"
        className={`mhud mhud-action flex h-[72px] w-[72px] select-none flex-col items-center justify-center rounded-full border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
          actionIcon ? 'bg-amber-400' : 'bg-[#f5e6c8]/60'
        }`}
        style={{ touchAction: 'manipulation' }}
      >
        <span className="text-3xl leading-none">{actionIcon ?? '✋'}</span>
        <span className="text-[10px] font-black text-[#2b1d1a]">E</span>
      </button>

      {/* 😊 표정 버튼 (자리 2번) — 누르면 표정 3개가 펼쳐져요 */}
      <div className="mhud-s select-none" style={{ '--n': 2 }}>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setEmoteOpen((o) => !o);
          }}
          aria-label="표정 고르기"
          aria-expanded={emoteOpen}
          className={`flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#1a110e] text-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
            emoteOpen ? 'bg-amber-400' : 'bg-[#f5e6c8]'
          }`}
          style={{ touchAction: 'manipulation' }}
        >
          😊
        </button>
        {emoteOpen && (
          <div className="emote-pop absolute flex gap-2">
            {EMOTE_CHOICES.map((c) => (
              <button
                key={c.type}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  buzz();
                  onEmote?.(c.type);
                  setEmoteOpen(false);
                }}
                aria-label={c.label}
                className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#1a110e] bg-white text-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none"
                style={{ touchAction: 'manipulation' }}
              >
                {c.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
