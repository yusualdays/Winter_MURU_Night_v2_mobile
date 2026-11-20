"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, set, update, remove, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { isHost } from "../lib/rooms";
import { startBirds, stopBirds } from "../lib/birdsong";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { SettingsPanel } from "../components/TeaHouseHud";
import { ForestBackdrop, ForestGrade, ForestTree, HostTree, IntroBoard, TrailEnd, TreeImage, TeaBench, TREE_KINDS } from "../components/ForestArt";
import { forestData } from "../spaceData";

// 🌳 무해림(無害林) — 제1회 기획전 「무해림 — 당신이 심은 나무」 (찻집 오른쪽 아래 통로)
//  - 옆으로 걷는 숲길 (SimpleRoom sideScroll). 오른쪽으로 걸으며 사람들이 심은 나무와 팻말을 만나요
//  - 나무 가까이 가면 화면 위에 그 팻말 문장이 크게 떠요 ("나에게 무해림은 ___이다. — 닉네임")
//  - 원하는 자리에 멈춰 [🌱 여기에 나무 심기] → 한 줄 + 나무 종류 고르기 → 그 자리에 나무가 자라요 (한 사람당 한 그루, 고쳐 쓰기·뽑기 가능)
//  - 나무가 늘수록 길이 오른쪽으로 길어져요
//  - 🍵 숲 중간 벤치: 가까이 가면 [🍵 야차하기] → 벤치에 앉아 차 고르고 마시기 (야차 = 야외에서 차 마시기). 차 종류는 ⚙️ 사장님 모드에서 바꿔요
//  - 🎵 배경 음악: spaceData forestData.bgm (public/forest/bgm.mp3) — ⚙️에서 켜기/끄기·소리 크기
//  - Firebase forest/yachaTeas = ["보리차", ...]
//  - 입구 서문 팻말 (처음 오면 "!") · 주인장 나무(林, 두 그루) · 숲길 끝 표시
//  - 전시 마무리: ⚙️ → 주인장(호스트·사장님)이 "주인장 나무 팻말 다시 쓰기" → 처음 팻말 위에 새 문장이 걸려요
//  - Firebase: forest/trees/{닉네임} = { nickname, byId, text, kind, x, createdAt, updatedAt } · forest/host = { rewritten, rewrittenAt }
//  - 왼쪽 끝 → ☕ 찻집 (오른쪽 아래 통로 앞으로 돌아가요)

const MAP_H = 1200;
const BASE_W = 2200; // 처음 숲길 길이 (맵 px)
const EXTRA_W = 900; // 마지막 나무 뒤로 남겨 두는 길
const GROUND_Y = 912; // 나무가 서는 높이
const PATH_TOP = 950;
const PATH_BOTTOM = 1110;
const WALK_TOP = 0.8; // 발이 다닐 수 있는 범위 (비율)
const WALK_BOTTOM = 0.92;
const INTRO_X = 380; // 서문 팻말
const START_X = 150; // 숲 입구 (처음 시작 자리)
const HOST_X = 860; // 주인장 나무
const BENCH_PREF_X = 1200; // 🍵 야차 벤치 자리 (주인장 나무 다음, 숲 중간 쉼터) — 이미 나무가 있으면 빈자리로 옮겨요
const BENCH_FLOOR = 1000; // 벤치 다리가 닿는 높이 (길 안쪽 가장자리)
const FIRST_PLANT_X = 1440; // 이보다 오른쪽부터 심을 수 있어요
const BENCH_GAP = 280; // 벤치와 나무 사이 (팻말·야차 창이 겹치지 않게)
// 벤치 자리: 기본 자리에서 오른쪽으로, 나무와 BENCH_GAP 이상 떨어진 첫 자리
function benchXOf(trees) {
  for (let x = BENCH_PREF_X; x < BENCH_PREF_X + 20000; x += 20) {
    if (Math.abs(x - HOST_X) >= BENCH_GAP && trees.every((t) => Math.abs(t.x - x) >= BENCH_GAP)) return x;
  }
  return BENCH_PREF_X;
}
const MIN_GAP = 260; // 나무 사이 최소 간격
const READ_RADIUS = 150; // 이만큼 가까우면 팻말 문장이 떠요
const MAX_LEN = 40;

const INTRO_ID = "intro";
const PLANT_ID = "plant";
const SEEN_KEY = "forestIntroSeen";
const BIRDS_KEY = "forestBirds";
const BGM_KEY = "forestBgm"; // 켜기/끄기
const BGM_VOL_KEY = "forestBgmVol"; // 0~100

const keyOf = (name = "") => (name.trim() || "손님").replace(/[.#$[\]/]/g, "_").slice(0, 40);
const fmt = (ms) => {
  if (typeof ms !== "number") return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

// ---------------- 🌲 Firebase ----------------
function useForest() {
  const [trees, setTrees] = useState([]);
  const [host, setHost] = useState({});
  useEffect(() => {
    if (!db) return;
    const a = onValue(ref(db, "forest/trees"), (snap) => {
      const list = [];
      snap.forEach((c) => {
        const v = c.val();
        if (v?.text && typeof v.x === "number") list.push({ key: c.key, ...v });
      });
      list.sort((p, q) => p.x - q.x);
      setTrees(list);
    });
    const b = onValue(ref(db, "forest/host"), (snap) => setHost(snap.val() ?? {}));
    return () => {
      a();
      b();
    };
  }, []);
  return { trees, host };
}

// ---------------- 🗺️ 숲 그림 ----------------
function ForestScene({ mapW, trees, nearKey, myKey, introAlert, onOpenIntro, benchBusy, benchX, onToStart }) {
  const now = Date.now();
  return (
    <div className="absolute inset-0">
      <style>{`@keyframes forest-grow{0%{transform:scale(.25,.1)}100%{transform:none}}`}</style>
      <ForestBackdrop mapW={mapW} mapH={MAP_H} groundY={GROUND_Y} pathTop={PATH_TOP} pathBottom={PATH_BOTTOM} count={trees.length} />
      <IntroBoard x={INTRO_X} groundY={GROUND_Y + 20} alert={introAlert} onOpen={onOpenIntro} title={forestData.title.split("—")[1]?.trim() ?? forestData.title} edition={forestData.edition} />
      <HostTree x={HOST_X} groundY={GROUND_Y} near={nearKey === "__host"} />
      <TeaBench x={benchX} floorY={BENCH_FLOOR} busy={benchBusy} />
      {trees.map((t) => (
        <ForestTree
          key={t.key}
          x={t.x}
          groundY={GROUND_Y + ((Math.round(t.x) % 3) - 1) * 6}
          kind={t.kind ?? 0}
          label={t.nickname}
          mine={t.key === myKey}
          near={nearKey === t.key}
          fresh={typeof t.createdAt === "number" && now - t.createdAt < 8000}
          size={0.9 + ((Math.round(t.x) * 7) % 5) / 20}
        />
      ))}
      <TrailEnd x={mapW - 260} groundY={GROUND_Y + 10} count={trees.length + 1} onToStart={onToStart} />
      <ForestGrade />
    </div>
  );
}

// ---------------- 📜 팻말 문장 (화면 위, 가까이 가면) ----------------
function ReadingCard({ near, host, mine, canRemove, onEdit, onRemove }) {
  if (!near) return null;
  const isHostTree = near.key === "__host";
  return (
    <div className="pointer-events-none fixed left-1/2 top-[15%] z-30 w-[min(560px,92vw)] -translate-x-1/2">
      <div className="pointer-events-auto border-[5px] border-[#2b1d1a] bg-[#f3e2bd] px-5 py-4 text-center text-[#2b1d1a] shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f, 6px 6px 0 0 rgba(0,0,0,.35)" }}>
        {isHostTree ? (
          <>
            <p className="text-xs font-black tracking-widest text-[#7c2d12]">🍵 무해림의 나무</p>
            {host.rewritten ? (
              <>
                <p className="mt-2 text-sm text-[#2b1d1a]/50">
                  처음 팻말 — <span className="line-through">{forestData.hostSign}</span>
                </p>
                <p className="mt-2 text-xs font-black text-[#7c2d12]">여러분 덕분에 알게 된 나</p>
                <p className="mt-1 whitespace-pre-line text-2xl font-black leading-snug">{host.rewritten}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-base font-bold">나는</p>
                <p className="mt-1 text-2xl font-black leading-snug">{forestData.hostSign}</p>
                <p className="mt-2 text-xs text-[#2b1d1a]/60">이 숲이 다 자라면, 이 팻말을 다시 써 볼게요.</p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-base font-bold">나에게 무해림은</p>
            <p className="mt-1 break-words text-2xl font-black leading-snug">{near.text}</p>
            <p className="mt-1 text-base font-bold">이다.</p>
            <p className="mt-2 text-sm font-black text-[#7c2d12]">
              — {near.nickname}
              {near.createdAt ? <span className="ml-1 font-bold text-[#2b1d1a]/50">· {fmt(near.createdAt)}에 심음</span> : null}
            </p>
            {(mine || canRemove) && (
              <div className="mt-3 flex justify-center gap-2">
                {mine && (
                  <button type="button" onClick={onEdit} className="border-4 border-[#2b1d1a] bg-amber-400 px-3 py-1 text-sm font-black">
                    ✏️ 고쳐 쓰기
                  </button>
                )}
                <button type="button" onClick={onRemove} className="border-4 border-[#2b1d1a] bg-[#6e4530] px-3 py-1 text-sm font-black text-white">
                  🪓 나무 뽑기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- 🌱 심기 창 ----------------
function PlantForm({ initial, onSubmit, onCancel }) {
  const [text, setText] = useState(initial?.text ?? "");
  const [kind, setKind] = useState(initial?.kind ?? Math.floor(Math.random() * 6));
  const [msg, setMsg] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim().replace(/(이다|다)\.?$/, "").trim();
        if (!t) return setMsg("빈칸을 채워 주세요 🌱");
        onSubmit({ text: t.slice(0, MAX_LEN), kind });
      }}
    >
      <p className="text-sm leading-relaxed text-amber-50/90">{initial ? "팻말을 고쳐 써요. 나무 자리는 그대로예요." : "이 자리에 당신의 나무를 심어요. 팻말에 한 줄을 남겨 주세요."}</p>
      <div className="mt-3 border-[5px] border-[#2b1d1a] bg-[#f3e2bd] p-4 text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f" }}>
        <p className="font-bold">나에게 무해림은</p>
        <input
          value={text}
          autoFocus
          maxLength={MAX_LEN}
          onChange={(e) => {
            setText(e.target.value);
            setMsg("");
          }}
          placeholder="겨울에 꺼내 마시는 따뜻한 보리차"
          className="mt-1 w-full border-b-4 border-dashed border-[#2b1d1a]/40 bg-transparent py-1 text-xl font-black outline-none placeholder:font-bold placeholder:text-[#2b1d1a]/30 focus:border-[#b45309]"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="font-bold">이다.</p>
          <span className="text-xs text-[#2b1d1a]/50">
            {text.length}/{MAX_LEN}
          </span>
        </div>
      </div>
      <p className="mt-4 text-xs font-black text-amber-200">🌳 어떤 나무를 심을까요?</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TREE_KINDS.map((k, i) => (
          <button key={i} type="button" onClick={() => setKind(i)} aria-pressed={kind === i} className={`flex flex-col items-center border-4 p-1 ${kind === i ? "border-amber-400 bg-[#3b2a20]" : "border-[#1a110e] bg-[#2b1d1a]"}`}>
            <span className="flex h-[66px] items-end justify-center">
              <TreeImage kind={i} height={66} maxWidth={70} />
            </span>
            <span className="mt-0.5 text-[11px] font-bold text-white/80">{k.name}</span>
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-sm font-bold text-rose-300">{msg}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="border-4 border-[#1a110e] bg-[#6e4530] px-4 py-2 font-black text-white">
          취소
        </button>
        <button type="submit" className="border-4 border-[#1a110e] bg-amber-400 px-5 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
          {initial ? "✏️ 고쳐 걸기" : "🌱 심기"}
        </button>
      </div>
    </form>
  );
}

// ---------------- 🎵 숲 배경 음악 ----------------
//  forestData.bgm.src 파일이 있으면 숲에 들어와 화면을 한 번 누른 뒤부터 조용히 반복 재생 (⚙️에서 켜기/끄기 · 소리 크기)
function useForestBgm() {
  const src = forestData.bgm?.src;
  const audioRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [on, setOnState] = useState(true);
  const [vol, setVolState] = useState(45);
  useEffect(() => {
    if (!src) return;
    try {
      if (localStorage.getItem(BGM_KEY) === "0") setOnState(false);
      const v = localStorage.getItem(BGM_VOL_KEY);
      if (v !== null && !Number.isNaN(Number(v))) setVolState(Math.max(0, Math.min(100, Number(v))));
    } catch {}
    const a = new Audio(src);
    a.loop = true;
    a.preload = "auto";
    a.addEventListener("canplay", () => setReady(true), { once: true });
    a.addEventListener("error", () => setReady(false), { once: true });
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
    };
  }, [src]);
  // 켜져 있으면 첫 터치·키 입력 뒤 재생 (브라우저 규칙)
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !ready) return;
    a.volume = (vol / 100) * 0.8;
    if (!on) {
      a.pause();
      return;
    }
    const go = () => a.play().catch(() => {});
    go();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, [ready, on, vol]);
  const setOn = (v) => {
    setOnState(v);
    try {
      localStorage.setItem(BGM_KEY, v ? "1" : "0");
    } catch {}
  };
  const setVol = (v) => {
    setVolState(v);
    try {
      localStorage.setItem(BGM_VOL_KEY, String(v));
    } catch {}
  };
  return { ready, on, setOn, vol, setVol, title: forestData.bgm?.title ?? "숲의 음악" };
}

// ---------------- 🍵 야차 (벤치에 앉으면) ----------------
//  차 종류는 ⚙️ 사장님 모드에서 그때그때 바꿔요 (Firebase forest/yachaTeas = ["보리차", ...])
const DEFAULT_TEAS = ["보리차", "녹차", "유자차", "오미자차"];
function useYachaTeas() {
  const [teas, setTeas] = useState(DEFAULT_TEAS);
  useEffect(() => {
    if (!db) return;
    return onValue(ref(db, "forest/yachaTeas"), (snap) => {
      const v = snap.val();
      const list = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : null;
      setTeas(list && list.filter(Boolean).length ? list.filter(Boolean) : DEFAULT_TEAS);
    });
  }, []);
  return teas;
}

function YachaPanel({ api, teas }) {
  const seated = !!api.mySeat && String(api.mySeat.id).startsWith("yacha");
  const [tea, setTea] = useState(null);
  const startedRef = useRef(false);
  useEffect(() => {
    if (seated && !startedRef.current) {
      startedRef.current = true;
      setTea(null);
    }
    if (!seated) startedRef.current = false;
  }, [seated]);
  if (!seated) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[15%] z-30 w-[min(460px,92vw)] -translate-x-1/2">
      <div className="pointer-events-auto border-[5px] border-[#2b1d1a] bg-[#f3e2bd] px-4 py-3 text-center text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f, 6px 6px 0 0 rgba(0,0,0,.35)" }}>
        {!tea ? (
          <div className="flex flex-wrap justify-center gap-2">
            {teas.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTea(t);
                  api.playAction("pouring");
                }}
                className="border-4 border-[#2b1d1a] bg-[#e9cf9f] px-3 py-1.5 text-sm font-black active:translate-y-0.5"
              >
                {t}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => api.playAction("drinking")} className="border-4 border-[#2b1d1a] bg-amber-400 px-4 py-1.5 font-black active:translate-y-0.5">
              🍵 {tea} 한 모금
            </button>
            <button type="button" onClick={() => setTea(null)} className="border-4 border-[#2b1d1a] bg-[#e9cf9f] px-3 py-1.5 text-sm font-black">
              다른 차
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 🍵 사장님: 야차 차 종류 바꾸기
function YachaTeaEditor({ teas }) {
  const [list, setList] = useState(teas);
  const [add, setAdd] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => setList(teas), [teas]);
  const save = (next) => {
    setList(next);
    if (!db) return;
    set(ref(db, "forest/yachaTeas"), next.length ? next : null)
      .then(() => setMsg("차 종류를 바꿨어요 🍵"))
      .catch(() => setMsg("저장하지 못했어요 (Firebase 규칙 확인)"));
  };
  return (
    <div className="mt-4 border-t-4 border-dashed border-white/15 pt-3">
      <p className="text-xs font-black text-amber-200">🍵 야차 벤치 차 종류</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {list.map((t, i) => (
          <span key={t + i} className="flex items-center gap-1 border-2 border-[#1a110e] bg-[#f5e6c8] py-0.5 pl-2 pr-1 text-sm font-bold text-[#2b1d1a]">
            {t}
            <button type="button" aria-label={`${t} 빼기`} onClick={() => save(list.filter((_, j) => j !== i))} className="px-1 font-black text-rose-700">
              ✕
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const v = add.trim().slice(0, 12);
          if (!v || list.includes(v)) return;
          save([...list, v]);
          setAdd("");
        }}
      >
        <input value={add} onChange={(e) => setAdd(e.target.value)} maxLength={12} placeholder="예: 대추차" className="min-w-0 flex-1 border-4 border-[#1a110e] bg-[#fdf6e3] px-2 py-1 text-sm text-[#2b1d1a] outline-none" />
        <button type="submit" className="shrink-0 border-4 border-[#1a110e] bg-amber-400 px-3 py-1 text-sm font-black text-[#2b1d1a]">
          ＋ 추가
        </button>
      </form>
      <button type="button" onClick={() => save(DEFAULT_TEAS)} className="mt-1.5 text-[11px] font-bold text-white/60 underline">
        처음 차 목록으로 되돌리기
      </button>
      {msg && <p className="mt-1 text-xs font-bold text-lime-300">{msg}</p>}
    </div>
  );
}

// ---------------- ⚙️ 설정 (새소리 · 주인장 팻말 다시 쓰기) ----------------
function ForestSettings({ api, birds, onBirds, host, count, teas, bgm }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(host.rewritten ?? "");
  const [msg, setMsg] = useState("");
  const canHost = api.isOwner || isHost(api.nickname);
  useEffect(() => setDraft(host.rewritten ?? ""), [host.rewritten]);
  const saveHost = (text) => {
    if (!db) return;
    const v = text.trim();
    (v ? update(ref(db, "forest/host"), { rewritten: v.slice(0, 120), rewrittenAt: serverTimestamp() }) : remove(ref(db, "forest/host")))
      .then(() => setMsg(v ? "주인장 나무 팻말을 다시 걸었어요 🌳" : "처음 팻말로 되돌렸어요"))
      .catch(() => setMsg("저장하지 못했어요 (Firebase 규칙 확인)"));
  };
  const top = (
    <div className="mt-3">
      <p className="text-xs font-black text-amber-200">🌳 지금 숲에 {count}그루 (주인장 나무 포함)</p>
      <label className="mt-2 flex items-center justify-between gap-2 border-4 border-[#1a110e] bg-[#2b1d1a] px-3 py-2 text-sm font-bold text-white">
        🐦 조용한 새소리
        <input type="checkbox" checked={birds} onChange={(e) => onBirds(e.target.checked)} className="h-5 w-5 accent-amber-400" />
      </label>
      {bgm.ready && (
        <div className="mt-2 border-4 border-[#1a110e] bg-[#2b1d1a] px-3 py-2 text-sm font-bold text-white">
          <label className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">🎵 {bgm.title}</span>
            <input type="checkbox" checked={bgm.on} onChange={(e) => bgm.setOn(e.target.checked)} className="h-5 w-5 shrink-0 accent-amber-400" />
          </label>
          <label className="mt-1.5 flex items-center gap-2">
            <span className="w-6 text-center">{bgm.vol === 0 ? "🔇" : bgm.vol < 40 ? "🔈" : "🔊"}</span>
            <input type="range" min="0" max="100" value={bgm.vol} onChange={(e) => bgm.setVol(Number(e.target.value))} className="h-2 min-w-0 flex-1 accent-amber-400" aria-label="음악 소리" />
            <span className="w-8 text-right text-xs tabular-nums text-white/60">{bgm.vol}</span>
          </label>
        </div>
      )}
    </div>
  );
  return (
    <div className="safe-top safe-right fixed z-40 flex flex-col items-end gap-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="무해림 설정" aria-expanded={open} className="flex h-12 w-12 items-center justify-center border-4 border-[#1a110e] bg-[#f5e6c8] text-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
        ⚙️
      </button>
      {open && (
        <SettingsPanel api={api} title="⚙️ 무해림 설정" noise={false} top={top}>
          {api.isOwner && <YachaTeaEditor teas={teas} />}
          {canHost && (
            <div className="mt-4 border-t-4 border-dashed border-white/15 pt-3">
              <p className="text-xs font-black text-amber-200">🍵 전시 마무리 — 주인장 나무 팻말 다시 쓰기</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">처음 팻말 "{forestData.hostSign}" 위에, 숲을 보고 알게 된 나를 걸어요. 비우고 저장하면 처음 팻말로 돌아가요.</p>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} rows={3} placeholder="여러분 덕분에 알게 된 나는…" className="mt-2 w-full resize-none border-4 border-[#1a110e] bg-[#fdf6e3] p-2 text-sm text-[#2b1d1a] outline-none" />
              <button type="button" onClick={() => saveHost(draft)} className="mt-1 w-full border-4 border-[#1a110e] bg-amber-400 py-1.5 text-sm font-black text-[#2b1d1a]">
                🌳 팻말 걸기
              </button>
              {msg && <p className="mt-1 text-xs font-bold text-lime-300">{msg}</p>}
            </div>
          )}
        </SettingsPanel>
      )}
    </div>
  );
}

// ---------------- 화면 위 UI ----------------
function ForestHud({ api, trees, host, mapW, myKey, onPlant, onEdit, birds, onBirds, teas, benchX, bgm }) {
  const fx = api.feet?.x ?? -9999;
  // 가장 가까운 나무 (주인장 나무 포함)
  let near = null;
  let best = READ_RADIUS;
  if (Math.abs(fx - HOST_X) < best + 60) {
    near = { key: "__host" };
    best = Math.abs(fx - HOST_X) - 60;
  }
  for (const t of trees) {
    const d = Math.abs(fx - t.x);
    if (d < best) {
      near = t;
      best = d;
    }
  }
  const myTree = trees.find((t) => t.key === myKey);
  // ← 왼쪽으로 돌아가는 중에는 팻말을 숨겨요 (내 나무만 보여요)
  if (near && api.dir === "left" && near.key !== myKey) near = null;
  const atEnd = fx > mapW - 700;
  const tooClose = [HOST_X, ...trees.map((t) => t.x)].some((x) => Math.abs(x - fx) < MIN_GAP) || Math.abs(benchX - fx) < BENCH_GAP;
  const canPlant = !myTree && fx >= FIRST_PLANT_X && fx <= mapW - 140 && !tooClose;
  const owner = api.isOwner || isHost(api.nickname);

  return (
    <>
      <ForestSettings api={api} birds={birds} onBirds={onBirds} host={host} count={trees.length + 1} teas={teas} bgm={bgm} />
      <YachaPanel api={api} teas={teas} />
      {/* ⏮ 숲 끝 → 입구로 한 번에 */}
      {atEnd && !api.mySeat && (
        <div className="safe-top fixed left-1/2 top-3 z-30 -translate-x-1/2 sm:top-auto sm:bottom-24">
          <button type="button" onClick={() => api.teleport(START_X, 0.86 * MAP_H)} className="whitespace-nowrap border-4 border-[#1a110e] bg-[#f3e2bd] px-4 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.45)] active:translate-y-0.5 active:shadow-none">
            ⏮ 숲 입구로 돌아가기
          </button>
        </div>
      )}
      <ReadingCard
        near={api.mySeat ? null : near}
        host={host}
        mine={near && near.key === myKey}
        canRemove={near && near.key !== "__host" && (near.key === myKey || owner)}
        onEdit={() => onEdit(near)}
        onRemove={() => {
          if (!db || !near || !window.confirm(`${near.nickname}님의 나무를 뽑을까요?`)) return;
          remove(ref(db, `forest/trees/${near.key}`)).then(() => api.showToast("나무를 뽑았어요", "🪓"));
        }}
      />
      {/* 🌱 심기 버튼 (아래 가운데) */}
      {!myTree && fx > 0 && !api.mySeat && (
        <div className="safe-bottom fixed bottom-32 left-1/2 z-30 -translate-x-1/2 sm:bottom-6">
          {canPlant ? (
            <button type="button" onClick={() => onPlant(fx)} className="whitespace-nowrap border-4 border-[#1a110e] bg-amber-400 px-5 py-2.5 text-lg font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.45)] active:translate-y-0.5 active:shadow-none">
              🌱 여기에 나무 심기
            </button>
          ) : (
            <p className="whitespace-nowrap border-4 border-[#1a110e] bg-[#2b1d1a]/85 px-3 py-1.5 text-sm font-bold text-[#f5e6c8]">
              {fx < FIRST_PLANT_X ? "→ 오른쪽으로 걸으며 숲을 둘러보세요" : tooClose ? "🌳 옆 나무와 조금 떨어진 곳에 심어 주세요" : "→ 조금 더 걸어가 주세요"}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default function ForestPage() {
  const { trees, host } = useForest();
  const teas = useYachaTeas();
  const bgm = useForestBgm();
  const benchX0 = benchXOf(trees);
  const benchX = benchX0;
  const maxX = trees.reduce((m, t) => Math.max(m, t.x), Math.max(HOST_X, benchX0));
  const mapW = Math.max(BASE_W, Math.round(maxX + EXTRA_W));
  const [nickname, setNickname] = useState("");
  const [introAlert, setIntroAlert] = useState(false);
  const [plantAt, setPlantAt] = useState(null); // { x, editing? }
  const [birds, setBirds] = useState(true);
  const openRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    try {
      setNickname(localStorage.getItem("partyNickname") ?? "");
      if (!localStorage.getItem(SEEN_KEY)) setIntroAlert(true);
      if (localStorage.getItem(BIRDS_KEY) === "0") setBirds(false);
    } catch {}
  }, []);

  // 🐦 새소리: 화면을 한 번 누르거나 키를 누르면 시작
  useEffect(() => {
    if (!birds) {
      stopBirds();
      return;
    }
    const go = () => startBirds();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      stopBirds();
    };
  }, [birds]);
  const changeBirds = (on) => {
    setBirds(on);
    try {
      localStorage.setItem(BIRDS_KEY, on ? "1" : "0");
    } catch {}
    if (on) startBirds();
  };

  const myKey = keyOf(nickname);
  const R = (px) => px / mapW; // 맵 px → 비율

  const blockers = useMemo(
    () => [
      { x: 0, y: 0, w: 1, h: WALK_TOP }, // 하늘·풀밭 (길 위쪽)
      { x: 0, y: WALK_BOTTOM, w: 1, h: 1 - WALK_BOTTOM }, // 길 아래쪽
      { x: 1 - 40 / mapW, y: 0, w: 40 / mapW, h: 1 }, // 오른쪽 끝
      { x: (benchX - 170) / mapW, y: WALK_TOP, w: 340 / mapW, h: (BENCH_FLOOR + 8) / MAP_H - WALK_TOP }, // 🍵 벤치 (앞으로는 지나갈 수 있어요)
    ],
    [mapW]
  );
  const spots = [{ id: INTRO_ID, rect: { x: R(INTRO_X - 120), y: 0.56, w: R(240), h: 0.04 }, near: { x: R(INTRO_X), y: 0.86 }, radius: 150, icon: "📜", title: "서문 읽기" }];
  // 🍵 야차 벤치 두 자리 — 앞·옆 어디서 다가가도 [🍵 야차하기]
  const seats = [-1, 1].map((d, i) => ({
    id: `yacha${i + 1}`,
    x: (benchX + d * 72) / mapW,
    y: (BENCH_FLOOR - 40) / MAP_H, // 발끝 자리 (엉덩이가 앉는 판에 닿게 조금 위)
    dir: "down",
    legs: true,
    icon: "🍵",
    label: "야차하기",
    stands: [
      { x: (benchX + d * 72) / mapW, y: 0.885 },
      { x: (benchX + d * 205) / mapW, y: 0.835 },
    ],
  }));
  const exits = [{ id: "back", to: "teaHouse", zone: { x: 0, y: WALK_TOP, w: R(80), h: WALK_BOTTOM - WALK_TOP }, label: "⬅ ☕ 찻집" }];
  const spawns = { default: { x: R(START_X), y: 0.86 }, teaHouse: { x: R(START_X), y: 0.86 } };

  const markSeen = () => {
    setIntroAlert(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };

  const savePlant = ({ text, kind }) => {
    const api = apiRef.current;
    if (!db || !plantAt) return;
    const key = myKey;
    const name = (api?.nickname || nickname || "손님").trim();
    const p = plantAt.editing
      ? update(ref(db, `forest/trees/${key}`), { text, kind, updatedAt: serverTimestamp() })
      : set(ref(db, `forest/trees/${key}`), { nickname: name, byId: api?.myId ?? "", text, kind, x: Math.round(plantAt.x), createdAt: serverTimestamp() });
    p.then(() => api?.showToast(plantAt.editing ? "팻말을 고쳐 걸었어요" : "나무를 심었어요. 숲이 조금 넓어졌어요 🌳", "🌱")).catch(() => api?.showToast("저장하지 못했어요 (Firebase 규칙 확인)", "⚠️"));
  };

  return (
    <SimpleRoom
      roomId="forest"
      roomName="🌳 무해림"
      welcome="오른쪽으로 걸으며 사람들이 심은 나무를 만나 보세요 · 원하는 자리에서 🌱 나무 심기 · 왼쪽 끝 = ☕ 찻집"
      mapW={mapW}
      mapH={MAP_H}
      outside="linear-gradient(#5f7682 50%, #4f6b47 50%)"
      sideScroll
      blockers={blockers}
      spots={spots}
      exits={exits}
      spawns={spawns}
      seats={seats}
      onEnter={({ openDetail }) => {
        openRef.current = openDetail;
      }}
      hud={(api) => {
        apiRef.current = api;
        return (
          <ForestHud
            api={api}
            trees={trees}
            host={host}
            mapW={mapW}
            myKey={keyOf(api.nickname)}
            birds={birds}
            onBirds={changeBirds}
            teas={teas}
            benchX={benchX}
            bgm={bgm}
            onPlant={(x) => {
              setPlantAt({ x });
              api.openDetail(PLANT_ID);
            }}
            onEdit={(t) => {
              setPlantAt({ x: t.x, editing: t });
              api.openDetail(PLANT_ID);
            }}
          />
        );
      }}
      renderModals={(openId, close) => [
        <PixelModal key={INTRO_ID} open={openId === INTRO_ID} onClose={close} label="🌳 무해림" title={forestData.title} width={560}>
          <IntroContent onSeen={markSeen} onClose={close} />
        </PixelModal>,
        <PixelModal key={PLANT_ID} open={openId === PLANT_ID} onClose={close} label="🌳 무해림" title={plantAt?.editing ? "✏️ 팻말 고쳐 쓰기" : "🌱 나무 심기"} width={600}>
          <PlantForm
            key={`${plantAt?.x}-${!!plantAt?.editing}`}
            initial={plantAt?.editing}
            onCancel={close}
            onSubmit={(v) => {
              savePlant(v);
              close();
            }}
          />
        </PixelModal>,
      ]}
    >
      <ForestScene mapW={mapW} trees={trees} nearKey={null} myKey={myKey} introAlert={introAlert} onOpenIntro={() => openRef.current?.(INTRO_ID)} benchBusy={false} benchX={benchX} onToStart={() => apiRef.current?.teleport(START_X, 0.86 * MAP_H)} />
    </SimpleRoom>
  );
}

// 📜 서문
function IntroContent({ onSeen, onClose }) {
  useEffect(() => {
    onSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <div className="border-[5px] border-[#2b1d1a] bg-[#f3e2bd] px-5 py-5 text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f" }}>
        <p className="text-xs font-black tracking-widest text-[#7c2d12]">{forestData.edition} · 서문</p>
        <div className="mt-3 flex flex-col gap-2 text-[17px] font-bold leading-relaxed">
          {forestData.intro.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {forestData.signature && <p className="mt-4 text-right text-sm font-black">{forestData.signature}</p>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-amber-50/70">{forestData.note}</p>
      <button type="button" onClick={onClose} className="mt-4 w-full border-4 border-[#1a110e] bg-amber-400 py-2.5 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
        숲길 걷기 ▶
      </button>
    </div>
  );
}
