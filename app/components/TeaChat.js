"use client";

import { useEffect, useRef, useState } from "react";
import { ref, set, remove, onValue, push, onDisconnect, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";

// 🍵 수락 기반 1:1 찻자리 채팅
//  - 다른 사람 캐릭터를 누르면 [🍵 대화 신청하기] (나나 상대가 📖 집중 모드면 막혀요)
//  - 상대 화면 오른쪽 위에 [수락 / 정중히 거절] 알림 → 수락하면 둘만 보는 픽셀 채팅창
//
// Firebase "teaChat"
//   requests/{받는ID}/{보낸ID} = { fromNick, at }         (대화 신청)
//   replies/{보낸ID}           = { byNick, reason }        (거절·바쁨 답장 → 보낸 사람이 읽고 지워요)
//   active/{내ID}              = { room, withId, withNick } (지금 대화 중인 찻자리)
//   rooms/{room}/msgs          = { by, text, at }           (둘만의 대화, 창을 닫으면 지워져요)

const BOX = "border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]";
const BTN = `${BOX} px-3 py-1.5 text-sm font-black active:translate-y-0.5 active:shadow-none disabled:opacity-50`;
const REQUEST_MS = 30000; // 30초 동안 답이 없으면 신청 취소
const FOCUS_MSG = "📖 지금은 집중 공부 중이라 대화를 걸 수 없어요";

const REASON_TEXT = {
  decline: "님이 정중히 거절했어요. 다음에 함께 차 한잔해요 🍂",
  focus: "님은 지금 집중 공부 중이에요 📖",
  busy: "님은 다른 분과 찻자리 중이에요 🍵",
  timeout: "님이 지금은 답이 없어요. 잠시 후 다시 신청해 보세요",
};

export default function TeaChat({ myId, nickname, focus, others, picked, setPicked, pickedPos, showToast }) {
  const [incoming, setIncoming] = useState([]); // [{ fromId, fromNick }]
  const [pending, setPending] = useState(null); // { toId, toNick }
  const [active, setActive] = useState(null); // { room, withId, withNick }
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { focus, active, pending };

  // 받은 신청 (집중 중이거나 대화 중이면 자동으로 답장)
  useEffect(() => {
    if (!db || !myId) return;
    const r = ref(db, `teaChat/requests/${myId}`);
    onDisconnect(r).remove();
    return onValue(r, (snap) => {
      const list = [];
      snap.forEach((c) => {
        const v = c.val();
        if (!v) return;
        const { focus: f, active: a } = stateRef.current;
        if (f || a) {
          set(ref(db, `teaChat/replies/${c.key}`), { byNick: nickname, reason: f ? "focus" : "busy", at: Date.now() }).catch(() => {});
          remove(ref(db, `teaChat/requests/${myId}/${c.key}`)).catch(() => {});
          return;
        }
        list.push({ fromId: c.key, fromNick: v.fromNick || "손님" });
      });
      setIncoming(list);
    });
  }, [myId, nickname]);

  // 거절 답장
  useEffect(() => {
    if (!db || !myId) return;
    const r = ref(db, `teaChat/replies/${myId}`);
    return onValue(r, (snap) => {
      const v = snap.val();
      if (!v) return;
      remove(r).catch(() => {});
      setPending(null);
      showToast?.(`${v.byNick || "상대"}${REASON_TEXT[v.reason] || REASON_TEXT.decline}`, "🍵");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // 지금 대화 중인 찻자리
  useEffect(() => {
    if (!db || !myId) return;
    const r = ref(db, `teaChat/active/${myId}`);
    onDisconnect(r).remove();
    return onValue(r, (snap) => {
      const v = snap.val();
      const prev = stateRef.current.active;
      if (!v && prev) showToast?.(`${prev.withNick}님과의 찻자리가 끝났어요`, "🍵");
      if (v) setPending(null);
      setActive(v?.room ? v : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // 둘만의 메시지
  useEffect(() => {
    if (!db || !active?.room) {
      setMsgs([]);
      return;
    }
    return onValue(ref(db, `teaChat/rooms/${active.room}/msgs`), (snap) => {
      const list = [];
      snap.forEach((c) => {
        list.push({ id: c.key, ...c.val() });
      });
      setMsgs(list.slice(-80));
    });
  }, [active?.room]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs]);

  // 집중 모드를 켜면: 보낸 신청 취소 + 받은 신청 정중히 넘기기
  useEffect(() => {
    if (!focus || !db) return;
    if (pending) cancelRequest();
    incoming.forEach((q) => reply(q.fromId, "focus"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // 보낸 신청이 30초 동안 답이 없으면 취소
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      cancelRequest();
      showToast?.(`${pending.toNick}${REASON_TEXT.timeout}`, "🍵");
    }, REQUEST_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const sendRequest = (toId, toNick) => {
    if (!db || focus || active) return;
    const r = ref(db, `teaChat/requests/${toId}/${myId}`);
    set(r, { fromNick: nickname, at: serverTimestamp() }).catch(() => {});
    onDisconnect(r).remove();
    setPending({ toId, toNick });
    setPicked(null);
    showToast?.(`${toNick}님에게 찻자리를 청했어요. 답을 기다리는 중…`, "🍵");
  };
  const cancelRequest = () => {
    const p = stateRef.current.pending;
    if (p && db) remove(ref(db, `teaChat/requests/${p.toId}/${myId}`)).catch(() => {});
    setPending(null);
  };
  const reply = (fromId, reason) => {
    if (!db) return;
    set(ref(db, `teaChat/replies/${fromId}`), { byNick: nickname, reason, at: Date.now() }).catch(() => {});
    remove(ref(db, `teaChat/requests/${myId}/${fromId}`)).catch(() => {});
  };
  const accept = (q) => {
    if (!db) return;
    if (!others[q.fromId]) {
      remove(ref(db, `teaChat/requests/${myId}/${q.fromId}`)).catch(() => {});
      showToast?.(`${q.fromNick}님이 자리를 떠났어요`, "🍂");
      return;
    }
    const room = [myId, q.fromId].sort().join("_");
    const mine = ref(db, `teaChat/active/${myId}`);
    const theirs = ref(db, `teaChat/active/${q.fromId}`);
    set(mine, { room, withId: q.fromId, withNick: q.fromNick }).catch(() => {});
    set(theirs, { room, withId: myId, withNick: nickname }).catch(() => {});
    onDisconnect(theirs).remove(); // 내가 창을 닫아도 상대 찻자리가 정리돼요
    onDisconnect(ref(db, `teaChat/rooms/${room}`)).remove();
    push(ref(db, `teaChat/rooms/${room}/msgs`), { by: "", text: `${nickname}님과 ${q.fromNick}님의 찻자리가 열렸어요 🍵`, at: Date.now() }).catch(() => {});
    // 나머지 신청은 "대화 중"으로 넘기기
    incoming.filter((x) => x.fromId !== q.fromId).forEach((x) => reply(x.fromId, "busy"));
    remove(ref(db, `teaChat/requests/${myId}/${q.fromId}`)).catch(() => {});
  };
  const leave = () => {
    if (!db || !active) return;
    remove(ref(db, `teaChat/active/${active.withId}`)).catch(() => {});
    remove(ref(db, `teaChat/active/${myId}`)).catch(() => {});
    remove(ref(db, `teaChat/rooms/${active.room}`)).catch(() => {});
  };
  const send = (e) => {
    e.preventDefault();
    const t = text.trim().slice(0, 300);
    if (!t || !db || !active) return;
    push(ref(db, `teaChat/rooms/${active.room}/msgs`), { by: nickname, text: t, at: Date.now() }).catch(() => {});
    setText("");
  };

  // 상대가 방을 나가면 찻자리 정리
  useEffect(() => {
    if (active && !others[active.withId]) {
      const t = setTimeout(() => {
        if (stateRef.current.active?.withId === active.withId) leave();
      }, 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, others]);

  const target = picked ? others[picked] : null;
  const targetFocus = !!target?.focus;
  const blocked = focus || targetFocus;

  return (
    <>
      {/* 캐릭터를 누르면 뜨는 [🍵 대화 신청하기] */}
      {target && pickedPos && (
        <div
          className="fixed z-[45] w-56 -translate-x-1/2 -translate-y-full"
          style={{ left: pickedPos.x + pickedPos.w / 2, top: Math.max(130, pickedPos.y - 12) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={`${BOX} bg-[#2b1d1a] p-3 text-white`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="truncate font-black text-amber-200">{target.nickname || "손님"}님</span>
              <button type="button" onClick={() => setPicked(null)} aria-label="닫기" className="px-1 text-white/70">✕</button>
            </div>
            <button
              type="button"
              disabled={blocked || !!active || (pending && pending.toId === picked)}
              onClick={() => sendRequest(picked, target.nickname || "손님")}
              className={`${BTN} w-full bg-[#bbf7d0] text-[#14532d]`}
            >
              {pending?.toId === picked ? "⏳ 답을 기다리는 중…" : "🍵 대화 신청하기"}
            </button>
            {blocked && <p className="mt-2 text-xs font-bold leading-relaxed text-amber-100">{FOCUS_MSG}{focus && !targetFocus ? " (내 집중 모드를 끄면 신청할 수 있어요)" : ""}</p>}
            {!blocked && active && <p className="mt-2 text-xs text-white/70">지금은 {active.withNick}님과 찻자리 중이에요</p>}
          </div>
          <span className="mx-auto block h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-[#1a110e]" />
        </div>
      )}

      {/* 받은 신청 알림 (오른쪽 위) */}
      {incoming.length > 0 && !active && (
        <div className="safe-right fixed top-[calc(var(--sat,0px)+5rem)] z-[46] flex w-[min(19rem,calc(100vw-2rem))] flex-col gap-2">
          {incoming.map((q) => (
            <div key={q.fromId} className={`${BOX} tea-chat-pop bg-[#f5e6c8] p-3 text-[#2b1d1a]`}>
              <p className="text-sm font-black">🍵 {q.fromNick}님이 찻자리를 청했어요</p>
              <p className="mt-0.5 text-xs text-[#2b1d1a]/70">둘만 조용히 이야기를 나눠요</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => accept(q)} className={`${BTN} flex-1 bg-emerald-400 text-[#14532d]`}>수락</button>
                <button type="button" onClick={() => reply(q.fromId, "decline")} className={`${BTN} flex-1 bg-[#6e4530] text-white`}>정중히 거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 보낸 신청 (기다리는 중) */}
      {pending && !active && (
        <div className="fixed bottom-[calc(var(--sab,0px)+5.5rem)] left-1/2 z-[44] -translate-x-1/2">
          <div className={`${BOX} flex items-center gap-2 bg-[#2b1d1a] px-3 py-2 text-sm font-bold text-amber-100`}>
            ⏳ {pending.toNick}님의 답을 기다리는 중…
            <button type="button" onClick={cancelRequest} className="border-2 border-white/30 px-2 text-xs">취소</button>
          </div>
        </div>
      )}

      {/* 둘만의 1:1 찻자리 채팅창 */}
      {active && (
        <div className="safe-left fixed bottom-[calc(var(--sab,0px)+1rem)] z-[46] flex h-[min(26rem,60vh)] w-[min(21rem,calc(100vw-2rem))] flex-col border-4 border-[#1a110e] bg-[#3b2a20] shadow-[6px_6px_0_0_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between border-b-4 border-[#1a110e] bg-[#7b5236] px-3 py-2">
            <span className="truncate font-black text-[#f5e6c8]">🍵 {active.withNick}님과의 찻자리</span>
            <button type="button" onClick={leave} className="border-2 border-[#1a110e] bg-[#f5e6c8] px-2 text-xs font-black text-[#2b1d1a]">자리 뜨기</button>
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3" style={{ background: "repeating-linear-gradient(0deg,#3b2a20 0 22px,#362619 22px 24px)" }}>
            {msgs.map((m) =>
              !m.by ? (
                <p key={m.id} className="text-center text-xs font-bold text-amber-200/80">{m.text}</p>
              ) : (
                <div key={m.id} className={`flex ${m.by === nickname ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] border-[3px] border-[#1a110e] px-2.5 py-1.5 text-sm leading-snug ${m.by === nickname ? "bg-[#bbf7d0] text-[#14532d]" : "bg-[#f5e6c8] text-[#2b1d1a]"}`}>
                    <span className="whitespace-pre-wrap break-words">{m.text}</span>
                  </div>
                </div>
              )
            )}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t-4 border-[#1a110e] bg-[#2b1d1a] p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              maxLength={300}
              placeholder="조용히 이야기를 건네요…"
              className="min-w-0 flex-1 border-[3px] border-[#1a110e] bg-[#fdf6e3] px-2 py-1.5 text-sm text-[#2b1d1a] outline-none"
            />
            <button type="submit" className={`${BTN} bg-amber-400 text-[#2b1d1a]`}>보내기</button>
          </form>
        </div>
      )}
      <style>{`@keyframes tea-chat-pop-k { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } } .tea-chat-pop { animation: tea-chat-pop-k 0.25s ease-out; }`}</style>
    </>
  );
}
