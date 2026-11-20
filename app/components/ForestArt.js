"use client";

// 🌳 무해림 숲길 그림 (모두 코드로 그린 픽셀아트 — 그림 파일이 필요 없어요)
//  - ForestBackdrop: 하늘 · 구름 · 먼 산 · 풀밭 · 오솔길 (지도 폭만큼 옆으로 길게)
//  - ForestTree: 손님 나무 6종 (kind 0~5) + 팻말
//  - HostTree: 주인장 나무 — 林처럼 나란히 선 두 그루
//  - IntroBoard: 입구 서문 팻말 · TrailEnd: 숲길 끝 표시

export const TREE_KINDS = [
  { name: "둥근 느티나무" },
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
export function ForestBackdrop({ mapW, mapH, groundY, pathTop, pathBottom }) {
  const clouds = [];
  for (let i = 0, x = 120; x < mapW; i++, x += 520 + ((i * 137) % 260)) {
    clouds.push(<Cloud key={i} x={x} y={60 + ((i * 97) % 260)} s={0.8 + ((i * 53) % 10) / 10} delay={-((i * 7) % 18)} />);
  }
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`@keyframes forest-cloud{to{transform:translateX(60px)}}@keyframes forest-bird{0%{transform:translate(0,0)}100%{transform:translate(900px,-120px)}}`}</style>
      {/* 하늘 — 군산의 탁 트인 하늘 */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(#7fb6de 0%, #a9d0ea 35%, #d9ebf0 60%, #f4e6c6 74%)" }} />
      {clouds}
      {/* 날아가는 새 몇 마리 */}
      {[0, 1].map((i) => (
        <div key={i} className="absolute text-[#2b1d1a]/60" style={{ left: 300 + i * 1400, top: 300 + i * 60, fontSize: 26, animation: `forest-bird ${28 + i * 9}s linear ${-i * 11}s infinite` }}>
          ˇ ˇ
        </div>
      ))}
      {/* 먼 산 · 가까운 언덕 */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 300, height: 160, backgroundImage: HILLS_FAR, backgroundRepeat: "repeat-x", backgroundSize: "640px 160px" }} />
      <div className="absolute left-0 right-0" style={{ top: groundY - 150, height: 140, backgroundImage: HILLS_NEAR, backgroundRepeat: "repeat-x", backgroundSize: "480px 140px" }} />
      {/* 풀밭 */}
      <div className="absolute left-0 right-0" style={{ top: groundY - 20, bottom: 0, backgroundImage: GRASS, backgroundSize: "96px 48px", borderTop: `6px solid #5a7836` }} />
      {/* 오솔길 */}
      <div className="absolute left-0 right-0" style={{ top: pathTop, height: pathBottom - pathTop, backgroundImage: PATH, backgroundSize: "128px 32px", borderTop: "6px solid #8a6038", borderBottom: "6px solid #8a6038", boxShadow: "inset 0 6px 0 #c9a06f" }} />
    </div>
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
  const W = 220 * size;
  const H = 330 * size;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H + 70 }}>
      <div className="absolute inset-x-0 top-0" style={{ height: H, transformOrigin: "50% 100%", animation: fresh ? "forest-grow 1.6s steps(6, end)" : undefined, filter: near ? "drop-shadow(0 0 10px rgba(255,236,170,.9))" : undefined }}>
        <svg viewBox="0 0 32 48" width="100%" height="100%" shapeRendering="crispEdges">
          <TreeShape kind={kind} />
        </svg>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: H - 34 }}>
        <Plank label={label} highlight={mine || near} />
      </div>
    </div>
  );
}

// 주인장 나무 — 林: 나란히 선 두 그루
export function HostTree({ x, groundY, near }) {
  const W = 420;
  const H = 400;
  return (
    <div className="pointer-events-none absolute" style={{ left: x - W / 2, top: groundY - H, width: W, height: H + 70 }}>
      <div className="absolute inset-x-0 top-0 flex items-end justify-center" style={{ height: H, filter: near ? "drop-shadow(0 0 12px rgba(255,236,170,.9))" : undefined }}>
        <svg viewBox="0 0 32 48" width={230} height={H} shapeRendering="crispEdges" style={{ marginRight: -40 }}>
          <TreeShape kind={0} />
        </svg>
        <svg viewBox="0 0 32 48" width={210} height={H * 0.92} shapeRendering="crispEdges">
          <TreeShape kind={1} />
        </svg>
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
export function TrailEnd({ x, groundY, count }) {
  return (
    <div className="pointer-events-none absolute flex flex-col items-center" style={{ left: x - 110, top: groundY - 150, width: 220 }}>
      <div className="border-[3px] px-2 py-1 text-center text-[16px] font-black leading-snug text-[#2b1d1a] shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]" style={{ background: "#e9cf9f", borderColor: OUT }}>
        🌱 지금까지 {count}그루
        <br />
        <span className="text-[13px] font-bold text-[#2b1d1a]/70">다음 나무는 여기서부터 자라요</span>
      </div>
      <div className="h-8 w-[6px]" style={{ background: "#6b4226", borderLeft: `2px solid ${OUT}`, borderRight: `2px solid ${OUT}` }} />
      <svg viewBox="0 0 12 10" width="60" height="50" shapeRendering="crispEdges">
        <rect x="5" y="4" width="2" height="6" fill="#4c7230" />
        <rect x="1" y="2" width="4" height="3" fill="#6b9a45" />
        <rect x="7" y="0" width="4" height="4" fill="#80a352" />
      </svg>
    </div>
  );
}
