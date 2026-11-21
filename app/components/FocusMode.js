"use client";

import { useEffect, useRef, useState } from "react";
import { sfxLevel, onSound } from "../lib/sound";

// 📖 공부 집중 모드 + 🎧 백색소음 믹서 (mp3 없이 Web Audio API로 직접 만든 소리)
//  - [📖 공부 집중 모드 ON/OFF]: 켜면 파티 UI가 숨고, 도트 뽀모도로 타이머(25분 집중 / 5분 휴식)가 떠요
//    머리 위 "📖 집중 중..." 표시 + 1:1 대화 신청이 막혀요 (SimpleRoom의 focus)
//  - 🔥 장작불 / 🫖 찻물 끓는 소리 / 🌧️ 빗소리 / 🍃 바람·풍경 소리 — 따로따로 볼륨 (이 브라우저에 기억)

const FOCUS_MIN = 25;
const BREAK_MIN = 5;
const VOL_KEY = "partyNoiseMix";

const BOX = "border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]";
const BTN = `${BOX} px-3 py-1.5 text-sm font-black active:translate-y-0.5 active:shadow-none`;

export const SOUNDS = [
  { id: "fire", icon: "🔥", name: "장작불 소리" },
  { id: "kettle", icon: "🫖", name: "찻물 끓는 소리" },
  { id: "rain", icon: "🌧️", name: "빗소리" },
  { id: "wind", icon: "🍃", name: "바람·풍경 소리" },
];

// ---------------- 🎧 소리 엔진 (페이지 하나에 하나) ----------------
const engine = { ctx: null, master: null, ch: {}, timers: [] };

function noiseBuffer(a, kind) {
  const len = a.sampleRate * 4;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (kind === "pink") {
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else d[i] = w;
  }
  return buf;
}
function loop(a, buf, out, filterType, freq, q = 0.7) {
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(out);
  src.start();
  return f;
}
// 짧은 "톡" (장작 튀는 소리 · 빗방울 · 찻물 보글)
function blip(out, { freq = 2000, ms = 20, vol = 0.5, type = "noise" }) {
  const a = engine.ctx;
  if (!a) return;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  g.connect(out);
  if (type === "noise") {
    const len = Math.max(1, Math.floor((a.sampleRate * ms) / 1000));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource();
    s.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    s.connect(f).connect(g);
    s.start();
  } else {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (type === "bubble") o.frequency.exponentialRampToValueAtTime(freq * 1.8, a.currentTime + ms / 1000);
    o.connect(g);
    o.start();
    o.stop(a.currentTime + ms / 1000 + 0.05);
  }
}
// 풍경 (맑은 종소리: 배음 몇 개)
function chime(out) {
  const a = engine.ctx;
  const base = [1046, 1175, 1318, 1568, 1760][Math.floor(Math.random() * 5)];
  [1, 2.76, 5.4].forEach((m, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = base * m;
    g.gain.setValueAtTime(0.12 / (i + 1), a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 2.5 - i * 0.6);
    o.connect(g).connect(out);
    o.start();
    o.stop(a.currentTime + 2.6);
  });
}
function every(fn, min, max) {
  let id;
  const go = () => {
    fn();
    id = setTimeout(go, min + Math.random() * (max - min));
    engine.timers.push(id);
  };
  id = setTimeout(go, min + Math.random() * (max - min));
  engine.timers.push(id);
}

function startEngine() {
  if (engine.ctx) {
    if (engine.ctx.state === "suspended") engine.ctx.resume();
    return true;
  }
  if (typeof window === "undefined") return false;
  let a;
  try {
    a = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return false;
  }
  engine.ctx = a;
  engine.master = a.createGain();
  engine.master.gain.value = sfxLevel() * 3; // 🔔 효과음 소리 크기 (모든 방 공통)
  engine.master.connect(a.destination);
  onSound(() => engine.master && engine.master.gain.setTargetAtTime(sfxLevel() * 3, a.currentTime, 0.1));
  const white = noiseBuffer(a, "white");
  const pink = noiseBuffer(a, "pink");
  const brown = noiseBuffer(a, "brown");
  const mk = (id) => {
    const g = a.createGain();
    g.gain.value = 0;
    g.connect(engine.master);
    engine.ch[id] = g;
    return g;
  };

  // 🔥 장작불: 낮게 웅웅거리는 소리 + 탁·타닥 튀는 소리
  const fire = mk("fire");
  loop(a, brown, fire, "lowpass", 500);
  every(() => {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) setTimeout(() => blip(fire, { freq: 1500 + Math.random() * 3000, ms: 8 + Math.random() * 25, vol: 0.4 + Math.random() * 0.6 }), i * (20 + Math.random() * 60));
  }, 60, 420);

  // 🫖 찻물 끓는 소리: 쉬익 하는 김 + 보글보글
  const kettle = mk("kettle");
  const hiss = a.createGain();
  hiss.gain.value = 0.25;
  hiss.connect(kettle);
  loop(a, pink, hiss, "bandpass", 5200, 1.2);
  const rumble = a.createGain();
  rumble.gain.value = 0.6;
  rumble.connect(kettle);
  loop(a, brown, rumble, "lowpass", 260);
  every(() => blip(kettle, { type: "bubble", freq: 300 + Math.random() * 500, ms: 40 + Math.random() * 60, vol: 0.15 + Math.random() * 0.2 }), 30, 160);

  // 🌧️ 빗소리: 촤아아 + 톡톡 떨어지는 빗방울
  const rain = mk("rain");
  const bed = a.createGain();
  bed.gain.value = 0.7;
  bed.connect(rain);
  loop(a, pink, bed, "highpass", 900);
  loop(a, brown, bed, "lowpass", 400);
  every(() => blip(rain, { freq: 2500 + Math.random() * 4000, ms: 6 + Math.random() * 10, vol: 0.2 + Math.random() * 0.3 }), 15, 90);

  // 🍃 바람·풍경: 천천히 커졌다 작아지는 바람 + 가끔 딸랑 풍경
  const wind = mk("wind");
  const wf = loop(a, pink, wind, "bandpass", 500, 2.5);
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 320;
  lfo.connect(lfoGain).connect(wf.frequency);
  lfo.start();
  every(() => chime(wind), 2500, 7000);
  return true;
}

function setVolume(id, v) {
  const g = engine.ch[id];
  if (!g || !engine.ctx) return;
  // 사람 귀에 맞게 (작은 값에서 더 섬세하게)
  g.gain.setTargetAtTime(Math.pow(v / 100, 2) * (id === "kettle" ? 1.4 : 1), engine.ctx.currentTime, 0.15);
}

// ---------------- 🌦️ 찻집 자동 백색소음 ----------------
//  찻집에서는 날씨에 맞는 소리 하나만 자동으로 (집중 패널 믹서를 직접 만지면 그때부터는 손님이 고른 대로)
//   평소: 🫖 찻물 끓는 소리 / 비: 🌧️ 빗소리 / 최저기온 -20℃ 이하: 🔥 장작불 / 태풍(강풍): 🍃 바람·풍경
let ambientId = null;
let manualMix = false;
export function setAmbient(id) {
  ambientId = id;
  if (manualMix) return;
  const apply = () => SOUNDS.forEach((s) => setVolume(s.id, s.id === id ? 70 : 0));
  if (engine.ctx) apply();
}
// 첫 터치 때 소리 켜기 (브라우저 규칙) — 찻집 페이지에서 써요
export function useCafeAmbient(id) {
  useEffect(() => {
    setAmbient(id);
    const go = () => {
      if (startEngine() && !manualMix) setAmbient(ambientId);
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, [id]);
  // 찻집을 나가면 조용히
  useEffect(
    () => () => {
      ambientId = null;
      if (!manualMix) SOUNDS.forEach((s) => setVolume(s.id, 0));
    },
    []
  );
}

// ---------------- 🎧 믹서 (집중 패널) ----------------
function loadVols() {
  try {
    return { fire: 0, kettle: 0, rain: 0, wind: 0, ...JSON.parse(localStorage.getItem(VOL_KEY) || "{}") };
  } catch {
    return { fire: 0, kettle: 0, rain: 0, wind: 0 };
  }
}
// light: 크림색 설정창용 (거실과 같은 모양) / 아니면 어두운 창용
export function NoiseMixer({ light = false }) {
  const [vols, setVols] = useState({ fire: 0, kettle: 0, rain: 0, wind: 0 });
  useEffect(() => setVols(loadVols()), []);
  const change = (id, v) => {
    startEngine(); // 첫 조작 때 소리 켜기 (브라우저 자동 재생 규칙)
    manualMix = true; // 손님이 직접 고르면 자동 백색소음은 멈춰요
    const next = { ...vols, [id]: v };
    setVols(next);
    try {
      localStorage.setItem(VOL_KEY, JSON.stringify(next));
    } catch {}
    Object.entries(next).forEach(([k, val]) => setVolume(k, val));
  };
  const any = Object.values(vols).some((v) => v > 0);
  if (light) {
    return (
      <div className="flex flex-col gap-3">
        {SOUNDS.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#2b1d1a] bg-[#efe0c0] text-lg">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-xs font-bold text-[#2b1d1a]">
                <span>{s.name}</span>
                <span className="tabular-nums text-[#5b3b2a]">{vols[s.id] === 0 ? "🔇" : `${vols[s.id]}%`}</span>
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={vols[s.id]}
                onChange={(e) => change(s.id, Number(e.target.value))}
                onPointerUp={(e) => e.currentTarget.blur()}
                aria-label={`${s.name} 볼륨`}
                className="mt-1 h-6 w-full cursor-pointer accent-[#c8323a] [@media(pointer:fine)]:h-1.5"
              />
            </div>
          </div>
        ))}
        {any && (
          <button type="button" onClick={() => SOUNDS.forEach((s) => change(s.id, 0))} className="self-end text-xs font-bold text-[#5b3b2a] underline">
            모두 끄기
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-black text-amber-200">🎧 백색소음 믹서</p>
      {SOUNDS.map((s) => (
        <label key={s.id} className="flex items-center gap-2 text-sm text-white">
          <span className="w-28 shrink-0 font-bold">{s.icon} {s.name}</span>
          <input type="range" min="0" max="100" value={vols[s.id]} onChange={(e) => change(s.id, Number(e.target.value))} className="h-2 min-w-0 flex-1 accent-amber-400" />
          <span className="w-8 text-right text-xs tabular-nums text-white/60">{vols[s.id]}</span>
        </label>
      ))}
      {any && (
        <button type="button" onClick={() => SOUNDS.forEach((s) => change(s.id, 0))} className="self-end text-xs font-bold text-white/60 underline">
          모두 끄기
        </button>
      )}
    </div>
  );
}

// 새로고침 뒤에도 기억해 둔 볼륨으로 이어 듣기 (첫 터치 때 시작)
function useResumeMix() {
  useEffect(() => {
    if (ambientId) return; // 찻집 자동 백색소음이 켜져 있으면 그걸로
    const vols = loadVols();
    if (!Object.values(vols).some((v) => v > 0)) return;
    const go = () => {
      if (startEngine()) Object.entries(loadVols()).forEach(([k, v]) => setVolume(k, v));
      window.removeEventListener("pointerdown", go);
    };
    window.addEventListener("pointerdown", go);
    return () => window.removeEventListener("pointerdown", go);
  }, []);
}

// ---------------- ⏱ 도트 뽀모도로 타이머 ----------------
function beep(times = 2) {
  if (!startEngine()) return;
  const a = engine.ctx;
  for (let i = 0; i < times; i++) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "square";
    o.frequency.value = 880;
    const t = a.currentTime + i * 0.25;
    g.gain.setValueAtTime(Math.max(0.0002, 0.08 * sfxLevel() * 3), t); // 🔔 효과음 크기
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}

// 7세그먼트 도트 숫자
const SEG = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
function Digit({ n, color }) {
  const on = SEG[n] || "";
  const c = (s) => (on.includes(s) ? color : "rgba(255,255,255,0.06)");
  return (
    <svg viewBox="0 0 5 9" width="30" height="54" shapeRendering="crispEdges">
      <rect x="1" y="0" width="3" height="1" fill={c("a")} />
      <rect x="4" y="1" width="1" height="3" fill={c("b")} />
      <rect x="4" y="5" width="1" height="3" fill={c("c")} />
      <rect x="1" y="8" width="3" height="1" fill={c("d")} />
      <rect x="0" y="5" width="1" height="3" fill={c("e")} />
      <rect x="0" y="1" width="1" height="3" fill={c("f")} />
      <rect x="1" y="4" width="3" height="1" fill={c("g")} />
    </svg>
  );
}

//  mini: 휴대폰용 한 줄 (⏱ 남은 시간 + ▶/⏸ + 펼치기) — 접었다 펴도 타이머는 그대로 이어져요
function Pomodoro({ mini = false, onExpand, extra = null }) {
  const [mode, setMode] = useState("focus"); // focus | break
  const [left, setLeft] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const endRef = useRef(0);
  const modeRef = useRef("focus");

  useEffect(() => {
    if (!running) return;
    endRef.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        beep(3);
        const next = modeRef.current === "focus" ? "break" : "focus";
        if (modeRef.current === "focus") setRounds((r) => r + 1);
        modeRef.current = next;
        const sec = (next === "focus" ? FOCUS_MIN : BREAK_MIN) * 60;
        endRef.current = Date.now() + sec * 1000;
        setMode(next);
        setLeft(sec);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const reset = (m = mode) => {
    setRunning(false);
    setMode(m);
    modeRef.current = m;
    setLeft((m === "focus" ? FOCUS_MIN : BREAK_MIN) * 60);
  };
  const total = (mode === "focus" ? FOCUS_MIN : BREAK_MIN) * 60;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const color = mode === "focus" ? "#fbbf24" : "#6ee7b7";
  const blocks = 20;
  const done = Math.round(((total - left) / total) * blocks);

  if (mini) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">{mode === "focus" ? "📖" : "🍵"}</span>
        <span className="min-w-[3.4rem] font-mono text-lg font-black tabular-nums leading-none" style={{ color }}>
          {mm}:{ss}
        </span>
        <button type="button" onClick={() => { startEngine(); setRunning((r) => !r); }} aria-label={running ? "잠깐 멈춤" : "시작"} className={`border-2 border-[#1a110e] px-2 py-0.5 text-xs font-black ${running ? "bg-[#6e4530] text-white" : "bg-amber-400 text-[#2b1d1a]"}`}>
          {running ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={onExpand} aria-label="크게 보기" className="border-2 border-[#1a110e] bg-[#f5e6c8] px-2 py-0.5 text-xs font-black text-[#2b1d1a]">
          ⤢
        </button>
        {extra}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[["focus", `📖 집중 ${FOCUS_MIN}분`], ["break", `🍵 휴식 ${BREAK_MIN}분`]].map(([m, l]) => (
          <button key={m} type="button" onClick={() => reset(m)} className={`border-2 border-[#1a110e] px-2 py-0.5 text-xs font-black ${mode === m ? "bg-amber-300 text-[#2b1d1a]" : "bg-black/30 text-white/70"}`}>{l}</button>
        ))}
      </div>
      <div className="flex items-center gap-1 border-4 border-[#1a110e] bg-[#111] px-3 py-2">
        <Digit n={+mm[0]} color={color} />
        <Digit n={+mm[1]} color={color} />
        <svg viewBox="0 0 1 9" width="6" height="54" shapeRendering="crispEdges">
          <rect y="2" width="1" height="1" fill={running && left % 2 ? "transparent" : color} />
          <rect y="6" width="1" height="1" fill={running && left % 2 ? "transparent" : color} />
        </svg>
        <Digit n={+ss[0]} color={color} />
        <Digit n={+ss[1]} color={color} />
      </div>
      {/* 도트 진행 막대 */}
      <div className="flex gap-[3px]">
        {Array.from({ length: blocks }, (_, i) => (
          <span key={i} className="h-2.5 w-2.5 border border-[#1a110e]" style={{ background: i < done ? color : "rgba(0,0,0,0.35)" }} />
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => { startEngine(); setRunning((r) => !r); }} className={`${BTN} ${running ? "bg-[#6e4530] text-white" : "bg-amber-400 text-[#2b1d1a]"}`}>
          {running ? "⏸ 잠깐 멈춤" : "▶ 시작"}
        </button>
        <button type="button" onClick={() => reset()} className={`${BTN} bg-black/30 text-white`}>↺ 처음부터</button>
      </div>
      <p className="text-xs font-bold text-white/60">{mode === "focus" ? "한 가지에만 집중해요" : "기지개 켜고 차 한 모금 🍵"} · 완료 {"🍅".repeat(Math.min(rounds, 8)) || "0"}</p>
    </div>
  );
}

// ---------------- 토글 + 패널 ----------------
//  compact: 자리 주문 바 안에 들어가는 작은 버튼
export function FocusToggle({ focus, setFocus, compact = false }) {
  useResumeMix();
  return (
    <button
      type="button"
      onClick={() => setFocus(!focus)}
      aria-pressed={focus}
      className={`flex items-center gap-1.5 whitespace-nowrap border-4 border-[#1a110e] font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none ${compact ? "px-3 py-1.5 text-sm" : "h-12 px-3 text-sm"} ${focus ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#f5e6c8] text-[#2b1d1a]"}`}
    >
      📖 {compact ? "집중 모드" : <span className="hidden sm:inline">공부 집중 모드</span>} {focus ? "ON" : "OFF"}
    </button>
  );
}

//  onOff: [집중 모드 끄기] (자리에서 일어난 뒤에도 끌 수 있게)
//  prop / onProp: 내 캐릭터가 📖 책을 읽을지 💻 노트북을 할지 (모두에게 보여요)
export function FocusPanel({ onOff, prop = "book", onProp }) {
  useResumeMix();
  const [mixOpen, setMixOpen] = useState(false);
  // 📱 휴대폰(좁은 화면·터치)에서는 처음부터 작게 → 캐릭터가 보이게
  const [small, setSmall] = useState(false);
  const [touchy, setTouchy] = useState(false);
  useEffect(() => {
    try {
      const m = window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
      setSmall(m);
      setTouchy(m);
    } catch {}
  }, []);
  // (아래 순서를 바꾸지 마세요: 작게/크게 바꿔도 타이머가 이어지도록 Pomodoro 자리가 그대로예요)
  return (
    <div className={small ? `${BOX} bg-[#2b1d1a]/95 px-2 py-1.5` : `${BOX} w-[min(20rem,calc(100vw-2rem))] bg-[#2b1d1a]/95 p-3`}>
      {!small && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-black text-amber-200">📖 공부 집중 모드</p>
          <div className="flex gap-1">
            {touchy && (
              <button type="button" onClick={() => setSmall(true)} className="border-2 border-[#1a110e] bg-black/30 px-2 py-0.5 text-xs font-black text-white">
                작게 ▴
              </button>
            )}
            {onOff && (
              <button type="button" onClick={onOff} className="border-2 border-[#1a110e] bg-[#f5e6c8] px-2 py-0.5 text-xs font-black text-[#2b1d1a]">
                끄기 ✕
              </button>
            )}
          </div>
        </div>
      )}
      {!small && onProp && (
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {[["book", "📖 책 읽기"], ["laptop", "💻 노트북"]].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => onProp(k)}
              aria-pressed={prop === k}
              className={`border-2 border-[#1a110e] py-1 text-xs font-black ${prop === k ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#f5e6c8]/80 text-[#2b1d1a]"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <Pomodoro
        mini={small}
        onExpand={() => setSmall(false)}
        extra={
          onOff ? (
            <button type="button" onClick={onOff} aria-label="집중 모드 끄기" className="border-2 border-[#1a110e] bg-black/30 px-1.5 py-0.5 text-xs font-black text-white">
              ✕
            </button>
          ) : null
        }
      />
      {!small && (
        <button type="button" onClick={() => setMixOpen((o) => !o)} className="mt-3 w-full border-t-2 border-white/15 pt-2 text-left text-xs font-black text-white/80">
          {mixOpen ? "▾" : "▸"} 🎧 백색소음 섞어 듣기
        </button>
      )}
      {!small && mixOpen && (
        <div className="mt-2">
          <NoiseMixer />
        </div>
      )}
    </div>
  );
}
