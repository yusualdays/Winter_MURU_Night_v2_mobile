"use client";

import { useEffect, useRef, useState } from "react";
import PixelModal from "./PixelModal";
import { partyData } from "../data";

// 🍡🍵 다도 체험존 미니게임 2종 (그림 파일 없이 CSS/SVG + Web Audio API 효과음만 사용)
//  1) 수제 다식 만들기 (쿠킹마마 스타일): 보늬밤 조림 / 곶감 호두말이 / 수제 매실청
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
  maesil: {
    name: "수제 매실청", emoji: "🍏", peel: "매실 꼭지 따기", cook: "설탕 녹이며 데우기", base: "#9cbf55", light: "#c8e08a", shell: "#5d7a2a",
  },
};
export const CRAFT_INFO = { ...RECIPES, matcha: { name: "내가 격불한 말차", emoji: "🍵", base: "#7fb36a" } };

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
      {shopUrl && (
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

// ---------------- 다식 그림 (SVG) ----------------
function DasikArt({ id, peel = 100, cooked = 0, garnish = [] }) {
  const r = RECIPES[id];
  const peeled = peel / 100;
  const C = 2 * Math.PI * 62; // 점선 둘레
  const glaze = cooked / 3;
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full">
      {/* 접시 */}
      <ellipse cx="100" cy="128" rx="88" ry="22" fill="#fff" stroke="#2b1d1a" strokeWidth="4" />
      {id === "maesil" ? (
        <g>
          {/* 유리병 */}
          <rect x="62" y="34" width="76" height="96" rx="10" fill="#e8f4ff" fillOpacity="0.6" stroke="#2b1d1a" strokeWidth="4" />
          <rect x="70" y="24" width="60" height="14" fill="#c08a57" stroke="#2b1d1a" strokeWidth="4" />
          <rect x="66" y={130 - 70 * Math.max(peeled * 0.4, glaze)} width="68" height={70 * Math.max(peeled * 0.4, glaze)} fill="#e7b84a" fillOpacity={0.3 + glaze * 0.5} />
          {[[85, 105], [112, 98], [98, 80], [80, 70], [118, 72]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="11" fill={r.base} stroke="#2b1d1a" strokeWidth="3" opacity={i / 5 < peeled ? 1 : 0.35} />
          ))}
        </g>
      ) : (
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
      )}
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
const GARNISH_SPOTS = [
  { x: 100, y: 46 }, { x: 70, y: 72 }, { x: 130, y: 72 }, { x: 84, y: 108 }, { x: 116, y: 108 },
];

// ---------------- 1) 수제 다식 만들기 ----------------
function DasikGame({ onBack }) {
  const [id, setId] = useState(null);
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
    if (!keep) setId(null);
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

  if (!id) {
    return (
      <div className="flex flex-col gap-2">
        <p className="mb-1 text-sm text-white/80">어떤 다식을 만들어 볼까요?</p>
        {Object.entries(RECIPES).map(([k, r]) => (
          <button key={k} type="button" onClick={() => { setId(k); reset(true); }} className={`${BTN} flex items-center gap-3 bg-[#f5e6c8] text-left text-[#2b1d1a]`}>
            <span className="text-3xl">{r.emoji}</span>
            <span>
              <span className="block">{r.name}</span>
              <span className="block text-xs font-bold text-[#2b1d1a]/60">{r.peel} → {r.cook} → 고명 올리기</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={onBack} className={`${BTN} mt-1 bg-[#6e4530] text-white`}>← 체험 고르기</button>
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
        <Stage><DasikArt id={id} peel={100} cooked={3} garnish={garnish} /></Stage>
        <div className="mt-3">
          <Result
            kind={id}
            stars={stars}
            comment={stars === 3 ? "다연: “사장님이 만든 것보다 예쁜데요?!” 🍵" : stars === 2 ? "다연: “윤기가 좌르르~ 정말 맛있어 보여요!”" : "다연: “조금 탔지만… 정성은 최고예요!”"}
            shopUrl={safeUrl(kit.url)}
            shopLabel={kit.label || "이 다식 DIY 키트 / 제철 과일 공구 보러가기"}
            taken={taken}
            onTake={() => { sendToTable(id, stars); setTaken(true); sfx.pop(); }}
            onAgain={() => reset(false)}
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
            <DasikArt id={id} peel={peel} />
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
              {/* 냄비 + 불 */}
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
            <DasikArt id={id} peel={100} cooked={3} garnish={garnish} />
            {/* 고명 자리 (SVG 200x160 기준 → %) */}
            {GARNISH_SPOTS.map((s, i) =>
              garnish.some((g) => g.spot === i) ? null : (
                <button key={i} type="button" aria-label="고명 올리기" onClick={() => placeGarnish(i)} className="craft-target absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white bg-white/25" style={{ left: `${(s.x / 200) * 100}%`, top: `${(s.y / 160) * 100}%` }} />
              )
            )}
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">✨ 고명을 고르고 반짝이는 자리를 탭해 올려요 ({garnish.length}/{GARNISH_SPOTS.length})</p>
          <div className="flex justify-center gap-2">
            {[["jat", "🤍 잣"], ["herb", "🌿 허브"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTool(k)} className={`${BTN} ${tool === k ? "bg-amber-300 text-[#2b1d1a]" : "bg-black/30 text-white"}`}>{l}</button>
            ))}
          </div>
        </>
      )}
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
          <Bowl>
            <ellipse cx="100" cy="72" rx="62" ry="14" fill={tea} />
            {Array.from({ length: bubbles }, (_, i) => (
              <circle key={i} cx={50 + ((i * 37) % 100)} cy={64 + ((i * 13) % 14)} r={2 + (i % 3)} fill="#e9f8e4" opacity="0.8" />
            ))}
          </Bowl>
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
            <Bowl>
              {sift > 0 && <ellipse cx="100" cy="74" rx={10 + sift * 9} ry={3 + sift * 2.5} fill="#5d8a2f" />}
            </Bowl>
            {/* 체 */}
            <div key={sift} className="craft-shake pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
              <div className="h-12 w-24 rounded-b-full border-4 border-[#1a110e]" style={{ background: "repeating-linear-gradient(45deg,#d6d3d1 0 3px,#a8a29e 3px 6px)" }} />
              {sift > 0 && sift < 3 && [0, 1, 2, 3].map((i) => <span key={i} className="craft-powder absolute h-1.5 w-1.5 rounded-full bg-[#5d8a2f]" style={{ left: 28 + i * 12, top: 44, animationDelay: `${i * 0.08}s` }} />)}
            </div>
          </Stage>
          <p className="my-2 text-center text-sm text-white/85">🥄 다완을 탭해 말차 가루를 체에 쳐요 ({sift}/3)</p>
        </>
      )}

      {step === 1 && (
        <>
          <Stage>
            <Bowl>
              <ellipse cx="100" cy="74" rx="37" ry="10" fill="#5d8a2f" />
              {water > 0 && <ellipse cx="100" cy="72" rx={Math.min(64, 30 + water * 0.4)} ry={Math.min(16, 8 + water * 0.1)} fill={mix("#7fae4a", "#3f6f22", Math.min(1, water / 70))} />}
            </Bowl>
            {/* 주전자 */}
            <div className="pointer-events-none absolute right-6 top-4 transition-transform duration-200" style={{ transform: pouring ? "rotate(-35deg)" : "none", transformOrigin: "20% 80%" }}>
              <div className="relative h-14 w-16 rounded-t-3xl border-4 border-[#1a110e] bg-[#9ca3af]">
                <span className="absolute -left-6 top-4 h-2.5 w-7 -rotate-12 border-4 border-[#1a110e] bg-[#9ca3af]" />
                <span className="absolute -top-3 left-5 h-3 w-5 border-4 border-[#1a110e] bg-[#6b7280]" />
              </div>
              {pouring && <span className="craft-water absolute -left-6 top-6 block h-16 w-1.5 origin-top rotate-[30deg] bg-sky-200/90" />}
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
            <Bowl>
              <ellipse cx="100" cy="72" rx="62" ry="14" fill={tea} />
              {Array.from({ length: bubbles }, (_, i) => (
                <circle key={i} cx={50 + ((i * 37) % 100)} cy={64 + ((i * 13) % 14)} r={2 + (i % 3)} fill="#e9f8e4" opacity="0.8" className="craft-foam" />
              ))}
            </Bowl>
            {/* 차선 */}
            <div className="pointer-events-none absolute top-2 -translate-x-1/2 transition-[left] duration-75" style={{ left: `${whiskX}%`, transform: `translateX(-50%) rotate(${(whiskX - 50) * 0.35}deg)` }}>
              <div className="mx-auto h-16 w-3 border-2 border-[#1a110e] bg-[#e7c98f]" />
              <div className="h-12 w-10 rounded-b-full border-2 border-[#1a110e]" style={{ background: "repeating-linear-gradient(90deg,#f1dcaa 0 2px,#c9a86a 2px 4px)" }} />
            </div>
          </Stage>
          <div className="my-2 flex items-center justify-between text-sm font-bold text-white/85">
            <span>🎋 좌우로 빠르게 문지르거나 연타!</span>
            <span className={`font-black ${left < 3 ? "text-rose-300" : "text-amber-200"}`}>⏱ {started ? left.toFixed(1) : WHISK_SEC}초</span>
          </div>
          <Gauge value={foam} label="거품 게이지" color={tea} />
        </>
      )}
      <button type="button" onClick={onBack} className={`${BTN} mt-3 w-full bg-[#6e4530] text-white`}>← 체험 고르기</button>
    </div>
  );
}

// ---------------- 체험존 모달 ----------------
export default function TeaCraftModal({ open, onClose }) {
  const [game, setGame] = useState(null);
  useEffect(() => {
    if (!open) { setGame(null); pourStop(); }
  }, [open]);

  return (
    <PixelModal open={open} onClose={onClose} label="🍵 다도 체험존" title={game === "dasik" ? "수제 다식 만들기" : game === "matcha" ? "말차 격불하기" : "오늘은 무엇을 만들어 볼까요?"} width={420}>
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
        @keyframes craft-shake-k { 0%,100% { transform: translateX(-50%); } 25% { transform: translateX(-58%); } 75% { transform: translateX(-42%); } }
        .craft-shake { animation: craft-shake-k 0.15s 3; }
        @keyframes craft-powder-fall { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(60px); opacity: 0; } }
        .craft-powder { animation: craft-powder-fall 0.6s ease-in both; }
        @keyframes craft-water-k { from { transform: rotate(30deg) scaleY(0); } to { transform: rotate(30deg) scaleY(1); } }
        .craft-water { animation: craft-water-k 0.2s ease-out both; }
        @keyframes craft-foam-k { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }
        .craft-foam { animation: craft-foam-k 0.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      `}</style>
      {!game && (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => { ac(); setGame("dasik"); }} className={`${BTN} flex items-center gap-3 bg-[#fbcfe8] text-left text-[#831843]`}>
            <span className="text-4xl">🍡</span>
            <span><span className="block text-base">수제 다식 만들기</span><span className="block text-xs font-bold opacity-70">보늬밤 · 곶감 호두말이 · 매실청 (3단계)</span></span>
          </button>
          <button type="button" onClick={() => { ac(); setGame("matcha"); }} className={`${BTN} flex items-center gap-3 bg-[#bbf7d0] text-left text-[#14532d]`}>
            <span className="text-4xl">🍵</span>
            <span><span className="block text-base">말차 격불하기</span><span className="block text-xs font-bold opacity-70">체 치기 → 온수 붓기 → 10초 차선 젓기</span></span>
          </button>
          <p className="text-center text-xs text-white/60">🔊 소리를 켜면 더 재미있어요 · 완성하면 내 테이블로 가져가 먹을 수 있어요</p>
        </div>
      )}
      {game === "dasik" && <DasikGame onBack={() => setGame(null)} />}
      {game === "matcha" && <MatchaGame onBack={() => setGame(null)} />}
    </PixelModal>
  );
}
