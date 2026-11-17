"use client";

// 터치(클릭)한 곳에 0.8초 동안 떴다 사라지는 픽셀 동그라미 파동
//  - x, y: 맵 좌표 / size: 크기 (맵 기준 px)
export const TAP_FX_MS = 800;

// 11x11 칸 중 동그라미 테두리만 칠하기
const RING_PIXELS = [];
for (let r = 0; r < 11; r++) {
  for (let c = 0; c < 11; c++) {
    const d = Math.hypot(r - 5, c - 5);
    if (d >= 3.6 && d < 5.1) RING_PIXELS.push([c, r]);
  }
}

export default function TapRipple({ x, y, size = 64 }) {
  return (
    <div className="pointer-events-none absolute z-[5]" style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      <style>{`
        @keyframes tap-ripple { 0% { transform: scale(0.3); opacity: 1; } 70% { opacity: 0.9; } 100% { transform: scale(1.25); opacity: 0; } }
        .tap-ripple { animation: tap-ripple ${TAP_FX_MS}ms ease-out forwards; }
      `}</style>
      <svg viewBox="0 0 11 11" width={size} height={size} shapeRendering="crispEdges" className="tap-ripple">
        {RING_PIXELS.map(([c, r]) => (
          <rect key={`${c}-${r}`} x={c} y={r} width="1" height="1" fill="#fef3c7" stroke="#1a110e" strokeWidth="0.15" />
        ))}
        <rect x="5" y="5" width="1" height="1" fill="#fbbf24" />
      </svg>
    </div>
  );
}
