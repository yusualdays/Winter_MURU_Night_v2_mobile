"use client";

import { useEffect, useState } from "react";
import { ref, set, update, remove, onDisconnect } from "firebase/database";
import { db } from "../lib/firebase";

// 🍵 찻집 테이블 주문 (자리에 앉으면 아래쪽 미니 주문 바)
//  - [🍵 차 주문] → 테이블에 다관·찻잔 + 2초 차 따르기(pouring) + 김 → [🍵 한 모금 마시기] (drinking + 🎵/❤️)
//  - [🍡 다식 주문] → 접시에 다식 3개 → [🍡 한 입 먹기] (eating) — 3번 먹으면 빈 접시
//  - Firebase "teaHouse/orders/{자리id}" = { by, tea: { at }, sweets: { left, at } } → 모두의 화면에 같이 보여요
//    (자리에서 일어나거나 창을 닫으면 치워져요)
export const POUR_MS = 2000;
const SWEETS = 3;
const DASIK_COLORS = ["#f9a8d4", "#fde047", "#86efac"];

const orderRef = (seatId) => ref(db, `teaHouse/orders/${seatId}`);
const isPouring = (tea, now) => !!tea && now - (tea.at ?? 0) < POUR_MS;

// 자리를 뜰 때 테이블 치우기
export function clearOrder(seatId) {
  if (db && seatId) remove(orderRef(seatId)).catch(() => {});
}

// 2초 차 따르기가 끝나면 다시 그리기
function useNow(watch) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    const stop = setTimeout(() => clearInterval(t), POUR_MS + 600);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [watch]);
  return now;
}

// ---------- 테이블 위 다관·찻잔·다식 접시 ----------
function TeaSet({ tea }) {
  const now = useNow(tea.at);
  const pouring = isPouring(tea, now);
  return (
    <div className="absolute" style={{ left: -30, top: -26, width: 60, height: 40 }}>
      {/* 찻잔 + 김 */}
      <svg className="absolute" width="22" height="18" viewBox="0 0 7 6" shapeRendering="crispEdges" style={{ left: 30, top: 18 }}>
        <rect x="0" y="0" width="6" height="1" fill="#2b1d1a" />
        <rect x="0.3" y="1" width="5.4" height="4" fill="#ffffff" stroke="#2b1d1a" strokeWidth="0.3" />
        {!pouring && <rect x="1" y="1" width="4" height="1" fill="#7a9a55" />}
      </svg>
      {!pouring && (
        <div className="absolute" style={{ left: 30, top: -6 }}>
          {[0, 1].map((i) => (
            <span key={i} className="tea-steam absolute h-4 w-2.5 rounded-full bg-white/80 blur-[2px]" style={{ left: 4 + i * 8, animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      )}
      {/* 다관 (따르는 2초 동안 기울어져요) */}
      <div className="absolute" style={{ left: pouring ? 8 : 0, top: pouring ? 0 : 12, transformOrigin: "80% 70%", transform: pouring ? "rotate(-35deg)" : "none", transition: "all 0.3s" }}>
        <svg width="30" height="24" viewBox="0 0 10 8" shapeRendering="crispEdges">
          <rect x="3" y="0" width="3" height="1" fill="#2b1d1a" />
          <rect x="1" y="1" width="7" height="6" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.35" />
          <rect x="2" y="2" width="2" height="1" fill="#a7c9b3" />
          <rect x="8" y="2" width="2" height="1" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.3" />
        </svg>
        {pouring && <span className="tea-stream absolute block w-1 origin-top bg-[#9bbf6a]" style={{ left: 30, top: 10, height: 20 }} />}
      </div>
    </div>
  );
}

function SweetsPlate({ sweets }) {
  const left = Math.max(0, sweets.left ?? 0);
  return (
    <div className="absolute" style={{ left: -26, top: 14, width: 52, height: 22 }}>
      <span className="absolute inset-0 rounded-[50%] border-[3px] border-[#2b1d1a] bg-white" />
      {Array.from({ length: left }, (_, i) => (
        <span key={i} className="absolute h-3.5 w-3.5 border-2 border-[#2b1d1a]" style={{ left: 8 + i * 12, top: 3, background: DASIK_COLORS[i % 3], borderRadius: 3 }} />
      ))}
      {left === 0 && <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-bold text-[#a8a29e]">· · ·</span>}
    </div>
  );
}

// 지도 위: 주문이 있는 자리마다 테이블에 놓기 (seats의 place 좌표, 0~1 비율)
export function TableItems({ orders = {}, seats = [], mapW, mapH }) {
  return (
    <>
      <style>{`
        @keyframes tea-steam-rise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 30% { opacity: 0.8; } 100% { transform: translateY(-22px) scale(1.3); opacity: 0; } }
        .tea-steam { animation: tea-steam-rise 1.8s ease-out infinite; }
        @keyframes tea-stream-grow { 0% { transform: scaleY(0); } 30%, 85% { transform: scaleY(1); } 100% { transform: scaleY(0); } }
        .tea-stream { animation: tea-stream-grow ${POUR_MS}ms ease-in-out both; }
      `}</style>
      {seats.map((st) => {
        const o = orders[st.id];
        if (!o || !st.place || (!o.tea && !o.sweets)) return null;
        return (
          <div key={st.id} className="pointer-events-none absolute z-[11]" style={{ left: st.place.x * mapW, top: st.place.y * mapH }}>
            {o.tea && <TeaSet tea={o.tea} />}
            {o.sweets && <SweetsPlate sweets={o.sweets} />}
          </div>
        );
      })}
    </>
  );
}

// ---------- 아래쪽 미니 주문 바 ----------
const BTN =
  "flex items-center gap-1 whitespace-nowrap border-4 border-[#1a110e] px-3 py-1.5 text-sm font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none disabled:opacity-50";

export function OrderBar({ seat, order, api }) {
  const now = useNow(order?.tea?.at);
  if (!seat) return null;
  const tea = order?.tea;
  const sweets = order?.sweets;
  const pouring = isPouring(tea, now);

  const save = (patch) => {
    if (!db) return;
    const r = orderRef(seat.id);
    update(r, { by: api.nickname, ...patch }).catch(() => {});
    onDisconnect(r).remove(); // 창을 닫으면 치우기
  };
  const orderTea = () => {
    save({ tea: { at: Date.now() } });
    api.playAction("pouring");
  };
  const drink = () => api.playAction("drinking");
  const orderSweets = () => save({ sweets: { left: SWEETS, at: Date.now() } });
  const eat = () => {
    if (!sweets || sweets.left <= 0 || !db) return;
    set(ref(db, `teaHouse/orders/${seat.id}/sweets/left`), sweets.left - 1).catch(() => {});
    api.playAction("eating");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sab,0px)+1rem)] z-[37] flex justify-center px-20">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 border-4 border-[#1a110e] bg-[#2b1d1a]/95 px-3 py-2 shadow-[5px_5px_0_0_rgba(0,0,0,0.35)]">
        <span className="hidden text-xs font-bold text-amber-200 sm:inline">🪑 {seat.group === "share" ? "단체석" : "2인석"}</span>
        {!tea ? (
          <button type="button" onClick={orderTea} className={`${BTN} bg-[#bbf7d0] text-[#14532d]`}>
            🍵 차 주문
          </button>
        ) : (
          <button type="button" onClick={drink} disabled={pouring} className={`${BTN} bg-[#bbf7d0] text-[#14532d]`}>
            {pouring ? "🫖 차 따르는 중…" : "🍵 한 모금 마시기"}
          </button>
        )}
        {!sweets || sweets.left <= 0 ? (
          <button type="button" onClick={orderSweets} className={`${BTN} bg-[#fbcfe8] text-[#831843]`}>
            🍡 {sweets ? "다식 또 주문" : "다식 주문"}
          </button>
        ) : (
          <button type="button" onClick={eat} className={`${BTN} bg-[#fbcfe8] text-[#831843]`}>
            🍡 한 입 먹기 <span className="bg-[#831843] px-1 text-[10px] text-white">{sweets.left}</span>
          </button>
        )}
      </div>
    </div>
  );
}
