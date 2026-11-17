"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { TeaNpc, TeaNpcLabel, DayeonSprite, NPC_W, NPC_H } from "../components/TeaNpc";
import SeasonWindow from "../components/SeasonWindow";
import TeaHouseHud, { useTeaHouse, menuId } from "../components/TeaHouseHud";
import { cafeData } from "../spaceData";

// ☕ 군산 온라인 찻집 (teaHouse) — 입장하면 가장 먼저 오는 곳
//  - 위쪽 가운데 통로 → 🛋️ 거실 / 왼쪽 아래·오른쪽 아래 구석 통로 → 🖼️ 전시회
//    (문 그림 없이, 통로 끝 경계에 닿으면 화면이 어두워지며 이동해요)
//  - 거실·전시회는 data.js의 eventSchedule 기간에만 열려요 (기간 밖에는 "준비중" 팻말)
//  - 그림은 아직 코드로 그린 임시 그림이에요. 배경 그림이 생기면 CafeScene을 그림 한 장으로 바꾸고 좌표만 맞추면 돼요
//  - 좌표는 모두 0~1 비율 (x: 왼쪽→오른쪽, y: 위→아래)
const MAP_W = 1600;
const MAP_H = 1200;
const WALL_H = 0.24; // 위쪽 벽 높이
const PASSAGE = { x: 0.44, w: 0.12 }; // 위쪽 가운데 통로 (벽이 뚫린 곳)

// 🪟 통창 자리 (0~1 비율) — 계절 풍경은 이 네모 안에서만 보여요. 배경 그림이 생기면 그림 속 통창에 맞춰 고쳐 주세요
const WINDOW_AREA = { x: 0.6, y: 0.03, w: 0.37, h: 0.15 };

// 📚 가운데 단체석(쉐어 테이블) — 모임이 열리면 여기 앉은 손님에게 발제문·미트 링크가 보여요
const SHARE_TABLE = { x: 0.43, y: 0.56, w: 0.14, h: 0.17 };
const SHARE_SEATS = [
  // x,y = 앉았을 때 엉덩이 자리 / stand = 의자 옆 서는 자리 (일어나면 여기로)
  { id: "share1", group: "share", x: 0.405, y: 0.64, dir: "right", stand: { x: 0.34, y: 0.64 }, label: "단체석에 앉기" },
  { id: "share2", group: "share", x: 0.405, y: 0.72, dir: "right", stand: { x: 0.34, y: 0.72 }, label: "단체석에 앉기" },
  { id: "share3", group: "share", x: 0.595, y: 0.64, dir: "left", stand: { x: 0.66, y: 0.64 }, label: "단체석에 앉기" },
  { id: "share4", group: "share", x: 0.595, y: 0.72, dir: "left", stand: { x: 0.66, y: 0.72 }, label: "단체석에 앉기" },
];

// 카운터 (벽 바로 앞) — 안쪽(벽과 카운터 사이)에 알바생 다연이 서 있어요
const COUNTER = { x: 0.04, y: 0.3, w: 0.3, h: 0.13 };
// 🍵 다연이 서 있는 자리 (발 가운데, 0~1 비율) — 사장님 접속과 상관없이 24시간 여기에 있어요
const COUNTER_NPC_POS = { x: 0.19, y: 0.335 };
const NPC_X = COUNTER_NPC_POS.x * MAP_W - NPC_W / 2; // 그림 왼쪽 위 (맵 좌표)
const NPC_Y = COUNTER_NPC_POS.y * MAP_H - NPC_H;
const NPC_TALK_RADIUS = 70; // 이만큼(맵 기준 px) 가까이 오면 [💬 말 걸기 / 이용 안내]

// 다연의 말
const NPC_LINES = {
  first: "어서 오세요, 차의 인연이 닿는 곳입니다. 찻집 이용 방법을 알려드릴게요!",
  again: "다시 오셨네요! 오늘도 편안한 시간 보내세요 🍵",
};

// 찻집 이용 가이드 (다연이 알려줘요)
const GUIDE = [
  { icon: "👆", title: "자리 이동", text: "바닥을 터치(클릭)하면 그곳으로 걸어가요. 빈 좌석이나 책장 앞으로 가 보세요. PC에서는 방향키·W·A·S·D도 돼요." },
  { icon: "📜", title: "차림표 & 체험", text: "벽의 차림표에서 오늘의 차를 구경하고, 다식·말차 만들기 체험도 해 보세요." },
  { icon: "🎧", title: "공부 집중 모드 & 백색소음", text: "오른쪽 위 [공부 집중 모드]를 켜면 조용히 집중할 수 있어요. 빗소리·장작불 같은 백색소음도 섞어 들을 수 있어요." },
  { icon: "🚪", title: "통로 안내", text: "위쪽 가운데 통로는 🛋️ 거실, 왼쪽·오른쪽 아래 구석 통로는 🖼️ 전시회로 이어져요. (오픈 기간에만 열려요)" },
];

// 테이블 (가운데 좌표) — 의자는 테이블 양옆에 그려져요
const TABLES = [
  { x: 0.2, y: 0.6 },
  { x: 0.8, y: 0.6 },
  { x: 0.78, y: 0.36 },
  { x: 0.2, y: 0.8 },
  { x: 0.8, y: 0.8 },
];

const BLOCKERS = [
  { x: 0, y: 0, w: PASSAGE.x, h: WALL_H }, // 위쪽 벽 (통로 왼쪽)
  { x: PASSAGE.x + PASSAGE.w, y: 0, w: 1 - PASSAGE.x - PASSAGE.w, h: WALL_H }, // 위쪽 벽 (통로 오른쪽)
  { x: COUNTER.x, y: WALL_H, w: COUNTER.w, h: COUNTER.y + COUNTER.h - WALL_H }, // 카운터 + 안쪽 (손님은 못 들어가요)
  ...TABLES.map((t) => ({ x: t.x - 0.085, y: t.y - 0.035, w: 0.17, h: 0.06 })), // 테이블 + 의자
  { x: 0.37, y: SHARE_TABLE.y + 0.01, w: 0.26, h: SHARE_TABLE.h }, // 단체석 + 의자
];

const SPOTS = [
  { id: "menu", rect: { x: 0.26, y: 0.05, w: 0.13, h: 0.13 }, near: { x: 0.39, y: 0.33 }, icon: "📜", title: "차림표" },
  // 다연에게 말 걸기 (버튼은 다연 머리 위에 떠요)
  {
    id: "guide",
    rect: { x: NPC_X / MAP_W, y: (NPC_Y - 56) / MAP_H, w: NPC_W / MAP_W, h: 0.04 },
    near: { x: COUNTER_NPC_POS.x, y: COUNTER.y + COUNTER.h + 0.03 }, // 카운터 앞 손님 자리
    radius: NPC_TALK_RADIUS,
    icon: "💬",
    title: "말 걸기 / 이용 안내",
  },
];

// 통로 (zone = 발이 닿으면 이동하는 경계, sign = 팻말 위치)
const EXITS = [
  { id: "up", to: "livingRoom", zone: { x: PASSAGE.x, y: 0.1, w: PASSAGE.w, h: 0.05 }, sign: { x: 0.5, y: 0.012 }, label: "⬆ 🛋️ 거실" },
  { id: "exLeft", to: "exhibitionRoom", zone: { x: 0, y: 0.9, w: 0.08, h: 0.1 }, sign: { x: 0.075, y: 0.78 }, label: "↙ 🖼️ 전시회" },
  { id: "exRight", to: "exhibitionRoom", zone: { x: 0.92, y: 0.9, w: 0.08, h: 0.1 }, sign: { x: 0.925, y: 0.78 }, label: "🖼️ 전시회 ↘" },
];

// 시작 위치 (발 가운데) — 어디서 왔는지에 따라
const SPAWNS = {
  default: { x: 0.5, y: 0.9 }, // 입장 (아래쪽 현관)
  livingRoom: { x: 0.5, y: 0.3 }, // 거실에서 내려옴 → 위쪽 통로 앞
  "exhibitionRoom:exLeft": { x: 0.12, y: 0.85 }, // 전시회에서 돌아옴 → 나갔던 왼쪽 통로 앞
  "exhibitionRoom:exRight": { x: 0.88, y: 0.85 }, // → 나갔던 오른쪽 통로 앞
  exhibitionRoom: { x: 0.12, y: 0.85 },
};

const pct = (r) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
const OUTLINE = "#2b1d1a";

// 둥근 테이블 + 양옆 의자
function Table({ x, y }) {
  return (
    <div className="absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {/* 의자 */}
      {[-1, 1].map((side) => (
        <div key={side} className="absolute border-4" style={{ left: side * 98 - 26, top: -30, width: 52, height: 64, borderColor: OUTLINE, background: "#8a5a3b", boxShadow: "inset 0 -10px 0 #6e4530" }} />
      ))}
      {/* 테이블 */}
      <div className="absolute rounded-full border-[5px]" style={{ left: -72, top: -50, width: 144, height: 96, borderColor: OUTLINE, background: "#d9a066", boxShadow: "inset 0 -12px 0 #b97d48, 0 10px 0 rgba(0,0,0,0.18)" }} />
      <div className="absolute text-3xl" style={{ left: -34, top: -32 }}>☕</div>
      <div className="absolute text-2xl" style={{ left: 8, top: -26 }}>🍪</div>
    </div>
  );
}

// 코드로 그린 임시 찻집 (npcBubble: 다연의 말풍선)
function CafeScene({ npcBubble, season }) {
  return (
    <div className="absolute inset-0">
      {/* 나무 바닥 */}
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, #c08a57 0 56px, #b37c4a 56px 60px), #c08a57" }} />
      <div className="absolute inset-0 opacity-40" style={{ background: "repeating-linear-gradient(90deg, transparent 0 236px, #9c6a3c 236px 240px)" }} />

      {/* 러그 */}
      <div className="absolute border-[6px]" style={{ ...pct({ x: 0.38, y: 0.5, w: 0.24, h: 0.32 }), borderColor: "#7a2e2e", background: "repeating-linear-gradient(45deg, #b0484a 0 16px, #a03e40 16px 32px)", boxShadow: "inset 0 0 0 10px #d9a066" }} />

      {/* 위쪽 벽 (세로 줄무늬 벽지 + 아래 나무 판넬) */}
      <div className="absolute left-0 top-0 w-full" style={{ height: `${WALL_H * 100}%`, background: "repeating-linear-gradient(90deg, #8fa98a 0 40px, #86a081 40px 80px)" }} />
      <div className="absolute left-0 w-full" style={{ top: `${(WALL_H - 0.06) * 100}%`, height: "6%", background: "#7b5236", boxShadow: "inset 0 6px 0 #946545, inset 0 -8px 0 #5e3d28" }} />

      {/* 🪟 사계절 통창 (설정에서 고른 계절 풍경 — 모두에게 같이 보여요) */}
      <SeasonWindow rect={{ x: WINDOW_AREA.x * MAP_W, y: WINDOW_AREA.y * MAP_H, w: WINDOW_AREA.w * MAP_W, h: WINDOW_AREA.h * MAP_H }} season={season} />

      {/* 메뉴판 (칠판) */}
      <div className="absolute flex flex-col items-center gap-2 border-[6px] pt-2" style={{ ...pct(SPOTS[0].rect), borderColor: "#7b5236", background: "#2f4a3a", boxShadow: `0 0 0 4px ${OUTLINE}` }}>
        <span className="text-lg font-black tracking-widest text-[#f5e6c8]">MENU</span>
        {[80, 60, 70, 50].map((w, i) => (
          <span key={i} className="h-1.5 bg-[#f5e6c8]/70" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* 위쪽 가운데 통로 (벽이 뚫려 있고 바닥이 위로 이어져요) */}
      <div className="absolute" style={{ ...pct({ x: PASSAGE.x, y: 0, w: PASSAGE.w, h: WALL_H }), background: "repeating-linear-gradient(0deg, #b37c4a 0 56px, #a8723f 56px 60px)", boxShadow: `inset 10px 0 0 #5e3d28, inset -10px 0 0 #5e3d28, inset 0 40px 30px -20px rgba(0,0,0,0.45)` }} />
      {[PASSAGE.x - 0.035, PASSAGE.x + PASSAGE.w + 0.005].map((x) => (
        <div key={x} className="absolute text-[56px] leading-none" style={{ left: `${x * 100}%`, top: `${(WALL_H - 0.08) * 100}%` }}>🪴</div>
      ))}

      {/* 🍵 알바생 다연 (카운터 안쪽 — 카운터가 다리를 가려요) */}
      <TeaNpc x={NPC_X} y={NPC_Y} />

      {/* 카운터 + 커피 머신 */}
      <div className="absolute border-[6px]" style={{ ...pct(COUNTER), borderColor: OUTLINE, background: "#8a5a3b", boxShadow: "inset 0 22px 0 #d9a066, inset 0 28px 0 #b97d48" }}>
        <div className="absolute border-4" style={{ left: "8%", top: -46, width: 80, height: 70, borderColor: OUTLINE, background: "#9ca3af", boxShadow: "inset 0 -14px 0 #6b7280" }} />
        <div className="absolute text-4xl" style={{ left: "70%", top: -34 }}>🍰</div>
        <div className="absolute text-4xl" style={{ left: "85%", top: -34 }}>🧁</div>
      </div>

      {/* 다연 이름표 + 말풍선 (카운터 위로 보이게) */}
      <TeaNpcLabel x={NPC_X} y={NPC_Y} bubble={npcBubble} />

      {/* 테이블 */}
      {TABLES.map((t, i) => (
        <Table key={i} {...t} />
      ))}

      {/* 📚 가운데 단체석 (긴 테이블 + 의자 4개) */}
      {SHARE_SEATS.map((st) => (
        <div key={st.id} className="absolute border-4" style={{ left: st.x * MAP_W - 30, top: st.y * MAP_H - 58, width: 60, height: 66, borderColor: OUTLINE, background: "#8a5a3b", boxShadow: "inset 0 -12px 0 #6e4530" }} />
      ))}
      <div className="absolute border-[6px]" style={{ ...pct(SHARE_TABLE), borderColor: OUTLINE, background: "#c08a57", boxShadow: "inset 0 -14px 0 #9c6a3c, 0 10px 0 rgba(0,0,0,0.18)" }}>
        <div className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap border-2 border-[#2b1d1a] bg-[#f5e6c8] px-2 text-xs font-black text-[#2b1d1a]">📚 단체석</div>
        <div className="absolute left-[18%] top-[38%] text-3xl">📖</div>
        <div className="absolute right-[18%] top-[52%] text-2xl">🍵</div>
      </div>

      {/* 왼쪽 아래 · 오른쪽 아래 구석 통로 (돌길이 바깥으로 이어져요) */}
      {[
        { x: 0, flip: false },
        { x: 0.86, flip: true },
      ].map(({ x, flip }) => (
        <div key={x} className="absolute" style={{ ...pct({ x, y: 0.86, w: 0.14, h: 0.14 }), background: `linear-gradient(${flip ? "135deg" : "225deg"}, transparent 30%, rgba(0,0,0,0.35))` }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="absolute h-8 w-12 rounded-sm border-4 border-[#5b5148] bg-[#bdb5a6]" style={{ [flip ? "right" : "left"]: 14 + i * 50, bottom: 14 + i * 34 }} />
          ))}
        </div>
      ))}

      {/* 아래쪽 현관 매트 */}
      <div className="absolute flex items-center justify-center border-4 text-sm font-black tracking-[0.3em] text-[#f5e6c8]" style={{ ...pct({ x: 0.43, y: 0.955, w: 0.14, h: 0.045 }), borderColor: OUTLINE, background: "#7a2e2e" }}>
        WELCOME
      </div>
    </div>
  );
}

export default function CafePage() {
  // 찻집 공용 상태 (계절 · 모임 · 라이브 · 메뉴 상태) — Firebase "teaHouse"
  const tea = useTeaHouse();

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
      welcome="위쪽 통로 = 🛋️ 거실 · 왼쪽·오른쪽 아래 통로 = 🖼️ 전시회"
      mapW={MAP_W}
      mapH={MAP_H}
      outside="#3b2a20"
      blockers={BLOCKERS}
      spots={SPOTS}
      exits={EXITS}
      spawns={SPAWNS}
      seats={SHARE_SEATS}
      hud={(api) => <TeaHouseHud tea={tea} api={api} />}
      onEnter={handleEnter}
      renderModals={(openId, close) => (
        <>
        {/* 찻집 이용 가이드 (다연) */}
        <PixelModal open={openId === "guide"} onClose={() => closeGuide(close)} label="🍵 다연의 찻집 이용 가이드" title="군산 온라인 찻집에 오신 걸 환영해요" width={520}>
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
            onClick={() => closeGuide(close)}
            className="mt-4 w-full border-4 border-[#1a110e] bg-amber-400 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
          >
            알겠어요, 둘러볼게요! 🍵
          </button>
        </PixelModal>

        <PixelModal open={openId === "menu"} onClose={close} label="☕ 군산 온라인 찻집" title="📜 차림표" width={460}>
          <ul className="flex flex-col gap-3">
            {/* 사장님이 정한 상태: 오늘의 추천 ⭐ 은 맨 위, 재료 소진 🍂 은 흐리게 */}
            {cafeData.menu
              .map((m, i) => ({ ...m, key: menuId(m, i), status: tea.menuStatus[menuId(m, i)] || "" }))
              .sort((a, b) => (b.status === "recommend") - (a.status === "recommend"))
              .map((m) => (
                <li
                  key={m.key}
                  className={`relative flex gap-3 border-4 p-3 text-[#2b1d1a] ${m.status === "recommend" ? "border-amber-500 bg-[#fef3c7]" : "border-[#1a110e] bg-[#f5e6c8]"} ${m.status === "soldout" ? "opacity-55 grayscale" : ""}`}
                >
                  <span className="text-3xl leading-none">{m.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-black ${m.status === "soldout" ? "line-through" : ""}`}>{m.name}</p>
                    <p className="text-sm text-[#2b1d1a]/70">{m.description}</p>
                  </div>
                  {m.status === "recommend" && <span className="shrink-0 self-start border-2 border-[#1a110e] bg-amber-400 px-1.5 text-xs font-black">⭐ 오늘의 추천</span>}
                  {m.status === "soldout" && <span className="shrink-0 self-start border-2 border-[#1a110e] bg-[#e7e5e4] px-1.5 text-xs font-black">🍂 재료 소진</span>}
                </li>
              ))}
          </ul>
          {cafeData.note && <p className="mt-4 text-sm text-amber-100/80">{cafeData.note}</p>}
        </PixelModal>
        </>
      )}
    >
      <CafeScene npcBubble={npcBubble} season={tea.season} />
    </SimpleRoom>
  );
}
