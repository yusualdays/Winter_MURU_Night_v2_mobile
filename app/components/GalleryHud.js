"use client";

import { useState } from "react";
import { SettingsPanel } from "./TeaHouseHud";
import { SettingsPopup, ChoiceRow, Section, L_BTN } from "./RoomSettings";

// 🖼️ 전시회 화면 위 UI — 오른쪽 위 ⚙️ 설정 (거실과 같은 모양)
//  - 💡 조명 (나에게만 보여요) · 📖 방명록 바로 열기 · (사장님 모드일 때만) 미리 열기
export const LIGHTS = [
  { id: "day", icon: "☀️", label: "환하게" },
  { id: "warm", icon: "🕯️", label: "은은하게" },
  { id: "spot", icon: "🔦", label: "밤 전시" },
];

export default function GalleryHud({ api, guestbookCount = 0, onOpenGuestbook, light, onLight }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsPopup open={open} setOpen={setOpen} title="⚙️ 전시회 설정">
      <SettingsPanel api={api} noise={false} top={<ChoiceRow title="💡 전시실 조명 (나에게만 보여요)" options={LIGHTS} value={light} onChange={onLight} />}>
        <Section title="📖 방명록">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenGuestbook?.();
            }}
            className={`${L_BTN} w-full py-2 text-sm`}
          >
            방명록 보기 ({guestbookCount})
          </button>
          {api.isOwner && <p className="mt-1.5 text-[11px] text-[#5b3b2a]">🍵 사장님 모드: 방명록의 모든 글을 지울 수 있어요</p>}
        </Section>
      </SettingsPanel>
    </SettingsPopup>
  );
}
