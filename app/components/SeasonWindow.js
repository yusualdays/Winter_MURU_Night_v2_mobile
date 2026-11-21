"use client";

import { useEffect, useState } from "react";
import { useImgOk, craftSrc } from "./CraftImg";

// 🪟 찻집 통창 — 계절별 바깥 풍경 (봄 벚꽃 / 여름 햇살 / 가을 단풍 노을 / 겨울 밤눈 / 비 오는 날)
//  - 그림: public/craft/window_{계절}.png (찻집 배경과 같은 2400x1792 크기, 창문 자리에만 풍경) → 있으면 그림, 없으면 코드 그림
//  - 그림 위에 꽃잎·눈·빗줄기가 살짝 내려서 창밖이 움직여 보여요
//  - rect: 통창 자리 (맵 좌표 px) — 이 네모 안에서만 보여요 (overflow-hidden 마스킹)
//  - 배경 그림이 생기면 그림 속 통창 좌표(WINDOW_AREA)만 맞춰 주면 돼요. frame={false}로 창틀을 끌 수 있어요
export const SEASONS = [
  { id: "spring", icon: "🌸", label: "봄", sub: "벚꽃" },
  { id: "summer", icon: "🌿", label: "여름", sub: "초록 햇살" },
  { id: "autumn", icon: "🍁", label: "가을", sub: "단풍" },
  { id: "winter", icon: "❄️", label: "겨울", sub: "눈 쌓인 숲" },
  { id: "rain", icon: "🌧️", label: "비", sub: "비 오는 날" },
];

// 📅 날짜 → 계절 (3~5월 봄 · 6~8월 여름 · 9~11월 가을 · 12~2월 겨울)
export function seasonByDate(d = new Date()) {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

// 🌦️ 지금 군산 날씨 (Open-Meteo 무료 날씨 API · 열쇠 필요 없음) — 창밖 풍경 + 찻집 자동 백색소음
//  - 찻집에 들어올 때 한 번 + 15분마다 다시 확인해요
//  - 날씨 코드: 눈 71~77, 85~86 / 비 51~67(이슬비·비·어는 비), 80~82(소나기), 95~99(뇌우)
const GUNSAN = { lat: 35.9676, lon: 126.7366 };
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${GUNSAN.lat}&longitude=${GUNSAN.lon}&current=weather_code,rain,showers,snowfall,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_min&forecast_days=1&timezone=Asia%2FSeoul`;
export function weatherKind(c) {
  if (!c) return null;
  const code = Number(c.weather_code);
  if ((code >= 71 && code <= 77) || code === 85 || code === 86 || c.snowfall > 0) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || c.rain > 0 || c.showers > 0) return "rain";
  return null;
}
// 태풍처럼 바람이 아주 센지 (평균 풍속 50km/h≈14m/s 이상 또는 순간 돌풍 75km/h≈21m/s 이상)
export const isStorm = (c) => !!c && ((c.wind_speed_10m ?? 0) >= 50 || (c.wind_gusts_10m ?? 0) >= 75);
// 날씨 → 찻집 자동 백색소음 (태풍 > 비 > 영하 20도 이하 > 평소)
export function ambientOf(w) {
  if (!w) return "kettle";
  if (w.storm) return "wind";
  if (w.kind === "rain") return "rain";
  if (w.minTemp !== null && w.minTemp <= -20) return "fire";
  return "kettle";
}
// → { kind: "rain" | "snow" | null, storm, minTemp } (확인 실패면 null)
export function useGunsanWeather() {
  const [w, setW] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch(WEATHER_URL)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive || !j) return;
          const min = j.daily?.temperature_2m_min?.[0];
          setW({ kind: weatherKind(j.current), storm: isStorm(j.current), minTemp: typeof min === "number" ? min : null });
        })
        .catch(() => {}); // 인터넷·API 문제면 그냥 계절 풍경 · 찻물 끓는 소리
    check();
    const t = setInterval(check, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return w;
}

const LOOK = {
  spring: {
    sky: "linear-gradient(#bfe3ff 0%, #ffe4f1 75%)",
    hills: ["#f9a8d4", "#f472b6"],
    ground: "#a7d98b",
    particle: ["#fbcfe8", "#f9a8d4", "#ffffff"],
    kind: "petal",
  },
  summer: {
    sky: "linear-gradient(#7dd3fc 0%, #e0f7ff 80%)",
    hills: ["#4ade80", "#16a34a"],
    ground: "#65a30d",
    particle: ["#fef9c3", "#ffffff", "#fde68a"],
    kind: "sparkle",
  },
  autumn: {
    sky: "linear-gradient(#7c3aed 0%, #f97316 55%, #fcd34d 100%)",
    hills: ["#ea580c", "#b91c1c"],
    ground: "#92400e",
    particle: ["#f97316", "#dc2626", "#facc15"],
    kind: "leaf",
  },
  winter: {
    sky: "linear-gradient(#0f172a 0%, #1e3a8a 80%)",
    hills: ["#cbd5e1", "#94a3b8"],
    ground: "#e2e8f0",
    particle: ["#ffffff", "#e0f2fe", "#ffffff"],
    kind: "snow",
  },
  rain: {
    sky: "linear-gradient(#64748b 0%, #a3b8c2 80%)",
    hills: ["#4d7c5b", "#2f5a3f"],
    ground: "#3f6b45",
    particle: ["#e0f2fe", "#cbd5e1", "#ffffff"],
    kind: "rain",
  },
};

const COUNT = 22;

export default function SeasonWindow({ rect, season = "winter", frame = true, mapW, mapH }) {
  const id = LOOK[season] ? season : "winter";
  const look = LOOK[id];
  const { x, y, w, h } = rect;
  const pic = useImgOk(`window_${id}`) === true && mapW && mapH; // 풍경 그림이 있으면 그림으로
  return (
    <div className="pointer-events-none absolute overflow-hidden" style={{ left: x, top: y, width: w, height: h, background: pic ? "#9fb4b8" : look.sky }}>
      <style>{`
        @keyframes sw-fall { 0% { transform: translate(0, -20px) rotate(0deg); } 50% { transform: translate(var(--sway), calc(var(--h) * 0.5)) rotate(180deg); } 100% { transform: translate(calc(var(--sway) * -0.4), calc(var(--h) + 20px)) rotate(360deg); } }
        @keyframes sw-drift { 0% { transform: translate(-30px, 10px); } 100% { transform: translate(calc(var(--w) + 30px), calc(var(--h) * 0.4)); } }
        @keyframes sw-twinkle { 0%, 100% { opacity: 0.2; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-14px); } }
        @keyframes sw-rain { 0% { transform: translate(0, -40px) rotate(12deg); } 100% { transform: translate(calc(var(--h) * -0.2), calc(var(--h) + 40px)) rotate(12deg); } }
      `}</style>

      {/* 🖼️ 풍경 그림 (찻집 배경과 같은 크기라서, 창문 자리만큼만 잘라 보여요) */}
      {pic && <img src={craftSrc(`window_${id}`)} alt="" draggable={false} className="absolute max-w-none" style={{ left: -x, top: -y, width: mapW, height: mapH }} />}

      {/* 해 · 달 */}
      {!pic && season === "winter" && <span className="absolute h-10 w-10 bg-[#fef9c3] shadow-[0_0_20px_6px_rgba(254,249,195,0.5)]" style={{ right: "12%", top: "16%", borderRadius: 4 }} />}
      {!pic && season === "summer" && <span className="absolute h-14 w-14 bg-[#fde047] shadow-[0_0_30px_12px_rgba(253,224,71,0.6)]" style={{ right: "10%", top: "10%", borderRadius: 6 }} />}
      {!pic && season === "autumn" && <span className="absolute h-16 w-16 bg-[#fb923c] opacity-90" style={{ left: "45%", bottom: "18%", borderRadius: 8 }} />}

      {/* 먼 산 · 나무 (도트 계단 모양) */}
      {!pic && [0, 1].map((layer) => (
        <div key={layer} className="absolute inset-x-0 bottom-0 flex items-end" style={{ height: `${45 - layer * 15}%` }}>
          {Array.from({ length: 14 }, (_, i) => {
            const hh = 40 + (((i * 37 + layer * 11) % 7) * 9);
            return <span key={i} className="flex-1" style={{ height: `${hh}%`, background: look.hills[layer], marginLeft: -1 }} />;
          })}
        </div>
      ))}
      {!pic && <div className="absolute inset-x-0 bottom-0 h-[10%]" style={{ background: look.ground }} />}

      {/* 계절 파티클 (벚꽃잎 · 햇살 · 단풍잎 · 눈) */}
      {Array.from({ length: COUNT }, (_, i) => {
        const left = (i * 53) % 100;
        const delay = -((i * 0.73) % 6);
        const color = look.particle[i % look.particle.length];
        const size = look.kind === "snow" ? 4 + (i % 3) * 2 : look.kind === "sparkle" ? 4 + (i % 2) * 3 : 7 + (i % 3) * 2;
        const style = { left: `${left}%`, top: 0, width: size, height: look.kind === "leaf" ? size * 0.8 : size, background: color, "--h": `${h}px`, "--w": `${w}px`, "--sway": `${((i % 5) - 2) * 18}px` };
        if (look.kind === "rain") {
          return <span key={i} className="absolute" style={{ left: `${(i * 53 + 20) % 110}%`, top: 0, width: 2, height: 18 + (i % 3) * 6, background: color, opacity: 0.55, "--h": `${h}px`, animation: `sw-rain ${0.7 + (i % 4) * 0.12}s linear ${delay / 6}s infinite` }} />;
        }
        if (look.kind === "sparkle") {
          return <span key={i} className="absolute" style={{ ...style, top: `${20 + ((i * 29) % 60)}%`, animation: `sw-twinkle ${2.4 + (i % 4) * 0.6}s ease-in-out ${delay}s infinite` }} />;
        }
        if (look.kind === "petal") {
          return <span key={i} className="absolute" style={{ ...style, left: 0, top: `${(i * 17) % 50}%`, borderRadius: "60% 0", animation: `sw-drift ${5 + (i % 5)}s linear ${delay}s infinite` }} />;
        }
        return <span key={i} className="absolute" style={{ ...style, animation: `sw-fall ${look.kind === "leaf" ? 5 + (i % 4) : 4 + (i % 5)}s linear ${delay}s infinite` }} />;
      })}

      {/* 창틀 (가로·세로 살) */}
      {frame && (
        <>
          {[0.25, 0.5, 0.75].map((f) => (
            <span key={f} className="absolute inset-y-0 w-2.5 bg-[#f5e6c8]" style={{ left: `calc(${f * 100}% - 5px)`, boxShadow: "0 0 0 2px #2b1d1a" }} />
          ))}
          <span className="absolute inset-x-0 h-2.5 bg-[#f5e6c8]" style={{ top: "38%", boxShadow: "0 0 0 2px #2b1d1a" }} />
          <span className="absolute inset-0 border-[8px] border-[#f5e6c8]" style={{ boxShadow: "inset 0 0 0 3px #2b1d1a, 0 0 0 4px #2b1d1a" }} />
        </>
      )}
    </div>
  );
}
