"use client";

import { useEffect, useRef, useState } from "react";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { galleryData } from "../spaceData";
import GalleryGuestbook, { useGuestbook } from "../components/GalleryGuestbook";
import GalleryHud from "../components/GalleryHud";
import { GuideBoard, GuideContent, GUIDE_SEEN_KEY } from "../components/GalleryGuide";
import { ListeningCorner, ListeningPicker } from "../components/GalleryListening";

// 🖼️ 전시회 (exhibitionRoom) — 찻집 카운터와 다구 선반 사이 길로 와요
//  - 배경 그림: public/gallery_bg.png (4:3) — 아래 좌표는 모두 이 그림 기준 0~1 비율. 주소 끝에 ?debug=1 → 장애물·버튼 위치 색칠
//  - 작품은 app/spaceData.js의 galleryData.artworks (앞 4개 = 벽 액자, 5·6번째 = 유리 진열장, 최대 6개)
//    image를 넣으면 그림 속 액자 안에 내 그림이 들어가고, 비워 두면 배경에 그려진 그림이 그대로 보여요
//  - 왼쪽 아래 책상 → 📖 방명록 겸 감상 후기 (components/GalleryGuestbook.js, Firebase galleryGuestbook)
//  - 📜 입구 옆 전시 안내문 (components/GalleryGuide.js, 내용은 spaceData galleryData.guide) — 첫 방문이면 "!"
//  - 🎧 아래 가운데 청음실: LP 플레이어 + 음반 거치대 → 유튜브 재생목록 (components/GalleryListening.js, 목록은 spaceData galleryData.listening)
//  - 오른쪽 위 ⚙️ → 전시회 설정 (components/GalleryHud.js)
//  - 왼쪽 문(왼쪽 벽 가운데) → ☕ 찻집 (카운터와 다구 선반 사이 길로 돌아가요)
//  - data.js의 eventSchedule 기간에만 들어올 수 있어요
const MAP_W = 1600;
const MAP_H = 1200;
const BG_IMAGE = "/gallery_bg.png";
const WALL_BOTTOM = 0.335; // 벽 아래 끝 (바닥 시작, 그림 기준)
const WALK_TOP = 0.41; // 발이 올라갈 수 있는 맨 위 (벽에 너무 붙어 머리가 액자를 덮지 않게)
const FLOOR = { x: 0.05, y: WALK_TOP, r: 0.948, b: 0.928 }; // 걸을 수 있는 바닥 테두리
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

// 📜 입구 옆 전시 안내문 (안내판 받침 가운데)
const GUIDE_AT = { x: 0.165, y: 0.56 };
const GUIDE_ID = "guide";

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
  { x: GUIDE_AT.x - 0.022, y: GUIDE_AT.y - 0.035, w: 0.044, h: 0.035 }, // 📜 전시 안내문
  { x: 0.355, y: 0.725, w: 0.29, h: 0.17 }, // 🎧 청음실 (음반 거치대 · LP 콘솔 · 스피커)
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

// 🎧 아래 가운데 청음실 (카펫 전체 자리) — 거치대·LP 콘솔·스피커는 못 지나가고, 앞(아래)에 서면 [🎧 음악 듣기]
const LISTEN = { x: 0.34, y: 0.743, w: 0.32, h: 0.192 };
const LISTEN_ID = "listening";
// 🎨 그림 파일(public/craft/gallery_listening.png, 2:1)을 넣으면 이 자리에 그려져요
const LISTEN_IMG = { x: 0.33, y: 0.703, w: 0.34, h: 0.227 };

// 💡 조명 (⚙️ 설정, 나에게만) — 밤 전시: 어둡게 + 작품·청음실에만 스포트라이트
const SPOTLIGHTS = [
  ...WALL_FRAMES.map((f) => ({ x: f.inner.x + f.inner.w / 2, y: f.inner.y + f.inner.h / 2, r: 0.11 })),
  ...CASES.map((c) => ({ x: c.body.x + c.body.w / 2, y: c.body.y + 0.1, r: 0.09 })),
  { x: 0.5, y: 0.82, r: 0.15 },
];
function Lighting({ mode }) {
  if (mode === "warm") return <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2350, background: "radial-gradient(ellipse at 50% 40%, rgba(255,190,110,0.10), rgba(40,20,5,0.38))", mixBlendMode: "multiply" }} />;
  if (mode !== "spot") return null;
  const holes = SPOTLIGHTS.map((s) => `radial-gradient(ellipse ${s.r * 100}% ${s.r * 133}% at ${s.x * 100}% ${s.y * 100}%, transparent 35%, black 100%)`).join(",");
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 2350, background: "rgba(8,6,12,0.68)", maskImage: holes, WebkitMaskImage: holes, maskComposite: "intersect", WebkitMaskComposite: "source-in" }} />
      {SPOTLIGHTS.map((s, i) => (
        <div key={i} className="pointer-events-none absolute" style={{ zIndex: 2351, left: `${(s.x - s.r) * 100}%`, top: `${(s.y - s.r * 1.33) * 100}%`, width: `${s.r * 200}%`, height: `${s.r * 266}%`, background: "radial-gradient(closest-side, rgba(255,220,150,0.16), transparent)" }} />
      ))}
    </>
  );
}

const SPOTS = [
  ...placed.map((p) => ({ id: p.art.id, rect: p.inner, near: p.near, radius: 110, icon: "🖼️", title: p.art.title })),
  { id: GUIDE_ID, rect: { x: GUIDE_AT.x - 0.026, y: GUIDE_AT.y - 0.1, w: 0.052, h: 0.06 }, near: { x: GUIDE_AT.x, y: GUIDE_AT.y + 0.04 }, radius: 80, icon: "📜", title: "전시 안내문" },
  { id: LISTEN_ID, rect: { x: 0.445, y: 0.75, w: 0.11, h: 0.08 }, near: { x: 0.5, y: 0.915 }, radius: 150, icon: "🎧", title: "음악 듣기" },
  { id: GUESTBOOK_ID, rect: DESK, near: { x: 0.19, y: 0.84 }, radius: 130, icon: "📖", title: "방명록 쓰기" },
];

// 왼쪽 문 → 찻집
const EXITS = [{ id: "out", to: "teaHouse", zone: { x: 0, y: DOOR.y + 0.01, w: 0.03, h: DOOR.h - 0.02 }, label: "⬅ ☕ 찻집으로" }];

const SPAWNS = {
  default: { x: 0.09, y: 0.595 },
  teaHouse: { x: 0.09, y: 0.595 }, // 찻집에서 오면 → 왼쪽 문 앞
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

function GalleryScene({ playing, light, guideAlert, onOpenGuide }) {
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

      {/* 🎧 청음실 */}
      <ListeningCorner area={LISTEN} imgArea={LISTEN_IMG} playing={!!playing} />
      <GuideBoard at={GUIDE_AT} alert={guideAlert} onOpen={onOpenGuide} mapW={MAP_W} mapH={MAP_H} />
      <Lighting mode={light} />



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
  const [playing, setPlaying] = useState(null); // 🎧 마지막으로 고른 LP { title, embed } — 전시실 LP가 돌아가요 (음악은 유튜브 새 창에서)
  const [light, setLight] = useState("warm"); // 💡 조명 (기본: 은은하게)
  const [guideAlert, setGuideAlert] = useState(false); // 📜 처음 왔으면 안내판 위 "!"
  const openRef = useRef(null); // SimpleRoom의 openDetail (onEnter에서 받아요)
  const markGuideSeen = () => {
    setGuideAlert(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {}
  };
  const openGuide = () => openRef.current?.(GUIDE_ID);
  useEffect(() => {
    try {
      const l = localStorage.getItem("galleryLight");
      if (["day", "warm", "spot"].includes(l)) setLight(l);
      if (!localStorage.getItem(GUIDE_SEEN_KEY)) setGuideAlert(true);
    } catch {}
  }, []);
  const changeLight = (l) => {
    setLight(l);
    try {
      localStorage.setItem("galleryLight", l);
    } catch {}
  };
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
      onEnter={({ openDetail }) => {
        openRef.current = openDetail;
      }}
      hud={(api) => (
        <>
          <GalleryHud api={api} guestbookCount={guestbook.length} onOpenGuestbook={() => api.openDetail(GUESTBOOK_ID)} light={light} onLight={changeLight} />
        </>
      )}
      renderModals={(openId, close, api) => [
        <PixelModal key={GUIDE_ID} open={openId === GUIDE_ID} onClose={close} label="🖼️ 전시회" title="📜 전시 안내문" width={560}>
          <GuideContent guide={galleryData?.guide} onClose={close} onSeen={markGuideSeen} />
        </PixelModal>,
        <PixelModal key={LISTEN_ID} open={openId === LISTEN_ID} onClose={close} label="🖼️ 전시회" title="🎧 청음실 · LP 고르기" width={600}>
          <ListeningPicker
            playlists={galleryData?.listening?.playlists ?? []}
            playing={playing}
            onPlay={(p) => {
              setPlaying(p);
              close();
              api.showToast(`${p.title} — 유튜브에서 열었어요`, "🎧");
            }}
            onStop={() => setPlaying(null)}
          />
        </PixelModal>,
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
      <GalleryScene playing={playing} light={light} guideAlert={guideAlert} onOpenGuide={openGuide} />
    </SimpleRoom>
  );
}
