"use client";

import { useEffect, useState } from "react";

// 🌳 무해림 숲길 그림 (모두 코드로 그린 픽셀아트 — 그림 파일이 필요 없어요)
//  - ForestBackdrop: 하늘 · 구름 · 먼 산 · 풀밭 · 오솔길 (지도 폭만큼 옆으로 길게)
//  - ForestTree: 손님 나무 6종 (kind 0~5) + 팻말
//  - HostTree: 주인장 나무 — 林처럼 나란히 선 두 그루
//  - IntroBoard: 입구 서문 팻말 · TrailEnd: 숲길 끝 표시
//  🎨 그림 파일이 public/forest/ 에 있으면 그 그림을, 없으면 코드 그림을 써요
//    bg_sky.png (하늘, 가로로 이어 붙여요) · forest_tree_1~6.png (1 느티 · 2 소나무 · 3 자작 · 4 감 · 5 단풍 · 6 벚나무)

// 그림 파일이 있는지 (한 번 확인하면 기억해요)
const imgCache = {};
export function useForestImg(name) {
  const src = `/forest/${name}.png`;
  const [ok, setOk] = useState(imgCache[src]);
  useEffect(() => {
    if (imgCache[src] !== undefined) return setOk(imgCache[src]);
    const im = new Image();
    im.onload = () => setOk((imgCache[src] = true));
    im.onerror = () => setOk((imgCache[src] = false));
    im.src = src;
  }, [src]);
  return ok ? src : null;
}
const treeFile = (kind) => `forest_tree_${(kind % 6) + 1}`;

// 나무 그림 한 장 (그림 파일 → 없으면 코드 그림) — 바닥 가운데 맞춤
export function TreeImage({ kind = 0, height, maxWidth }) {
  const src = useForestImg(treeFile(kind));
  if (src) return <img src={src} alt="" draggable={false} style={{ height, width: "auto", maxWidth, imageRendering: "pixelated", objectFit: "contain", objectPosition: "bottom", filter: "saturate(.78) brightness(.9)" }} />;
  return (
    <svg viewBox="0 0 32 48" height={height} width={(height * 2) / 3} shapeRendering="crispEdges">
      <TreeShape kind={kind} />
    </svg>
  );
}

export const TREE_KINDS = [
  { name: "느티나무" },
  { name: "소나무" },
  { name: "자작나무" },
  { name: "감나무" },
  { name: "단풍나무" },
  { name: "벚나무" },
];

const OUT = "#2b1d1a";
const enc = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// 반복 무늬 (옆으로 이어 붙여요)
const HILLS_FAR = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" shape-rendering="crispEdges"><path d="M0 160 V96 h40 v-8 h40 v-12 h48 v-8 h56 v8 h40 v12 h32 v8 h48 v-16 h40 v-12 h56 v12 h48 v16 h40 v8 h56 v-8 h40 v-8 h56 v40 Z" fill="#a9c3b8"/></svg>`
);
const HILLS_NEAR = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" shape-rendering="crispEdges"><path d="M0 140 V80 h32 v-12 h40 v-12 h48 v12 h32 v16 h40 v-8 h48 v-16 h56 v12 h40 v12 h48 v-8 h40 v-8 h56 v76 Z" fill="#7f9c6c"/><path d="M0 140 V100 h48 v-8 h64 v8 h80 v-4 h96 v8 h88 v-8 h104 v44 Z" fill="#6c8a58"/></svg>`
);
const GRASS = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" shape-rendering="crispEdges"><rect width="96" height="48" fill="#6f8f45"/><rect x="8" y="6" width="4" height="8" fill="#80a352"/><rect x="12" y="10" width="4" height="4" fill="#80a352"/><rect x="40" y="26" width="4" height="8" fill="#5f7d3a"/><rect x="44" y="30" width="4" height="4" fill="#5f7d3a"/><rect x="70" y="8" width="4" height="8" fill="#80a352"/><rect x="66" y="12" width="4" height="4" fill="#80a352"/><rect x="24" y="38" width="4" height="4" fill="#e8d27a"/><rect x="84" y="34" width="4" height="4" fill="#f1e3e8"/></svg>`
);
const PATH = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="32" shape-rendering="crispEdges"><rect width="128" height="32" fill="#b98d5f"/><rect x="10" y="8" width="8" height="4" fill="#a87b4f"/><rect x="50" y="20" width="12" height="4" fill="#c79d6e"/><rect x="90" y="6" width="6" height="4" fill="#9c7046"/><rect x="104" y="22" width="8" height="4" fill="#a87b4f"/><rect x="30" y="24" width="4" height="4" fill="#8a6038"/></svg>`
);

function Cloud({ x, y, s = 1, delay = 0 }) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: 180 * s, height: 60 * s, animation: `forest-cloud 18s ease-in-out ${delay}s infinite alternate` }}>
      <svg viewBox="0 0 36 12" width="100%" height="100%" shapeRendering="crispEdges">
        <rect x="6" y="6" width="26" height="6" fill="#ffffff" />
        <rect x="10" y="2" width="10" height="4" fill="#ffffff" />
        <rect x="18" y="0" width="8" height="6" fill="#ffffff" />
        <rect x="2" y="8" width="6" height="4" fill="#ffffff" />
        <rect x="6" y="10" width="28" height="2" fill="#dbe8f0" />
      </svg>
    </div>
  );
}

// 하늘·산·풀밭·길 (지도 전체) — groundY: 나무가 서는 높이, pathTop/pathBottom: 길 (모두 맵 px)
// 🌲 깊은 숲 무늬 (코드로 그린 나무줄기 줄 — 그림 파일 forest_far / forest_mid가 생기면 바꿔요)
//  seed로 줄기 위치를 정해요 (매번 같은 모양)
function trunkRow({ w, h, n, minW, maxW, trunk, edge, leaf, leafHi, seed, canopyY, fern }) {
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let body = "";
  for (let i = 0; i < n; i++) {
    const tw = Math.round(minW + rnd() * (maxW - minW));
    const x = Math.round((i / n) * w + rnd() * (w / n - tw));
    body += `<rect x="${x}" y="0" width="${tw}" height="${h}" fill="${trunk}"/><rect x="${x}" y="0" width="${Math.max(2, Math.round(tw / 5))}" height="${h}" fill="${edge}"/>`;
    // 가지
    const by = Math.round(canopyY + rnd() * h * 0.25);
    const dir = rnd() > 0.5 ? 1 : -1;
    body += `<rect x="${dir > 0 ? x + tw : x - 40}" y="${by}" width="40" height="${Math.max(3, Math.round(tw / 6))}" fill="${trunk}"/>`;
  }
  // 위쪽 잎 덩어리
  for (let i = 0; i < n * 3; i++) {
    const cw = Math.round(60 + rnd() * 120);
    const ch = Math.round(30 + rnd() * 60);
    const x = Math.round(rnd() * (w - cw));
    const y = Math.round(rnd() * canopyY);
    const R = (a) => Math.round(a);
    body += `<rect x="${x}" y="${R(y + ch * 0.35)}" width="${cw}" height="${R(ch * 0.65)}" fill="${leaf}"/>`;
    body += `<rect x="${R(x + cw * 0.12)}" y="${R(y + ch * 0.12)}" width="${R(cw * 0.76)}" height="${R(ch * 0.5)}" fill="${leaf}"/>`;
    body += `<rect x="${R(x + cw * 0.3)}" y="${y}" width="${R(cw * 0.4)}" height="${R(ch * 0.3)}" fill="${leaf}"/>`;
    body += `<rect x="${R(x + cw * 0.3)}" y="${y}" width="${R(cw * 0.25)}" height="5" fill="${leafHi}"/><rect x="${R(x + cw * 0.12)}" y="${R(y + ch * 0.12)}" width="${R(cw * 0.2)}" height="5" fill="${leafHi}"/>`;
    body += `<rect x="${R(x + cw * 0.05)}" y="${R(y + ch - 4)}" width="${R(cw * 0.9)}" height="4" fill="${trunk}" opacity=".35"/>`;
  }
  if (fern) {
    for (let i = 0; i < n * 2; i++) {
      const fw = Math.round(30 + rnd() * 50);
      const x = Math.round(rnd() * (w - fw));
      body += `<rect x="${x}" y="${h - 22}" width="${fw}" height="22" fill="${fern}"/><rect x="${x + 6}" y="${h - 30}" width="${Math.round(fw / 2)}" height="8" fill="${fern}"/>`;
    }
  }
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`);
}
const FAR_TREES = trunkRow({ w: 700, h: 760, n: 9, minW: 10, maxW: 22, trunk: "#71878a", edge: "#7f9598", leaf: "#6a8481", leafHi: "#7d9693", seed: 7, canopyY: 260 });
const MID_TREES = trunkRow({ w: 900, h: 900, n: 6, minW: 26, maxW: 46, trunk: "#2b362f", edge: "#3b4a40", leaf: "#2d4434", leafHi: "#3d5a43", seed: 21, canopyY: 300, fern: "#33503a" });
const MEADOW = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" shape-rendering="crispEdges"><rect width="96" height="48" fill="#4f6b47"/><rect x="8" y="4" width="4" height="10" fill="#5e7c52"/><rect x="12" y="8" width="4" height="6" fill="#5e7c52"/><rect x="40" y="24" width="4" height="10" fill="#45603f"/><rect x="70" y="6" width="4" height="10" fill="#5e7c52"/><rect x="24" y="38" width="3" height="3" fill="#c9d3c3"/><rect x="84" y="32" width="3" height="3" fill="#b9c6d6"/></svg>`
);
const EARTH = enc(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="32" shape-rendering="crispEdges"><rect width="128" height="32" fill="#7b6b55"/><rect x="10" y="8" width="8" height="4" fill="#6d5e4a"/><rect x="50" y="20" width="12" height="4" fill="#8a7a62"/><rect x="90" y="6" width="6" height="4" fill="#64564400"/><rect x="104" y="22" width="8" height="4" fill="#6d5e4a"/></svg>`
);

// 하늘·숲·풀밭·길 (지도 전체) — groundY: 나무가 서는 높이, pathTop/pathBottom: 길 (모두 맵 px)
//  count: 심어진 나무 수 → 많을수록 안개가 걷히고 뒤쪽 숲이 짙어져요
export function ForestBackdrop({ mapW, mapH, groundY, pathTop, pathBottom, count = 0 }) {
  const grow = Math.min(1, count / 20); // 0 → 1 (나무 20그루면 다 자란 숲)
  // 🎨 그림 배경 (public/forest/forest_far · forest_mid · forest_ground) — 셋 다 있으면 그림으로
  const far = useForestImg("forest_far");
  const mid = useForestImg("forest_mid");
  const ground = useForestImg("forest_ground");
  if (far && mid && ground) {
    const H = 960; // 먼 숲·가까운 숲 높이 (맵 px)
    const GT = 788; // 풀밭+오솔길 그림 윗부분 (길이 걷는 자리에 오게)
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ background: "#22312c" }}>
        <div className="absolute inset-x-0 top-0" style={{ height: H, backgroundImage: `url(${far})`, backgroundRepeat: "repeat-x", backgroundSize: `auto ${H}px`, imageRendering: "pixelated" }} />
        {/* 안개 (나무가 늘수록 걷혀요) */}
        <div className="absolute inset-x-0 top-0" style={{ height: H, background: `linear-gradient(rgba(170,190,192,0), rgba(170,190,192,${0.35 - grow * 0.25}))` }} />
        {/* 가까운 숲 (나무가 늘수록 진해져요) */}
        <div className="absolute inset-x-0 top-0" style={{ height: H, backgroundImage: `url(${mid})`, backgroundRepeat: "repeat-x", backgroundSize: `auto ${H}px`, imageRendering: "pixelated", opacity: 0.45 + grow * 0.55 }} />
        {/* 풀밭 + 오솔길 */}
        <div className="absolute inset-x-0" style={{ top: GT, height: 451, backgroundImage: `url(${ground})`, backgroundRepeat: "repeat-x", backgroundSize: "auto 451px", imageRendering: "pixelated" }} />
        <div className="absolute inset-x-0" style={{ top: GT + 440, bottom: 0, background: "#767848" }} />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 흐린 하늘 (비 온 뒤 저녁) */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(#5f7682 0%, #7d929a 30%, #a3b3b2 60%, #b9c4bb 76%)" }} />
      {/* 먼 숲 (안개 속) */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 760, height: 760, backgroundImage: FAR_TREES, backgroundRepeat: "repeat-x", backgroundSize: "700px 760px", opacity: 0.45 + grow * 0.4 }} />
      {/* 안개 1 */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 520, height: 520, background: `linear-gradient(rgba(190,204,204,0), rgba(190,204,204,${0.75 - grow * 0.35}))` }} />
      {/* 가까운 숲줄기 (나무가 늘수록 진해져요) */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 900 + 10, height: 900, backgroundImage: MID_TREES, backgroundRepeat: "repeat-x", backgroundSize: "900px 900px", opacity: 0.18 + grow * 0.72 }} />
      {/* 위쪽 나뭇가지 그늘 */}
      <div className="absolute inset-x-0 top-0 h-[260px]" style={{ background: "linear-gradient(rgba(30,44,36,.55), rgba(30,44,36,0))" }} />
      {/* 안개 2 (숲과 풀밭 사이) */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 160, height: 200, background: "linear-gradient(rgba(200,212,210,0), rgba(200,212,210,.45), rgba(200,212,210,0))" }} />
      {/* 풀밭 */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 14, bottom: 0, backgroundImage: MEADOW, backgroundSize: "96px 48px", borderTop: "6px solid #435c3d" }} />
      {/* 오솔길 (흐릿한 흙길) */}
      <div className="absolute left-0 right-0" style={{ top: pathTop, height: pathBottom - pathTop, backgroundImage: EARTH, backgroundSize: "128px 32px", borderTop: "6px solid #5f523f", borderBottom: "6px solid #5f523f", opacity: 0.92 }} />
    </div>
  );
}

// 🌫️ 숲 전체에 얹는 저녁빛·안개 (나무·팻말 위, 캐릭터 아래)
export function ForestGrade() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(rgba(60,90,100,.22), rgba(40,70,70,.12))", mixBlendMode: "multiply" }} />
      <div className="pointer-events-none absolute inset-x-0" style={{ top: 700, height: 300, background: "linear-gradient(rgba(205,215,212,0), rgba(205,215,212,.18), rgba(205,215,212,0))" }} />
    </>
  );
}

// ---------- 나무 6종 (viewBox 32×48, 바닥 가운데가 (16,48)) ----------
function Trunk({ c = "#6b4226", hi = "#8a5a36", w = 4, top = 30 }) {
  return (
    <>
      <rect x={16 - w / 2 - 1} y={top} width={w + 2} height={48 - top} fill={OUT} />
      <rect x={16 - w / 2} y={top} width={w} height={48 - top} fill={c} />
      <rect x={16 - w / 2} y={top} width="1" height={48 - top} fill={hi} />
      <rect x={16 - w / 2 - 3} y="46" width={w + 6} height="2" fill={OUT} />
    </>
  );
}
function Blob({ cells, fill, shade, light }) {
  // cells: [x, y, w, h] 네모들 → 테두리 + 채움 + 그늘 + 빛
  return (
    <>
      {cells.map(([x, y, w, h], i) => <rect key={`o${i}`} x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill={OUT} />)}
      {cells.map(([x, y, w, h], i) => <rect key={`f${i}`} x={x} y={y} width={w} height={h} fill={fill} />)}
      {cells.map(([x, y, w, h], i) => <rect key={`s${i}`} x={x} y={y + h - 2} width={w} height="2" fill={shade} />)}
      {cells.slice(0, 2).map(([x, y], i) => <rect key={`l${i}`} x={x + 2} y={y + 1} width="3" height="2" fill={light} />)}
    </>
  );
}

export function TreeShape({ kind = 0 }) {
  switch (kind % 6) {
    case 1: // 소나무
      return (
        <>
          <Trunk c="#5a3a22" top={34} />
          {[[6, 26, 20, 8], [8, 18, 16, 8], [10, 10, 12, 8], [13, 4, 6, 6]].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill={OUT} />
              <rect x={x} y={y} width={w} height={h} fill="#2f5d3a" />
              <rect x={x} y={y + h - 2} width={w} height="2" fill="#244a2e" />
              <rect x={x + 2} y={y} width={w - 6} height="1" fill="#4a7d4f" />
            </g>
          ))}
        </>
      );
    case 2: // 자작나무
      return (
        <>
          <rect x="13" y="22" width="6" height="26" fill={OUT} />
          <rect x="14" y="22" width="4" height="26" fill="#f2efe6" />
          {[26, 31, 37, 42].map((y) => <rect key={y} x={y % 2 ? 14 : 16} y={y} width="2" height="1" fill={OUT} />)}
          <rect x="11" y="46" width="10" height="2" fill={OUT} />
          <Blob cells={[[7, 8, 18, 10], [5, 14, 22, 8], [10, 4, 12, 6]]} fill="#a7c35a" shade="#88a443" light="#c8dc7c" />
        </>
      );
    case 3: // 감나무
      return (
        <>
          <Trunk c="#5e3b22" top={30} w={4} />
          <Blob cells={[[4, 12, 24, 14], [8, 6, 16, 8], [6, 24, 20, 6]]} fill="#5f8a3a" shade="#4c7230" light="#7ea653" />
          {[[9, 14], [19, 11], [14, 20], [22, 20], [8, 24]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x} y={y} width="3" height="3" fill="#e9772a" />
              <rect x={x} y={y} width="1" height="1" fill="#ffb066" />
            </g>
          ))}
        </>
      );
    case 4: // 단풍나무
      return (
        <>
          <Trunk c="#5e3b22" top={31} />
          <Blob cells={[[5, 10, 22, 14], [9, 4, 14, 8], [7, 22, 18, 6]]} fill="#d9662f" shade="#b34d24" light="#f09a4a" />
          <rect x="11" y="14" width="3" height="3" fill="#f2c14e" />
          <rect x="20" y="18" width="3" height="3" fill="#a83a22" />
        </>
      );
    case 5: // 벚나무
      return (
        <>
          <Trunk c="#4e3326" top={31} />
          <Blob cells={[[4, 11, 24, 13], [8, 5, 16, 8], [6, 22, 20, 6]]} fill="#f2b8c6" shade="#d996a8" light="#ffe1e8" />
          {[[10, 14], [18, 9], [22, 19], [12, 23]].map(([x, y], i) => <rect key={i} x={x} y={y} width="2" height="2" fill="#ffffff" />)}
        </>
      );
    default: // 둥근 느티나무
      return (
        <>
          <Trunk top={30} />
          <Blob cells={[[5, 10, 22, 14], [9, 4, 14, 8], [7, 22, 18, 6]]} fill="#6b9a45" shade="#557d36" light="#8dbb5f" />
        </>
      );
  }
}

// 팻말 (나무 앞 기둥 + 판자) — 판자에는 닉네임만 작게, 가까이 가면 화면 위에 전문이 떠요
export function Plank({ label, highlight = false, wide = false }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="max-w-[170px] truncate whitespace-nowrap border-[3px] px-2 py-0.5 text-[17px] font-black leading-tight text-[#2b1d1a] shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
        style={{ background: highlight ? "#fde68a" : "#e9cf9f", borderColor: OUT, minWidth: wide ? 120 : 64, textAlign: "center" }}
      >
        {label}
      </div>
      <div className="h-6 w-[6px]" style={{ background: "#6b4226", borderLeft: `2px solid ${OUT}`, borderRight: `2px solid ${OUT}` }} />
    </div>
  );
}

// 손님 나무 한 그루 — x: 바닥 가운데 (맵 px), groundY: 바닥 높이
export function ForestTree({ x, groundY, kind, label, fresh, mine, near, size = 1 }) {
  const W = 400 * size;
  const H = 380 * size;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H + 70 }}>
      <div className="absolute inset-x-0 top-0 flex items-end justify-center" style={{ height: H, transformOrigin: "50% 100%", animation: fresh ? "forest-grow 1.6s steps(6, end)" : undefined, filter: near ? "drop-shadow(0 0 10px rgba(255,236,170,.9))" : undefined }}>
        <TreeImage kind={kind} height={H} maxWidth={W} />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: H - 34 }}>
        <Plank label={label} highlight={mine || near} />
      </div>
    </div>
  );
}

// 주인장 나무 — 林: 나란히 선 두 그루
export function HostTree({ x, groundY, near }) {
  const W = 620;
  const H = 440;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H + 70 }}>
      <div className="absolute inset-x-0 top-0 flex items-end justify-center" style={{ height: H, filter: near ? "drop-shadow(0 0 12px rgba(255,236,170,.9))" : undefined }}>
        <div style={{ marginRight: -70, display: "flex", alignItems: "flex-end" }}>
          <TreeImage kind={0} height={H} maxWidth={360} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <TreeImage kind={1} height={H * 0.92} maxWidth={340} />
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: H - 34 }}>
        <Plank label="🍵 무해림의 나무" highlight={near} wide />
      </div>
    </div>
  );
}

// 입구 서문 팻말 (큰 나무 게시판) — 처음 오면 "!"
export function IntroBoard({ x, groundY, alert, onOpen, title, edition }) {
  const W = 300;
  const H = 280;
  return (
    <div className="absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H, zIndex: alert ? 2450 : undefined }}>
      <style>{`@keyframes forest-alert{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>
      <button type="button" onClick={onOpen} aria-label="서문 읽기" className="absolute inset-0 cursor-pointer bg-transparent p-0">
        {/* 기둥 */}
        <span className="absolute bottom-0 left-[22%] h-[45%] w-3" style={{ background: "#6b4226", border: `3px solid ${OUT}` }} />
        <span className="absolute bottom-0 right-[22%] h-[45%] w-3" style={{ background: "#6b4226", border: `3px solid ${OUT}` }} />
        {/* 판 */}
        <span className="absolute inset-x-0 top-0 flex h-[66%] flex-col items-center justify-center border-[5px] px-3 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]" style={{ background: "#f3e2bd", borderColor: OUT, boxShadow: "inset 0 0 0 4px #c9a06f, 4px 4px 0 0 rgba(0,0,0,.3)" }}>
          <span className="text-[15px] font-black tracking-widest text-[#7c2d12]">{edition}</span>
          <span className="mt-1 text-[30px] font-black leading-none text-[#2b1d1a]">無害林</span>
          <span className="mt-1 text-[17px] font-black text-[#2b1d1a]">{title}</span>
          <span className="mt-2 text-[14px] font-bold text-[#2b1d1a]/60">서문 읽기 ▶</span>
        </span>
      </button>
      {alert && (
        <div className="absolute bottom-full left-1/2 mb-2 flex w-0 justify-center" style={{ scale: "var(--ui-boost, 1)", transformOrigin: "50% 100%" }}>
          <button
            type="button"
            onClick={onOpen}
            aria-label="서문 바로 읽기"
            className="flex h-[74px] w-[58px] shrink-0 items-center justify-center border-[5px] border-[#2b1d1a] bg-[#facc15] text-[52px] font-black leading-none text-[#2b1d1a] shadow-[5px_5px_0_0_rgba(0,0,0,0.35)] hover:bg-[#fde047]"
            style={{ animation: "forest-alert 0.9s steps(3, jump-none) infinite" }}
          >
            !
          </button>
        </div>
      )}
    </div>
  );
}

// 숲길 끝 (새싹 + 작은 팻말)
export function TrailEnd({ x, groundY, count, onToStart }) {
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - 110, top: groundY - 128, width: 220 }}>
      {/* ⏮ 입구로 가는 표지판 (누르면 숲 처음으로) */}
      <button type="button" onClick={onToStart} aria-label="숲 입구로" className="relative mb-1 h-[38px] w-[150px] hover:brightness-110">
        {/* 왼쪽을 가리키는 나무 화살표 판 (테두리 잘림 없이 SVG로) */}
        <svg viewBox="0 0 50 13" width="150" height="39" shapeRendering="crispEdges" className="absolute inset-0 drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
          <path d="M6 0h44v13H6v-1H5v-1H4v-1H3v-1H2V8H1V5h1V4h1V3h1V2h1V1h1z" fill="#2b1d1a" />
          <path d="M7 1h42v11H7v-1H6v-1H5V9H4V8H3V5h1V4h1V3h1V2h1z" fill="#d9b98a" />
          <rect x="7" y="1" width="42" height="1" fill="#ead2a6" />
        </svg>
        <span className="relative flex h-full items-center justify-center pl-3 text-[15px] font-black text-[#2b1d1a]">⏮ 숲 입구로</span>
      </button>
      <div className="h-8 w-[6px]" style={{ background: "#6b4226", borderLeft: `2px solid ${OUT}`, borderRight: `2px solid ${OUT}` }} />
      <svg viewBox="0 0 12 10" width="60" height="50" shapeRendering="crispEdges">
        <rect x="5" y="4" width="2" height="6" fill="#4c7230" />
        <rect x="1" y="2" width="4" height="3" fill="#6b9a45" />
        <rect x="7" y="0" width="4" height="4" fill="#80a352" />
      </svg>
    </div>
  );
}

// 🍵 야차 벤치 (숲 중간, 앞에서 본 나무 벤치 + 찻쟁반) — x: 가운데, floorY: 벤치 다리가 닿는 높이 (맵 px)
export function TeaBench({ x, floorY, busy }) {
  const W = 340;
  const H = 170;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: floorY - H, width: W, height: H }}>
      <style>{`@keyframes yacha-steam{0%{opacity:0;transform:translateY(0) scaleX(1)}30%{opacity:.8}100%{opacity:0;transform:translateY(-34px) scaleX(1.6)}}`}</style>
      <svg viewBox="0 0 60 30" width="100%" height="100%" shapeRendering="crispEdges" style={{ filter: "saturate(.85) brightness(.92)" }}>
        {/* 그림자 */}
        <rect x="4" y="28" width="52" height="2" fill="#00000030" />
        {/* 등받이 */}
        <rect x="5" y="2" width="50" height="11" fill="#2b1d1a" />
        <rect x="6" y="3" width="48" height="4" fill="#8a6440" />
        <rect x="6" y="3" width="48" height="1" fill="#a57b52" />
        <rect x="6" y="8" width="48" height="4" fill="#7a5636" />
        <rect x="6" y="8" width="48" height="1" fill="#946b47" />
        {/* 등받이 기둥 */}
        <rect x="8" y="2" width="3" height="16" fill="#2b1d1a" />
        <rect x="49" y="2" width="3" height="16" fill="#2b1d1a" />
        {/* 앉는 판 */}
        <rect x="2" y="16" width="56" height="6" fill="#2b1d1a" />
        <rect x="3" y="17" width="54" height="2" fill="#a57b52" />
        <rect x="3" y="19" width="54" height="2" fill="#7a5636" />
        {/* 다리 */}
        <rect x="6" y="22" width="3" height="7" fill="#2b1d1a" />
        <rect x="51" y="22" width="3" height="7" fill="#2b1d1a" />
        <rect x="7" y="22" width="1" height="6" fill="#6b4a2e" />
        <rect x="52" y="22" width="1" height="6" fill="#6b4a2e" />
        {/* 찻쟁반 (가운데) */}
        <rect x="24" y="15" width="12" height="2" fill="#2b1d1a" />
        <rect x="25" y="15" width="10" height="1" fill="#c9a06f" />
        {/* 다관 */}
        <rect x="25" y="11" width="5" height="4" fill="#2b1d1a" />
        <rect x="26" y="12" width="3" height="3" fill="#8b5e3c" />
        <rect x="27" y="10" width="1" height="1" fill="#2b1d1a" />
        <rect x="30" y="12" width="1" height="1" fill="#2b1d1a" />
        {/* 찻잔 두 개 */}
        <rect x="31" y="13" width="2" height="2" fill="#e8e2d0" />
        <rect x="33.5" y="13" width="2" height="2" fill="#e8e2d0" />
      </svg>
      {/* 김 */}
      {[0, 1, 2].map((i) => (
        <span key={i} className="absolute h-5 w-[6px] rounded-full bg-white/70" style={{ left: `${44 + i * 4}%`, top: "26%", animation: `yacha-steam ${busy ? 2 : 3.2}s ${i * 0.7}s ease-out infinite`, opacity: 0 }} />
      ))}
    </div>
  );
}

// 🪧 입구 나무 팻말 — 「無害林」 + 「없을 무 · 해할 해 · 수풀 림」 (설명 없이 이것만)
export function EntranceSign({ x, groundY, title, reading }) {
  const W = 260;
  const H = 230;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H }}>
      {/* 기둥 */}
      <span className="absolute bottom-0 left-1/2 h-[52%] w-4 -translate-x-1/2" style={{ background: "#5e4027", border: `3px solid ${OUT}` }} />
      {/* 나무 판 */}
      <span
        className="absolute inset-x-0 top-0 flex h-[58%] flex-col items-center justify-center border-[5px] text-center"
        style={{ background: "#a9825a", borderColor: OUT, boxShadow: "inset 0 0 0 4px #8a6440, inset 0 6px 0 4px #b9926a, 4px 4px 0 0 rgba(0,0,0,.3)", filter: "saturate(.85)" }}
      >
        <span className="text-[44px] font-black leading-none tracking-[0.12em] text-[#2b1d1a]" style={{ textShadow: "0 2px 0 rgba(255,236,200,.35)" }}>
          {title}
        </span>
        <span className="mt-2 text-[15px] font-bold tracking-wide text-[#2b1d1a]/80">{reading}</span>
      </span>
    </div>
  );
}
