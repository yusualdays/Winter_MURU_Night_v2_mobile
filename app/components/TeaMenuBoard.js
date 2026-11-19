"use client";

import { useEffect, useState } from "react";
import { ref, set, remove, push, onValue, query, limitToLast, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { toKey } from "../lib/session";
import { partyData } from "../data";
import PixelModal from "./PixelModal";

// 🍵 세로형 찻집 차림표 + 메뉴 상세 (시장조사)
//  - 메뉴: data.js의 teaMenu.items / 상태(⭐ 추천 · 🍂 소진): 사장님 관리
//  - 상세 창: [❤️ 이 메뉴 꼭 팔아주세요] 투표 (한 사람 한 표, 다시 누르면 취소)
//             [💬 예비 손님 피드백 남기기]
//  - Firebase "menuFeedbacks/{메뉴id}"
//      votes/{닉네임}: true
//      comments/{자동id}: { nickname, text, createdAt }
const MAX_LEN = 150;

const safeUrl = (u) => (/^https?:\/\//i.test((u || "").trim()) ? u.trim() : "");

function MenuDetail({ item, status, nickname, onBack }) {
  const [votes, setVotes] = useState({});
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const me = toKey(nickname || "손님");
  const voted = !!votes[me];
  const voteCount = Object.keys(votes).length;

  useEffect(() => {
    if (!db) return;
    const offVotes = onValue(ref(db, `menuFeedbacks/${item.id}/votes`), (snap) => setVotes(snap.val() || {}));
    const offComments = onValue(query(ref(db, `menuFeedbacks/${item.id}/comments`), limitToLast(30)), (snap) => {
      const list = [];
      snap.forEach((c) => {
        list.push({ id: c.key, ...c.val() });
      });
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setComments(list);
    });
    return () => {
      offVotes();
      offComments();
    };
  }, [item.id]);

  const toggleVote = () => {
    if (!db) return;
    const r = ref(db, `menuFeedbacks/${item.id}/votes/${me}`);
    (voted ? remove(r) : set(r, true)).catch(() => setNotice("저장하지 못했어요. Firebase 규칙을 확인해 주세요."));
  };
  const send = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return setNotice("한 마디 적어 주세요 💬");
    if (!db) return;
    push(ref(db, `menuFeedbacks/${item.id}/comments`), { nickname: nickname || "손님", text: body.slice(0, MAX_LEN), createdAt: serverTimestamp() })
      .then(() => {
        setText("");
        setNotice("소중한 의견 고마워요! 사장님께 꼭 전할게요 🍵");
      })
      .catch(() => setNotice("저장하지 못했어요. Firebase 규칙을 확인해 주세요."));
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-sm font-bold text-amber-200 hover:text-amber-100">
        ← 차림표로
      </button>

      {/* 메뉴 카드 */}
      <div className="border-4 border-[#1a110e] bg-[#f5e6c8] p-4 text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <span className="text-5xl leading-none">{item.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#2b1d1a]/60">{item.category}</p>
            <p className="text-xl font-black">{item.name}</p>
            {item.price && <p className="text-sm font-bold text-[#7c2d12]">{item.price}</p>}
          </div>
          {status === "recommend" && <span className="shrink-0 border-2 border-[#1a110e] bg-amber-400 px-1.5 text-xs font-black">⭐ 오늘의 추천</span>}
          {status === "soldout" && <span className="shrink-0 border-2 border-[#1a110e] bg-[#e7e5e4] px-1.5 text-xs font-black">🍂 재료 소진</span>}
        </div>
        {item.story && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{item.story}</p>}
      </div>

      {/* ❤️ 투표 */}
      <button
        type="button"
        onClick={toggleVote}
        className={`mt-4 flex w-full items-center justify-center gap-2 border-4 border-[#1a110e] py-2.5 font-black shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none ${
          voted ? "bg-rose-400 text-white" : "bg-[#fde2e4] text-[#9f1239] hover:bg-rose-200"
        }`}
      >
        {voted ? "❤️ 투표했어요! (다시 누르면 취소)" : "❤️ 이 메뉴 꼭 팔아주세요"}
        <span className="bg-[#1a110e]/80 px-2 text-sm text-white">{voteCount}</span>
      </button>

      {/* 💬 피드백 */}
      <form onSubmit={send} className="mt-4">
        <p className="text-sm font-bold text-amber-200">💬 예비 손님 피드백 남기기</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setNotice("");
          }}
          maxLength={MAX_LEN}
          rows={2}
          placeholder="예: 매실차에 탄산을 섞은 여름 메뉴도 있으면 좋겠어요! 가격은 5천 원대면 자주 사 먹을 것 같아요."
          className="mt-1.5 w-full resize-none border-4 border-[#1a110e] bg-[#fdf6e3] p-2.5 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">
            {text.length}/{MAX_LEN}
          </span>
          <button type="submit" className="border-4 border-[#1a110e] bg-amber-400 px-4 py-1.5 text-sm font-black text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
            남기기
          </button>
        </div>
        {notice && <p className="mt-1 text-sm text-lime-300">{notice}</p>}
      </form>

      {comments.length > 0 && (
        <div className="mt-4 border-t-4 border-dashed border-white/15 pt-3">
          <p className="mb-2 text-xs font-bold text-white/60">다른 손님들의 의견 {comments.length}개</p>
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <li key={c.id} className="border-2 border-white/15 bg-black/20 px-3 py-2 text-sm">
                <span className="font-bold text-amber-200">{c.nickname}</span>
                <span className="ml-2 whitespace-pre-wrap break-words text-white/85">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TeaMenuBoard({ open, onClose, items = [], menuStatus = {}, nickname }) {
  const [selectedId, setSelectedId] = useState(null);
  const tm = partyData?.teaMenu ?? {};
  const showroom = partyData.shopOpen ? safeUrl(tm.showroomUrl) : ""; // 🛍️ 쇼핑 준비 전이면 숨겨요
  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  // ⭐ 추천은 위로
  const list = items.map((m) => ({ ...m, status: menuStatus[m.id] || "" })).sort((a, b) => (b.status === "recommend") - (a.status === "recommend"));
  const groups = [...new Set(list.map((m) => m.category || "메뉴"))];
  const selected = list.find((m) => m.id === selectedId);

  return (
    <PixelModal open={open} onClose={onClose} label="☕ 군산 온라인 찻집" title={selected ? `${selected.emoji} ${selected.name}` : `🍵 ${tm.title || "차림표"}`} width={460}>
      {selected ? (
        <MenuDetail item={selected} status={selected.status} nickname={nickname} onBack={() => setSelectedId(null)} />
      ) : (
        <>
          {/* 세로형 나무 차림표 */}
          <div className="mx-auto max-w-[360px] border-[6px] border-[#5e3d28] bg-[#f5e6c8] px-4 py-5 text-[#2b1d1a] shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 34px, rgba(94,61,40,0.08) 34px 35px)" }}>
            <p className="text-center text-xs font-bold tracking-[0.3em] text-[#7b5236]">MENU</p>
            {tm.subtitle && <p className="mt-1 text-center text-sm font-bold text-[#7b5236]">{tm.subtitle}</p>}
            {groups.map((g) => (
              <div key={g} className="mt-4">
                <p className="mb-1.5 border-b-2 border-dashed border-[#7b5236]/50 pb-1 text-center text-sm font-black text-[#5e3d28]">· {g} ·</p>
                <ul className="flex flex-col">
                  {list
                    .filter((m) => (m.category || "메뉴") === g)
                    .map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(m.id)}
                          className={`flex w-full items-center gap-2 px-1 py-1.5 text-left hover:bg-[#7b5236]/10 ${m.status === "soldout" ? "opacity-50" : ""}`}
                        >
                          <span className="text-xl">{m.emoji}</span>
                          <span className={`flex-1 font-bold ${m.status === "soldout" ? "line-through" : ""}`}>
                            {m.name}
                            {m.status === "recommend" && <span className="ml-1 text-xs text-amber-600">⭐추천</span>}
                            {m.status === "soldout" && <span className="ml-1 text-xs">🍂소진</span>}
                          </span>
                          {m.price && <span className="text-sm font-bold text-[#7c2d12]">{m.price}</span>}
                          <span className="text-xs text-[#7b5236]">›</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <p className="mt-4 text-center text-[11px] text-[#7b5236]">메뉴를 누르면 이야기와 투표 · 피드백 창이 열려요</p>
          </div>

          {showroom && (
            <a
              href={showroom}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-4 block max-w-[360px] border-4 border-[#1a110e] bg-[#03c75a] py-2 text-center text-sm font-black text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] hover:brightness-110"
            >
              🫖 다구 쇼룸 구경하기 (스마트스토어) ↗
            </a>
          )}
        </>
      )}
    </PixelModal>
  );
}
