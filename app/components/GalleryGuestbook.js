"use client";

import { useEffect, useState } from "react";
import { ref, push, remove, onValue, query, limitToLast, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";

// 📖 전시회 방명록 겸 후기 (왼쪽 아래 책상)
//  - 누구나: 한 마디 + 스티커 + (고르면) 가장 마음에 든 작품
//  - 내가 쓴 글은 내가 지울 수 있고, 🍵 사장님은 모든 글을 지울 수 있어요
//  - 위쪽에 작품별 "💛 마음에 든 작품" 순위가 보여요
//
// Firebase "galleryGuestbook/{자동id}" = { nickname, byId, text, sticker, fav(작품 id | ""), createdAt }
const MAX_LEN = 200;
const SHOW_LAST = 150;
const STICKERS = ["🖼️", "❄️", "☕", "💛", "✨", "🎄", "🌙", "🍊"];
const PAPER = ["#fff7d6", "#fde2e4", "#e0f2fe", "#dcfce7", "#f3e8ff", "#ffedd5"];

const pad = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  if (typeof ms !== "number") return "방금";
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// 같은 글은 항상 같은 종이 색
const paperOf = (id = "") => PAPER[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PAPER.length];

export function useGuestbook() {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    if (!db) return;
    return onValue(query(ref(db, "galleryGuestbook"), limitToLast(SHOW_LAST)), (snap) => {
      const list = [];
      snap.forEach((c) => {
        const v = c.val();
        if (v?.text) list.push({ id: c.key, ...v });
      });
      list.sort((a, b) => (b.createdAt ?? Infinity) - (a.createdAt ?? Infinity));
      setEntries(list);
    });
  }, []);
  return entries;
}

export default function GalleryGuestbook({ entries, artworks, nickname, myId, isOwner }) {
  const [text, setText] = useState("");
  const [sticker, setSticker] = useState(STICKERS[0]);
  const [fav, setFav] = useState("");
  const [notice, setNotice] = useState("");
  const [writing, setWriting] = useState(false);

  const titleOf = Object.fromEntries(artworks.map((a) => [a.id, a.title]));
  const favCount = {};
  for (const e of entries) if (e.fav && titleOf[e.fav]) favCount[e.fav] = (favCount[e.fav] ?? 0) + 1;
  const ranking = Object.entries(favCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const send = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return setNotice("한 마디 적어 주세요 ✍️");
    if (!db) return setNotice("지금은 저장할 수 없어요 (Firebase 연결 확인)");
    push(ref(db, "galleryGuestbook"), { nickname: nickname || "손님", byId: myId || "", text: body.slice(0, MAX_LEN), sticker, fav, createdAt: serverTimestamp() })
      .then(() => {
        setText("");
        setFav("");
        setWriting(false);
        setNotice("방명록에 남겼어요! 와 주셔서 고마워요 🖼️");
      })
      .catch(() => setNotice("저장하지 못했어요. Firebase 규칙을 확인해 주세요."));
  };
  const del = (id) => {
    if (!db || !window.confirm("이 글을 지울까요?")) return;
    remove(ref(db, `galleryGuestbook/${id}`)).catch(() => setNotice("지우지 못했어요."));
  };

  return (
    <div>
      {/* 💛 마음에 든 작품 순위 */}
      {ranking.length > 0 && (
        <div className="mb-3 border-4 border-[#1a110e] bg-[#2b1d1a] px-3 py-2 text-sm text-white">
          <p className="text-xs font-black text-amber-300">💛 손님들이 가장 마음에 들어 한 작품</p>
          <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {ranking.map(([id, n], i) => (
              <li key={id} className="font-bold">
                {["🥇", "🥈", "🥉"][i]} {titleOf[id]} <span className="text-white/60">{n}표</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ✍️ 쓰기 */}
      {writing ? (
        <form onSubmit={send} className="border-4 border-[#1a110e] bg-[#2b1d1a] p-3">
          <p className="text-sm font-black text-amber-200">✍️ 방명록 · 감상 후기 남기기</p>
          <textarea
            value={text}
            autoFocus
            onChange={(e) => {
              setText(e.target.value);
              setNotice("");
            }}
            maxLength={MAX_LEN}
            rows={3}
            placeholder="예: '따뜻한 창가' 보니까 작년 겨울 생각났어요. 초대해 줘서 고마워요!"
            className="mt-1.5 w-full resize-none border-4 border-[#1a110e] bg-[#fdf6e3] p-2.5 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400"
          />
          <div className="text-right text-xs text-white/50">
            {text.length}/{MAX_LEN}
          </div>
          <p className="mt-1 text-xs font-bold text-white/80">스티커</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSticker(s)}
                aria-pressed={sticker === s}
                className={`h-9 w-9 border-4 text-lg ${sticker === s ? "border-amber-400 bg-amber-100" : "border-[#1a110e] bg-[#f5e6c8]"}`}
              >
                {s}
              </button>
            ))}
          </div>
          {artworks.length > 0 && (
            <label className="mt-2 block text-xs font-bold text-white/80">
              💛 가장 마음에 든 작품 (골라도 되고 안 골라도 돼요)
              <select value={fav} onChange={(e) => setFav(e.target.value)} className="mt-1 w-full border-4 border-[#1a110e] bg-[#fdf6e3] px-2 py-1.5 text-sm font-normal text-[#2b1d1a] outline-none">
                <option value="">— 고르지 않기 —</option>
                {artworks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setWriting(false)} className="border-4 border-[#1a110e] bg-[#6e4530] px-3 py-1.5 text-sm font-black text-white">
              취소
            </button>
            <button type="submit" className="border-4 border-[#1a110e] bg-amber-400 px-4 py-1.5 text-sm font-black text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
              남기기
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setWriting(true);
            setNotice("");
          }}
          className="w-full border-4 border-[#1a110e] bg-amber-400 py-2.5 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none"
        >
          ✍️ 방명록 쓰기
        </button>
      )}
      {notice && <p className="mt-2 text-sm font-bold text-lime-300">{notice}</p>}

      {/* 📜 남긴 글들 */}
      <p className="mt-4 text-xs font-bold text-amber-200">
        📜 남겨진 글 {entries.length}개{entries.length >= SHOW_LAST ? ` (최근 ${SHOW_LAST}개)` : ""}
      </p>
      <div className="mt-1.5 grid max-h-[42vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {entries.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/60">아직 아무도 남기지 않았어요. 첫 번째 방문 기록을 남겨 주세요!</p>}
        {entries.map((e) => {
          const mine = e.byId && e.byId === myId;
          return (
            <div key={e.id} className="relative border-4 border-[#1a110e] p-2.5 pb-2 text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]" style={{ background: paperOf(e.id) }}>
              <span className="absolute -right-2 -top-3 text-2xl drop-shadow">{e.sticker || "🖼️"}</span>
              <p className="whitespace-pre-wrap break-words pr-3 text-sm leading-relaxed">{e.text}</p>
              {e.fav && titleOf[e.fav] && <p className="mt-1 text-xs font-bold text-[#9f1239]">💛 {titleOf[e.fav]}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#2b1d1a]/60">
                <span className="font-bold text-[#2b1d1a]/80">— {e.nickname}</span>
                <span className="flex items-center gap-2">
                  {fmt(e.createdAt)}
                  {(mine || isOwner) && (
                    <button type="button" onClick={() => del(e.id)} className="font-bold text-rose-700 underline">
                      지우기
                    </button>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
