"use client";

import { useState } from "react";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { galleryData } from "../spaceData";

// 🖼️ 전시회 (exhibitionRoom) — 찻집의 왼쪽·오른쪽 아래 통로로 와요
//  - 작품은 app/spaceData.js의 galleryData.artworks (앞 5개 = 벽, 나머지 = 이젤, 최대 8개)
//  - 아래쪽 가운데 출구 경계 → ☕ 찻집 (나갔던 통로 앞으로 돌아가요)
//  - data.js의 eventSchedule 기간에만 들어올 수 있어요
//  - 좌표는 모두 0~1 비율
const MAP_W = 1600;
const MAP_H = 1200;
const WALL_H = 0.3;

// 작품 거는 자리: 벽 5칸 + 이젤 3칸
const WALL_SLOTS = [0.14, 0.32, 0.5, 0.68, 0.86].map((cx) => ({ rect: { x: cx - 0.065, y: 0.06, w: 0.13, h: 0.17 }, near: { x: cx, y: 0.38 } }));
const EASEL_SLOTS = [0.22, 0.5, 0.78].map((cx) => ({ rect: { x: cx - 0.05, y: 0.52, w: 0.1, h: 0.12 }, near: { x: cx, y: 0.77 }, easel: true }));
const SLOTS = [...WALL_SLOTS, ...EASEL_SLOTS];

const artworks = (galleryData?.artworks ?? []).slice(0, SLOTS.length);
const placed = artworks.map((art, i) => ({ art, ...SLOTS[i] }));

const BLOCKERS = [
  { x: 0, y: 0, w: 1, h: WALL_H }, // 위쪽 벽
  ...placed.filter((p) => p.easel).map((p) => ({ x: p.rect.x + 0.01, y: 0.62, w: p.rect.w - 0.02, h: 0.06 })), // 이젤 다리
  { x: 0.66, y: 0.82, w: 0.14, h: 0.05 }, // 벤치
];

const SPOTS = placed.map((p) => ({ id: p.art.id, rect: p.rect, near: p.near, icon: "🖼️", title: p.art.title }));

// 아래쪽 가운데 출구 → 찻집
const EXITS = [{ id: "out", to: "teaHouse", zone: { x: 0.42, y: 0.93, w: 0.16, h: 0.07 }, sign: { x: 0.5, y: 0.885 }, label: "⬇ ☕ 찻집으로" }];

const SPAWNS = {
  default: { x: 0.5, y: 0.83 },
  teaHouse: { x: 0.5, y: 0.83 }, // 찻집에서 오면 → 출구 바로 위
};

const pct = (r) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
const OUTLINE = "#2b1d1a";
const PLACEHOLDER_COLORS = [
  ["#1e3a5f", "#f8fafc"],
  ["#7c2d12", "#fde68a"],
  ["#065f46", "#d9f99d"],
  ["#3b0764", "#f5d0fe"],
  ["#713f12", "#fef3c7"],
  ["#0f172a", "#bae6fd"],
  ["#7f1d1d", "#fecaca"],
  ["#134e4a", "#ccfbf1"],
];

// 작품 그림 (그림이 없거나 못 불러오면 임시 도트 그림)
function ArtImage({ art, index, big = false }) {
  const [failed, setFailed] = useState(false);
  if (art.image && !failed) {
    return <img src={art.image} alt={art.title} onError={() => setFailed(true)} className="h-full w-full object-cover" style={{ imageRendering: "pixelated" }} draggable={false} />;
  }
  const [bg, fg] = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];
  return (
    <div className="relative flex h-full w-full items-end justify-center overflow-hidden" style={{ background: bg }}>
      <div className="absolute rounded-full" style={{ width: "28%", aspectRatio: "1", right: "14%", top: "14%", background: fg, opacity: 0.9 }} />
      <div className="absolute bottom-0 left-0 w-full" style={{ height: "34%", background: `repeating-linear-gradient(90deg, ${fg}33 0 12px, transparent 12px 24px)` }} />
      {big && <span className="relative mb-3 text-sm font-bold" style={{ color: fg }}>그림 준비 중</span>}
    </div>
  );
}

function GalleryScene() {
  return (
    <div className="absolute inset-0">
      {/* 밝은 나무 바닥 */}
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, #e2c9a4 0 56px, #d6bb93 56px 60px), #e2c9a4" }} />

      {/* 흰 벽 + 걸레받이 */}
      <div className="absolute left-0 top-0 w-full" style={{ height: `${WALL_H * 100}%`, background: "linear-gradient(#f8f5ef, #ece6db)" }} />
      <div className="absolute left-0 w-full" style={{ top: `${(WALL_H - 0.015) * 100}%`, height: "1.5%", background: "#8d8277" }} />
      <div className="absolute left-0 w-full" style={{ top: "3%", height: 6, background: "#cfc6b8" }} /> {/* 그림 거는 레일 */}

      {/* 전시 제목 */}
      <div className="absolute left-1/2 top-[0.6%] -translate-x-1/2 whitespace-nowrap text-xl font-black tracking-widest text-[#5b5148]">{galleryData?.title}</div>

      {/* 작품 */}
      {placed.map((p, i) => (
        <div key={p.art.id}>
          {/* 바닥의 조명 빛 */}
          {!p.easel && <div className="pointer-events-none absolute" style={{ ...pct({ x: p.rect.x - 0.02, y: p.rect.y, w: p.rect.w + 0.04, h: 0.36 }), background: "radial-gradient(ellipse at 50% 0%, rgba(255,240,200,0.55), transparent 70%)" }} />}
          {/* 이젤 다리 */}
          {p.easel && (
            <div className="absolute" style={pct({ x: p.rect.x, y: p.rect.y + p.rect.h - 0.01, w: p.rect.w, h: 0.16 })}>
              <span className="absolute left-[18%] top-0 h-full w-2.5 origin-top rotate-[8deg] bg-[#7b5236]" />
              <span className="absolute right-[18%] top-0 h-full w-2.5 origin-top -rotate-[8deg] bg-[#7b5236]" />
              <span className="absolute left-1/2 top-0 h-[85%] w-2.5 -translate-x-1/2 bg-[#5e3d28]" />
            </div>
          )}
          {/* 액자 */}
          <div className="absolute border-[6px] bg-white p-1.5" style={{ ...pct(p.rect), borderColor: p.easel ? "#7b5236" : OUTLINE, boxShadow: "6px 8px 0 rgba(0,0,0,0.18)" }}>
            <ArtImage art={p.art} index={i} />
          </div>
          {/* 이름표 */}
          {!p.easel && (
            <div className="absolute flex justify-center" style={{ left: `${p.rect.x * 100}%`, width: `${p.rect.w * 100}%`, top: `${(p.rect.y + p.rect.h + 0.012) * 100}%` }}>
              <span className="max-w-full truncate bg-white px-2 text-xs font-bold text-[#5b5148] shadow">{p.art.title}</span>
            </div>
          )}
        </div>
      ))}

      {/* 벤치 */}
      <div className="absolute border-[5px]" style={{ ...pct({ x: 0.66, y: 0.8, w: 0.14, h: 0.06 }), borderColor: OUTLINE, background: "#9c6a3c", boxShadow: "inset 0 -10px 0 #7b5236" }} />

      {/* 화분 */}
      <div className="absolute -translate-x-1/2 text-[72px] leading-none" style={{ left: "96%", top: "86%" }}>🪴</div>

      {/* 아래쪽 가운데 출구 (바닥이 어둡게 이어져요) */}
      <div className="absolute" style={{ ...pct({ x: 0.42, y: 0.93, w: 0.16, h: 0.07 }), background: "linear-gradient(transparent, rgba(0,0,0,0.35))" }} />
    </div>
  );
}

export default function GalleryPage() {
  return (
    <SimpleRoom
      roomId="exhibitionRoom"
      roomName="🖼️ 전시회"
      welcome={`${galleryData?.intro ?? ""} · 아래쪽 출구 = ☕ 찻집`}
      mapW={MAP_W}
      mapH={MAP_H}
      outside="#4a4038"
      blockers={BLOCKERS}
      spots={SPOTS}
      exits={EXITS}
      spawns={SPAWNS}
      renderModals={(openId, close) =>
        placed.map((p, i) => (
          <PixelModal key={p.art.id} open={openId === p.art.id} onClose={close} label="🖼️ 전시회" title={p.art.title} width={560}>
            <div className="mx-auto aspect-[4/3] w-full max-w-[460px] border-[6px] border-[#1a110e] bg-white p-2">
              <ArtImage art={p.art} index={i} big />
            </div>
            <p className="mt-3 text-sm font-bold text-amber-200">
              {[p.art.artist, p.art.year].filter(Boolean).join(" · ")}
            </p>
            {p.art.description && <p className="mt-1 whitespace-pre-line leading-relaxed text-amber-50/90">{p.art.description}</p>}
          </PixelModal>
        ))
      }
    >
      <GalleryScene />
    </SimpleRoom>
  );
}
