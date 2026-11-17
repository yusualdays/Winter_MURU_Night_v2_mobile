'use client';

import { useState } from 'react';

// 휴대폰·태블릿용 화면 조작 버튼 (PC에서는 안 보여요)
//  - 걷기: 방향 패드 대신 맵의 가고 싶은 곳을 터치하면 걸어가요 (page.js의 handleMapTap)
//  - 오른쪽 아래: 행동 버튼 = PC의 E키 (가까운 물건 보기 / 앉기 / 일어나기)
//
//  onAction()            : 행동 버튼을 눌렀을 때
//  actionIcon            : 행동 버튼에 보일 아이콘 (가까운 물건이 없으면 null → 흐리게)
//  onEmote(type)         : 😊 버튼에서 표정을 골랐을 때 (PC의 숫자키 1·2·3)
//
// 오른쪽 아래 버튼 자리는 globals.css의 .mhud-* 클래스가 정해요
//   (세로 화면: 아래 → 위 = 행동 / 💬 / 😊 / 🥂 / 📜,  가로 화면: 행동 버튼 왼쪽으로 한 줄)

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


export default function MobileControls({ onAction, actionIcon, onEmote }) {
  const [emoteOpen, setEmoteOpen] = useState(false);

  return (
    <>
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
