"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, push, remove, onValue, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import PixelModal from "./PixelModal";

// 📌 찻집 게시판 (벽에 걸린 코르크 보드 — public/craft/cafe_board.png)
//  - 📢 공지: 사장님만 쓰고 지울 수 있어요
//  - 📅 달력: 사장님이 모임·행사 날짜를 적으면 달력에 표시돼요 (날짜를 누르면 그날 일정)
//  - 📝 메모: 손님 누구나 포스트잇을 붙일 수 있어요 (내가 붙인 것·사장님은 뗄 수 있어요, 최근 40장)
//  Firebase: teaHouse/board/{notices, events, memos}
const BOX = "border-4 border-[#1a110e] shadow-[3px_3px_0_0_rgba(0,0,0,0.4)]";
const BTN = `${BOX} px-3 py-1.5 text-sm font-black active:translate-y-0.5 active:shadow-none disabled:opacity-50`;
const INPUT = "w-full border-4 border-[#1a110e] bg-[#fdf6e3] px-3 py-2 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400";
const MEMO_COLORS = ["#fde68a", "#fbcfe8", "#bbf7d0", "#bfdbfe", "#fed7aa"];
const PINS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function useList(path, open) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!open || !db) return;
    return onValue(ref(db, path), (snap) => {
      const l = [];
      snap.forEach((c) => {
        const v = c.val();
        if (v) l.push({ id: c.key, ...v });
      });
      setList(l);
    });
  }, [path, open]);
  return list;
}

const Pin = ({ i = 0 }) => (
  <span className="absolute -top-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[#1a110e]" style={{ background: PINS[i % PINS.length] }} />
);

export function BoardModal({ open, onClose, api }) {
  const isOwner = !!api?.isOwner;
  const nickname = api?.nickname || "손님";
  const myId = api?.myId || "";
  const [tab, setTab] = useState("notice");

  const notices = useList("teaHouse/board/notices", open);
  const events = useList("teaHouse/board/events", open);
  const memos = useList("teaHouse/board/memos", open);

  return (
    <PixelModal open={open} onClose={onClose} label="📌 게시판" title="찻집 게시판" width={520}>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {[["notice", "📢 공지"], ["calendar", "📅 달력"], ["memo", "📝 메모"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`${BTN} ${tab === k ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#f5e6c8] text-[#2b1d1a]"}`}>
            {l}
          </button>
        ))}
      </div>
      {/* 코르크 판 */}
      <div className="border-[6px] border-[#5e3d28] p-3" style={{ background: "#9c6b45", backgroundImage: "radial-gradient(rgba(0,0,0,0.12) 1px, transparent 1.5px)", backgroundSize: "7px 7px" }}>
        {tab === "notice" && <Notices list={notices} isOwner={isOwner} nickname={nickname} />}
        {tab === "calendar" && <Calendar list={events} isOwner={isOwner} nickname={nickname} />}
        {tab === "memo" && <Memos list={memos} isOwner={isOwner} nickname={nickname} myId={myId} />}
      </div>
    </PixelModal>
  );
}

// ---------------- 📢 공지 ----------------
function Notices({ list, isOwner, nickname }) {
  const [text, setText] = useState("");
  const sorted = [...list].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const add = (e) => {
    e.preventDefault();
    const t = text.trim().slice(0, 300);
    if (!t || !db) return;
    push(ref(db, "teaHouse/board/notices"), { text: t, by: nickname, at: serverTimestamp() }).catch(() => {});
    setText("");
  };
  return (
    <div className="flex flex-col gap-4 pt-2">
      {sorted.length === 0 && <p className="py-6 text-center text-sm font-bold text-white/80">아직 공지가 없어요</p>}
      {sorted.map((n, i) => (
        <div key={n.id} className="relative bg-[#fdf6e3] px-3 pb-2 pt-3 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]" style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}>
          <Pin i={i} />
          <p className="whitespace-pre-line text-sm font-bold leading-relaxed">{n.text}</p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[#2b1d1a]/50">
            <span>{n.at ? new Date(n.at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : ""} · 사장님</span>
            {isOwner && (
              <button type="button" onClick={() => db && remove(ref(db, `teaHouse/board/notices/${n.id}`))} className="font-black text-rose-700">
                떼기 ✕
              </button>
            )}
          </div>
        </div>
      ))}
      {isOwner && (
        <form onSubmit={add} className="flex flex-col gap-2 border-t-2 border-white/30 pt-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300} placeholder="공지 내용 (사장님만 보여요)" className={INPUT} />
          <button type="submit" className={`${BTN} bg-amber-400 text-[#2b1d1a]`}>📌 공지 붙이기</button>
        </form>
      )}
    </div>
  );
}

// ---------------- 📅 달력 ----------------
function Calendar({ list, isOwner, nickname }) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [picked, setPicked] = useState(() => dayKey(new Date()));
  const [title, setTitle] = useState("");
  const today = dayKey(new Date());
  const byDay = useMemo(() => {
    const m = {};
    list.forEach((e) => {
      if (e.date) (m[e.date] ||= []).push(e);
    });
    return m;
  }, [list]);

  const y = view.getFullYear();
  const mo = view.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const add = (e) => {
    e.preventDefault();
    const t = title.trim().slice(0, 40);
    if (!t || !picked || !db) return;
    push(ref(db, "teaHouse/board/events"), { date: picked, title: t, by: nickname, at: serverTimestamp() }).catch(() => {});
    setTitle("");
  };
  const dayEvents = byDay[picked] ?? [];
  const [py, pm, pd] = picked.split("-").map(Number);
  // 다가오는 일정 (오늘부터)
  const upcoming = [...list].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#fdf6e3] p-2 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setView(new Date(y, mo - 1, 1))} className="px-2 text-lg font-black" aria-label="이전 달">◀</button>
          <p className="font-black">{y}년 {mo + 1}월</p>
          <button type="button" onClick={() => setView(new Date(y, mo + 1, 1))} className="px-2 text-lg font-black" aria-label="다음 달">▶</button>
        </div>
        <div className="grid grid-cols-7 border-l-2 border-t-2 border-[#2b1d1a]/40 text-center text-[11px] font-black">
          {WEEK.map((w, i) => (
            <span key={w} className={`border-b-2 border-r-2 border-[#2b1d1a]/40 py-0.5 ${i === 0 ? "text-rose-600" : i === 6 ? "text-blue-700" : ""}`}>{w}</span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={i} className="border-b-2 border-r-2 border-[#2b1d1a]/40 bg-black/5" />;
            const k = `${y}-${pad(mo + 1)}-${pad(d)}`;
            const ev = byDay[k];
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(k)}
                className={`relative flex h-11 flex-col items-center border-b-2 border-r-2 border-[#2b1d1a]/40 pt-0.5 text-xs font-bold ${picked === k ? "bg-amber-300" : k === today ? "bg-amber-100" : ""}`}
              >
                {d}
                {ev && <span className="mt-0.5 w-[92%] truncate rounded-sm bg-[#b91c1c] px-0.5 text-[9px] leading-tight text-white">{ev[0].title}</span>}
                {ev && ev.length > 1 && <span className="text-[9px] leading-none text-[#b91c1c]">+{ev.length - 1}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 고른 날 */}
      <div className="relative bg-[#fde68a] px-3 pb-2 pt-3 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">
        <Pin i={1} />
        <p className="text-sm font-black">{pm}월 {pd}일 {WEEK[new Date(py, pm - 1, pd).getDay()]}요일</p>
        {dayEvents.length === 0 ? (
          <p className="mt-1 text-xs text-[#2b1d1a]/60">일정이 없어요</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-sm font-bold">
                <span>📌 {e.title}</span>
                {isOwner && (
                  <button type="button" onClick={() => db && remove(ref(db, `teaHouse/board/events/${e.id}`))} className="text-xs font-black text-rose-700" aria-label="일정 지우기">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <form onSubmit={add} className="mt-2 flex gap-1.5">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="이 날 일정 적기 (예: 독서모임 8시)" className={INPUT} />
            <button type="submit" className={`${BTN} shrink-0 bg-amber-400 text-[#2b1d1a]`}>추가</button>
          </form>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="bg-[#fdf6e3]/90 px-3 py-2 text-[#2b1d1a]">
          <p className="text-xs font-black text-[#7b5236]">다가오는 일정</p>
          <ul className="mt-1 text-sm">
            {upcoming.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => { const [a, b] = e.date.split("-").map(Number); setView(new Date(a, b - 1, 1)); setPicked(e.date); }} className="text-left font-bold">
                  {Number(e.date.slice(5, 7))}/{Number(e.date.slice(8, 10))} · {e.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------- 📝 메모 (포스트잇) ----------------
function Memos({ list, isOwner, nickname, myId }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(MEMO_COLORS[0]);
  const sorted = [...list].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 40);
  const add = (e) => {
    e.preventDefault();
    const t = text.trim().slice(0, 80);
    if (!t || !db) return;
    push(ref(db, "teaHouse/board/memos"), { text: t, color, by: nickname, uid: myId, at: serverTimestamp() }).catch(() => {});
    setText("");
  };
  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="flex flex-col gap-2 bg-black/20 p-2">
        <div className="flex gap-1.5">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="한 줄 메모를 붙여 보세요" className={INPUT} />
          <button type="submit" className={`${BTN} shrink-0 bg-amber-400 text-[#2b1d1a]`}>붙이기</button>
        </div>
        <div className="flex gap-1.5">
          {MEMO_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label="메모 색" className={`h-6 w-6 border-2 ${color === c ? "border-white" : "border-[#1a110e]"}`} style={{ background: c }} />
          ))}
        </div>
      </form>
      {sorted.length === 0 && <p className="py-4 text-center text-sm font-bold text-white/80">첫 메모를 붙여 주세요!</p>}
      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
        {sorted.map((m, i) => {
          const mine = m.uid && m.uid === myId;
          return (
            <div key={m.id} className="relative flex min-h-[84px] flex-col justify-between px-2 pb-1.5 pt-3 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]" style={{ background: m.color || MEMO_COLORS[0], transform: `rotate(${((i * 7) % 5) - 2}deg)` }}>
              <Pin i={i} />
              <p className="break-words text-sm font-bold leading-snug">{m.text}</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#2b1d1a]/60">
                <span className="truncate">{m.by}</span>
                {(mine || isOwner) && (
                  <button type="button" onClick={() => db && remove(ref(db, `teaHouse/board/memos/${m.id}`))} className="font-black text-rose-700" aria-label="메모 떼기">✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
