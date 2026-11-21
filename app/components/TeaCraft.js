"use client";

import { useEffect, useRef, useState } from "react";
import PixelModal from "./PixelModal";
import { CraftImg, craftSrc, useImgOk } from "./CraftImg";
import { partyData } from "../data";

// 🍡🍵 다도 체험존 미니게임 2종 (그림 파일 없이 CSS/SVG + Web Audio API 효과음만 사용)
//  1) 수제 다식 만들기 (쿠킹마마 스타일): 보늬밤 조림 / 곶감 호두말이 (+ 🍢 가래떡 구이)
//     ① 재료 손질(연타로 점선 따라 껍질 벗기기) → ② 불 조절(초록 구간에서 3번 클릭) → ③ 플레이팅(고명 올리기)
//  2) 말차 격불하기: ① 체 치기(다완 3번 클릭) → ② 온수 붓기(주전자 길게 누르기) → ③ 10초 동안 차선 젓기
//  완성하면 [🪑 내 테이블로 가져가기] → 앉아 있는 자리(지금 또는 다음에 앉을 자리) 테이블에 놓여요
//    (localStorage "teaCraftPending" → TeaTable.js OrderBar가 Firebase teaHouse/orders/{자리}/crafted 로 옮겨요)
//  상품 링크는 data.js teaCraft 에서 바꿔요

export const CRAFT_PENDING_KEY = "teaCraftPending";
export const CRAFT_EVENT = "tea-craft-ready";

const CFG = partyData.teaCraft || {};
const safeUrl = (u) => (/^https?:\/\//i.test((u || "").trim()) ? u.trim() : "");

export const RECIPES = {
  bonibam: {
    name: "군산 보늬밤 조림", emoji: "🌰", peel: "밤 겉껍질 벗기기", cook: "약불에 시럽 조리기", base: "#7a3e1f", light: "#a8643a", shell: "#4a2a17",
  },
  gotgam: {
    name: "곶감 호두말이", emoji: "🍊", peel: "곶감 꼭지 따고 씨 빼기", cook: "호두 살짝 볶기", base: "#d9692a", light: "#f0a05a", shell: "#8a3c14",
  },
  // 🍢 가래떡 구이 — 다른 다식과 진행 방식이 달라요 (썰기 → 석쇠에 굽기 → 조청·콩가루) → TteokGame
  tteok: {
    name: "가래떡 구이", emoji: "🍢", game: "tteok", base: "#e8b04a", light: "#fff4dc", shell: "#8a5a2b",
  },
};
export const CRAFT_INFO = { ...RECIPES, matcha: { name: "내가 격불한 말차", emoji: "🍵", base: "#7fb36a" }, leaftea: { name: "내가 우린 잎차", emoji: "🍃", base: "#c9a23a", drink: true } };

// ---------------- 🔊 Web Audio 효과음 ----------------
let ctx = null;
function ac() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return null;
  }
  return ctx;
}
function tone(freq, ms = 120, type = "sine", vol = 0.15, slide = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + ms / 1000);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + ms / 1000 + 0.02);
}
// 사각사각 (짧은 화이트노이즈 + 고역 필터)
function noise(ms = 90, freq = 3500, vol = 0.25) {
  const a = ac();
  if (!a) return;
  const len = Math.floor((a.sampleRate * ms) / 1000);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq * (0.8 + Math.random() * 0.4);
  f.Q.value = 0.9;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}
const sfx = {
  peel: () => noise(60, 2200, 0.2),
  good: () => { tone(880, 120, "triangle"); setTimeout(() => tone(1320, 160, "triangle"), 90); },
  bad: () => tone(180, 220, "square", 0.08, -60),
  pop: () => tone(600, 90, "sine", 0.18, 400),
  tap: () => noise(120, 900, 0.18),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 220, "triangle", 0.14), i * 120)),
  whisk: () => noise(70, 4200, 0.22),
};
let pourNode = null;
function pourStart() {
  const a = ac();
  if (!a || pourNode) return;
  const len = a.sampleRate * 2;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  const g = a.createGain();
  g.gain.value = 0.12;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  pourNode = src;
}
function pourStop() {
  try { pourNode?.stop(); } catch {}
  pourNode = null;
}

// ---------------- 공통 UI ----------------
const BOX = "border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]";
const BTN = `${BOX} px-3 py-2 text-sm font-black active:translate-y-0.5 active:shadow-none disabled:opacity-50 select-none`;

function Steps({ list, cur }) {
  return (
    <div className="mb-3 flex gap-1">
      {list.map((s, i) => (
        <div key={s} className={`flex-1 border-2 border-[#1a110e] px-1 py-1 text-center text-[11px] font-black ${i < cur ? "bg-emerald-300 text-[#14532d]" : i === cur ? "bg-amber-300 text-[#2b1d1a]" : "bg-black/30 text-white/50"}`}>
          {"①②③"[i]} {s}
        </div>
      ))}
    </div>
  );
}
function Gauge({ value, color = "#34d399", label }) {
  return (
    <div className="w-full">
      {label && <div className="mb-1 flex justify-between text-xs font-bold text-white/80"><span>{label}</span><span>{Math.round(value)}%</span></div>}
      <div className="h-5 w-full border-4 border-[#1a110e] bg-black/40">
        <div className="h-full transition-[width] duration-100" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  );
}
const Stage = ({ children, onPointerDown, onPointerMove, className = "" }) => (
  <div
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    className={`relative mx-auto flex h-56 w-full max-w-[340px] touch-none select-none items-center justify-center overflow-hidden border-4 border-[#1a110e] bg-[#f5e6c8] ${className}`}
  >
    {children}
  </div>
);
const Stars = ({ n }) => (
  <div className="text-3xl tracking-widest">
    {[1, 2, 3].map((i) => (
      <span key={i} className={i <= n ? "" : "opacity-25 grayscale"}>⭐</span>
    ))}
  </div>
);

// 완성 화면 (별점 + 테이블로 가져가기 + 상품 링크)
function Result({ kind, stars, comment, shopUrl, shopLabel, onTake, onAgain, taken }) {
  const info = CRAFT_INFO[kind];
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-lg font-black text-amber-200">{info.emoji} {info.name} 완성!</p>
      <Stars n={stars} />
      <p className="text-sm text-white/85">{comment}</p>
      <button type="button" onClick={onTake} disabled={taken} className={`${BTN} w-full bg-emerald-300 text-[#14532d]`}>
        {taken ? "✅ 테이블로 보냈어요! 자리에서 드셔 보세요" : `🪑 내 테이블로 가져가기`}
      </button>
      {taken && <p className="text-xs text-white/60">앉아 있지 않다면, 다음에 앉는 자리 테이블에 놓여요.</p>}
      {partyData.shopOpen && shopUrl && (
        <a href={shopUrl} target="_blank" rel="noopener noreferrer" className={`${BTN} block w-full bg-amber-400 text-[#2b1d1a]`}>
          🛍️ {shopLabel}
        </a>
      )}
      <button type="button" onClick={onAgain} className={`${BTN} w-full bg-[#6e4530] text-white`}>
        🔁 다시 만들기
      </button>
    </div>
  );
}

function sendToTable(kind, stars) {
  const item = { kind, stars, at: Date.now() };
  try { localStorage.setItem(CRAFT_PENDING_KEY, JSON.stringify(item)); } catch {}
  try { window.dispatchEvent(new CustomEvent(CRAFT_EVENT)); } catch {}
}

// ---------------- 🎨 그림 파일 (public/craft/*.png) ----------------
//  파일이 아직 없으면 → 코드로 그린 그림(fallback)을 대신 보여줘요
// 다식 그림: {id}_raw → {id}_peeled (손질) → {id}_done (완성) + 고명 그림
//  (그림 파일이 없는 다식은 아래 SVG 그림으로)
const GARNISH_PCT = [
  { x: 50, y: 30 }, { x: 34, y: 45 }, { x: 66, y: 45 }, { x: 40, y: 62 }, { x: 60, y: 62 },
];
function DasikPic({ id, peel = 100, done = false, garnish = [], children }) {
  const ok = useImgOk(`${id}_${done ? "done" : "raw"}`);
  return (
    <div className="relative aspect-square h-full">
      {ok === false ? (
        <div className="absolute inset-0 flex items-center">
          <DasikArt id={id} peel={done ? 100 : peel} cooked={done ? 3 : 0} />
        </div>
      ) : done ? (
        <img src={craftSrc(`${id}_done`)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      ) : (
        <>
          <img src={craftSrc(`${id}_raw`)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
          <img src={craftSrc(`${id}_peeled`)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150" style={{ opacity: peel / 100 }} />
        </>
      )}
      {garnish.map((g) => {
        const s = GARNISH_PCT[g.spot];
        return (
          <div key={g.spot} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%`, width: g.type === "jat" ? "13%" : "18%" }}>
            <div className="craft-drop">
              <CraftImg name={`garnish_${g.type}`} className="w-full drop-shadow-[1px_2px_0_rgba(0,0,0,0.35)]" style={{ transform: `rotate(${g.rot}deg)` }} fallback={<span className="block text-center text-2xl">{g.type === "jat" ? "🤍" : "🌿"}</span>} />
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
}

// ---------------- 다식 그림 (SVG · 그림 파일이 없을 때) ----------------
function DasikArt({ id, peel = 100, cooked = 0, garnish = [] }) {
  const r = RECIPES[id];
  const peeled = peel / 100;
  const C = 2 * Math.PI * 62; // 점선 둘레
  const glaze = cooked / 3;
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      {/* 접시 */}
      <ellipse cx="100" cy="128" rx="88" ry="22" fill="#fff" stroke="#2b1d1a" strokeWidth="4" />
        <g>
          <circle cx="100" cy="84" r="54" fill={r.base} stroke="#2b1d1a" strokeWidth="4" />
          <circle cx="84" cy="66" r="14" fill={r.light} opacity="0.8" />
          {id === "gotgam" && (
            <g opacity={peeled}>
              <path d="M70 92 Q100 70 130 92 Q100 112 70 92Z" fill="#f2d7a8" stroke="#2b1d1a" strokeWidth="3" />
              <path d="M84 92 Q100 82 116 92" stroke="#8a5a3b" strokeWidth="3" fill="none" />
            </g>
          )}
          {/* 시럽 윤기 */}
          <ellipse cx="100" cy="84" rx="54" ry="54" fill="#ffcc66" opacity={glaze * 0.35} />
          {glaze > 0 && <path d="M76 52 Q90 44 104 48" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity={glaze * 0.9} fill="none" />}
          {/* 안 벗긴 껍질 (점선 따라 벗겨져요) */}
          <circle cx="100" cy="84" r="62" fill="none" stroke={r.shell} strokeWidth="14" strokeDasharray={`${C * (1 - peeled)} ${C}`} transform="rotate(-90 100 84)" />
        </g>
      {peel < 100 && <circle cx="100" cy="84" r="62" fill="none" stroke="#2b1d1a" strokeWidth="2" strokeDasharray="6 6" className="craft-dash" />}
      {garnish.map((g, i) =>
        g.type === "jat" ? (
          <ellipse key={i} cx={g.x} cy={g.y} rx="5" ry="8" fill="#fff6d8" stroke="#2b1d1a" strokeWidth="2" transform={`rotate(${g.rot} ${g.x} ${g.y})`} className="craft-drop" />
        ) : (
          <path key={i} d={`M${g.x} ${g.y + 8} Q${g.x - 10} ${g.y} ${g.x} ${g.y - 9} Q${g.x + 10} ${g.y} ${g.x} ${g.y + 8}Z`} fill="#4caf50" stroke="#1b5e20" strokeWidth="2" transform={`rotate(${g.rot} ${g.x} ${g.y})`} className="craft-drop" />
        )
      )}
    </svg>
  );
}

// 플레이팅 자리 (SVG 좌표)
const GARNISH_SPOTS = GARNISH_PCT;

// ---------------- 1) 수제 다식 만들기 ----------------
//  initialId: 미니게임 목록에서 고른 다식 (보늬밤 · 곶감 · 가래떡) — 바로 그 게임부터 시작
function DasikGame({ onBack, initialId = null }) {
  const [id, setId] = useState(initialId);
  const [step, setStep] = useState(0);
  const [peel, setPeel] = useState(0);
  const [peelStart, setPeelStart] = useState(0);
  const [peelTime, setPeelTime] = useState(0);
  const [temp, setTemp] = useState(0);
  const [hits, setHits] = useState(0);
  const [miss, setMiss] = useState(0);
  const [flash, setFlash] = useState(null);
  const [garnish, setGarnish] = useState([]);
  const [tool, setTool] = useState("jat");
  const [taken, setTaken] = useState(false);
  const raf = useRef(0);
  const tempRef = useRef(0);

  // 온도 바늘: 위아래로 흔들려요 (맞힐수록 빨라져요)
  useEffect(() => {
    if (step !== 1) return;
    const t0 = performance.now();
    const loop = (t) => {
      const speed = 0.0022 + hits * 0.0009;
      const v = 50 + 48 * Math.sin((t - t0) * speed);
      tempRef.current = v;
      setTemp(v);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step, hits]);

  const reset = (keep) => {
    setStep(0); setPeel(0); setPeelStart(0); setHits(0); setMiss(0); setGarnish([]); setTaken(false); setFlash(null);
    if (!keep) {
      if (initialId) onBack?.(); // 목록에서 바로 골라 들어왔으면 → 미니게임 목록으로
      else setId(null);
    }
  };

  const doPeel = () => {
    if (peel >= 100) return;
    sfx.peel();
    if (!peelStart) setPeelStart(Date.now());
    const next = Math.min(100, peel + 7 + Math.random() * 3);
    setPeel(next);
    if (next >= 100) {
      setPeelTime((Date.now() - (peelStart || Date.now())) / 1000);
      sfx.good();
      setTimeout(() => setStep(1), 600);
    }
  };

  const ZONE = [58, 74];
  const doHeat = () => {
    const v = tempRef.current;
    if (v >= ZONE[0] && v <= ZONE[1]) {
      sfx.good();
      setFlash("good");
      const h = hits + 1;
      setHits(h);
      if (h >= 3) setTimeout(() => setStep(2), 600);
    } else {
      sfx.bad();
      setFlash(v > ZONE[1] ? "hot" : "cold");
      setMiss((m) => m + 1);
    }
    setTimeout(() => setFlash(null), 450);
  };

  const placeGarnish = (i) => {
    if (garnish.some((g) => g.spot === i)) return;
    sfx.pop();
    const s = GARNISH_SPOTS[i];
    const next = [...garnish, { spot: i, type: tool, x: s.x, y: s.y, rot: Math.round(Math.random() * 60 - 30) }];
    setGarnish(next);
    if (next.length >= GARNISH_SPOTS.length) setTimeout(() => { sfx.win(); setStep(3); }, 500);
  };

  // 🍢 가래떡 구이는 따로 만든 게임으로
  if (id && RECIPES[id]?.game === "tteok") return <TteokGame onBack={() => reset(false)} />;

  if (!id) {
    return (
      <div className="flex flex-col gap-2">
        <p className="mb-1 text-sm text-white/80">어떤 다식을 만들어 볼까요?</p>
        {Object.entries(RECIPES).map(([k, r]) => (
          <button key={k} type="button" onClick={() => { setId(k); reset(true); }} className={`${BTN} flex items-center gap-3 bg-[#f5e6c8] text-left text-[#2b1d1a]`}>
            <span className="text-3xl">{r.emoji}</span>
            <span>{r.name}</span>
          </button>
        ))}
        <button type="button" onClick={onBack} className={`${BTN} mt-1 bg-[#6e4530] text-white`}>← 다른 게임 고르기</button>
      </div>
    );
  }

  const r = RECIPES[id];
  if (step === 3) {
    let stars = 3;
    if (miss >= 2) stars--;
    if (miss >= 5 || peelTime > 8) stars--;
    stars = Math.max(1, stars);
    const kit = CFG.dasikKits?.[id] || {};
    return (
      <>
        <Stage><DasikPic id={id} done garnish={garnish} /></Stage>
        <div className="mt-3">
          <Result
            kind={id}
            stars={stars}
            comment={stars === 3 ? "다연: “사장님이 만든 것보다 예쁜데요?!” 🍵" : stars === 2 ? "다연: “윤기가 좌르르~ 정말 맛있어 보여요!”" : "다연: “조금 탔지만… 정성은 최고예요!”"}
            shopUrl={safeUrl(kit.url)}
            shopLabel={kit.label || "이 다식 DIY 키트 / 제철 과일 공구 보러가기"}
            taken={taken}
            onTake={() => { sendToTable(id, stars); setTaken(true); sfx.pop(); }}
            onAgain={() => reset(true)}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      <p className="mb-2 text-center font-black text-amber-200">{r.emoji} {r.name}</p>
      <Steps list={["재료 손질", "불 조절", "플레이팅"]} cur={step} />

      {step === 0 && (
        <>
          <Stage onPointerDown={doPeel} className="cursor-pointer active:scale-[0.99]">
            <DasikPic id={id} peel={peel} />
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce text-2xl">👆</span>
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🔪 {r.peel} — 점선을 따라 마구 연타!</p>
          <Gauge value={peel} label="손질 게이지" color="#f59e0b" />
        </>
      )}

      {step === 1 && (
        <>
          <Stage onPointerDown={doHeat} className={`cursor-pointer ${flash === "good" ? "bg-emerald-200" : flash ? "bg-rose-200" : ""}`}>
            <div className="flex h-full w-full items-center justify-around px-3">
              {/* 냄비 + 불 (pot.png · 없으면 코드 그림) */}
              <div className="relative h-44 w-44">
                <CraftImg
                  name="pot"
                  className="absolute inset-0 h-full w-full"
                  fallback={
                  <div className="relative h-40 w-36">
                    <div className="absolute inset-x-0 top-6 h-24 overflow-hidden rounded-b-3xl border-4 border-[#2b1d1a] bg-[#6b7280]">
                      <div className="absolute inset-x-2 top-3 h-6 rounded-full" style={{ background: r.base, boxShadow: `0 0 0 4px ${r.light} inset` }} />
                      {hits > 0 && [0, 1, 2].map((i) => <span key={i} className="craft-bubble absolute h-2 w-2 rounded-full bg-white/80" style={{ left: 30 + i * 28, top: 18, animationDelay: `${i * 0.3}s` }} />)}
                    </div>
                    <div className="absolute -left-3 top-8 h-3 w-5 border-4 border-[#2b1d1a] bg-[#4b5563]" />
                    <div className="absolute inset-x-6 bottom-0 flex h-9 items-end justify-center gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className="craft-flame block w-4 rounded-t-full" style={{ height: 10 + (temp / 100) * 26, background: temp > 74 ? "#ef4444" : temp < 58 ? "#60a5fa" : "#f59e0b", animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </div>
                  }
                />
                {/* 불 세기 (온도에 따라 색·크기) */}
                <div className="pointer-events-none absolute flex items-end justify-center gap-0.5" style={{ left: "29%", width: "22%", top: "64%", height: 14, transform: "translateY(-100%)" }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="craft-flame block w-2 rounded-t-full opacity-90" style={{ height: 4 + (temp / 100) * 12, background: temp > 74 ? "#ef4444" : temp < 58 ? "#60a5fa" : "#f59e0b", animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                {hits > 0 && [0, 1, 2].map((i) => <span key={i} className="craft-bubble pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-[#2b1d1a] bg-white/90" style={{ left: `${30 + i * 12}%`, top: "22%", animationDelay: `${i * 0.3}s` }} />)}
              </div>
              {/* 온도 게이지 (세로) */}
              <div className="relative h-44 w-9 border-4 border-[#2b1d1a] bg-gradient-to-t from-sky-300 via-amber-200 to-rose-400">
                <div className="absolute inset-x-0 bg-emerald-400/90" style={{ bottom: `${ZONE[0]}%`, height: `${ZONE[1] - ZONE[0]}%`, boxShadow: "0 0 0 2px #14532d inset" }} />
                <div className="absolute -left-3 -right-3 h-1.5 bg-[#2b1d1a]" style={{ bottom: `${temp}%` }} />
                <span className="absolute -right-10 text-xs font-black text-[#14532d]" style={{ bottom: `${ZONE[0] + 2}%` }}>적정</span>
              </div>
            </div>
            {flash && <span className="pointer-events-none absolute top-3 text-lg font-black text-[#2b1d1a]">{flash === "good" ? "좋아요! 🔥" : flash === "hot" ? "너무 뜨거워요! 💦" : "아직 미지근해요 ❄️"}</span>}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🔥 {r.cook} — 바늘이 <b className="text-emerald-300">초록 구간</b>일 때 탭!</p>
          <div className="flex justify-center gap-2 text-2xl">
            {[0, 1, 2].map((i) => <span key={i} className={i < hits ? "" : "opacity-25 grayscale"}>🔥</span>)}
            <span className="ml-2 self-center text-xs font-bold text-white/60">실수 {miss}</span>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Stage>
            <DasikPic id={id} done garnish={garnish}>
              {/* 고명 자리 (그림 기준 %) */}
              {GARNISH_SPOTS.map((s, i) =>
                garnish.some((g) => g.spot === i) ? null : (
                  <button key={i} type="button" aria-label="고명 올리기" onClick={() => placeGarnish(i)} className="craft-target absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white bg-white/40" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
                )
              )}
            </DasikPic>
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">✨ 고명을 고르고 반짝이는 자리를 탭해 올려요 ({garnish.length}/{GARNISH_SPOTS.length})</p>
          <div className="flex justify-center gap-2">
            {[["jat", "🤍 잣"], ["herb", "🌿 허브"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTool(k)} className={`${BTN} ${tool === k ? "bg-amber-300 text-[#2b1d1a]" : "bg-black/30 text-white"}`}>{l}</button>
            ))}
          </div>
        </>
      )}
      <button type="button" onClick={() => reset(false)} className={`${BTN} mt-3 w-full bg-[#6e4530] text-white`}>← 다른 게임 고르기</button>
    </div>
  );
}

// ---------------- 1-2) 🍢 가래떡 구이 ----------------
//  ① 떡 썰기: 좌우로 움직이는 칼이 점선 위에 왔을 때 탭 (3번 → 4토막)
//  ② 석쇠에 굽기: 아랫면이 점점 노릇해져요. 떡을 탭하면 뒤집기! 양면을 노릇하게 (너무 오래 두면 타요)
//  ③ 찍어 먹기: 🍯 조청 / 🫘 콩가루를 골라 떡을 탭해 올리기
const TTEOK_CUTS = [25, 50, 75]; // 썰 자리 (%)
const GOLD = [55, 82]; // 노릇노릇 구간 (굽기 정도 %)
const BURN = 90; // 이 이상이면 탄 거예요
const COOK_SPEED = 14; // 1초에 익는 정도 (%)

// 굽기 정도 → 색 (하얀 떡 → 노릇 → 갈색 → 탄 색)
function toastColor(v) {
  const stops = [
    [0, [250, 247, 240]],
    [45, [246, 226, 178]],
    [68, [232, 176, 74]],
    [88, [168, 104, 44]],
    [100, [70, 44, 28]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(",")})`;
    }
  }
  return "rgb(70,44,28)";
}

// 떡 한 토막 (SVG) — side: 지금 보이는 면의 굽기 정도, topping: "honey" | "kongga"
function TteokPiece({ x, y, w = 40, h = 22, v = 0, topping = null, wiggle = false }) {
  const grill = v > 40;
  return (
    <g transform={`translate(${x} ${y})`}>
    <g className={wiggle ? "tteok-sizzle" : ""}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(8, h / 2)} fill={toastColor(v)} stroke="#2b1d1a" strokeWidth="3" />
      {/* 석쇠 자국 */}
      {grill && [-0.25, 0, 0.25].map((f) => (
        <line key={f} x1={w * f - 3} y1={-h / 2 + 4} x2={w * f + 3} y2={h / 2 - 4} stroke="#5a3418" strokeWidth="3" strokeLinecap="round" opacity={Math.min(1, (v - 40) / 30)} />
      ))}
      {/* 반짝이 */}
      <rect x={-w / 2 + 6} y={-h / 2 + 4} width={w * 0.35} height="3" rx="1.5" fill="#fff" opacity="0.7" />
      {topping === "honey" && <path d={`M${-w / 2 + 4} ${-h / 2 + 3} Q0 ${-h / 2 - 4} ${w / 2 - 4} ${-h / 2 + 3} L${w / 2 - 6} 2 Q0 ${-3} ${-w / 2 + 6} 2Z`} fill="#c9781c" opacity="0.85" stroke="#7a3e10" strokeWidth="1.5" />}
      {topping === "kongga" && [...Array(14)].map((_, i) => <rect key={i} x={-w / 2 + 4 + ((i * 7) % (w - 8))} y={-h / 2 + 2 + ((i * 5) % (h - 6))} width="3" height="3" fill="#d9b25a" />)}
    </g>
    </g>
  );
}

// 🖼️ 그림 버전 떡 한 토막 (tteok_piece_raw → golden → burnt 를 굽기 정도에 따라 겹쳐 보여요)
const clamp01 = (n) => Math.max(0, Math.min(1, n));
function TteokPieceImg({ v = 0, topping = null }) {
  return (
    <div className="relative aspect-square w-full">
      <img src={craftSrc("tteok_piece_raw")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      <img src={craftSrc("tteok_piece_golden")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: clamp01((v - 20) / 35) }} />
      <img src={craftSrc("tteok_piece_burnt")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: clamp01((v - 84) / 10) }} />
      {/* 🍯 조청 / 🫘 콩가루 (떡 윗면을 따라 비스듬히) */}
      {topping && (
        <div className="pointer-events-none absolute" style={{ left: "24%", top: "30%", width: "62%", height: "17%", transform: "rotate(-23deg)" }}>
          <div className="craft-drop h-full w-full">
            {topping === "honey" ? (
              <div className="h-full w-full rounded-full border-2 border-[#7a3e10]/70 bg-[#c9781c]/80" style={{ boxShadow: "inset 0 2px 0 rgba(255,236,170,0.7)" }} />
            ) : (
              <div className="h-full w-full rounded-full" style={{ background: "radial-gradient(circle, #d9b25a 0 1.6px, transparent 2px) 0 0 / 5px 5px, radial-gradient(circle, #a8782e 0 1.2px, transparent 1.6px) 2.5px 2.5px / 5px 5px" }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 접시 위 떡 4토막 자리 (그림 기준 %)
const TTEOK_PLATE_POS = [{ x: 34, y: 44 }, { x: 62, y: 40 }, { x: 40, y: 60 }, { x: 68, y: 56 }];
// 석쇠 위 떡 4토막 자리 (석쇠 칸 기준 px · 칸 크기 320x224)
const GRILL_W = 320;
const GRILL_TOP = -26; // 석쇠 그림을 위로 살짝 올려서 숯불 화로 아래쪽은 잘라요
const GRILL_POS = [0.22, 0.41, 0.6, 0.79].map((x, i) => ({ x: x * GRILL_W, y: 0.43 * GRILL_W + GRILL_TOP + (i % 2 ? -6 : 6) }));
const PIECE_W = 78;
// 도마 위 가래떡 (tteok_raw.png): 왼쪽 끝 A → 오른쪽 끝 B (그림 기준 %)
const LOG_A = { x: 21, y: 59 };
const LOG_B = { x: 76, y: 33 };
const logPoint = (p) => ({ x: LOG_A.x + ((LOG_B.x - LOG_A.x) * p) / 100, y: LOG_A.y + ((LOG_B.y - LOG_A.y) * p) / 100 });

function TteokGame({ onBack }) {
  const [step, setStep] = useState(0);
  // ① 썰기
  const [cuts, setCuts] = useState(0);
  const [knife, setKnife] = useState(10);
  const knifeRef = useRef(10);
  const [miss, setMiss] = useState(0);
  const [flash, setFlash] = useState(null);
  // ② 굽기: 토막마다 { a, b, up } — a·b = 양면 굽기 정도, up = 지금 위로 보이는 면 ("a"면 b가 아래에서 익는 중)
  const [pieces, setPieces] = useState([]);
  const piecesRef = useRef([]);
  const [burnt, setBurnt] = useState(0);
  // ③ 찍어 먹기
  const [tool, setTool] = useState("honey");
  const [tops, setTops] = useState([null, null, null, null]);
  const [taken, setTaken] = useState(false);
  const [flips, setFlips] = useState([0, 0, 0, 0]);
  const raf = useRef(0);
  // 그림 파일이 있으면 그림으로, 없으면 코드 그림으로
  const boardImg = useImgOk("tteok_raw") !== false;
  const grillImg = useImgOk("tteok_grill") !== false;
  const pieceImg = useImgOk("tteok_piece_raw") !== false;
  const plateImg = useImgOk("table_plate") !== false && pieceImg;

  const reset = () => {
    setStep(0); setCuts(0); setMiss(0); setFlash(null); setTops([null, null, null, null]); setTaken(false); setBurnt(0); setFlips([0, 0, 0, 0]);
    piecesRef.current = []; setPieces([]);
  };

  // ① 칼이 좌우로 왔다 갔다 (썰수록 빨라져요)
  useEffect(() => {
    if (step !== 0) return;
    const t0 = performance.now();
    const loop = (t) => {
      const speed = 0.0016 + cuts * 0.0006;
      const v = 50 + 44 * Math.sin((t - t0) * speed);
      knifeRef.current = v;
      setKnife(v);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step, cuts]);

  const doCut = () => {
    const target = TTEOK_CUTS[cuts];
    if (target == null) return;
    if (Math.abs(knifeRef.current - target) <= 5) {
      sfx.peel();
      sfx.good();
      setFlash("good");
      const n = cuts + 1;
      setCuts(n);
      if (n >= TTEOK_CUTS.length) {
        setTimeout(() => {
          const start = [0, 1, 2, 3].map(() => ({ a: 0, b: 0, up: "a" }));
          piecesRef.current = start;
          setPieces(start);
          setStep(1);
        }, 600);
      }
    } else {
      sfx.bad();
      setFlash("miss");
      setMiss((m) => m + 1);
    }
    setTimeout(() => setFlash(null), 400);
  };

  // ② 석쇠: 아랫면이 계속 익어요
  useEffect(() => {
    if (step !== 1) return;
    let last = performance.now();
    let tick = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      piecesRef.current = piecesRef.current.map((p) => {
        const down = p.up === "a" ? "b" : "a";
        return { ...p, [down]: Math.min(100, p[down] + COOK_SPEED * dt) };
      });
      tick += dt;
      if (tick > 0.05) {
        tick = 0;
        setPieces(piecesRef.current);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step]);

  const flip = (i) => {
    sfx.tap();
    setFlips((f) => f.map((n, k) => (k === i ? n + 1 : n)));
    piecesRef.current = piecesRef.current.map((p, k) => (k === i ? { ...p, up: p.up === "a" ? "b" : "a" } : p));
    setPieces(piecesRef.current);
  };
  const allGolden = pieces.length > 0 && pieces.every((p) => p.a >= GOLD[0] && p.b >= GOLD[0]);
  const finishGrill = () => {
    const b = piecesRef.current.reduce((n, p) => n + (p.a > BURN ? 1 : 0) + (p.b > BURN ? 1 : 0), 0);
    setBurnt(b);
    sfx.good();
    setStep(2);
  };

  const putTopping = (i) => {
    if (tops[i]) return;
    sfx.pop();
    const next = tops.map((t, k) => (k === i ? tool : t));
    setTops(next);
    if (next.every(Boolean)) setTimeout(() => { sfx.win(); setStep(3); }, 500);
  };

  const final = pieces.length ? pieces : [0, 1, 2, 3].map(() => ({ a: 70, b: 70, up: "a" }));
  const plate = plateImg ? (
    <div className="relative aspect-square h-full">
      <img src={craftSrc("table_plate")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      {final.map((p, i) => (
        <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${TTEOK_PLATE_POS[i].x}%`, top: `${TTEOK_PLATE_POS[i].y}%`, width: "38%" }}>
          <TteokPieceImg v={Math.max(p.a, p.b)} topping={tops[i]} />
        </div>
      ))}
    </div>
  ) : (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      <ellipse cx="100" cy="100" rx="88" ry="40" fill="#fff" stroke="#2b1d1a" strokeWidth="4" />
      <ellipse cx="100" cy="100" rx="70" ry="28" fill="none" stroke="#e7dccb" strokeWidth="3" />
      {final.map((p, i) => (
        <TteokPiece key={i} x={58 + i * 28} y={98 + (i % 2 ? -8 : 6)} w={30} h={22} v={Math.max(p.a, p.b)} topping={tops[i]} />
      ))}
    </svg>
  );

  if (step === 3) {
    let stars = 3;
    if (miss >= 2 || burnt >= 1) stars--;
    if (miss >= 5 || burnt >= 3) stars--;
    stars = Math.max(1, stars);
    const kit = CFG.dasikKits?.tteok || {};
    return (
      <>
        <Stage>{plate}</Stage>
        <div className="mt-3">
          <Result
            kind="tteok"
            stars={stars}
            comment={stars === 3 ? "다연: “겉은 바삭, 속은 쫀득! 완벽한 가래떡이에요!” 🍢" : stars === 2 ? "다연: “고소한 냄새가 찻집에 가득해요~”" : "다연: “조금 탔지만… 탄 맛도 추억이죠!”"}
            shopUrl={safeUrl(kit.url)}
            shopLabel={kit.label || "군산 방앗간 가래떡 보러가기"}
            taken={taken}
            onTake={() => { sendToTable("tteok", stars); setTaken(true); sfx.pop(); }}
            onAgain={reset}
          />
        </div>
        <button type="button" onClick={onBack} className={`${BTN} mt-2 w-full bg-black/30 text-white`}>← 다른 게임 고르기</button>
      </>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes tteok-sizzle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
        .tteok-sizzle { animation: tteok-sizzle 0.25s steps(2, jump-none) infinite; transform-box: fill-box; }
        .tteok-sizzle-h { animation: tteok-sizzle 0.25s steps(2, jump-none) infinite; }
        @keyframes tteok-flip-k { 0% { transform: translateY(0) scaleY(1); } 40% { transform: translateY(-18px) scaleY(0.15); } 100% { transform: translateY(0) scaleY(1); } }
        .tteok-flip { animation: tteok-flip-k 0.28s ease-out; }
        @keyframes tteok-steam-k { 0% { transform: translate(-50%, 4px); opacity: 0; } 40% { opacity: 1; } 100% { transform: translate(-50%, -12px); opacity: 0; } }
        .tteok-steam { animation: tteok-steam-k 1.1s ease-out infinite; }
      `}</style>
      <p className="mb-2 text-center font-black text-amber-200">🍢 가래떡 구이</p>
      <Steps list={["떡 썰기", "석쇠 굽기", "찍어 먹기"]} cur={step} />

      {step === 0 && (
        <>
          <Stage onPointerDown={doCut} className={`cursor-pointer ${flash === "good" ? "bg-emerald-200" : flash ? "bg-rose-200" : ""}`}>
            {boardImg ? (
              <div className="relative aspect-square h-full">
                <img src={craftSrc("tteok_raw")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
                <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                  {TTEOK_CUTS.map((c, i) => {
                    const pt = logPoint(c);
                    // 떡을 가로지르는 선 (떡 방향에 수직)
                    const x1 = pt.x - 4, y1 = pt.y - 8.5, x2 = pt.x + 4, y2 = pt.y + 8.5;
                    return i < cuts ? (
                      <line key={c} x1={x1 + 1.5} y1={y1 + 3} x2={x2 - 1.5} y2={y2 - 3} stroke="#8a6a4a" strokeWidth="1.4" strokeLinecap="round" />
                    ) : (
                      <line key={c} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i === cuts ? "#ef4444" : "#2b1d1a"} strokeWidth="1.1" strokeDasharray="2.4 1.8" />
                    );
                  })}
                  {/* 칼 (떡을 따라 왔다 갔다) */}
                  {(() => {
                    const pt = logPoint(knife);
                    return (
                      <g transform={`translate(${pt.x} ${pt.y - 9})`}>
                        <rect x="-2" y="-22" width="4" height="10" rx="1" fill="#6e4530" stroke="#2b1d1a" strokeWidth="1" />
                        <path d="M-3 -12 L3 -12 L2 4 L-2 1 Z" fill="#e5e7eb" stroke="#2b1d1a" strokeWidth="1.2" />
                      </g>
                    );
                  })()}
                </svg>
              </div>
            ) : (
            <svg viewBox="0 0 200 160" className="h-full w-full">
              {/* 도마 */}
              <rect x="8" y="58" width="184" height="72" rx="8" fill="#c08a57" stroke="#2b1d1a" strokeWidth="4" />
              <rect x="8" y="118" width="184" height="12" fill="#9c6a3c" />
              {/* 가래떡 (썬 자리는 틈이 벌어져요) */}
              {[0, 25, 50, 75].map((from, i) => {
                const to = [25, 50, 75, 100][i];
                const gapL = i > 0 && i <= cuts ? 1.5 : 0;
                const gapR = i < 3 && i + 1 <= cuts ? 1.5 : 0;
                const x1 = 16 + ((from + gapL) / 100) * 168;
                const x2 = 16 + ((to - gapR) / 100) * 168;
                return <rect key={i} x={x1} y="74" width={x2 - x1} height="34" rx="10" fill="#faf7f0" stroke="#2b1d1a" strokeWidth="3" />;
              })}
              {/* 썰 자리 점선 */}
              {TTEOK_CUTS.map((c, i) => i >= cuts && (
                <line key={c} x1={16 + (c / 100) * 168} y1="66" x2={16 + (c / 100) * 168} y2="116" stroke={i === cuts ? "#ef4444" : "#2b1d1a"} strokeWidth="2.5" strokeDasharray="5 4" />
              ))}
              {/* 칼 */}
              <g transform={`translate(${16 + (knife / 100) * 168} 0)`}>
                <rect x="-4" y="14" width="8" height="22" rx="2" fill="#6e4530" stroke="#2b1d1a" strokeWidth="2" />
                <path d="M-6 36 L6 36 L4 70 L-4 64 Z" fill="#e5e7eb" stroke="#2b1d1a" strokeWidth="2.5" />
              </g>
            </svg>
            )}
            {flash && <span className="pointer-events-none absolute top-2 text-lg font-black text-[#2b1d1a]">{flash === "good" ? "싹둑! ✨" : "앗, 빗나갔어요!"}</span>}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🔪 칼이 <b className="text-rose-300">빨간 점선</b> 위에 왔을 때 탭! ({cuts}/{TTEOK_CUTS.length})</p>
          <p className="text-center text-xs font-bold text-white/60">실수 {miss}</p>
        </>
      )}

      {step === 1 && (
        <>
          <Stage>
            {grillImg && pieceImg ? (
              <div className="relative h-full shrink-0" style={{ width: GRILL_W }}>
                <img src={craftSrc("tteok_grill")} alt="" draggable={false} className="pointer-events-none absolute left-0" style={{ top: GRILL_TOP, width: GRILL_W, height: GRILL_W }} />
                {pieces.map((p, i) => {
                  const upV = p[p.up];
                  const downV = p[p.up === "a" ? "b" : "a"];
                  const pos = GRILL_POS[i];
                  return (
                    <div key={i}>
                      {/* 아랫면 익는 정도 (작은 막대) */}
                      <div className="pointer-events-none absolute h-2 border border-[#1a110e] bg-[#1a110e]" style={{ left: pos.x - 20, top: 8 + (i % 2) * 14, width: 40 }}>
                        <div className="h-full" style={{ width: `${Math.min(100, downV)}%`, background: downV > BURN ? "#b91c1c" : downV >= GOLD[0] ? "#22c55e" : "#f59e0b" }} />
                        <div className="absolute -top-1 h-0.5 bg-[#22c55e]" style={{ left: `${GOLD[0]}%`, width: `${GOLD[1] - GOLD[0]}%` }} />
                      </div>
                      {/* 떡 (탭하면 뒤집어요) */}
                      <button
                        type="button"
                        aria-label={`${i + 1}번 떡 뒤집기`}
                        onPointerDown={(e) => { e.stopPropagation(); flip(i); }}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: pos.x, top: pos.y, width: PIECE_W, zIndex: 2 + i }}
                      >
                        <div key={flips[i]} className={flips[i] ? "tteok-flip" : ""}>
                          <div className="tteok-sizzle-h">
                            <TteokPieceImg v={upV} />
                          </div>
                        </div>
                      </button>
                      {/* 김 · 연기 */}
                      {downV > 30 && (
                        <span className="tteok-steam pointer-events-none absolute -translate-x-1/2 text-base" style={{ left: pos.x, top: pos.y - 34, zIndex: 10 }}>
                          {downV > BURN ? "💨" : "♨"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            <svg viewBox="0 0 200 160" className="h-full w-full">
              {/* 숯불 */}
              <rect x="14" y="120" width="172" height="26" rx="6" fill="#3a2a22" stroke="#2b1d1a" strokeWidth="3" />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={24 + i * 23} y={124 + (i % 2) * 4} width="16" height="10" fill={i % 2 ? "#f97316" : "#ef4444"} className="craft-flame" />)}
              {/* 석쇠 */}
              <rect x="14" y="44" width="172" height="76" fill="none" stroke="#4b5563" strokeWidth="5" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={14 + i * 24.5} y1="44" x2={14 + i * 24.5} y2="120" stroke="#6b7280" strokeWidth="3" />)}
              {[0, 1, 2].map((i) => <line key={`h${i}`} x1="14" y1={63 + i * 19} x2="186" y2={63 + i * 19} stroke="#6b7280" strokeWidth="3" />)}
              {/* 떡 4토막 — 탭하면 뒤집어요 */}
              {pieces.map((p, i) => {
                const upV = p[p.up];
                const downV = p[p.up === "a" ? "b" : "a"];
                return (
                  <g key={i} onPointerDown={(e) => { e.stopPropagation(); flip(i); }} style={{ cursor: "pointer" }}>
                    <TteokPiece x={40 + i * 40} y={82} w={34} h={22} v={upV} wiggle />
                    {/* 아랫면 익는 정도 (작은 막대) */}
                    <rect x={40 + i * 40 - 15} y="22" width="30" height="7" fill="#1a110e" />
                    <rect x={40 + i * 40 - 15} y="22" width={(Math.min(100, downV) / 100) * 30} height="7" fill={downV > BURN ? "#7f1d1d" : downV >= GOLD[0] ? "#22c55e" : "#f59e0b"} />
                    <rect x={40 + i * 40 - 15 + (GOLD[0] / 100) * 30} y="20" width={((GOLD[1] - GOLD[0]) / 100) * 30} height="2" fill="#22c55e" />
                    {/* 김 */}
                    {downV > 30 && <text x={40 + i * 40} y="40" textAnchor="middle" fontSize="12">{downV > BURN ? "💨" : "♨"}</text>}
                  </g>
                );
              })}
            </svg>
            )}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🔥 떡을 탭하면 뒤집어요 — 위 막대가 <b className="text-emerald-300">초록</b>이면 그 면은 노릇노릇! (빨갛게 되면 타요)</p>
          <div className="flex justify-center">
            <button type="button" onClick={finishGrill} disabled={!allGolden} className={`${BTN} bg-amber-400 text-[#2b1d1a]`}>
              {allGolden ? "🍽️ 접시에 담기" : "양면을 다 노릇하게 구워 주세요"}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Stage>
            {plate}
            {final.map((_, i) =>
              tops[i] ? null : plateImg ? (
                <div key={i} className="pointer-events-none absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2">
                  <button type="button" aria-label="찍어 먹기" onClick={() => putTopping(i)} className="craft-target pointer-events-auto absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#2b1d1a] bg-white/30" style={{ left: `${TTEOK_PLATE_POS[i].x}%`, top: `${TTEOK_PLATE_POS[i].y}%` }} />
                </div>
              ) : (
                <button key={i} type="button" aria-label="찍어 먹기" onClick={() => putTopping(i)} className="craft-target absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#2b1d1a] bg-white/30" style={{ left: `${((58 + i * 28) / 200) * 100}%`, top: `${((98 + (i % 2 ? -8 : 6)) / 160) * 100}%` }} />
              )
            )}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">✨ 고르고 떡을 탭해서 올려요 ({tops.filter(Boolean).length}/4)</p>
          <div className="flex justify-center gap-2">
            {[["honey", "🍯 조청"], ["kongga", "🫘 콩가루"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTool(k)} className={`${BTN} ${tool === k ? "bg-amber-300 text-[#2b1d1a]" : "bg-black/30 text-white"}`}>{l}</button>
            ))}
          </div>
        </>
      )}

      <button type="button" onClick={onBack} className={`${BTN} mt-3 w-full bg-[#6e4530] text-white`}>← 다른 게임 고르기</button>
    </div>
  );
}

// ---------------- 2) 말차 격불하기 ----------------
const WHISK_SEC = 10;
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

const Bowl = ({ children }) => (
  <svg viewBox="0 0 200 160" className="pointer-events-none h-full w-full">
    <ellipse cx="100" cy="140" rx="70" ry="10" fill="rgba(0,0,0,0.15)" />
    <path d="M30 70 Q30 140 100 140 Q170 140 170 70Z" fill="#3d3a36" stroke="#1a110e" strokeWidth="4" />
    <path d="M44 92 Q100 108 156 92" stroke="#6b5d4f" strokeWidth="4" fill="none" opacity="0.6" />
    <ellipse cx="100" cy="70" rx="70" ry="18" fill="#2a2724" stroke="#1a110e" strokeWidth="4" />
    {children}
  </svg>
);

// 다완 그림: layers = [[그림 이름, 투명도], ...] (아래부터 쌓아요). 그림이 없으면 fallback(SVG)
function MatchaBowl({ layers, fallback }) {
  const ok = useImgOk("matcha_bowl_empty");
  if (ok === false) return fallback;
  return (
    <div className="pointer-events-none absolute bottom-1 left-1/2 aspect-square h-[80%] -translate-x-1/2">
      {layers.map(([name, op]) => (
        <img key={name} src={craftSrc(name)} alt="" draggable={false} className="absolute inset-0 h-full w-full transition-opacity duration-200" style={{ opacity: op }} />
      ))}
    </div>
  );
}

function MatchaGame({ onBack }) {
  const [step, setStep] = useState(0);
  const [sift, setSift] = useState(0);
  const [water, setWater] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [pourMsg, setPourMsg] = useState("");
  const [foam, setFoam] = useState(0);
  const [left, setLeft] = useState(WHISK_SEC);
  const [started, setStarted] = useState(false);
  const [whiskX, setWhiskX] = useState(50);
  const [taken, setTaken] = useState(false);
  const [pourScore, setPourScore] = useState(0);
  const waterRef = useRef(0);
  const lastX = useRef(null);
  const lastDir = useRef(0);
  const foamRef = useRef(0);
  const doneRef = useRef(false);

  // 물 붓기: 누르고 있는 동안 차올라요
  useEffect(() => {
    if (!pouring) return;
    pourStart();
    const t = setInterval(() => {
      waterRef.current = Math.min(100, waterRef.current + 1.6);
      setWater(waterRef.current);
      if (waterRef.current >= 100) stopPour();
    }, 40);
    return () => { clearInterval(t); pourStop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouring]);

  const stopPour = () => {
    if (!pouring && waterRef.current === 0) return;
    setPouring(false);
    pourStop();
    const w = waterRef.current;
    if (w < 55) { setPourMsg("조금 더 부어 주세요 (꾹 누르기)"); return; }
    if (w > 85) {
      sfx.bad();
      setPourMsg("앗, 넘쳤어요! 다시 부어 볼까요? 💦");
      setTimeout(() => { waterRef.current = 0; setWater(0); setPourMsg(""); }, 900);
      return;
    }
    const perfect = w >= 62 && w <= 75;
    setPourScore(perfect ? 1 : 0);
    sfx.good();
    setPourMsg(perfect ? "딱 좋은 양이에요! 80℃ 온수 완벽 ✨" : "괜찮아요! 다음 단계로");
    setTimeout(() => { setStep(2); setPourMsg(""); }, 900);
  };

  // 젓기 타이머 10초
  useEffect(() => {
    if (step !== 2 || !started) return;
    const t0 = Date.now();
    const t = setInterval(() => {
      const l = Math.max(0, WHISK_SEC - (Date.now() - t0) / 1000);
      setLeft(l);
      if (l <= 0) { clearInterval(t); finish(); }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, started]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    sfx.win();
    setTimeout(() => setStep(3), 400);
  };

  const addFoam = (amt) => {
    if (doneRef.current) return;
    if (!started) setStarted(true);
    sfx.whisk();
    foamRef.current = Math.min(100, foamRef.current + amt);
    setFoam(foamRef.current);
    if (foamRef.current >= 100) finish();
  };

  const onMove = (e) => {
    if (step !== 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setWhiskX(Math.max(15, Math.min(85, x)));
    if (e.pointerType === "mouse" && e.buttons === 0 && lastX.current === null) { lastX.current = x; return; }
    if (lastX.current !== null) {
      const dx = x - lastX.current;
      if (Math.abs(dx) > 4) {
        const dir = Math.sign(dx);
        // 좌우로 방향을 바꿀 때마다 거품이 생겨요 (M자·W자로 빠르게!)
        if (dir !== lastDir.current) addFoam(2.6);
        lastDir.current = dir;
        lastX.current = x;
      }
    } else lastX.current = x;
  };

  const reset = () => {
    setStep(0); setSift(0); setWater(0); waterRef.current = 0; setFoam(0); foamRef.current = 0; setLeft(WHISK_SEC);
    setStarted(false); setTaken(false); setPourMsg(""); doneRef.current = false; lastX.current = null;
  };

  const t = foam / 100;
  const tea = mix("#2f5a1e", "#8fd19e", t); // 진한 녹색 → 크리미한 에메랄드
  const bubbles = Math.round(t * 22);


  if (step === 3) {
    let stars = 1;
    if (foam >= 100) stars = 2;
    if (foam >= 100 && pourScore) stars = 3;
    if (foam < 60) stars = 1;
    return (
      <>
        <Stage>
          <MatchaBowl
            layers={[["matcha_bowl_water", 1], ["matcha_bowl_foam", Math.max(0.3, t)]]}
            fallback={
              <Bowl>
                <ellipse cx="100" cy="72" rx="62" ry="14" fill={tea} />
                {Array.from({ length: bubbles }, (_, i) => (
                  <circle key={i} cx={50 + ((i * 37) % 100)} cy={64 + ((i * 13) % 14)} r={2 + (i % 3)} fill="#e9f8e4" opacity="0.8" />
                ))}
              </Bowl>
            }
          />
        </Stage>
        <div className="mt-3">
          <Result
            kind="matcha"
            stars={stars}
            comment={stars === 3 ? "크리미한 에메랄드 거품! 다인(茶人)의 솜씨예요 🍵" : stars === 2 ? "거품이 곱게 올라왔어요!" : "거품이 조금 부족하지만 쌉싸름하니 좋아요"}
            shopUrl={safeUrl(CFG.matchaKit?.url)}
            shopLabel={CFG.matchaKit?.label || "말차 다구 세트 보러가기"}
            taken={taken}
            onTake={() => { sendToTable("matcha", stars); setTaken(true); sfx.pop(); }}
            onAgain={reset}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      <p className="mb-2 text-center font-black text-amber-200">🍵 말차 격불하기</p>
      <Steps list={["체 치기", "온수 붓기", "차선 젓기"]} cur={step} />

      {step === 0 && (
        <>
          <Stage
            className="cursor-pointer"
            onPointerDown={() => {
              if (sift >= 3) return;
              sfx.tap();
              const n = sift + 1;
              setSift(n);
              if (n >= 3) { sfx.good(); setTimeout(() => setStep(1), 700); }
            }}
          >
            <MatchaBowl
              layers={[["matcha_bowl_empty", 1], ["matcha_bowl_powder", sift / 3]]}
              fallback={
                <Bowl>
                  {sift > 0 && <ellipse cx="100" cy="74" rx={10 + sift * 9} ry={3 + sift * 2.5} fill="#5d8a2f" />}
                </Bowl>
              }
            />
            {/* 체 (matcha_sieve.png · 없으면 코드 그림) */}
            <div key={sift} className="craft-shake pointer-events-none absolute top-0" style={{ left: "calc(50% - 42px)" }}>
              <CraftImg
                name="matcha_sieve"
                className="w-36"
                fallback={<div className="mt-3 h-12 w-24 rounded-b-full border-4 border-[#1a110e]" style={{ background: "repeating-linear-gradient(45deg,#d6d3d1 0 3px,#a8a29e 3px 6px)" }} />}
              />
              {sift > 0 && sift < 3 && [0, 1, 2, 3].map((i) => <span key={i} className="craft-powder absolute h-1.5 w-1.5 rounded-full bg-[#5d8a2f]" style={{ left: 30 + i * 10, top: 70, animationDelay: `${i * 0.08}s` }} />)}
            </div>
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🥄 다완을 탭해 말차 가루를 체에 쳐요 ({sift}/3)</p>
        </>
      )}

      {step === 1 && (
        <>
          <Stage>
            <MatchaBowl
              layers={[["matcha_bowl_powder", 1], ["matcha_bowl_water", Math.min(1, water / 70)]]}
              fallback={
                <Bowl>
                  <ellipse cx="100" cy="74" rx="37" ry="10" fill="#5d8a2f" />
                  {water > 0 && <ellipse cx="100" cy="72" rx={Math.min(64, 30 + water * 0.4)} ry={Math.min(16, 8 + water * 0.1)} fill={mix("#7fae4a", "#3f6f22", Math.min(1, water / 70))} />}
                </Bowl>
              }
            />
            {/* 숙우 (matcha_pourer.png · 없으면 코드 그림) */}
            <div className="pointer-events-none absolute right-3 top-1 transition-transform duration-200" style={{ transform: pouring ? "rotate(-35deg)" : "none", transformOrigin: "30% 80%" }}>
              <CraftImg
                name="matcha_pourer"
                className="w-28"
                fallback={
                  <div className="relative mr-3 mt-3 h-14 w-16 rounded-t-3xl border-4 border-[#1a110e] bg-[#9ca3af]">
                    <span className="absolute -left-6 top-4 h-2.5 w-7 -rotate-12 border-4 border-[#1a110e] bg-[#9ca3af]" />
                    <span className="absolute -top-3 left-5 h-3 w-5 border-4 border-[#1a110e] bg-[#6b7280]" />
                  </div>
                }
              />
              {pouring && <span className="craft-water absolute left-0 top-8 block h-16 w-1.5 origin-top rotate-[30deg] bg-sky-200/90" />}
            </div>
            {/* 수위 게이지 */}
            <div className="pointer-events-none absolute left-3 top-4 h-40 w-5 border-4 border-[#1a110e] bg-black/20">
              <div className="absolute inset-x-0 bg-emerald-400/70" style={{ bottom: "62%", height: "13%" }} />
              <div className="absolute inset-x-0 bottom-0 bg-sky-300" style={{ height: `${water}%` }} />
            </div>
          </Stage>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); if (waterRef.current < 100) setPouring(true); }}
            onPointerUp={stopPour}
            onPointerLeave={() => pouring && stopPour()}
            onContextMenu={(e) => e.preventDefault()}
            className={`${BTN} mt-3 w-full touch-none ${pouring ? "bg-sky-200" : "bg-sky-300"} text-[#0c4a6e]`}
          >
            {pouring ? "🫖 쪼르르… (손을 떼면 멈춰요)" : "🫖 꾹 눌러서 80℃ 온수 붓기"}
          </button>
          <p className="mt-2 text-center text-sm text-white/85">{pourMsg || "왼쪽 게이지의 초록 칸에서 손을 떼요"}</p>
        </>
      )}

      {step === 2 && (
        <>
          <Stage onPointerDown={(e) => { lastX.current = null; addFoam(1.5); onMove(e); }} onPointerMove={onMove} className="cursor-grab">
            <MatchaBowl
              layers={[["matcha_bowl_water", 1], ["matcha_bowl_foam", t]]}
              fallback={
                <Bowl>
                  <ellipse cx="100" cy="72" rx="62" ry="14" fill={tea} />
                  {Array.from({ length: bubbles }, (_, i) => (
                    <circle key={i} cx={50 + ((i * 37) % 100)} cy={64 + ((i * 13) % 14)} r={2 + (i % 3)} fill="#e9f8e4" opacity="0.8" className="craft-foam" />
                  ))}
                </Bowl>
              }
            />
            {/* 차선 (matcha_whisk.png · 없으면 코드 그림) */}
            <div className="pointer-events-none absolute -top-2 -translate-x-1/2 transition-[left] duration-75" style={{ left: `${whiskX}%`, transform: `translateX(-50%) rotate(${(whiskX - 50) * 0.35}deg)` }}>
              <CraftImg
                name="matcha_whisk"
                className="h-36 w-auto"
                fallback={
                  <div className="mt-4">
                    <div className="mx-auto h-16 w-3 border-2 border-[#1a110e] bg-[#e7c98f]" />
                    <div className="h-12 w-10 rounded-b-full border-2 border-[#1a110e]" style={{ background: "repeating-linear-gradient(90deg,#f1dcaa 0 2px,#c9a86a 2px 4px)" }} />
                  </div>
                }
              />
            </div>
          </Stage>
          <div className="my-2 flex items-center justify-between text-sm font-bold text-white/85">
            <span>🎋 좌우로 빠르게 문지르거나 연타!</span>
            <span className={`font-black ${left < 3 ? "text-rose-300" : "text-amber-200"}`}>⏱ {started ? left.toFixed(1) : WHISK_SEC}초</span>
          </div>
          <Gauge value={foam} label="거품 게이지" color={tea} />
        </>
      )}
      <button type="button" onClick={onBack} className={`${BTN} mt-3 w-full bg-[#6e4530] text-white`}>← 다른 게임 고르기</button>
    </div>
  );
}

// ---------------- 3) 🍃 잎차 우리기 ----------------
//  ① 찻잎 넣기: 찻숟가락이 좌우로 움직여요 → 다관 위에 왔을 때 탭 (3번)
//  ② 물 끓이기: 온도 바늘이 오르내려요 → 초록 구간(80℃ 근처)에서 탭하면 다관에 물을 부어요
//  ③ 우리기: 찻물 색이 점점 진해져요 → 초록 구간에서 [🫖 따르기] (너무 빠르면 싱겁고, 늦으면 떫어요)
const LEAF_SCOOPS = 3;
const LEAF_TEMP_ZONE = [68, 80]; // 온도 바늘 초록 구간 (%)
const LEAF_BREW_ZONE = [55, 75]; // 우림 정도 초록 구간 (%)
const LEAF_BREW_SEC = 6; // 우림 막대가 끝까지 차는 시간

function LeafTeaGame({ onBack }) {
  const [step, setStep] = useState(0);
  const [scoops, setScoops] = useState(0);
  const [miss, setMiss] = useState(0);
  const [flash, setFlash] = useState(null);
  const [spoon, setSpoon] = useState(10);
  const spoonRef = useRef(10);
  const [temp, setTemp] = useState(0);
  const tempRef = useRef(0);
  const [brew, setBrew] = useState(0);
  const brewRef = useRef(0);
  const [brewing, setBrewing] = useState(false);
  const [brewScore, setBrewScore] = useState(null); // "good" | "weak" | "bitter"
  const [taken, setTaken] = useState(false);
  const raf = useRef(0);

  const reset = () => {
    setStep(0); setScoops(0); setMiss(0); setFlash(null); setBrew(0); brewRef.current = 0; setBrewing(false); setBrewScore(null); setTaken(false);
  };
  const flashFor = (f) => {
    setFlash(f);
    setTimeout(() => setFlash(null), 450);
  };

  // ① 찻숟가락 좌우 (넣을수록 빨라져요)
  useEffect(() => {
    if (step !== 0) return;
    const t0 = performance.now();
    const loop = (t) => {
      const v = 50 + 44 * Math.sin((t - t0) * (0.0018 + scoops * 0.0007));
      spoonRef.current = v;
      setSpoon(v);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step, scoops]);
  const doScoop = () => {
    if (scoops >= LEAF_SCOOPS) return;
    if (Math.abs(spoonRef.current - 50) <= 9) {
      sfx.peel();
      flashFor("good");
      const n = scoops + 1;
      setScoops(n);
      if (n >= LEAF_SCOOPS) { sfx.good(); setTimeout(() => setStep(1), 600); }
    } else {
      sfx.bad();
      flashFor("miss");
      setMiss((m) => m + 1);
    }
  };

  // ② 온도 바늘
  useEffect(() => {
    if (step !== 1) return;
    const t0 = performance.now();
    const loop = (t) => {
      const v = 50 + 48 * Math.sin((t - t0) * 0.0026);
      tempRef.current = v;
      setTemp(v);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step]);
  const doHeat = () => {
    const v = tempRef.current;
    if (v >= LEAF_TEMP_ZONE[0] && v <= LEAF_TEMP_ZONE[1]) {
      sfx.good();
      flashFor("good");
      pourStart();
      setTimeout(() => { pourStop(); setStep(2); setBrewing(true); }, 900);
    } else {
      sfx.bad();
      flashFor(v > LEAF_TEMP_ZONE[1] ? "hot" : "cold");
      setMiss((m) => m + 1);
    }
  };

  // ③ 우리기: 막대가 차올라요 (끝까지 가면 떫어져요)
  useEffect(() => {
    if (step !== 2 || !brewing) return;
    const t0 = performance.now();
    const start = brewRef.current;
    const loop = (t) => {
      const v = Math.min(100, start + ((t - t0) / 1000 / LEAF_BREW_SEC) * 100);
      brewRef.current = v;
      setBrew(v);
      if (v < 100) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [step, brewing]);
  const doPour = () => {
    if (!brewing) return;
    setBrewing(false);
    const v = brewRef.current;
    const score = v < LEAF_BREW_ZONE[0] ? "weak" : v > LEAF_BREW_ZONE[1] ? "bitter" : "good";
    setBrewScore(score);
    if (score === "good") sfx.good(); else sfx.bad();
    pourStart();
    setTimeout(() => { pourStop(); sfx.win(); setStep(3); }, 1100);
  };

  const teaColor = mix("#f3e7a6", "#8a5a1c", Math.min(1, brew / 100)); // 연한 연둣빛 → 진한 호박색

  if (step === 3) {
    let stars = 3;
    if (brewScore !== "good") stars--;
    if (miss >= 3) stars--;
    stars = Math.max(1, stars);
    return (
      <>
        <Stage>
          <div className="relative flex items-end gap-6">
            <CraftImg name="table_teapot" className="w-28" fallback={<span className="text-6xl">🫖</span>} />
            <div className="relative w-24">
              <CraftImg name="table_cup_full" className="w-full" fallback={<span className="text-6xl">🍵</span>} />
              {[0, 1].map((i) => (
                <span key={i} className="craft-bubble absolute h-5 w-3 rounded-full bg-white/80 blur-[2px]" style={{ left: 30 + i * 18, top: -6, animationDelay: `${i * 0.5}s` }} />
              ))}
            </div>
          </div>
        </Stage>
        <div className="mt-3">
          <Result
            kind="leaftea"
            stars={stars}
            comment={brewScore === "good" ? (stars === 3 ? "다연: “향이 정말 좋아요! 딱 알맞게 우러났어요” 🍃" : "다연: “맛있게 우러났어요!”") : brewScore === "weak" ? "다연: “조금 싱겁지만 은은하니 좋아요”" : "다연: “살짝 떫지만… 정성이 담겼어요!”"}
            taken={taken}
            onTake={() => { sendToTable("leaftea", stars); setTaken(true); sfx.pop(); }}
            onAgain={reset}
          />
        </div>
        <button type="button" onClick={onBack} className={`${BTN} mt-2 w-full bg-black/30 text-white`}>← 다른 게임 고르기</button>
      </>
    );
  }

  return (
    <div>
      <Steps list={["찻잎 넣기", "물 끓이기", "우리기"]} cur={step} />

      {step === 0 && (
        <>
          <Stage onPointerDown={doScoop} className={`cursor-pointer ${flash === "good" ? "bg-emerald-200" : flash ? "bg-rose-200" : ""}`}>
            {/* 다관 (가운데) */}
            <div className="absolute bottom-3 left-1/2 w-32 -translate-x-1/2">
              <CraftImg name="table_teapot" className="w-full" fallback={<span className="block text-center text-7xl">🫖</span>} />
            </div>
            {/* 목표 표시 (다관 입구) */}
            <span className="absolute left-1/2 top-[38%] h-3 w-12 -translate-x-1/2 rounded-full border-2 border-dashed border-[#14532d] bg-emerald-300/40" />
            {/* 찻숟가락 (좌우로) */}
            <div className="pointer-events-none absolute top-3 -translate-x-1/2 text-center" style={{ left: `${spoon}%` }}>
              <span className="block text-3xl leading-none">🥄</span>
              <span className="block text-lg leading-none">🍃</span>
            </div>
            {/* 넣은 찻잎이 떨어지는 모습 */}
            {flash === "good" && [0, 1, 2].map((i) => <span key={i} className="craft-powder absolute text-sm" style={{ left: `${46 + i * 4}%`, top: "22%", animationDelay: `${i * 0.06}s` }}>🍃</span>)}
            {flash && <span className="pointer-events-none absolute bottom-2 left-2 text-sm font-black text-[#2b1d1a]">{flash === "good" ? "쏙! 🍃" : "앗, 흘렸어요!"}</span>}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🥄 찻숟가락이 <b className="text-emerald-300">다관 위</b>에 왔을 때 탭! ({scoops}/{LEAF_SCOOPS})</p>
          <p className="text-center text-xs font-bold text-white/60">실수 {miss}</p>
        </>
      )}

      {step === 1 && (
        <>
          <Stage onPointerDown={doHeat} className={`cursor-pointer ${flash === "good" ? "bg-emerald-200" : flash ? "bg-rose-200" : ""}`}>
            <div className="flex h-full w-full items-center justify-around px-3">
              <div className="relative h-44 w-44">
                <CraftImg name="pot" className="absolute inset-0 h-full w-full" fallback={<span className="flex h-full items-center justify-center text-7xl">🫕</span>} />
                {temp > 50 && [0, 1, 2].map((i) => <span key={i} className="craft-bubble pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-[#2b1d1a] bg-white/90" style={{ left: `${30 + i * 12}%`, top: "22%", animationDelay: `${i * 0.3}s` }} />)}
              </div>
              {/* 온도 게이지 (세로) */}
              <div className="relative h-44 w-9 border-4 border-[#2b1d1a] bg-gradient-to-t from-sky-300 via-amber-200 to-rose-400">
                <div className="absolute inset-x-0 bg-emerald-400/90" style={{ bottom: `${LEAF_TEMP_ZONE[0]}%`, height: `${LEAF_TEMP_ZONE[1] - LEAF_TEMP_ZONE[0]}%`, boxShadow: "0 0 0 2px #14532d inset" }} />
                <div className="absolute -left-3 -right-3 h-1.5 bg-[#2b1d1a]" style={{ bottom: `${temp}%` }} />
                <span className="absolute -right-11 text-xs font-black text-[#14532d]" style={{ bottom: `${LEAF_TEMP_ZONE[0] + 2}%` }}>80℃</span>
              </div>
            </div>
            {flash && <span className="pointer-events-none absolute top-3 text-lg font-black text-[#2b1d1a]">{flash === "good" ? "딱 좋아요! 쪼르르~" : flash === "hot" ? "너무 뜨거워요! 찻잎이 데어요" : "아직 미지근해요 ❄️"}</span>}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🔥 바늘이 <b className="text-emerald-300">초록 구간(80℃)</b>일 때 탭!</p>
          <p className="text-center text-xs font-bold text-white/60">실수 {miss}</p>
        </>
      )}

      {step === 2 && (
        <>
          <Stage>
            <div className="relative flex items-end gap-5">
              <div className="w-28">
                <CraftImg name="table_teapot" className="w-full" fallback={<span className="text-6xl">🫖</span>} />
              </div>
              {/* 찻물 색 미리보기 (점점 진해져요) */}
              <div className="relative mb-3 h-20 w-20 rounded-b-[45%] border-4 border-[#2b1d1a] bg-white">
                <div className="absolute inset-x-1 bottom-1 top-2 rounded-b-[45%] transition-colors" style={{ background: teaColor }} />
                {[0, 1].map((i) => <span key={i} className="craft-bubble absolute h-4 w-2.5 rounded-full bg-white/80 blur-[2px]" style={{ left: 22 + i * 18, top: -14, animationDelay: `${i * 0.5}s` }} />)}
              </div>
            </div>
            {!brewing && brewScore && <span className="pointer-events-none absolute top-3 text-lg font-black text-[#2b1d1a]">{brewScore === "good" ? "향긋하게 우러났어요! 🍃" : brewScore === "weak" ? "조금 싱거워요" : "앗, 떫어졌어요!"}</span>}
          </Stage>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs font-bold text-white/80"><span>🍃 우림 정도</span><span>{brew < LEAF_BREW_ZONE[0] ? "연해요" : brew <= LEAF_BREW_ZONE[1] ? "딱 좋아요!" : "진해요"}</span></div>
            <div className="relative h-5 w-full border-4 border-[#1a110e] bg-black/40">
              <div className="absolute inset-y-0 bg-emerald-400/50" style={{ left: `${LEAF_BREW_ZONE[0]}%`, width: `${LEAF_BREW_ZONE[1] - LEAF_BREW_ZONE[0]}%` }} />
              <div className="relative h-full" style={{ width: `${brew}%`, background: teaColor }} />
            </div>
          </div>
          <button type="button" onClick={doPour} disabled={!brewing} className={`${BTN} mt-3 w-full bg-amber-400 text-[#2b1d1a]`}>🫖 지금 따르기!</button>
          <p className="mt-2 text-center text-sm text-white/85">막대가 <b className="text-emerald-300">초록 칸</b>에 있을 때 따라요</p>
        </>
      )}
      <button type="button" onClick={onBack} className={`${BTN} mt-3 w-full bg-[#6e4530] text-white`}>← 다른 게임 고르기</button>
    </div>
  );
}

// ---------------- 체험존 모달 ----------------
export default function TeaCraftModal({ open, onClose }) {
  const [game, setGame] = useState(null);
  useEffect(() => {
    if (!open) { setGame(null); pourStop(); }
  }, [open]);

  // 🎮 미니게임 목록 (한 화면에 모두)
  const GAMES = [
    { key: "matcha", emoji: "🍵", img: "matcha_bowl_foam", name: "말차", bg: "bg-[#bbf7d0] text-[#14532d]" },
    { key: "leaftea", emoji: "🍃", img: "table_cup_full", name: "잎차 우리기", bg: "bg-[#fef3c7] text-[#713f12]" },
    ...Object.entries(RECIPES).map(([k, r]) => ({ key: `dasik:${k}`, emoji: r.emoji, img: `${k}_done`, name: r.name.replace("군산 ", ""), bg: "bg-[#fbcfe8] text-[#831843]" })),
  ];
  const picked = GAMES.find((g) => g.key === game);
  return (
    <PixelModal open={open} onClose={onClose} label="🎮 미니게임" title={picked ? picked.name : "오늘은 무엇을 만들어 볼까요?"} width={420}>
      <style>{`
        @keyframes craft-dash-move { to { stroke-dashoffset: -24; } }
        .craft-dash { animation: craft-dash-move 0.8s linear infinite; }
        @keyframes craft-drop-in { 0% { transform: translateY(-30px); opacity: 0; } 70% { transform: translateY(3px); opacity: 1; } 100% { transform: translateY(0); } }
        .craft-drop { animation: craft-drop-in 0.35s ease-out both; transform-box: fill-box; }
        @keyframes craft-pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.18); } }
        .craft-target { animation: craft-pulse 0.9s ease-in-out infinite; }
        @keyframes craft-flicker { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.75); } }
        .craft-flame { animation: craft-flicker 0.25s ease-in-out infinite; transform-origin: bottom; transition: height 0.1s; }
        @keyframes craft-bub { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-16px); opacity: 0; } }
        .craft-bubble { animation: craft-bub 0.9s ease-out infinite; }
        @keyframes craft-shake-k { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }
        .craft-shake { animation: craft-shake-k 0.15s 3; }
        @keyframes craft-powder-fall { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(60px); opacity: 0; } }
        .craft-powder { animation: craft-powder-fall 0.6s ease-in both; }
        @keyframes craft-water-k { from { transform: rotate(30deg) scaleY(0); } to { transform: rotate(30deg) scaleY(1); } }
        .craft-water { animation: craft-water-k 0.2s ease-out both; }
        @keyframes craft-foam-k { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }
        .craft-foam { animation: craft-foam-k 0.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      `}</style>
      {!game && (
        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((g) => (
            <button key={g.key} type="button" onClick={() => { ac(); setGame(g.key); }} className={`${BTN} flex flex-col items-center gap-1 py-4 text-center ${g.bg}`}>
              <CraftImg name={g.img} className="h-16 w-16 object-contain" fallback={<span className="text-4xl">{g.emoji}</span>} />
              <span className="text-base">{g.name}</span>
            </button>
          ))}
        </div>
      )}
      {game?.startsWith("dasik:") && <DasikGame key={game} initialId={game.slice(6)} onBack={() => setGame(null)} />}
      {game === "matcha" && <MatchaGame onBack={() => setGame(null)} />}
      {game === "leaftea" && <LeafTeaGame onBack={() => setGame(null)} />}
    </PixelModal>
  );
}
