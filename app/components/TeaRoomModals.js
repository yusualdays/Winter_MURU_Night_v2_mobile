"use client";

import { useEffect, useState } from "react";
import { ref, push, onValue, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { partyData } from "../data";
import PixelModal from "./PixelModal";
import { NoiseMixer } from "./FocusMode";
import { DayeonSprite } from "./TeaNpc";
import { VolumeRow } from "./RoomSettings";

// ☕ 찻집 벽면 오브젝트 창 모음
//  - CounterModal  : 카운터 앞 → [🍵 차림표 보기] [🍡 다식·말차 만들기] [💬 다연에게 말 걸기]
//  - SpeakerModal  : 스피커 → 🎵 BGM 켜기/볼륨 + 🎧 백색소음 믹서
//  - BookmarkModal : 책장 → 🔖 교환 독서 책갈피 (Firebase teaHouse/bookmarks — 한 줄 남기고, 남의 책갈피 뽑아가기)
//  - ShowroomModal : 다구 판매존 선반 → 🫖 다구 쇼룸 (data.js teaShowroom) + 스마트스토어 링크

const BOX = "border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]";
const BTN = `${BOX} px-3 py-2 text-sm font-black active:translate-y-0.5 active:shadow-none disabled:opacity-50`;
const INPUT = "w-full border-4 border-[#1a110e] bg-[#fdf6e3] px-3 py-2 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400";
const safeUrl = (u) => (/^https?:\/\//i.test((u || "").trim()) ? u.trim() : "");

// ---------------- 카운터 ----------------
export function CounterModal({ open, onClose, onPick }) {
  return (
    <PixelModal open={open} onClose={onClose} label="🍵 카운터" width={400}>
      {/* 다연이 말풍선으로 인사 */}
      <div className="mb-4 mt-1 flex items-end gap-2">
        <div className="shrink-0">
          <DayeonSprite scale={3} />
        </div>
        <div className="relative mb-8 border-4 border-[#1a110e] bg-white px-4 py-2.5 text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]">
          <p className="text-base font-bold leading-snug">안녕하세요. 주문하시겠어요?</p>
          {/* 말풍선 꼬리 (다연 쪽) */}
          <span className="absolute -left-[14px] bottom-3 border-y-[8px] border-r-[12px] border-y-transparent border-r-[#1a110e]" />
          <span className="absolute -left-[7px] bottom-[14px] border-y-[6px] border-r-[8px] border-y-transparent border-r-white" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => onPick("craft")} className={`${BTN} bg-[#fbcfe8] text-left text-[#831843]`}>🎮 미니게임 하기</button>
        <button type="button" onClick={() => onPick("guide")} className={`${BTN} bg-[#f5e6c8] text-left text-[#2b1d1a]`}>💬 말걸기</button>
      </div>
    </PixelModal>
  );
}

// ---------------- 🎵 스피커: BGM + 백색소음 ----------------
// 찻집 BGM (data.js teaHouseBgm + teaHouseBgmTitle) — 페이지 하나에 오디오 하나. 비워 두면 BGM 칸이 안 보여요
//  - 켜 두면(기본) 찻집에 들어와 화면을 한 번 누른 뒤부터 반복 재생 · 켜기/끄기·소리 크기는 이 기기에 기억 (teaBgmOn, teaBgmVol)
//  - 라디오(스피커) 창과 ⚙️ 찻집 설정 두 곳에서 조절해요
let bgm = null;
const bgmListeners = new Set();
const notifyBgm = () => bgmListeners.forEach((f) => f());
function readPref() {
  try {
    const on = localStorage.getItem("teaBgmOn") !== "0";
    const v = Number(localStorage.getItem("teaBgmVol") ?? 40);
    return { on, vol: Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 40 };
  } catch {
    return { on: true, vol: 40 };
  }
}
const BGM_SRC = partyData.teaHouseBgm || ""; // 비어 있으면 찻집 BGM 없음 (칸도 숨겨요)
export function getBgm() {
  if (typeof window === "undefined" || !BGM_SRC) return null;
  if (!bgm) {
    bgm = new Audio(BGM_SRC);
    bgm.loop = true;
    bgm.volume = readPref().vol / 100;
    bgm.addEventListener("play", notifyBgm);
    bgm.addEventListener("pause", notifyBgm);
  }
  return bgm;
}
export const BGM_TITLE = partyData.teaHouseBgmTitle || "찻집 BGM";

// 찻집에 들어오면: 켜 둔 상태면 첫 터치·키 입력 뒤 재생 / 나가면 멈춤
export function useCafeBgmAutoStart() {
  useEffect(() => {
    const a = getBgm();
    if (!a) return;
    const go = () => {
      if (readPref().on && a.paused) a.play().catch(() => {});
    };
    go();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      a.pause();
    };
  }, []);
}

// 🎵 켜기/끄기 + 소리 크기 (⚙️ 설정: 크림색 VolumeRow · 라디오 창: dark)
export function CafeBgmControl({ dark = false }) {
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(40);
  useEffect(() => {
    const a = getBgm();
    const sync = () => a && setPlaying(!a.paused);
    setVol(readPref().vol);
    sync();
    bgmListeners.add(sync);
    return () => bgmListeners.delete(sync);
  }, []);
  if (!BGM_SRC) return null;
  const toggle = () => {
    const a = getBgm();
    if (!a) return;
    const on = a.paused;
    if (on) a.play().catch(() => {});
    else a.pause();
    try {
      localStorage.setItem("teaBgmOn", on ? "1" : "0");
    } catch {}
  };
  const changeVol = (v) => {
    setVol(v);
    const a = getBgm();
    if (a) a.volume = v / 100;
    try {
      localStorage.setItem("teaBgmVol", String(v));
    } catch {}
  };
  if (!dark) return <VolumeRow icon="🎵" label={BGM_TITLE} playing={playing} onToggle={toggle} volume={vol} onVolume={changeVol} />;
  return (
    <div className="border-2 border-white/15 bg-black/20 p-3">
      <p className="mb-2 truncate text-xs font-black text-amber-200">🎵 {BGM_TITLE}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} className={`${BTN} shrink-0 ${playing ? "bg-[#6e4530] text-white" : "bg-amber-400 text-[#2b1d1a]"}`}>
          {playing ? "⏸ 끄기" : "▶ 켜기"}
        </button>
        <input type="range" min="0" max="100" value={vol} onChange={(e) => changeVol(Number(e.target.value))} className="h-2 min-w-0 flex-1 accent-amber-400" aria-label="BGM 소리" />
        <span className="w-8 text-right text-xs tabular-nums text-white/60">{vol}</span>
      </div>
    </div>
  );
}

export function SpeakerModal({ open, onClose }) {
  return (
    <PixelModal open={open} onClose={onClose} label="🎵 스피커" title="BGM & 백색소음 설정" width={420}>
      <div className="flex flex-col gap-4">
        <CafeBgmControl dark />
        <div className="border-2 border-white/15 bg-black/20 p-3">
          <NoiseMixer />
        </div>
      </div>
    </PixelModal>
  );
}

// ---------------- 🔖 교환 독서 책갈피 ----------------
// 책 제목 + 마음에 남은 한 줄을 책갈피로 꽂아 두면, 다른 손님이 하나씩 뽑아 읽어요
const BM_COLORS = ["#fca5a5", "#fde68a", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8"];
export function BookmarkModal({ open, onClose, nickname }) {
  const [list, setList] = useState([]);
  const [book, setBook] = useState("");
  const [line, setLine] = useState("");
  const [drawn, setDrawn] = useState(null);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!open || !db) return;
    return onValue(ref(db, "teaHouse/bookmarks"), (snap) => {
      const l = [];
      snap.forEach((c) => {
        l.push({ id: c.key, ...c.val() });
      });
      setList(l.reverse().slice(0, 60));
    });
  }, [open]);
  useEffect(() => {
    if (!open) {
      setDrawn(null);
      setSent(false);
    }
  }, [open]);
  const submit = (e) => {
    e.preventDefault();
    if (!book.trim() || !line.trim() || !db) return;
    push(ref(db, "teaHouse/bookmarks"), { by: nickname || "손님", book: book.trim().slice(0, 40), line: line.trim().slice(0, 140), at: serverTimestamp() }).catch(() => {});
    setBook("");
    setLine("");
    setSent(true);
  };
  const draw = () => {
    const pool = list.filter((b) => b.by !== nickname);
    const src = pool.length ? pool : list;
    if (src.length) setDrawn(src[Math.floor(Math.random() * src.length)]);
  };
  return (
    <PixelModal open={open} onClose={onClose} label="📚 책장" title="🔖 교환 독서 책갈피" width={460}>
      <p className="mb-3 text-sm leading-relaxed text-white/80">요즘 읽는 책의 한 줄을 책갈피로 꽂아 두세요. 다른 손님이 뽑아 가서 읽어요.</p>

      <button type="button" onClick={draw} disabled={!list.length} className={`${BTN} w-full bg-amber-400 text-[#2b1d1a]`}>
        🔖 책갈피 하나 뽑기 {list.length ? `(${list.length}장)` : "(아직 없어요)"}
      </button>
      {drawn && (
        <div key={drawn.id} className="relative mx-auto mt-3 w-64 border-4 border-[#1a110e] p-4 pt-6 text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]" style={{ background: BM_COLORS[drawn.id.charCodeAt(drawn.id.length - 1) % BM_COLORS.length] }}>
          <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#1a110e] bg-white" />
          <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed">“{drawn.line}”</p>
          <p className="mt-3 text-right text-xs font-black">— 《{drawn.book}》</p>
          <p className="text-right text-[11px] opacity-70">{drawn.by}님의 책갈피</p>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t-2 border-white/15 pt-3">
        <p className="text-xs font-black text-amber-200">✍️ 내 책갈피 꽂기</p>
        <input value={book} onChange={(e) => setBook(e.target.value)} onKeyDown={(e) => e.stopPropagation()} maxLength={40} placeholder="책 제목" className={INPUT} />
        <textarea value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={(e) => e.stopPropagation()} maxLength={140} rows={2} placeholder="마음에 남은 한 줄 (140자)" className={INPUT} />
        <button type="submit" disabled={!book.trim() || !line.trim()} className={`${BTN} bg-[#bbf7d0] text-[#14532d]`}>
          {sent ? "✅ 꽂았어요! 하나 더 꽂기" : "🔖 책장에 꽂기"}
        </button>
      </form>
    </PixelModal>
  );
}

// ---------------- 🫖 다구 쇼룸 ----------------
export function ShowroomModal({ open, onClose }) {
  const sr = partyData.teaShowroom || {};
  const items = sr.items || [];
  const storeUrl = safeUrl(sr.storeUrl || partyData.teaMenu?.showroomUrl);
  return (
    <PixelModal open={open} onClose={onClose} label="🫖 다구 판매존" title={sr.title || "다구 쇼룸"} width={460}>
      {sr.subtitle && <p className="mb-3 text-sm text-white/80">{sr.subtitle}</p>}
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const url = safeUrl(it.url) || storeUrl;
          const Card = url ? "a" : "div";
          return (
            <Card key={it.name} {...(url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {})} className="flex flex-col gap-1 border-4 border-[#1a110e] bg-[#f5e6c8] p-2.5 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] hover:bg-[#fdf0d5]">
              <span className="text-3xl">{it.emoji}</span>
              <span className="text-sm font-black leading-tight">{it.name}</span>
              {it.price && <span className="text-xs font-bold text-[#7b5236]">{it.price}</span>}
              {it.description && <span className="text-[11px] leading-snug text-[#2b1d1a]/70">{it.description}</span>}
            </Card>
          );
        })}
      </div>
      {storeUrl && (
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={`${BTN} mt-4 block text-center bg-amber-400 text-[#2b1d1a]`}>
          🛍️ 스마트스토어 구경하기 ↗
        </a>
      )}
    </PixelModal>
  );
}
