"use client";

import { useEffect, useState } from "react";
import { ref, set, remove, onValue, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { partyData } from "../data";
import { cafeData } from "../spaceData";
import { isHost, inSchedule, scheduleText } from "../lib/rooms";
import PixelModal from "./PixelModal";
import { SEASONS } from "./SeasonWindow";

// ☕ 찻집 화면 위 UI 모음
//  - ⚙️ 설정: 🪟 사계절 통창 풍경 (모두에게 실시간 반영) · 🔑 사장님 인증 · 🔓 테스트용 강제 오픈
//  - 📋 사장님 관리: 모임 주최 / 메뉴 실시간 상태 / 조조차회 라이브 알림
//  - 위쪽 가운데 공지 배너 (모임 · 라이브) + 단체석에 앉은 손님에게 발제문·미트 링크 카드
//
// Firebase "teaHouse"
//   season:     { value: "winter", by }
//   gathering:  { title, topic, meetUrl, openedAt, by }   (없으면 모임 없음)
//   live:       { url, openedAt, by }                     (없으면 라이브 없음)
//   menuStatus: { 메뉴id: "recommend" | "soldout" }       (없으면 기본)

// 찻집 공용 상태 구독
export function useTeaHouse() {
  const [state, setState] = useState({ season: "winter", seasonBy: "", gathering: null, live: null, menuStatus: {} });
  useEffect(() => {
    if (!db) return;
    return onValue(ref(db, "teaHouse"), (snap) => {
      const v = snap.val() || {};
      setState({
        season: v.season?.value || "winter",
        seasonBy: v.season?.by || "",
        gathering: v.gathering?.title ? v.gathering : null,
        live: v.live?.url ? v.live : null,
        menuStatus: v.menuStatus || {},
      });
    });
  }, []);
  return state;
}

// 메뉴 id (spaceData의 id가 없으면 순서로)
export const menuId = (m, i) => m.id ?? `menu${i + 1}`;

// 주소가 http(s)로 시작하는지 (이상한 링크 방지)
const safeUrl = (u) => {
  const s = (u || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
};

const BOX = "border-4 border-[#1a110e] shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]";
const BTN = `${BOX} px-3 py-1.5 text-sm font-black active:translate-y-0.5 active:shadow-none disabled:opacity-50`;
const INPUT = "w-full border-4 border-[#1a110e] bg-[#fdf6e3] px-3 py-2 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400";

// ---------------- ⚙️ 설정 창 ----------------
function SettingsPanel({ tea, api, onOpenOwner }) {
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const ownerPin = partyData?.ownerPin;

  const chooseSeason = (id) => {
    if (db) set(ref(db, "teaHouse/season"), { value: id, by: api.nickname }).catch(() => {});
  };
  const login = (e) => {
    e.preventDefault();
    if (!ownerPin) return setPinMsg("data.js에 ownerPin(사장님 비밀번호)을 먼저 적어 주세요.");
    if (pin.trim() === String(ownerPin)) {
      api.setOwner(true);
      setPin("");
      setPinMsg("");
      api.showToast("사장님 모드가 켜졌어요! 앞치마를 둘렀어요", "🍵");
    } else setPinMsg("비밀번호가 맞지 않아요.");
  };

  return (
    <div className="max-h-[80vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto bg-[#2b1d1a] p-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]">
      <div className="border-4 border-[#f5e6c8] p-3 text-white">
        <p className="font-black text-amber-300">⚙️ 찻집 설정</p>

        {/* 🪟 사계절 통창 */}
        <p className="mt-3 text-sm font-bold">🪟 통창 풍경</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {SEASONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => chooseSeason(s.id)}
              className={`${BTN} flex items-center gap-1.5 ${tea.season === s.id ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#f5e6c8] text-[#2b1d1a]"}`}
            >
              <span className="text-lg">{s.icon}</span>
              <span className="text-left leading-tight">
                {s.label}
                <span className="block text-[10px] font-bold opacity-70">{s.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-white/50">찻집에 있는 모두의 창밖이 함께 바뀌어요{tea.seasonBy ? ` · 마지막 변경: ${tea.seasonBy}님` : ""}</p>

        {/* 🔓 테스트용 강제 오픈 (호스트·사장님) */}
        {(isHost(api.nickname) || api.isOwner) && (
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 border-2 border-white/20 bg-black/20 px-3 py-2">
            <span className="text-sm font-bold">
              🔓 거실·전시회 미리 열기 <span className="block text-[11px] font-normal text-white/60">테스트용 · 오픈 기간 {scheduleText() || "제한 없음"} · 지금 {inSchedule() ? "오픈 중" : "준비중"}</span>
            </span>
            <input type="checkbox" checked={api.forceOpen} onChange={(e) => api.changeForceOpen(e.target.checked)} className="h-5 w-5 shrink-0 accent-amber-400" />
          </label>
        )}

        {/* 🔑 사장님 인증 */}
        <div className="mt-4 border-t-4 border-dashed border-white/15 pt-3">
          {api.isOwner ? (
            <>
              <p className="text-sm font-bold text-lime-300">🍵 사장님 모드 켜짐</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={onOpenOwner} className={`${BTN} flex-1 bg-amber-400 text-[#2b1d1a]`}>
                  📋 사장님 관리
                </button>
                <button type="button" onClick={() => api.setOwner(false)} className={`${BTN} bg-[#6e4530] text-white`}>
                  끄기
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={login}>
              <p className="text-sm font-bold">🔑 사장님 인증</p>
              <div className="mt-1.5 flex gap-2">
                <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="비밀번호" className={INPUT} />
                <button type="submit" className={`${BTN} shrink-0 bg-amber-400 text-[#2b1d1a]`}>
                  인증
                </button>
              </div>
              {pinMsg && <p className="mt-1 text-xs text-rose-300">{pinMsg}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- 📋 사장님 관리 창 ----------------
function OwnerPanel({ open, onClose, tea, api }) {
  const [g, setG] = useState({ title: "", topic: "", meetUrl: "" });
  const [liveUrl, setLiveUrl] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!open) return;
    setMsg("");
    if (tea.gathering) setG({ title: tea.gathering.title || "", topic: tea.gathering.topic || "", meetUrl: tea.gathering.meetUrl || "" });
    if (tea.live) setLiveUrl(tea.live.url || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const write = (path, value) => (db ? (value === null ? remove(ref(db, path)) : set(ref(db, path), value)).catch(() => setMsg("저장하지 못했어요. Firebase 규칙을 확인해 주세요.")) : null);

  const openGathering = (e) => {
    e.preventDefault();
    if (!g.title.trim()) return setMsg("모임 제목을 적어 주세요.");
    if (g.meetUrl.trim() && !safeUrl(g.meetUrl)) return setMsg("미트 링크는 https:// 로 시작해야 해요.");
    write("teaHouse/gathering", { title: g.title.trim().slice(0, 40), topic: g.topic.trim().slice(0, 500), meetUrl: safeUrl(g.meetUrl), openedAt: serverTimestamp(), by: api.nickname });
    setMsg("");
    api.showToast("모임을 열었어요! 찻집 위에 공지가 떠요", "📚");
  };
  const openLive = (e) => {
    e.preventDefault();
    if (!safeUrl(liveUrl)) return setMsg("유튜브 라이브 주소(https://...)를 적어 주세요.");
    write("teaHouse/live", { url: safeUrl(liveUrl), openedAt: serverTimestamp(), by: api.nickname });
    setMsg("");
    api.showToast("조조차회 라이브 알림을 띄웠어요!", "🌅");
  };
  const setStatus = (id, status) => {
    if (db) (status ? set(ref(db, `teaHouse/menuStatus/${id}`), status) : remove(ref(db, `teaHouse/menuStatus/${id}`))).catch(() => {});
  };

  const STATUS = [
    { v: "", label: "기본" },
    { v: "recommend", label: "추천 ⭐" },
    { v: "soldout", label: "소진 🍂" },
  ];

  return (
    <PixelModal open={open} onClose={onClose} label="🍵 사장님 전용" title="📋 사장님 관리" width={560}>
      {msg && <p className="mb-3 border-2 border-rose-300/50 bg-rose-900/40 px-3 py-2 text-sm text-rose-100">{msg}</p>}

      {/* 1) 독서모임 · 차모임 주최 */}
      <section>
        <p className="font-black text-amber-200">📚 독서모임 · 차모임 주최</p>
        {tea.gathering ? (
          <div className="mt-2 border-2 border-lime-300/40 bg-black/20 p-3 text-sm">
            <p className="font-bold text-lime-300">진행 중: {tea.gathering.title}</p>
            <button type="button" onClick={() => write("teaHouse/gathering", null)} className={`${BTN} mt-2 bg-[#6e4530] text-white`}>
              모임 닫기
            </button>
          </div>
        ) : null}
        <form onSubmit={openGathering} className="mt-2 flex flex-col gap-2">
          <input value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} maxLength={40} placeholder="모임 제목 (예: 12월 독서모임 — 『작별하지 않는다』)" className={INPUT} />
          <textarea value={g.topic} onChange={(e) => setG({ ...g, topic: e.target.value })} maxLength={500} rows={3} placeholder="오늘의 발제문 (단체석에 앉은 손님에게 보여요)" className={`${INPUT} resize-none`} />
          <input value={g.meetUrl} onChange={(e) => setG({ ...g, meetUrl: e.target.value })} placeholder="구글 미트 링크 (https://meet.google.com/...)" className={INPUT} />
          <button type="submit" className={`${BTN} bg-amber-400 text-[#2b1d1a]`}>
            {tea.gathering ? "모임 내용 고치기" : "모임 오픈하기"}
          </button>
        </form>
      </section>

      {/* 2) 메뉴 실시간 상태 */}
      <section className="mt-5 border-t-4 border-dashed border-white/15 pt-4">
        <p className="font-black text-amber-200">🍵 메뉴 실시간 상태</p>
        <ul className="mt-2 flex flex-col gap-2">
          {(cafeData?.menu ?? []).map((m, i) => {
            const id = menuId(m, i);
            const cur = tea.menuStatus[id] || "";
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-white/15 bg-black/20 px-3 py-2">
                <span className="text-sm font-bold">
                  {m.emoji} {m.name}
                </span>
                <span className="flex gap-1">
                  {STATUS.map((st) => (
                    <button
                      key={st.v || "normal"}
                      type="button"
                      onClick={() => setStatus(id, st.v)}
                      className={`border-2 border-[#1a110e] px-2 py-0.5 text-xs font-black ${cur === st.v ? "bg-amber-400 text-[#2b1d1a]" : "bg-[#f5e6c8]/80 text-[#2b1d1a]"}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3) 조조차회 라이브 */}
      <section className="mt-5 border-t-4 border-dashed border-white/15 pt-4">
        <p className="font-black text-amber-200">🌅 조조차회 라이브 알림</p>
        <form onSubmit={openLive} className="mt-2 flex flex-col gap-2">
          <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="유튜브 라이브 주소 (https://youtube.com/live/...)" className={INPUT} />
          <div className="flex gap-2">
            <button type="submit" className={`${BTN} flex-1 bg-amber-400 text-[#2b1d1a]`}>
              {tea.live ? "라이브 주소 바꾸기" : "조조차회 열기"}
            </button>
            {tea.live && (
              <button type="button" onClick={() => write("teaHouse/live", null)} className={`${BTN} bg-[#6e4530] text-white`}>
                라이브 끝내기
              </button>
            )}
          </div>
        </form>
      </section>
    </PixelModal>
  );
}

// ---------------- 위쪽 공지 배너 ----------------
function Banners({ tea }) {
  const liveUrl = safeUrl(tea.live?.url);
  if (!tea.gathering && !liveUrl) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--sat,0px)+0.75rem)] z-[35] flex flex-col items-center gap-2 px-16">
      {liveUrl && (
        <div className={`${BOX} pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#fde68a] px-3 py-1.5 text-center text-[#2b1d1a] sm:px-4 sm:py-2`}>
          <span className="text-xs font-black sm:text-sm">🌅 지금 사장님의 &apos;조조차회(아침 차와 독서)&apos; 라이브가 진행 중입니다!</span>
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="border-4 border-[#1a110e] bg-[#dc2626] px-2.5 py-1 text-xs font-black text-white hover:bg-[#ef4444]">
            📺 유튜브에서 함께하기 ↗
          </a>
        </div>
      )}
      {tea.gathering && (
        <div className={`${BOX} w-full max-w-xl bg-[#f5e6c8] px-3 py-1.5 text-center text-xs text-[#2b1d1a] sm:px-4 sm:py-2 sm:text-sm`}>
          <span className="font-black">📚 지금 &lsquo;{tea.gathering.title}&rsquo; 모임 중</span>
          <span className="ml-1 font-bold text-[#2b1d1a]/70">
            · <span className="hidden sm:inline">가운데 단체석에 앉으면 발제문과 미트 링크를 볼 수 있어요</span>
            <span className="sm:hidden">단체석에 앉아 보세요</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------- 단체석 손님용 모임 카드 ----------------
function GatheringCard({ gathering }) {
  const meet = safeUrl(gathering.meetUrl);
  return (
    <div className="safe-left fixed bottom-[calc(var(--sab,0px)+1rem)] z-[36] w-80 max-w-[calc(100vw-6rem)] bg-[#2b1d1a] p-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]">
      <div className="max-h-[50vh] overflow-y-auto border-4 border-[#f5e6c8] p-3 text-white">
        <p className="text-xs font-bold text-amber-300">📚 단체석 · 오늘의 모임</p>
        <p className="mt-0.5 font-black">{gathering.title}</p>
        {gathering.topic && (
          <>
            <p className="mt-2 text-xs font-bold text-amber-200">📝 오늘의 발제문</p>
            <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-white/90">{gathering.topic}</p>
          </>
        )}
        {meet && (
          <a href={meet} target="_blank" rel="noopener noreferrer" className={`${BTN} mt-3 block bg-amber-400 text-center text-[#2b1d1a]`}>
            🎥 구글 미트로 참여하기 ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------- 합치기 ----------------
export default function TeaHouseHud({ tea, api }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const atShareTable = api.mySeat?.group === "share";

  return (
    <>
      <Banners tea={tea} />
      {atShareTable && tea.gathering && <GatheringCard gathering={tea.gathering} />}

      {/* ⚙️ 오른쪽 위 설정 */}
      <div className="safe-top safe-right fixed z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label="찻집 설정"
          aria-expanded={panelOpen}
          className="flex h-12 w-12 items-center justify-center border-4 border-[#1a110e] bg-[#f5e6c8] text-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none"
        >
          ⚙️
        </button>
        {panelOpen && (
          <SettingsPanel
            tea={tea}
            api={api}
            onOpenOwner={() => {
              setPanelOpen(false);
              setOwnerOpen(true);
            }}
          />
        )}
      </div>

      {api.isOwner && <OwnerPanel open={ownerOpen} onClose={() => setOwnerOpen(false)} tea={tea} api={api} />}
    </>
  );
}
