"use client";

import { useState } from "react";
import { SettingsPanel } from "./TeaHouseHud";

// 🖼️ 전시회 화면 위 UI — 오른쪽 위 ⚙️ 설정 (찻집과 같은 모양)
//  - 🎧 백색소음 · 🔓 미리 열기(호스트·사장님) · 🔑 사장님 인증 (사장님은 방명록 글을 지울 수 있어요)
//  - 📖 방명록 바로 열기 (책상까지 안 걸어가도 돼요)
export default function GalleryHud({ api, guestbookCount = 0, onOpenGuestbook }) {
  const [open, setOpen] = useState(false);
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
        <SettingsPanel api={api} title="⚙️ 전시회 설정">
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
