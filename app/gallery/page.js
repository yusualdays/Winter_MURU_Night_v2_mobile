"use client";

import { useEffect, useState } from "react";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { galleryData } from "../spaceData";
import GalleryGuestbook, { useGuestbook } from "../components/GalleryGuestbook";
import GalleryHud from "../components/GalleryHud";

// 🖼️ 전시회 (exhibitionRoom) — 찻집 오른쪽 아래 통로로 와요
//  - 배경 그림: public/gallery_bg.png (4:3) — 아래 좌표는 모두 이 그림 기준 0~1 비율. 주소 끝에 ?debug=1 → 장애물·버튼 위치 색칠
//  - 작품은 app/spaceData.js의 galleryData.artworks (앞 4개 = 벽 액자, 5·6번째 = 유리 진열장, 최대 6개)
//    image를 넣으면 그림 속 액자 안에 내 그림이 들어가고, 비워 두면 배경에 그려진 그림이 그대로 보여요
//  - 왼쪽 아래 책상 → 📖 방명록 겸 감상 후기 (components/GalleryGuestbook.js, Firebase galleryGuestbook)
//  - 오른쪽 위 ⚙️ → 전시회 설정 (components/GalleryHud.js)
//  - 왼쪽 문(왼쪽 벽 가운데) → ☕ 찻집 (오른쪽 아래 통로 앞으로 돌아가요)
//  - data.js의 eventSchedule 기간에만 들어올 수 있어요
const MAP_W = 1600;
const MAP_H = 1200;
const BG_IMAGE = "/gallery_bg.png";
const WALL_BOTTOM = 0.335; // 벽 아래 끝 (바닥 시작)
const FLOOR = { x: 0.05, y: WALL_BOTTOM, r: 0.95, b: 0.935 }; // 바닥 테두리
const DOOR = { y: 0.53, h: 0.1 }; // 왼쪽 문 (찻집으로)

// 작품 자리: inner = 액자 안쪽 그림 칸, frame = 버튼이 뜨는 곳, near = 이 근처에 서면 [🖼️ 작품 이름]
const WALL_FRAMES = [
  { inner: { x: 0.115, y: 0.145, w: 0.125, h: 0.115 }, near: { x: 0.18, y: 0.4 } },
  { inner: { x: 0.345, y: 0.165, w: 0.11, h: 0.085 }, near: { x: 0.4, y: 0.4 } },
  { inner: { x: 0.56, y: 0.145, w: 0.105, h: 0.115 }, near: { x: 0.615, y: 0.4 } },
  { inner: { x: 0.775, y: 0.14, w: 0.085, h: 0.13 }, near: { x: 0.82, y: 0.4 } },
];
const CASES = [
  { inner: { x: 0.262, y: 0.49, w: 0.074, h: 0.07 }, body: { x: 0.255, y: 0.4, w: 0.09, h: 0.23 }, near: { x: 0.3, y: 0.7 } },
  { inner: { x: 0.662, y: 0.49, w: 0.074, h: 0.07 }, body: { x: 0.655, y: 0.4, w: 0.09, h: 0.23 }, near: { x: 0.7, y: 0.7 } },
];
const SLOTS = [...WALL_FRAMES, ...CASES.map((c) => ({ ...c, inCase: true }))];
const BENCH = { x: 0.415, y: 0.53, w: 0.17, h: 0.1 };
const SEAT_FEET_Y = 0.612; // 벤치에 앉았을 때 발끝 높이

const artworks = (galleryData?.artworks ?? []).slice(0, SLOTS.length);
const placed = artworks.map((art, i) => ({ art, ...SLOTS[i] }));

const BLOCKERS = [
  { x: 0, y: 0, w: 1, h: FLOOR.y }, // 위쪽 벽
  { x: 0, y: 0, w: FLOOR.x, h: DOOR.y }, // 왼쪽 벽 (문 위)
  { x: 0, y: DOOR.y + DOOR.h, w: FLOOR.x, h: 1 }, // 왼쪽 벽 (문 아래)
  { x: FLOOR.r, y: 0, w: 1 - FLOOR.r, h: 1 }, // 오른쪽 벽
  { x: 0, y: FLOOR.b, w: 1, h: 1 - FLOOR.b }, // 아래쪽 벽
  ...CASES.map((c) => ({ x: c.body.x, y: c.body.y - 0.03, w: c.body.w, h: c.body.h + 0.03 })), // 유리 진열장 (유리 위로 못 올라가게 전체)
  { x: BENCH.x, y: BENCH.y - 0.01, w: BENCH.w, h: BENCH.h + 0.01 }, // 벤치 (위에 못 서게 전체)
  { x: FLOOR.x, y: 0.66, w: 0.1, h: 0.3 }, // 화분 + 방명록 탁자
];

// 🪑 가운데 벤치 (앉아서 작품 감상) — stands: 앞·뒤·옆 어디서 다가가도 앉을 수 있어요 — 앞이 트인 벤치라 legs: true (다리를 자르지 않고 벤치 앞으로 늘어뜨려요)
//   legs 자리의 y = 발끝 높이 (엉덩이는 그보다 캐릭터 다리 길이만큼 위 = 벤치 앉는 판)
const SEATS = [
  { id: "bench1", x: 0.46, y: SEAT_FEET_Y, dir: "down", legs: true, stands: [{ x: 0.46, y: 0.69 }, { x: 0.46, y: 0.49 }, { x: 0.38, y: 0.6 }], label: "벤치에 앉기" },
  { id: "bench2", x: 0.54, y: SEAT_FEET_Y, dir: "down", legs: true, stands: [{ x: 0.54, y: 0.69 }, { x: 0.54, y: 0.49 }, { x: 0.62, y: 0.6 }], label: "벤치에 앉기" },
];

// 📖 왼쪽 아래 책상 (방명록) — 책상 오른쪽에 서면 [📖 방명록 쓰기]
const DESK = { x: 0.055, y: 0.745, w: 0.09, h: 0.185 };
const GUESTBOOK_ID = "guestbook";

const SPOTS = [
  ...placed.map((p) => ({ id: p.art.id, rect: p.inner, near: p.near, radius: 110, icon: "🖼️", title: p.art.title })),
  { id: GUESTBOOK_ID, rect: DESK, near: { x: 0.19, y: 0.84 }, radius: 130, icon: "📖", title: "방명록 쓰기" },
];

// 왼쪽 문 → 찻집
const EXITS = [{ id: "out", to: "teaHouse", zone: { x: 0, y: DOOR.y + 0.01, w: 0.03, h: DOOR.h - 0.02 }, sign: { x: 0.11, y: 0.44 }, label: "⬅ ☕ 찻집으로" }];

const SPAWNS = {
  default: { x: 0.13, y: 0.58 },
  teaHouse: { x: 0.13, y: 0.58 }, // 찻집에서 오면 → 왼쪽 문 앞
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
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    try {
      setDebug(new URLSearchParams(window.location.search).has("debug"));
    } catch {}
  }, []);
  return (
    <div className="absolute inset-0">
      {/* 배경 그림 */}
      <div className="absolute inset-0" style={{ background: `url(${BG_IMAGE}) center / 100% 100% no-repeat, #c9bba8`, imageRendering: "pixelated" }} />

      {/* 작품 (image가 있을 때만 그림 속 액자·진열장 안에 덮어요) */}
      {placed.map((p, i) =>
        p.art.image ? (
          <div key={p.art.id} className="pointer-events-none absolute overflow-hidden bg-white" style={pct(p.inner)}>
            <ArtImage art={p.art} index={i} />
            {p.inCase && <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent" />}
          </div>
        ) : null
      )}

      {/* 📖 방명록 책상 팻말 */}
      <div className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap border-4 border-[#2b1d1a] bg-[#f5e6c8] px-2 py-0.5 text-base font-black text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]" style={{ left: `${(DESK.x + DESK.w / 2) * 100}%`, top: `${(DESK.y - 0.045) * 100}%`, zIndex: 50 }}>
        📖 방명록
      </div>

      {/* 전시 제목 */}
      <div className="absolute left-1/2 top-[5.5%] -translate-x-1/2 whitespace-nowrap text-xl font-black tracking-widest text-[#5b5148]">{galleryData?.title}</div>

      {debug && (
        <div className="pointer-events-none absolute inset-0 z-[20]">
          {BLOCKERS.map((b, i) => <div key={i} className="absolute border-2 border-red-600 bg-red-500/25" style={pct(b)} />)}
          {SPOTS.map((s) => <div key={s.id} className="absolute border-2 border-yellow-400 bg-yellow-300/30" style={pct(s.rect)} />)}
          {EXITS.map((e) => <div key={e.id} className="absolute border-2 border-purple-500 bg-purple-500/30" style={pct(e.zone)} />)}
          {SEATS.map((st) => <span key={st.id} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500" style={{ left: st.x * MAP_W, top: st.y * MAP_H }} />)}
        </div>
      )}
    </div>
  );
}

export default function GalleryPage() {
  const guestbook = useGuestbook();
  return (
    <SimpleRoom
      roomId="exhibitionRoom"
      roomName="🖼️ 전시회"
      welcome={`${galleryData?.intro ?? ""} · 왼쪽 문 = ☕ 찻집`}
      mapW={MAP_W}
      mapH={MAP_H}
      outside="#4a4038"
      blockers={BLOCKERS}
      spots={SPOTS}
      exits={EXITS}
      spawns={SPAWNS}
      seats={SEATS}
      hud={(api) => <GalleryHud api={api} guestbookCount={guestbook.length} onOpenGuestbook={() => api.openDetail(GUESTBOOK_ID)} />}
      renderModals={(openId, close, api) => [
        <PixelModal key={GUESTBOOK_ID} open={openId === GUESTBOOK_ID} onClose={close} label="🖼️ 전시회" title="📖 방명록 · 감상 후기" width={640}>
          <GalleryGuestbook entries={guestbook} artworks={artworks} nickname={api.nickname} myId={api.myId} isOwner={api.isOwner} />
        </PixelModal>,
        ...placed.map((p, i) => (
          <PixelModal key={p.art.id} open={openId === p.art.id} onClose={close} label="🖼️ 전시회" title={p.art.title} width={560}>
            <div className="mx-auto aspect-[4/3] w-full max-w-[460px] border-[6px] border-[#1a110e] bg-white p-2">
              <ArtImage art={p.art} index={i} big />
            </div>
            <p className="mt-3 text-sm font-bold text-amber-200">
              {[p.art.artist, p.art.year].filter(Boolean).join(" · ")}
            </p>
            {p.art.description && <p className="mt-1 whitespace-pre-line leading-relaxed text-amber-50/90">{p.art.description}</p>}
          </PixelModal>
        )),
      ]}
    >
      <GalleryScene />
    </SimpleRoom>
  );
}
