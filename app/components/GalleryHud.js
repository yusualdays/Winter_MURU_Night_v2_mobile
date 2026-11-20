"use client";

import { useState } from "react";
import { SettingsPanel } from "./TeaHouseHud";

// 🖼️ 전시회 화면 위 UI — 오른쪽 위 ⚙️ 설정 (찻집과 같은 모양)
//  - 💡 조명 (나에게만 보여요) · 🔓 미리 열기(호스트·사장님)
//  - 📖 방명록 바로 열기 (책상까지 안 걸어가도 돼요)
export const LIGHTS = [
  { id: "day", icon: "☀️", name: "환하게" },
  { id: "warm", icon: "🕯️", name: "은은하게" },
  { id: "spot", icon: "🔦", name: "밤 전시" },
];

export default function GalleryHud({ api, guestbookCount = 0, onOpenGuestbook, light, onLight }) {
  const [open, setOpen] = useState(false);
  const top = (
    <>
      {/* 💡 조명 */}
      <div className="mt-3">
        <p className="text-xs font-black text-amber-200">💡 전시실 조명 <span className="font-bold text-white/50">(나에게만 보여요)</span></p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {LIGHTS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={light === l.id}
              onClick={() => onLight(l.id)}
              className={`border-4 px-1 py-1.5 text-xs font-black ${light === l.id ? "border-amber-400 bg-amber-400 text-[#2b1d1a]" : "border-[#1a110e] bg-[#f5e6c8] text-[#2b1d1a]"}`}
            >
              <span className="block text-lg leading-none">{l.icon}</span>
              {l.name}
            </button>
          ))}
        </div>
      </div>

    </>
  );
  return (
    <div className="safe-top safe-right fixed z-40 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="전시회 설정"
        aria-expanded={open}
        className="flex h-12 w-12 items-center justify-center border-4 border-[#1a110e] bg-[#f5e6c8] text-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none"
      >
        ⚙️
      </button>
      {open && (
        <SettingsPanel api={api} title="⚙️ 전시회 설정" noise={false} top={top}>
          <div className="mt-4 border-t-4 border-dashed border-white/15 pt-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenGuestbook?.();
              }}
              className="w-full border-4 border-[#1a110e] bg-[#f5e6c8] px-3 py-1.5 text-sm font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.35)] active:translate-y-0.5 active:shadow-none"
            >
              📖 방명록 보기 <span className="font-bold text-[#2b1d1a]/60">({guestbookCount})</span>
            </button>
            {api.isOwner && <p className="mt-1.5 text-[11px] text-white/60">🍵 사장님 모드: 방명록의 모든 글을 지울 수 있어요</p>}
          </div>
        </SettingsPanel>
      )}
    </div>
  );
}
