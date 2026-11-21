"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSound } from "../lib/sound";

// ⚙️ 모든 방 공통 설정창 모양 (거실 설정창과 같은 생김새)
//  - SettingsPopup: 오른쪽 위 픽셀 톱니바퀴 버튼 + 크림색 팝업 (ESC·바깥 누르면 닫혀요)
//  - VolumeRow: ▶/❚❚ 버튼 + 이름 + % + 소리 막대 · ChoiceRow: 3개 중 하나 고르기 · ToggleRow: 켜기/끄기
//  - Section: 점선으로 나눈 칸 · L_INPUT / L_BTN / L_BTN_MAIN: 크림색 창 안의 입력칸·버튼 모양

// 도트 느낌 테두리 (모서리를 계단 모양으로 깎기)
export const PIXEL_CORNERS =
  "polygon(0 6px, 6px 6px, 6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px))";

export const L_INPUT = "w-full border-2 border-[#2b1d1a] bg-white/70 px-2 py-1.5 text-sm text-[#2b1d1a] outline-none placeholder:text-[#5b3b2a]/50 focus:bg-white";
export const L_BTN = "border-2 border-[#2b1d1a] bg-[#efe0c0] px-3 py-1.5 text-xs font-bold text-[#5b3b2a] transition hover:bg-white active:translate-y-px";
export const L_BTN_MAIN = "border-2 border-[#2b1d1a] bg-amber-400 px-3 py-1.5 text-xs font-black text-[#2b1d1a] shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.2)] active:translate-y-px";

// ---------- 픽셀 톱니바퀴 아이콘 ----------
const GEAR = ["...KK...", ".K.KK.K.", "..KKKK..", "KKK..KKK", "KKK..KKK", "..KKKK..", ".K.KK.K.", "...KK..."];
export function PixelGear({ color = "#fde68a" }) {
  return (
    <svg viewBox="0 0 8 8" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true">
      {GEAR.flatMap((row, y) => [...row].map((c, x) => (c === "K" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null)))}
    </svg>
  );
}

// ---------- 볼륨 한 줄 ----------
export function VolumeRow({ icon, label, playing, onToggle, volume, onVolume, disabled, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={`${label} ${playing ? "일시정지" : "재생"}`}
            className={`flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#2b1d1a] text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              playing ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#5b3b2a] text-amber-100 hover:bg-[#6e4833]"
            }`}
          >
            {playing ? "❚❚" : "▶"}
          </button>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#2b1d1a] bg-[#efe0c0] text-lg">{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2 text-xs font-bold text-[#2b1d1a]">
            <span className="truncate">
              {onToggle ? `${icon} ` : ""}
              {label}
            </span>
            <span className="shrink-0 tabular-nums text-[#5b3b2a]">{volume === 0 ? "🔇" : `${volume}%`}</span>
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()} // 놓으면 포커스 해제 → 방향키가 다시 캐릭터로
            aria-label={`${label} 볼륨`}
            className="mt-1 h-6 w-full cursor-pointer accent-[#c8323a] [@media(pointer:fine)]:h-1.5"
          />
        </div>
      </div>
      {hint && <p className="pl-11 text-[11px] text-[#a8433a]">{hint}</p>}
    </div>
  );
}

// ---------- 🔊 소리 (모든 방 공통: 배경음악 · 효과음) ----------
//  한 방에서 바꾸면 다른 방에도 그대로 (lib/sound.js)
export function SoundSection({ bgmHint = "", sfxHint = "" }) {
  const [s, set] = useSound();
  return (
    <div className="flex flex-col gap-3">
      <VolumeRow icon="🎵" label="음악" playing={s.bgmOn} onToggle={() => set({ bgmOn: !s.bgmOn })} volume={s.bgmVol} onVolume={(v) => set({ bgmVol: v, bgmOn: v > 0 ? true : s.bgmOn })} hint={bgmHint} />
      <VolumeRow icon="🔔" label="효과음" playing={s.sfxOn} onToggle={() => set({ sfxOn: !s.sfxOn })} volume={s.sfxVol} onVolume={(v) => set({ sfxVol: v, sfxOn: v > 0 ? true : s.sfxOn })} hint={sfxHint} />
    </div>
  );
}

// ---------- 여러 개 중 하나 고르기 ----------
export function ChoiceRow({ title, options, value, onChange }) {
  return (
    <div>
      {title && <p className="mb-1.5 text-xs font-bold text-[#2b1d1a]">{title}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={(e) => {
                onChange(o.id);
                e.currentTarget.blur();
              }}
              aria-pressed={active}
              className={`flex flex-col items-center gap-0.5 border-2 border-[#2b1d1a] px-1 py-1.5 text-[11px] font-bold leading-tight transition ${
                active ? "bg-amber-400 text-[#2b1d1a] shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.2)]" : "bg-[#efe0c0] text-[#5b3b2a] hover:bg-white"
              }`}
            >
              <span className="text-lg leading-none">{o.icon}</span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 켜기 / 끄기 한 줄 ----------
export function ToggleRow({ icon, label, sub, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#2b1d1a] bg-[#efe0c0] text-lg">{icon}</span>
      <span className="min-w-0 flex-1 text-xs font-bold text-[#2b1d1a]">
        {label}
        {sub && <span className="block text-[11px] font-normal text-[#5b3b2a]">{sub}</span>}
      </span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#c8323a]" />
    </label>
  );
}

// ---------- 점선으로 나눈 칸 ----------
export function Section({ title, children }) {
  return (
    <div className="mt-4 border-t-2 border-dashed border-[#2b1d1a]/25 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      {title && <p className="mb-2 text-sm font-black text-[#2b1d1a]">{title}</p>}
      {children}
    </div>
  );
}

// ---------- ⚙️ 버튼 + 팝업 ----------
//  below: 팝업이 닫혀 있을 때 톱니바퀴 아래에 보여 줄 것 (예: 찻집 집중 모드 타이머)
export function SettingsPopup({ open, setOpen, title = "⚙️ 설정", children, below = null }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, setOpen]);
  return (
    <div ref={ref} className="safe-top safe-right fixed z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="설정"
        aria-expanded={open}
        title="설정"
        className="flex h-12 w-12 items-center justify-center bg-[#2b1d1a] transition hover:scale-105 active:scale-95"
        style={{ clipPath: PIXEL_CORNERS }}
      >
        <span className="flex h-10 w-10 items-center justify-center bg-[#6e4833]" style={{ clipPath: PIXEL_CORNERS }}>
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.3 }} className="flex">
            <PixelGear />
          </motion.span>
        </span>
      </button>
      {!open && below}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-14 w-80 max-w-[calc(100vw-1.5rem)] origin-top-right bg-[#2b1d1a] p-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]"
            style={{ clipPath: PIXEL_CORNERS }}
          >
            <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto bg-[#f5e6c8] p-4" style={{ clipPath: PIXEL_CORNERS, overscrollBehavior: "contain", touchAction: "pan-y" }}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-[#2b1d1a]">{title}</p>
                <button type="button" onClick={() => setOpen(false)} className="h-9 w-9 text-xl leading-none text-[#5b3b2a] hover:text-[#2b1d1a]" aria-label="닫기">
                  ×
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
