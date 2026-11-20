"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, set, update, remove, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { ensureUser, watchUser, adminLogin, logout } from "../lib/forestAuth";
import { isHost } from "../lib/rooms";
import { startBirds, stopBirds } from "../lib/birdsong";
import SimpleRoom from "../components/SimpleRoom";
import PixelModal from "../components/PixelModal";
import { SettingsPanel } from "../components/TeaHouseHud";
import { SettingsPopup, VolumeRow, ToggleRow, Section, L_INPUT, L_BTN, L_BTN_MAIN } from "../components/RoomSettings";
import { GuideBoard } from "../components/GalleryGuide";
import { ForestBackdrop, ForestGrade, ForestTree, HostTree, TrailEnd, TreeImage, TeaBench, TREE_KINDS } from "../components/ForestArt";
import { forestData } from "../spaceData";

// 🌳 무해림(無害林) — 찻집 오른쪽 아래 통로, 옆으로 걷는 숲길
//  - 설명은 최소로: 입구엔 「無害林 / 없을 무 · 해할 해 · 수풀 림」 나무 팻말 하나, 주인장 대사는 "어서 오세요." · "편하게 한 그루 심고 가세요."
//  - 원하는 자리에 멈춰 [🌱 여기에 나무 심기] → 자유로운 한 마디(최대 100자, 줄바꿈 OK) + 이름(선택) + 나무 종류 + 🔒 비밀 나무(선택)
//  - 나무 가까이 가면(→ 오른쪽으로 걸을 때) 화면 위에 팻말 내용이 떠요. ← 왼쪽으로 돌아갈 땐 내 나무만
//  - 🔒 비밀 나무: 나무는 심기지만 내용은 관리자만. 내용은 forestSecrets/{id}에 따로 저장하고, 서버 규칙으로 관리자 외에는 아예 내려주지 않아요
//    (손님은 익명 로그인, 관리자는 이메일 로그인 — lib/forestAuth.js. Firebase 콘솔에서 로그인 방법·규칙 설정 필요)
//  - 주인장 나무(林, 두 그루) 팻말은 자유 문장, ⚙️ 사장님 모드에서 고쳐요 (forest/host/text)
//  - 🍵 숲 중간 야차 벤치 (차 종류는 ⚙️ 사장님 모드, forest/yachaTeas) · 🎵 배경 음악 (forestData.bgm) · 🐦 새소리
//  - 나무가 늘수록 길이 오른쪽으로 길어지고 안개가 걷혀요 · 숲 끝 → ⏮ 숲 입구로
//  - Firebase forest/trees/{id} = { name, byId, kind, x, createdAt, updatedAt, text | secret: true }
//  - 왼쪽 끝 → ☕ 찻집

const MAP_H = 1200;
const BASE_W = 2200; // 처음 숲길 길이 (맵 px)
const EXTRA_W = 900; // 마지막 나무 뒤로 남겨 두는 길
const GROUND_Y = 912; // 나무가 서는 높이
const PATH_TOP = 950;
const PATH_BOTTOM = 1110;
const WALK_TOP = 0.8; // 발이 다닐 수 있는 범위 (비율)
const WALK_BOTTOM = 0.92;
const INTRO_X = 380; // 입구 안내판 (처음 오면 "!" → 이용안내)
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
const MAX_LEN = forestData.maxLength ?? 100;

const PLANT_ID = "plant";
const GUIDE_ID = "guide";
const GUIDE_SEEN_KEY = "forestGuideSeen";
const BIRDS_KEY = "forestBirds";
const BGM_KEY = "forestBgm"; // 켜기/끄기
const BGM_VOL_KEY = "forestBgmVol"; // 0~100

const keyOf = (name = "") => (name.trim() || "손님").replace(/[.#$[\]/]/g, "_").slice(0, 40); // 예전 나무(닉네임 열쇠)용
const newKeyOf = (myId = "") => `t_${String(myId || Math.random().toString(36).slice(2)).replace(/[.#$[\]/]/g, "_")}`;
const nameOf = (t) => (t?.name ?? t?.nickname ?? "").trim();
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
        if (v && typeof v.x === "number" && (v.text || v.secret)) list.push({ key: c.key, ...v });
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

// 🔐 관리자 로그인 상태 + 비밀 나무 내용 (관리자만 서버에서 받아와요)
function useAdminSecrets() {
  const [user, setUser] = useState(null);
  const [secrets, setSecrets] = useState({});
  const [denied, setDenied] = useState(false);
  useEffect(() => watchUser(setUser), []);
  const isAdmin = !!user && !user.isAnonymous && (!forestData.adminUid || user.uid === forestData.adminUid);
  useEffect(() => {
    setSecrets({});
    setDenied(false);
    if (!db || !isAdmin) return;
    return onValue(
      ref(db, "forestSecrets"),
      (snap) => setSecrets(snap.val() ?? {}),
      () => setDenied(true) // 서버가 거절 (관리자 UID가 규칙과 다름)
    );
  }, [isAdmin]);
  return { user, isAdmin, secrets, denied };
}

// ---------------- 🗺️ 숲 그림 ----------------
function ForestScene({ mapW, trees, nearKey, isMine, benchBusy, benchX, onToStart, guideAlert, onOpenGuide }) {
  const now = Date.now();
  return (
    <div className="absolute inset-0">
      <style>{`@keyframes forest-grow{0%{transform:scale(.25,.1)}100%{transform:none}}`}</style>
      <ForestBackdrop mapW={mapW} mapH={MAP_H} groundY={GROUND_Y} pathTop={PATH_TOP} pathBottom={PATH_BOTTOM} count={trees.length} />
      <GuideBoard at={{ x: INTRO_X / mapW, y: (GROUND_Y + 30) / MAP_H }} alert={guideAlert} onOpen={onOpenGuide} mapW={mapW} mapH={MAP_H} />
      <HostTree x={HOST_X} groundY={GROUND_Y} near={nearKey === "__host"} />
      <TeaBench x={benchX} floorY={BENCH_FLOOR} busy={benchBusy} />
      {trees.map((t) => (
        <ForestTree
          key={t.key}
          x={t.x}
          groundY={GROUND_Y + ((Math.round(t.x) % 3) - 1) * 6}
          kind={t.kind ?? 0}
          label={t.treeName ? `${t.secret ? "🔒 " : ""}${t.treeName}` : t.secret ? "🔒" : nameOf(t)}
          mine={isMine(t)}
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

// ---------------- 📜 팻말 (화면 위, 가까이 가면) ----------------
function ReadingCard({ near, host, mine, canRemove, onEdit, onRemove, secretText }) {
  if (!near) return null;
  const isHostTree = near.key === "__host";
  const name = isHostTree ? forestData.hostName : near.secret ? secretText?.name ?? "" : nameOf(near);
  const text = isHostTree ? host.text || host.rewritten || forestData.hostSign : near.secret ? secretText?.text : near.text;
  const locked = !isHostTree && near.secret && !secretText;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[15%] z-30 w-[min(560px,92vw)] -translate-x-1/2">
      <div className="pointer-events-auto border-[5px] border-[#2b1d1a] bg-[#f3e2bd] px-5 py-4 text-center text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f, 6px 6px 0 0 rgba(0,0,0,.35)" }}>
        {!isHostTree && near.treeName && <p className="mb-2 text-sm font-black tracking-wide text-[#3f6212]">🌳 {near.treeName}</p>}
        {locked ? (
          <p className="py-1 text-lg font-black">🔒 비밀 이야기가 담긴 나무예요</p>
        ) : (
          <>
            {!isHostTree && near.secret && <p className="mb-1 text-xs font-black text-[#7c2d12]">🔒 비밀 나무 · 관리자에게만 보여요</p>}
            <p className="whitespace-pre-wrap break-words text-xl font-black leading-relaxed">{text}</p>
            {name && <p className="mt-2 text-sm font-black text-[#7c2d12]">— {name}</p>}
          </>
        )}
        {!isHostTree && (mine || canRemove) && (
          <div className="mt-3 flex justify-center gap-2">
            {mine && (
              <button type="button" onClick={onEdit} className="border-4 border-[#2b1d1a] bg-amber-400 px-3 py-1 text-sm font-black">
                ✏️ 고쳐 쓰기
              </button>
            )}
            {canRemove && (
              <button type="button" onClick={onRemove} className="border-4 border-[#2b1d1a] bg-[#6e4530] px-3 py-1 text-sm font-black text-white">
                🪓 나무 뽑기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- 🌱 심기 창 ----------------
//  나무 고르기 → 🌳 나무 이름 → 나무에게 하고 싶은 말 → 내 이름(선택) · 🔒 비밀 나무
function PlantForm({ initial, defaultName = "", onSubmit, onCancel }) {
  const wasSecret = !!initial?.secret;
  const [text, setText] = useState(wasSecret ? "" : initial?.text ?? "");
  const [treeName, setTreeName] = useState(initial?.treeName ?? "");
  const [name, setName] = useState(initial ? (wasSecret ? "" : nameOf(initial)) : defaultName);
  const [secret, setSecret] = useState(wasSecret);
  const [kind, setKind] = useState(initial?.kind ?? Math.floor(Math.random() * 6));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const LABEL = "mb-1 block text-xs font-black text-amber-200";
  const FIELD = "w-full border-4 border-[#1a110e] bg-[#fdf6e3] px-2.5 py-1.5 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400";
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const t = text.replace(/\s+$/g, "").replace(/^\s+/, "");
        if (!t) return setMsg("나무에게 한 마디 해 주세요 🌱");
        setBusy(true);
        const err = await onSubmit({ text: t.slice(0, MAX_LEN), treeName: treeName.trim().slice(0, 12), name: name.trim().slice(0, 20), secret, kind });
        setBusy(false);
        if (err) setMsg(err);
      }}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TREE_KINDS.map((k, i) => (
          <button key={i} type="button" onClick={() => setKind(i)} aria-pressed={kind === i} aria-label={k.name} className={`flex flex-col items-center border-4 p-1 ${kind === i ? "border-amber-400 bg-[#3b2a20]" : "border-[#1a110e] bg-[#2b1d1a]"}`}>
            <span className="flex h-[66px] items-end justify-center">
              <TreeImage kind={i} height={66} maxWidth={70} />
            </span>
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className={LABEL}>🌳 나무 이름</span>
        <input value={treeName} onChange={(e) => setTreeName(e.target.value)} maxLength={12} placeholder="예: 쉼표, 단단이, 늦봄" className={FIELD} />
      </label>

      <label className="mt-3 block">
        <span className={LABEL}>💬 나무에게 하고 싶은 말</span>
        <div className="border-[5px] border-[#2b1d1a] bg-[#f3e2bd] p-3 text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f" }}>
          <textarea
            value={text}
            maxLength={MAX_LEN}
            rows={4}
            onChange={(e) => {
              setText(e.target.value);
              setMsg("");
            }}
            placeholder={forestData.placeholder}
            className="w-full resize-none bg-transparent p-1 text-lg font-bold leading-relaxed outline-none placeholder:font-bold placeholder:text-[#2b1d1a]/35"
          />
          <div className="text-right text-xs text-[#2b1d1a]/50">
            {text.length}/{MAX_LEN}
          </div>
        </div>
      </label>
      {wasSecret && <p className="mt-1 text-[11px] text-amber-100/60">비밀 나무 내용은 나도 다시 볼 수 없어서, 새로 써야 해요.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="내 이름 (비워 두면 이름 없이)" className={`${FIELD} min-w-0 flex-1`} />
        <label className={`flex shrink-0 cursor-pointer items-center gap-2 border-4 px-3 py-1.5 text-sm font-black ${secret ? "border-amber-400 bg-[#3b2a20] text-amber-200" : "border-[#1a110e] bg-[#2b1d1a] text-white/85"}`}>
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          🔒 비밀 나무
        </label>
      </div>
      {secret && <p className="mt-1 text-[11px] text-amber-100/70">하고 싶은 말과 내 이름은 주인장만 읽을 수 있어요. 나무 이름은 숲에 보여요.</p>}
      {msg && <p className="mt-2 text-sm font-bold text-rose-300">{msg}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="border-4 border-[#1a110e] bg-[#6e4530] px-4 py-2 font-black text-white">
          취소
        </button>
        <button type="submit" disabled={busy} className="border-4 border-[#1a110e] bg-amber-400 px-5 py-2 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none disabled:opacity-60">
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
  const [vol, setVolState] = useState(20); // 처음 소리 크기 20
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
    <Section title="🍵 야차 벤치 차 종류">
      <div className="flex flex-wrap gap-1.5">
        {list.map((t, i) => (
          <span key={t + i} className="flex items-center gap-1 border-2 border-[#2b1d1a] bg-[#efe0c0] py-0.5 pl-2 pr-1 text-xs font-bold text-[#2b1d1a]">
            {t}
            <button type="button" aria-label={`${t} 빼기`} onClick={() => save(list.filter((_, j) => j !== i))} className="px-1 font-black text-[#a8433a]">
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
        <input value={add} onChange={(e) => setAdd(e.target.value)} maxLength={12} placeholder="예: 대추차" className={`${L_INPUT} min-w-0 flex-1`} />
        <button type="submit" className={`${L_BTN_MAIN} shrink-0`}>
          ＋ 추가
        </button>
      </form>
      <button type="button" onClick={() => save(DEFAULT_TEAS)} className="mt-1.5 text-[11px] font-bold text-[#5b3b2a] underline">
        처음 차 목록으로 되돌리기
      </button>
      {msg && <p className="mt-1 text-xs font-bold text-[#3f6212]">{msg}</p>}
    </Section>
  );
}

// ---------------- ⚙️ 설정 (거실과 같은 모양: 새소리 · 음악 · 사장님: 차 종류 · 주인장 팻말 · 관리자 로그인) ----------------
function AdminLogin({ admin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const count = Object.keys(admin.secrets).length;
  return (
    <Section title="🔐 비밀 나무 읽기">
      {admin.isAdmin ? (
        <div className="text-xs text-[#2b1d1a]">
          {admin.denied ? <p className="text-[#a8433a]">서버가 거절했어요. 관리자 UID와 규칙을 확인해 주세요.</p> : <p>관리자로 로그인됨 · 비밀 나무 {count}그루를 읽을 수 있어요</p>}
          <button type="button" onClick={() => logout()} className={`${L_BTN} mt-1.5`}>
            로그아웃
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg("");
            adminLogin(email.trim(), pw)
              .then(() => setPw(""))
              .catch(() => setMsg("로그인하지 못했어요. 이메일·비밀번호를 확인해 주세요."));
          }}
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="관리자 이메일" className={L_INPUT} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="비밀번호" className={L_INPUT} />
          <button type="submit" className={L_BTN_MAIN}>
            로그인
          </button>
          {msg && <p className="text-[11px] font-bold text-[#a8433a]">{msg}</p>}
        </form>
      )}
    </Section>
  );
}

function ForestSettings({ api, birds, onBirds, host, count, teas, bgm, admin }) {
  const [open, setOpen] = useState(false);
  const current = host.text || host.rewritten || forestData.hostSign;
  const [draft, setDraft] = useState(current);
  const [msg, setMsg] = useState("");
  const canHost = api.isOwner;
  useEffect(() => setDraft(current), [current]);
  const saveHost = (text) => {
    if (!db) return;
    const v = text.replace(/\s+$/g, "");
    (v.trim() ? set(ref(db, "forest/host"), { text: v.slice(0, 200), updatedAt: serverTimestamp() }) : remove(ref(db, "forest/host")))
      .then(() => setMsg(v.trim() ? "주인장 나무 팻말을 바꿨어요 🌳" : "처음 문장으로 되돌렸어요"))
      .catch(() => setMsg("저장하지 못했어요 (Firebase 규칙 확인)"));
  };
  const top = (
    <div className="flex flex-col gap-4">
      {bgm.ready && <VolumeRow icon="🎵" label={bgm.title} playing={bgm.on} onToggle={() => bgm.setOn(!bgm.on)} volume={bgm.vol} onVolume={bgm.setVol} />}
      <ToggleRow icon="🐦" label="새소리" checked={birds} onChange={onBirds} />
      <p className="text-[11px] text-[#5b3b2a]">🌳 지금 숲에 {count}그루</p>
    </div>
  );
  return (
    <SettingsPopup open={open} setOpen={setOpen} title="⚙️ 무해림 설정">
      <SettingsPanel api={api} noise={false} top={top}>
        {api.isOwner && <YachaTeaEditor teas={teas} />}
        {canHost && (
          <Section title="🍵 주인장 나무 팻말">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} rows={3} className={`${L_INPUT} resize-none`} />
            <button type="button" onClick={() => saveHost(draft)} className={`${L_BTN_MAIN} mt-1.5 w-full`}>
              🌳 팻말 걸기
            </button>
            {msg && <p className="mt-1 text-xs font-bold text-[#3f6212]">{msg}</p>}
          </Section>
        )}
        {(canHost || admin.isAdmin) && <AdminLogin admin={admin} />}
      </SettingsPanel>
    </SettingsPopup>
  );
}

// ---------------- 화면 위 UI ----------------
function ForestHud({ api, trees, host, mapW, isMine, onPlant, onEdit, birds, onBirds, teas, benchX, bgm, admin }) {
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
  const myTree = trees.find(isMine);
  // ← 왼쪽으로 돌아가는 중에는 팻말을 숨겨요 (내 나무만 보여요)
  if (near && api.dir === "left" && !(near.key !== "__host" && isMine(near))) near = null;
  const atEnd = fx > mapW - 700;
  const tooClose = [HOST_X, ...trees.map((t) => t.x)].some((x) => Math.abs(x - fx) < MIN_GAP) || Math.abs(benchX - fx) < BENCH_GAP;
  const canPlant = !myTree && fx >= FIRST_PLANT_X && fx <= mapW - 140 && !tooClose;

  return (
    <>
      <ForestSettings api={api} birds={birds} onBirds={onBirds} host={host} count={trees.length + 1} teas={teas} bgm={bgm} admin={admin} />
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
        mine={near && near.key !== "__host" && isMine(near)}
        canRemove={near && near.key !== "__host" && api.isOwner} // 🪓 나무 뽑기는 사장님 인증한 주인장만
        secretText={near && near.secret ? admin.secrets[near.key] : null}
        onEdit={() => onEdit(near)}
        onRemove={() => {
          if (!db || !near || !window.confirm("이 나무를 뽑을까요?")) return;
          const k = near.key;
          remove(ref(db, `forest/trees/${k}`)).then(() => api.showToast("나무를 뽑았어요", "🪓"));
          if (near.secret) remove(ref(db, `forestSecrets/${k}`)).catch(() => {}); // 내가 쓴 비밀이거나 관리자면 지워져요
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
              {fx < FIRST_PLANT_X ? forestData.plantGuide : tooClose ? "옆 나무와 조금 떨어진 곳에 심어 주세요" : "조금 더 걸어가 주세요"}
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
  const [plantAt, setPlantAt] = useState(null); // { x, editing? }
  const [birds, setBirds] = useState(true);
  const [guideAlert, setGuideAlert] = useState(false); // 📜 처음 오면 안내판 위 "!"
  const openRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    try {
      setNickname(localStorage.getItem("partyNickname") ?? "");
      if (localStorage.getItem(BIRDS_KEY) === "0") setBirds(false);
      if (!localStorage.getItem(GUIDE_SEEN_KEY)) setGuideAlert(true);
      let fid = localStorage.getItem("forestId");
      if (!fid) {
        fid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem("forestId", fid);
      }
      setMyId(fid);
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

  const admin = useAdminSecrets();
  const [myId, setMyId] = useState(""); // 이 기기의 숲 아이디 (localStorage — 다음에 와도 내 나무를 알아봐요)
  // 내 나무: 이 기기에서 심은 나무 (byId) — 예전 닉네임 열쇠 나무도 인정
  const isMine = (t) => !!t && ((myId && t.byId === myId) || (!t.byId && nickname && t.key === keyOf(nickname)));
  const R = (px) => px / mapW; // 맵 px → 비율

  const blockers = useMemo(
    () => [
      { x: 0, y: 0, w: 1, h: WALK_TOP }, // 하늘·풀밭 (길 위쪽)
      { x: 0, y: WALK_BOTTOM, w: 1, h: 1 - WALK_BOTTOM }, // 길 아래쪽
      { x: 1 - 40 / mapW, y: 0, w: 40 / mapW, h: 1 }, // 오른쪽 끝
      { x: (benchX - 170) / mapW, y: WALK_TOP, w: 340 / mapW, h: (BENCH_FLOOR + 8) / MAP_H - WALK_TOP }, // 🍵 벤치 (앞으로는 지나갈 수 있어요)
    ],
    [mapW, benchX]
  );
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


  // 🌱 심기 / 고쳐 쓰기 — 실패하면 오류 문구를 돌려줘요 (창에 표시)
  const savePlant = async ({ text, treeName, name, secret, kind }) => {
    const api = apiRef.current;
    if (!db || !plantAt) return "지금은 저장할 수 없어요";
    const editing = plantAt.editing;
    const key = editing ? editing.key : newKeyOf(myId);
    const pub = { treeName: treeName || null, name: secret ? "" : name, byId: myId, kind, x: Math.round(editing ? editing.x : plantAt.x), [editing ? "updatedAt" : "createdAt"]: serverTimestamp() };
    try {
      if (secret) {
        // 비밀 내용은 forestSecrets에만 (관리자만 읽을 수 있는 곳)
        const user = await ensureUser();
        await set(ref(db, `forestSecrets/${key}`), { text, name, uid: user.uid, createdAt: serverTimestamp() });
        await update(ref(db, `forest/trees/${key}`), { ...pub, secret: true, text: null, nickname: null });
      } else {
        await update(ref(db, `forest/trees/${key}`), { ...pub, secret: null, text, nickname: null });
        if (editing?.secret) remove(ref(db, `forestSecrets/${key}`)).catch(() => {});
      }
      api?.showToast(editing ? "팻말을 고쳐 걸었어요" : "나무를 심었어요 🌳", "🌱");
      return null;
    } catch (e) {
      return secret ? "비밀 나무를 저장하지 못했어요. (관리자 설정이 아직 안 됐을 수 있어요)" : "저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
    }
  };

  return (
    <SimpleRoom
      roomId="forest"
      roomName="🌳 무해림"
      welcomeTitle={forestData.greeting}
      welcome="왼쪽 끝 = ☕ 찻집"
      mapW={mapW}
      mapH={MAP_H}
      outside="linear-gradient(#5f7682 50%, #4f6b47 50%)"
      sideScroll
      blockers={blockers}
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
            isMine={isMine}
            admin={admin}
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
      spots={[{ id: GUIDE_ID, rect: { x: (INTRO_X - 50) / mapW, y: (GROUND_Y - 110) / MAP_H, w: 100 / mapW, h: 0.03 }, near: { x: INTRO_X / mapW, y: 0.86 }, radius: 110, icon: "📜", title: "이용안내" }]}
      renderModals={(openId, close) => [
        <PixelModal key={GUIDE_ID} open={openId === GUIDE_ID} onClose={close} label="🌳 무해림" title="📜 무해림 이용안내" width={520}>
          <ForestGuide
            onSeen={() => {
              setGuideAlert(false);
              try {
                localStorage.setItem(GUIDE_SEEN_KEY, "1");
              } catch {}
            }}
            onClose={close}
          />
        </PixelModal>,
        <PixelModal key={PLANT_ID} open={openId === PLANT_ID} onClose={close} label="🌳 무해림" title={plantAt?.editing ? "✏️ 고쳐 쓰기" : "🌱 나무 심기"} width={600}>
          <PlantForm
            key={`${plantAt?.x}-${!!plantAt?.editing}`}
            initial={plantAt?.editing}
            defaultName=""
            onCancel={close}
            onSubmit={async (v) => {
              const err = await savePlant(v);
              if (!err) close();
              return err;
            }}
          />
        </PixelModal>,
      ]}
    >
      <ForestScene mapW={mapW} trees={trees} nearKey={null} isMine={isMine} guideAlert={guideAlert} onOpenGuide={() => openRef.current?.(GUIDE_ID)} benchBusy={false} benchX={benchX} onToStart={() => apiRef.current?.teleport(START_X, 0.86 * MAP_H)} />
    </SimpleRoom>
  );
}

// 📜 무해림 이용안내 (spaceData forestData.guide — title + text)
function ForestGuide({ onSeen, onClose }) {
  useEffect(() => {
    onSeen?.(); // 한 번 열어 보면 "!" 끄기
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const g = forestData.guide ?? {};
  const paras = String(g.text ?? "").split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div>
      <div className="border-[5px] border-[#2b1d1a] bg-[#f3e2bd] px-5 py-6 text-center text-[#2b1d1a]" style={{ boxShadow: "inset 0 0 0 4px #c9a06f" }}>
        <p className="text-4xl font-black tracking-[0.15em]">{g.title}</p>
        <div className="mt-5 flex flex-col gap-4 text-[15px] font-bold leading-relaxed">
          {paras.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p.trim()}
            </p>
          ))}
        </div>
      </div>
      <button type="button" onClick={onClose} className="mt-4 w-full border-4 border-[#1a110e] bg-amber-400 py-2.5 font-black text-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none">
        숲길 걷기 ▶
      </button>
    </div>
  );
}
