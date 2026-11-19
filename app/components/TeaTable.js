"use client";

import { useEffect, useState } from "react";
import { ref, set, update, remove, onDisconnect } from "firebase/database";
import { db } from "../lib/firebase";
import { CRAFT_PENDING_KEY, CRAFT_EVENT, CRAFT_INFO } from "./TeaCraft";
import { CraftImg } from "./CraftImg";

// 🍵 찻집 테이블 주문 (자리에 앉으면 아래쪽 미니 주문 바)
//  - [🍵 차 주문] → 테이블에 다관·찻잔 + 2초 차 따르기(pouring) + 김 → [🍵 한 모금 마시기] (drinking + 🎵/❤️)
//  - [🍡 다식 주문] → 접시에 다식 3개 → [🍡 한 입 먹기] (eating) — 3번 먹으면 빈 접시
//  - Firebase "teaHouse/orders/{자리id}" = { by, tea: { at }, sweets: { left, at } } → 모두의 화면에 같이 보여요
//  - 🍵 다도 체험존에서 만든 다식·말차 → crafted: { kind, stars, left, by } (내가 만든 걸로 먹기·마시기)
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
//  그림 파일(public/craft/table_*.png 등)이 있으면 그 그림, 없으면 코드로 그린 그림
function TeaSet({ tea }) {
  const now = useNow(tea.at);
  const pouring = isPouring(tea, now);
  const cupName = pouring ? "table_cup_empty" : "table_cup_full";
  return (
    <div className="absolute" style={{ left: -34, top: -34, width: 76, height: 52 }}>
      {/* 찻잔 + 김 */}
      <div className="absolute" style={{ left: 38, top: 22, width: 30 }}>
        <CraftImg
          key={cupName}
          name={cupName}
          className="w-full"
          fallback={
            <svg width="22" height="18" viewBox="0 0 7 6" shapeRendering="crispEdges" className="mt-1">
              <rect x="0" y="0" width="6" height="1" fill="#2b1d1a" />
              <rect x="0.3" y="1" width="5.4" height="4" fill="#ffffff" stroke="#2b1d1a" strokeWidth="0.3" />
              {!pouring && <rect x="1" y="1" width="4" height="1" fill="#7a9a55" />}
            </svg>
          }
        />
      </div>
      {!pouring && (
        <div className="absolute" style={{ left: 40, top: 2 }}>
          {[0, 1].map((i) => (
            <span key={i} className="tea-steam absolute h-4 w-2.5 rounded-full bg-white/80 blur-[2px]" style={{ left: 4 + i * 8, animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      )}
      {/* 다관 (따르는 2초 동안 찻잔 쪽으로 기울어져요) */}
      <div className="absolute" style={{ left: pouring ? 10 : 0, top: pouring ? 0 : 12, width: 42, transformOrigin: "80% 70%", transform: pouring ? "rotate(35deg)" : "none", transition: "all 0.3s" }}>
        <CraftImg
          name="table_teapot"
          className="w-full"
          fallback={
            <svg width="30" height="24" viewBox="0 0 10 8" shapeRendering="crispEdges">
              <rect x="3" y="0" width="3" height="1" fill="#2b1d1a" />
              <rect x="1" y="1" width="7" height="6" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.35" />
              <rect x="2" y="2" width="2" height="1" fill="#a7c9b3" />
              <rect x="8" y="2" width="2" height="1" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.3" />
            </svg>
          }
        />
      </div>
      {pouring && <span className="tea-stream absolute block w-1 origin-top bg-[#9bbf6a]" style={{ left: 51, top: 10, height: 18 }} />}
    </div>
  );
}

// 다식 3개 (dasik_piece_1~3.png) — 한 입 먹을 때마다 하나씩 없어져요
const PIECE_POS = [{ x: 14, y: 4 }, { x: 30, y: 2 }, { x: 46, y: 5 }];
function SweetsPlate({ sweets }) {
  const left = Math.max(0, sweets.left ?? 0);
  return (
    <div className="absolute" style={{ left: -32, top: 6, width: 64, height: 36 }}>
      <CraftImg
        name="table_plate"
        className="absolute inset-x-0 bottom-0 w-full"
        fallback={<span className="absolute inset-x-1.5 bottom-1 h-[22px] rounded-[50%] border-[3px] border-[#2b1d1a] bg-white" />}
      />
      {Array.from({ length: left }, (_, i) => (
        <div key={i} className="absolute -translate-x-1/2" style={{ left: PIECE_POS[i].x, top: PIECE_POS[i].y, width: 18 }}>
          <CraftImg
            name={`dasik_piece_${i + 1}`}
            className="w-full"
            fallback={<span className="block h-3.5 w-3.5 border-2 border-[#2b1d1a]" style={{ background: DASIK_COLORS[i % 3], borderRadius: 3, marginTop: 8 }} />}
          />
        </div>
      ))}
    </div>
  );
}

// 체험존에서 만든 다식·말차 (테이블 위) → 게임에서 완성한 그림 그대로
//  말차: matcha_bowl_foam → 다 마시면 matcha_bowl_empty
//  다식: {다식}_done (가래떡은 tteok_done) → 다 먹으면 table_plate
function CraftedDish({ crafted }) {
  const info = CRAFT_INFO[crafted.kind];
  if (!info) return null;
  const left = Math.max(0, crafted.left ?? 0);
  const matcha = crafted.kind === "matcha";
  const name = matcha ? (left ? "matcha_bowl_foam" : "matcha_bowl_empty") : left ? `${crafted.kind}_done` : "table_plate";
  const fallback = matcha ? (
    <div className="relative h-[34px] w-10">
      <span className="absolute inset-x-0 bottom-0 h-6 rounded-b-full border-[3px] border-[#1a110e] bg-[#3d3a36]" />
      <span className="absolute inset-x-1 bottom-4 h-2.5 rounded-[50%]" style={{ background: left ? "#9fd8a8" : "#3d3a36", boxShadow: left ? "inset 0 0 0 2px #e9f8e4" : "none" }} />
    </div>
  ) : (
    <div className="relative h-[34px] w-10">
      <span className="absolute inset-x-0 bottom-0 h-4 rounded-[50%] border-[3px] border-[#2b1d1a] bg-white" />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-lg leading-none">{left ? info.emoji.repeat(Math.min(2, left)) : "·"}</span>
    </div>
  );
  return (
    <div className="absolute flex items-end justify-center" style={{ left: matcha ? 40 : 36, top: matcha ? -14 : -22, width: matcha ? 46 : 56, height: matcha ? 46 : 56 }}>
      <CraftImg key={name} name={name} className="w-full" fallback={fallback} />
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-amber-200 [text-shadow:1px_1px_0_#000]">{"⭐".repeat(crafted.stars || 1)}</span>
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
        if (!o || !st.place || (!o.tea && !o.sweets && !o.crafted)) return null;
        return (
          <div key={st.id} className="pointer-events-none absolute" style={{ left: st.place.x * mapW, top: st.place.y * mapH, zIndex: 2000 }}>
            {o.tea && <TeaSet tea={o.tea} />}
            {o.sweets && <SweetsPlate sweets={o.sweets} />}
            {o.crafted && <CraftedDish crafted={o.crafted} />}
          </div>
        );
      })}
    </>
  );
}

// ---------- 아래쪽 미니 주문 바 ----------
const BTN =
  "flex items-center gap-1 whitespace-nowrap border-4 border-[#1a110e] px-3 py-1.5 text-sm font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none disabled:opacity-50";

export function OrderBar({ seat, order, api, extra = null }) {
  const now = useNow(order?.tea?.at);
  const seatId = seat?.id;
  const nickname = api.nickname;

  // 🍵 체험존에서 만든 다식·말차가 기다리고 있으면 내 테이블에 놓기 (지금 앉아 있거나, 다음에 앉을 때)
  useEffect(() => {
    if (!seatId || !db) return;
    const bring = () => {
      let item = null;
      try {
        item = JSON.parse(localStorage.getItem(CRAFT_PENDING_KEY) || "null");
        localStorage.removeItem(CRAFT_PENDING_KEY);
      } catch {}
      if (!item?.kind || !CRAFT_INFO[item.kind]) return;
      const r = orderRef(seatId);
      update(r, { by: nickname, crafted: { kind: item.kind, stars: item.stars || 1, left: 3, at: Date.now() } }).catch(() => {});
      onDisconnect(r).remove();
      api.showToast?.(`내가 만든 ${CRAFT_INFO[item.kind].name}를 테이블에 놓았어요`, CRAFT_INFO[item.kind].emoji);
    };
    bring();
    window.addEventListener(CRAFT_EVENT, bring);
    return () => window.removeEventListener(CRAFT_EVENT, bring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatId, nickname]);

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

  const crafted = order?.crafted;
  const craftInfo = crafted && CRAFT_INFO[crafted.kind];
  const useCrafted = () => {
    if (!crafted || crafted.left <= 0 || !db) return;
    set(ref(db, `teaHouse/orders/${seat.id}/crafted/left`), crafted.left - 1).catch(() => {});
    api.playAction(crafted.kind === "matcha" ? "drinking" : "eating");
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
        {craftInfo && crafted.left > 0 && (
          <button type="button" onClick={useCrafted} className={`${BTN} bg-[#fde68a] text-[#78350f]`}>
            {craftInfo.emoji} 내가 만든 {crafted.kind === "matcha" ? "말차 마시기" : "다식 먹기"} <span className="bg-[#78350f] px-1 text-[10px] text-white">{crafted.left}</span>
          </button>
        )}
        {/* 📖 공부 집중 모드 켜기/끄기 */}
        {extra}
      </div>
    </div>
  );
}
