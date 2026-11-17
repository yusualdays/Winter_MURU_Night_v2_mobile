"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { TeaNpc, TeaNpcLabel, DayeonSprite, NPC_W, NPC_H } from "../components/TeaNpc";
import SeasonWindow from "../components/SeasonWindow";
import TeaHouseHud, { useTeaHouse } from "../components/TeaHouseHud";
import TeaMenuBoard from "../components/TeaMenuBoard";
import TeaCraftModal from "../components/TeaCraft";
import { CounterModal, SpeakerModal, BookmarkModal, ShowroomModal } from "../components/TeaRoomModals";
import { TableItems, clearOrder } from "../components/TeaTable";
import { cafeData } from "../spaceData";

// ☕ 군산 온라인 찻집 (teaHouse) — 입장하면 가장 먼저 오는 곳
//  - 배경 그림: public/teahouse_bg.png (4:3, 모던·미니멀 찻집) — 아래 좌표는 모두 이 그림 기준 0~1 비율
//    (x: 왼쪽→오른쪽, y: 위→아래). 주소 끝에 ?debug=1 을 붙이면 장애물·자리·버튼 위치가 색칠돼 보여요 → 그림에 맞춰 숫자만 고치면 돼요
//  - 위쪽 가운데 통로 → 🛋️ 거실 / 오른쪽 아래 통로 → 🖼️ 전시회 (data.js eventSchedule 기간에만, 기간 밖에는 "🚧 준비중")
const MAP_W = 1600;
const MAP_H = 1200;
const BG_IMAGE = "/teahouse_bg.png";

// 벽 아래 끝 (바닥이 시작되는 높이)
const WALL_BOTTOM = 0.33;
// 위쪽 가운데 통로 (거실로 가는 문)
const PASSAGE = { x: 0.465, w: 0.09, top: 0.16 };

// 🪟 통창 유리 부분 — 계절 풍경은 이 네모 안에서만 보여요 (overflow-hidden)
const WINDOW_AREA = { x: 0.095, y: 0.145, w: 0.225, h: 0.17 };

// 🍵 카운터 + 주방 (오른쪽 위) — 통째로 못 지나가요
const COUNTER = { x: 0.615, y: 0.27, w: 0.34, h: 0.27 };
// 🍵 다연이 서 있는 자리 (발 가운데) — 그림 속 다연 위치. 그림에 다연이 그려져 있어서 코드 캐릭터는 숨기고 이름표·말풍선만 띄워요
const COUNTER_NPC_POS = { x: 0.78, y: 0.43 };
const NPC_IN_BG = true; // 배경 그림에 다연이 없으면 false 로 바꾸면 코드로 그린 다연이 나와요
const NPC_X = COUNTER_NPC_POS.x * MAP_W - NPC_W / 2; // 그림 왼쪽 위 (맵 좌표)
const NPC_Y = COUNTER_NPC_POS.y * MAP_H - NPC_H;

// 다연의 말
const NPC_LINES = {
  first: "어서 오세요, 차의 인연이 닿는 곳입니다. 찻집 이용 방법을 알려드릴게요!",
  again: "다시 오셨네요! 오늘도 편안한 시간 보내세요 🍵",
};

// 찻집 이용 가이드 (다연이 알려줘요)
const GUIDE = [
  { icon: "👆", title: "자리 이동 & 대화", text: "바닥을 터치(클릭)하면 걸어가요. 빈 의자 옆에서 앉을 수 있고, 다른 손님 캐릭터를 누르면 1:1 찻자리 대화를 청할 수 있어요." },
  { icon: "🍵", title: "카운터", text: "카운터 앞에서 차림표를 보거나, 다식·말차 만들기 체험을 해 보세요. 만든 건 내 테이블로 가져가 먹을 수 있어요." },
  { icon: "📖", title: "공부 집중 모드 & 소리", text: "오른쪽 위 [📖 공부 집중 모드]로 뽀모도로 타이머를 켜요. 창가 옆 스피커에서 BGM과 백색소음을 고를 수 있어요." },
  { icon: "🔖", title: "책장 & 다구 판매존", text: "왼쪽 아래 책장엔 손님들이 남긴 독서 책갈피가, 오른쪽 선반엔 다구 쇼룸이 있어요." },
  { icon: "🚪", title: "통로 안내", text: "위쪽 가운데 문은 🛋️ 거실, 오른쪽 아래 통로는 🖼️ 전시실로 이어져요. (오픈 기간에만 열려요)" },
];

// ---------------- 🪑 좌석 (총 13석) ----------------
//  x,y = 앉았을 때 엉덩이 자리 / dir = 앉아서 보는 방향 / stand = 의자 옆 서는 자리 (가까이 오면 [🪑 앉기], 일어나면 여기로)
//  place = 테이블 위 차·다식이 놓이는 곳

// 왼쪽 2인 테이블 4개 (테이블마다 위·아래 의자)
const DUO_TABLES = [
  { id: "t1", x: 0.115, top: 0.32, bottom: 0.4, standX: 0.2 },
  { id: "t2", x: 0.302, top: 0.32, bottom: 0.4, standX: 0.375 },
  { id: "t3", x: 0.115, top: 0.5, bottom: 0.58, standX: 0.2 },
  { id: "t4", x: 0.302, top: 0.5, bottom: 0.58, standX: 0.375 },
];
const TABLE_W = 0.075;
const TABLE_SEATS = DUO_TABLES.flatMap((t) => [
  { id: `${t.id}U`, group: t.id, x: t.x, y: t.top - 0.01, dir: "down", stand: { x: t.standX, y: t.top - 0.005 }, place: { x: t.x, y: t.top + 0.02 }, label: "2인석에 앉기" },
  { id: `${t.id}D`, group: t.id, x: t.x, y: t.bottom + 0.035, dir: "up", stand: { x: t.standX, y: t.bottom + 0.04 }, place: { x: t.x, y: t.bottom - 0.02 }, label: "2인석에 앉기" },
]);

// 📚 가운데 아래 단체석 (긴 쉐어 테이블) — 앉으면 독서모임 발제문·구글 미트 링크가 보여요
//   좌측 2석(왼쪽 위·왼쪽 아래) · 우측 2석(오른쪽 위·오른쪽 아래) · 하단 1석(아래 가운데)
const SHARE_TABLE = { x: 0.395, y: 0.725, w: 0.245, h: 0.16 };
const SHARE_SEATS = [
  { id: "share1", group: "share", x: 0.44, y: 0.73, dir: "down", stand: { x: 0.44, y: 0.665 }, place: { x: 0.44, y: 0.765 }, label: "단체석에 앉기" },
  { id: "share2", group: "share", x: 0.44, y: 0.92, dir: "up", stand: { x: 0.365, y: 0.92 }, place: { x: 0.44, y: 0.83 }, label: "단체석에 앉기" },
  { id: "share3", group: "share", x: 0.59, y: 0.73, dir: "down", stand: { x: 0.59, y: 0.665 }, place: { x: 0.59, y: 0.765 }, label: "단체석에 앉기" },
  { id: "share4", group: "share", x: 0.59, y: 0.92, dir: "up", stand: { x: 0.67, y: 0.92 }, place: { x: 0.59, y: 0.83 }, label: "단체석에 앉기" },
  { id: "share5", group: "share", x: 0.515, y: 0.92, dir: "up", stand: { x: 0.515, y: 0.975 }, place: { x: 0.515, y: 0.83 }, label: "단체석에 앉기" },
];
const ALL_SEATS = [...TABLE_SEATS, ...SHARE_SEATS];

// ---------------- 벽면 오브젝트 ----------------
const SPEAKER = { x: 0.405, y: 0.25, w: 0.05, h: 0.11 };
const BOOKSHELF = { x: 0.05, y: 0.75, w: 0.19, h: 0.23 };
const TEAWARE_SHELF = { x: 0.775, y: 0.58, w: 0.175, h: 0.18 };

// ---------------- 🚧 장애물 (발이 못 들어가는 네모) ----------------
const BLOCKERS = [
  { x: 0, y: 0, w: PASSAGE.x, h: WALL_BOTTOM }, // 위쪽 벽 (통로 왼쪽)
  { x: PASSAGE.x + PASSAGE.w, y: 0, w: 1 - PASSAGE.x - PASSAGE.w, h: WALL_BOTTOM }, // 위쪽 벽 (통로 오른쪽)
  { x: 0, y: 0, w: 0.05, h: 1 }, // 왼쪽 벽
  { x: 0.95, y: 0, w: 0.05, h: 0.84 }, // 오른쪽 벽 (전시실 통로 위까지)
  { x: 0, y: 0.985, w: 0.84, h: 0.015 }, // 아래쪽 벽 (전시실 통로 왼쪽까지)
  { ...COUNTER }, // 카운터 + 주방
  ...DUO_TABLES.map((t) => ({ x: t.x - TABLE_W / 2, y: t.top + 0.005, w: TABLE_W, h: t.bottom - t.top - 0.01 })), // 2인 테이블 본체
  { x: SHARE_TABLE.x, y: SHARE_TABLE.y + 0.025, w: SHARE_TABLE.w, h: SHARE_TABLE.h - 0.045 }, // 단체석 테이블 본체
  { x: SPEAKER.x, y: 0.3, w: SPEAKER.w, h: 0.06 }, // 스피커
  { x: BOOKSHELF.x, y: 0.8, w: BOOKSHELF.w, h: 0.2 }, // 책장
  { x: 0.25, y: 0.9, w: 0.045, h: 0.1 }, // 책장 옆 잡지꽂이
  { x: TEAWARE_SHELF.x, y: 0.63, w: TEAWARE_SHELF.w, h: 0.13 }, // 다구 판매존 선반
  { x: 0.785, y: 0.88, w: 0.05, h: 0.1 }, // 전시실 앞 입간판
];

// ---------------- 💬 상호작용 포인트 ----------------
//  rect = 버튼이 뜨는 곳(그림 위) / near = 이 근처에 서면 버튼이 떠요 / radius = 거리 (맵 px)
const SPOTS = [
  { id: "counter", rect: { x: 0.66, y: 0.5, w: 0.24, h: 0.04 }, near: { x: 0.77, y: 0.575 }, radius: 140, icon: "🍵", title: "차림표 보기 · 다식·말차 만들기" },
  { id: "speaker", rect: { x: SPEAKER.x - 0.02, y: SPEAKER.y - 0.04, w: SPEAKER.w + 0.04, h: 0.04 }, near: { x: 0.43, y: 0.4 }, radius: 110, icon: "🎵", title: "BGM & 백색소음 설정" },
  { id: "bookshelf", rect: { x: BOOKSHELF.x, y: BOOKSHELF.y - 0.04, w: BOOKSHELF.w, h: 0.04 }, near: { x: 0.15, y: 0.72 }, radius: 140, icon: "🔖", title: "교환 독서 책갈피" },
  { id: "showroom", rect: { x: TEAWARE_SHELF.x, y: TEAWARE_SHELF.y - 0.04, w: TEAWARE_SHELF.w, h: 0.04 }, near: { x: 0.72, y: 0.74 }, radius: 110, icon: "🫖", title: "다구 쇼룸 / 스마트스토어 구경하기" },
];

// ---------------- 🚪 통로 (zone = 발이 닿으면 이동하는 경계) ----------------
//  paintedSign: 배경 그림에 팻말이 있어서, 열려 있을 땐 그림 팻말만 / 준비중일 때만 코드 팻말 "🚧 준비중"
const EXITS = [
  { id: "up", to: "livingRoom", zone: { x: PASSAGE.x + 0.01, y: PASSAGE.top, w: PASSAGE.w - 0.02, h: 0.05 }, sign: { x: 0.51, y: 0.1 }, paintedSign: true, label: "⬆ 🛋️ 거실" },
  { id: "exRight", to: "exhibitionRoom", zone: { x: 0.85, y: 0.95, w: 0.1, h: 0.05 }, sign: { x: 0.9, y: 0.76 }, paintedSign: true, label: "🖼️ 전시실 ➜" },
];

// 시작 위치 (발 가운데) — 어디서 왔는지에 따라
const SPAWNS = {
  default: { x: 0.52, y: 0.6 }, // 처음 입장 (가운데)
  livingRoom: { x: 0.51, y: 0.4 }, // 거실에서 내려옴 → 위쪽 통로 앞
  "exhibitionRoom:exRight": { x: 0.72, y: 0.86 }, // 전시회에서 돌아옴 → 오른쪽 아래 통로 앞
  exhibitionRoom: { x: 0.72, y: 0.86 },
};

const pct = (r) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

// 🔧 ?debug=1 — 장애물(빨강) · 앉는 자리(초록) · 서는 자리(파랑) · 버튼 자리(노랑) · 통로(보라)
function DebugOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[20]">
      {BLOCKERS.map((b, i) => <div key={i} className="absolute border-2 border-red-600 bg-red-500/25" style={pct(b)} />)}
      <div className="absolute border-2 border-sky-400" style={pct(WINDOW_AREA)} />
      {SPOTS.map((s) => (
        <div key={s.id}>
          <div className="absolute border-2 border-yellow-400 bg-yellow-300/30 text-[10px] font-black" style={pct(s.rect)}>{s.id}</div>
          <div className="absolute rounded-full border-2 border-yellow-400" style={{ left: s.near.x * MAP_W - (s.radius ?? 90), top: s.near.y * MAP_H - (s.radius ?? 90), width: (s.radius ?? 90) * 2, height: (s.radius ?? 90) * 2 }} />
        </div>
      ))}
      {EXITS.map((e) => <div key={e.id} className="absolute border-2 border-purple-500 bg-purple-500/30" style={pct(e.zone)} />)}
      {ALL_SEATS.map((st) => (
        <div key={st.id}>
          <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500" style={{ left: st.x * MAP_W, top: st.y * MAP_H }} />
          <span className="absolute -translate-x-1/2 text-[10px] font-black text-green-900" style={{ left: st.x * MAP_W, top: st.y * MAP_H + 6 }}>{st.id}</span>
          <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 bg-blue-500" style={{ left: st.stand.x * MAP_W, top: st.stand.y * MAP_H }} />
        </div>
      ))}
      <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 bg-pink-500" style={{ left: COUNTER_NPC_POS.x * MAP_W, top: COUNTER_NPC_POS.y * MAP_H }} />
    </div>
  );
}

// 배경 그림 + 그 위에 올리는 것들 (npcBubble: 다연의 말풍선)
function CafeScene({ npcBubble, season, orders, debug }) {
  return (
    <div className="absolute inset-0">
      {/* 배경 그림 (그림이 없을 때를 대비해 나무 바닥색) */}
      <div className="absolute inset-0" style={{ background: `url(${BG_IMAGE}) center / 100% 100% no-repeat, #c08a57`, imageRendering: "pixelated" }} />

      {/* 🪟 사계절 통창 (유리 안쪽만, 가운데 창살은 다시 그려요) */}
      <SeasonWindow rect={{ x: WINDOW_AREA.x * MAP_W, y: WINDOW_AREA.y * MAP_H, w: WINDOW_AREA.w * MAP_W, h: WINDOW_AREA.h * MAP_H }} season={season} />
      <div className="pointer-events-none absolute bg-[#4b4b4b]" style={{ left: (WINDOW_AREA.x + WINDOW_AREA.w / 2) * MAP_W - 5, top: WINDOW_AREA.y * MAP_H, width: 10, height: WINDOW_AREA.h * MAP_H }} />
      <div className="pointer-events-none absolute bg-gradient-to-br from-white/25 via-transparent to-transparent" style={pct(WINDOW_AREA)} />

      {/* 🍵 알바생 다연 (그림에 있으면 코드 캐릭터는 숨기고 이름표·말풍선만) */}
      {!NPC_IN_BG && <TeaNpc x={NPC_X} y={NPC_Y} />}
      <TeaNpcLabel x={NPC_X} y={NPC_Y + (NPC_IN_BG ? 40 : 0)} bubble={npcBubble} />

      {/* 🍵 테이블 위 차·다식 (손님이 주문하면 모두에게 보여요) */}
      <TableItems orders={orders} seats={ALL_SEATS} mapW={MAP_W} mapH={MAP_H} />

      {debug && <DebugOverlay />}
    </div>
  );
}

export default function CafePage() {
  // 찻집 공용 상태 (계절 · 모임 · 라이브 · 메뉴 상태) — Firebase "teaHouse"
  const tea = useTeaHouse();
  const nicknameRef = useRef("");
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    try {
      setDebug(new URLSearchParams(window.location.search).has("debug"));
    } catch {}
  }, []);
  // 카운터 창에서 고른 것 (menu | craft | guide) — 카운터 창 대신 그 창을 열어요
  const [counterPick, setCounterPick] = useState(null);

  // 다연의 말풍선 { text, key }
  const [npcBubble, setNpcBubble] = useState(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const say = useCallback((text, ms) => {
    const key = Date.now();
    setNpcBubble({ text, key });
    later(() => setNpcBubble((b) => (b?.key === key ? null : b)), ms);
  }, []);

  // 찻집에 들어왔을 때: 첫 방문이면 1초 뒤 인사 + 이용 가이드, 재방문이면 환영 인사만 4초
  const handleEnter = useCallback(
    ({ openDetail }) => {
      try {
        nicknameRef.current = localStorage.getItem("partyNickname") || "";
      } catch {}
      let visited = false;
      try {
        visited = localStorage.getItem("teaHouseVisited") === "true";
      } catch {}
      if (!visited) {
        later(() => {
          say(NPC_LINES.first, 8000);
          openDetail("guide");
        }, 1000);
      } else {
        later(() => say(NPC_LINES.again, 4000), 600);
      }
    },
    [say]
  );

  // 가이드를 닫으면 "이미 와 본 손님"으로 기억
  const closeGuide = (close) => {
    try {
      localStorage.setItem("teaHouseVisited", "true");
    } catch {}
    close();
  };

  return (
    <SimpleRoom
      roomId="teaHouse"
      roomName="☕ 군산 온라인 찻집"
      welcome="위쪽 문 = 🛋️ 거실 · 오른쪽 아래 통로 = 🖼️ 전시실"
      mapW={MAP_W}
      mapH={MAP_H}
      outside="#3b2a20"
      blockers={BLOCKERS}
      spots={SPOTS}
      exits={EXITS}
      spawns={SPAWNS}
      seats={ALL_SEATS}
      onSeatLeave={clearOrder}
      hud={(api) => <TeaHouseHud tea={tea} api={api} />}
      onEnter={handleEnter}
      renderModals={(openId, close) => {
        const closeAll = () => {
          setCounterPick(null);
          close();
        };
        const view = openId === "counter" ? counterPick ?? "counter" : openId;
        return (
        <>
        {/* 찻집 이용 가이드 (다연) */}
        <PixelModal open={view === "guide"} onClose={() => closeGuide(closeAll)} label="🍵 다연의 찻집 이용 가이드" title="군산 온라인 찻집에 오신 걸 환영해요" width={520}>
          <div className="mb-4 flex items-center gap-3 border-4 border-[#1a110e] bg-[#f5e6c8] p-3 text-[#2b1d1a]">
            <div className="shrink-0 bg-[#d9c7a6] px-1 pt-1">
              <DayeonSprite scale={3} />
            </div>
            <p className="text-sm font-bold leading-relaxed">“{NPC_LINES.first}”</p>
          </div>
          <ol className="flex flex-col gap-2.5">
            {GUIDE.map((g, i) => (
              <li key={g.title} className="flex gap-3 border-2 border-white/15 bg-black/20 p-3">
                <span className="text-2xl leading-none">{g.icon}</span>
                <div>
                  <p className="font-black text-amber-200">
                    {"①②③④"[i]} {g.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/85">{g.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => closeGuide(closeAll)}
            className="mt-4 w-full border-4 border-[#1a110e] bg-amber-400 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
          >
            알겠어요, 둘러볼게요! 🍵
          </button>
        </PixelModal>

        {/* 🍵 세로형 차림표 + 메뉴 투표·피드백 */}
        {/* 🍵 카운터: [차림표 보기] [다식·말차 만들기] [다연에게 말 걸기] */}
        <CounterModal open={view === "counter"} onClose={closeAll} onPick={setCounterPick} />
        <TeaCraftModal open={view === "craft"} onClose={closeAll} />
        {/* 🍵 세로형 차림표 + 메뉴 투표·피드백 */}
        <TeaMenuBoard open={view === "menu"} onClose={closeAll} items={cafeData.menu} menuStatus={tea.menuStatus} nickname={nicknameRef.current} />

        <SpeakerModal open={view === "speaker"} onClose={closeAll} />
        <BookmarkModal open={view === "bookshelf"} onClose={closeAll} nickname={nicknameRef.current} />
        <ShowroomModal open={view === "showroom"} onClose={closeAll} />
        </>
        );
      }}
    >
      <CafeScene npcBubble={npcBubble} season={tea.season} orders={tea.orders} debug={debug} />
    </SimpleRoom>
  );
}
