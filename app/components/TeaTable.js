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
//  모든 물건은 "테이블 상판 위"에만 놓여요 (자리마다 자기 앞 상판 칸)
//   - 2인 테이블(옆으로 앉는 자리): 상판 반쪽에 2줄 — 뒷줄 다관·찻잔 / 앞줄 다식 접시·내가 만든 것
//   - 단체석(위·아래로 앉는 자리): 자기 앞 상판에 한 줄로 나란히
const SIZE = { pot: 32, cup: 26, plate: 38, dasik: 32, matcha: 28 };

// 물건 하나 (cx = 가운데, by = 바닥 높이, w = 폭 · 자리 기준 px)
function Spot({ cx, by, w, z = 0, children }) {
  return (
    <div className="absolute flex items-end justify-center" style={{ left: cx - w / 2, top: by - w, width: w, height: w, zIndex: z }}>
      {children}
    </div>
  );
}

// 자리 모양에 따라 물건 자리 정하기 (side: 1 = 앉은 사람이 오른쪽, -1 = 왼쪽)
function layoutFor(seat, o) {
  const hasTea = !!o.tea;
  const front = [o.sweets && "sweets", o.crafted && "crafted"].filter(Boolean);
  const wOf = (k) => (k === "sweets" ? SIZE.plate : o.crafted?.kind === "matcha" ? SIZE.matcha : o.crafted?.kind === "leaftea" ? SIZE.cup : SIZE.dasik);
  const L = {};
  if (seat.dir === "left" || seat.dir === "right") {
    // 2인 테이블 상판 반쪽 (가로 약 60px · 세로 약 75px)
    const s = seat.dir === "left" ? 1 : -1;
    if (hasTea) {
      L.pot = { cx: -10 * s, by: -12, w: SIZE.pot };
      L.cup = { cx: 18 * s, by: -10, w: SIZE.cup };
    }
    const by = hasTea ? 26 : 10;
    const xs = front.length === 2 ? [-11 * s, 17 * s] : [3 * s];
    front.forEach((k, i) => (L[k] = { cx: xs[i], by, w: wOf(k) }));
    L.flip = s < 0; // 왼쪽 사람: 다관 주둥이가 왼쪽(찻잔 쪽)을 보게
  } else {
    // 단체석: 한 줄로 나란히 (다관 · 찻잔 · 접시 · 내가 만든 것)
    const row = [];
    if (hasTea) row.push(["pot", SIZE.pot], ["cup", SIZE.cup]);
    front.forEach((k) => row.push([k, wOf(k)]));
    const gap = 3;
    const total = row.reduce((t, [, w]) => t + w, 0) + gap * (row.length - 1);
    let x = -total / 2;
    row.forEach(([k, w]) => {
      L[k] = { cx: x + w / 2, by: k === "cup" ? -2 : 0, w };
      x += w + gap;
    });
    L.flip = false;
  }
  return L;
}

function TeaPot({ at, flip }) {
  const now = useNow(at);
  const pouring = isPouring({ at }, now);
  return (
    <div className="h-full w-full" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <div className="h-full w-full" style={{ transformOrigin: "60% 95%", transform: pouring ? "translate(5px,-4px) rotate(32deg)" : "none", transition: "transform 0.3s" }}>
        <CraftImg
          name="table_teapot"
          className="w-full"
          fallback={
            <svg width="100%" viewBox="0 0 10 8" shapeRendering="crispEdges" style={{ marginTop: "25%" }}>
              <rect x="3" y="0" width="3" height="1" fill="#2b1d1a" />
              <rect x="1" y="1" width="7" height="6" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.35" />
              <rect x="2" y="2" width="2" height="1" fill="#a7c9b3" />
              <rect x="8" y="2" width="2" height="1" fill="#7aa58a" stroke="#2b1d1a" strokeWidth="0.3" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function TeaCup({ at, spot }) {
  const now = useNow(at);
  const pouring = isPouring({ at }, now);
  const name = pouring ? "table_cup_empty" : "table_cup_full";
  return (
    <>
      <CraftImg
        key={name}
        name={name}
        className="w-full"
        fallback={
          <svg width="100%" viewBox="0 0 7 6" shapeRendering="crispEdges">
            <rect x="0" y="0" width="6" height="1" fill="#2b1d1a" />
            <rect x="0.3" y="1" width="5.4" height="4" fill="#ffffff" stroke="#2b1d1a" strokeWidth="0.3" />
            {!pouring && <rect x="1" y="1" width="4" height="1" fill="#7a9a55" />}
          </svg>
        }
      />
      {/* 쪼르르 (따르는 2초) / 김 (다 따른 뒤) */}
      {pouring ? (
        <span className="tea-stream absolute left-1/2 block w-[3px] origin-top -translate-x-1/2 bg-[#9bbf6a]" style={{ top: -spot.w * 0.55, height: spot.w * 0.9 }} />
      ) : (
        [0, 1].map((i) => (
          <span key={i} className="tea-steam absolute h-3.5 w-2 rounded-full bg-white/80 blur-[2px]" style={{ left: spot.w * 0.2 + i * 7, top: -8, animationDelay: `${i * 0.6}s` }} />
        ))
      )}
    </>
  );
}

// 다식 3개 (dasik_piece_1~3.png) — 한 입 먹을 때마다 하나씩 없어져요
function SweetsPlate({ sweets, w }) {
  const left = Math.max(0, sweets.left ?? 0);
  const piece = Math.round(w * 0.36); // 다식 3개가 접시 안에 쏙 들어가는 크기
  const xs = [0.34, 0.5, 0.66];
  return (
    <div className="relative h-full w-full">
      <CraftImg
        name="table_plate"
        className="absolute inset-x-0 bottom-0 w-full"
        fallback={<span className="absolute inset-x-0 bottom-0.5 h-[45%] rounded-[50%] border-[3px] border-[#2b1d1a] bg-white" />}
      />
      {Array.from({ length: left }, (_, i) => (
        <div key={i} className="absolute -translate-x-1/2" style={{ left: `${xs[i] * 100}%`, bottom: w * (i === 1 ? 0.36 : 0.3), width: piece }}>
          <CraftImg
            name={`dasik_piece_${i + 1}`}
            className="w-full"
            fallback={<span className="mx-auto block border-2 border-[#2b1d1a]" style={{ width: piece * 0.75, height: piece * 0.75, background: DASIK_COLORS[i % 3], borderRadius: 3 }} />}
          />
        </div>
      ))}
    </div>
  );
}

// 체험존에서 만든 다식·말차 → 게임에서 완성한 그림 그대로
//  말차: matcha_bowl_foam → 다 마시면 matcha_bowl_empty
//  다식: {다식}_done (가래떡은 tteok_done) → 다 먹으면 table_plate
function CraftedDish({ crafted }) {
  const info = CRAFT_INFO[crafted.kind];
  if (!info) return null;
  const left = Math.max(0, crafted.left ?? 0);
  const matcha = crafted.kind === "matcha";
  const leaf = crafted.kind === "leaftea"; // 🍃 내가 우린 잎차 → 찻잔
  const name = leaf ? (left ? "table_cup_full" : "table_cup_empty") : matcha ? (left ? "matcha_bowl_foam" : "matcha_bowl_empty") : left ? `${crafted.kind}_done` : "table_plate";
  const fallback = matcha ? (
    <div className="relative h-[70%] w-full">
      <span className="absolute inset-x-0 bottom-0 h-[70%] rounded-b-full border-[3px] border-[#1a110e] bg-[#3d3a36]" />
      <span className="absolute inset-x-1 top-0 h-[35%] rounded-[50%]" style={{ background: left ? "#9fd8a8" : "#3d3a36", boxShadow: left ? "inset 0 0 0 2px #e9f8e4" : "none" }} />
    </div>
  ) : (
    <div className="relative h-[70%] w-full">
      <span className="absolute inset-x-0 bottom-0 h-[50%] rounded-[50%] border-[3px] border-[#2b1d1a] bg-white" />
      <span className="absolute bottom-[25%] left-1/2 -translate-x-1/2 text-sm leading-none">{left ? info.emoji : "·"}</span>
    </div>
  );
  return (
    <>
      <CraftImg key={name} name={name} className="w-full" fallback={fallback} />
      <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black leading-none text-amber-200 [text-shadow:1px_1px_0_#000]">{"⭐".repeat(crafted.stars || 1)}</span>
    </>
  );
}

// 지도 위: 주문이 있는 자리마다 테이블에 놓기 (seats의 place 좌표, 0~1 비율)
export function TableItems({ orders = {}, seats = [], mapW, mapH }) {
  return (
    <>
      <style>{`
        @keyframes tea-steam-rise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 30% { opacity: 0.8; } 100% { transform: translateY(-18px) scale(1.3); opacity: 0; } }
        .tea-steam { animation: tea-steam-rise 1.8s ease-out infinite; }
        @keyframes tea-stream-grow { 0%, 15% { transform: translateX(-50%) scaleY(0); } 35%, 85% { transform: translateX(-50%) scaleY(1); } 100% { transform: translateX(-50%) scaleY(0); } }
        .tea-stream { animation: tea-stream-grow ${POUR_MS}ms ease-in-out both; }
      `}</style>
      {seats.map((st) => {
        const o = orders[st.id];
        if (!o || !st.place || (!o.tea && !o.sweets && !o.crafted)) return null;
        const L = layoutFor(st, o);
        return (
          <div key={st.id} className="pointer-events-none absolute" style={{ left: st.place.x * mapW, top: st.place.y * mapH, zIndex: 2000 }}>
            {L.pot && <Spot {...L.pot} z={1}><TeaPot at={o.tea.at} flip={L.flip} /></Spot>}
            {L.cup && <Spot {...L.cup} z={2}><TeaCup at={o.tea.at} spot={L.cup} /></Spot>}
            {L.sweets && <Spot {...L.sweets} z={3}><SweetsPlate sweets={o.sweets} w={L.sweets.w} /></Spot>}
            {L.crafted && <Spot {...L.crafted} z={4}><CraftedDish crafted={o.crafted} /></Spot>}
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
    api.playAction(crafted.kind === "matcha" || crafted.kind === "leaftea" ? "drinking" : "eating");
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
            {craftInfo.emoji} 내가 만든 {crafted.kind === "matcha" ? "말차 마시기" : crafted.kind === "leaftea" ? "백차 마시기" : "다식 먹기"} <span className="bg-[#78350f] px-1 text-[10px] text-white">{crafted.left}</span>
          </button>
        )}
        {/* 📖 공부 집중 모드 켜기/끄기 */}
        {extra}
      </div>
    </div>
  );
}
