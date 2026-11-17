"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, set, update, remove, push, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { getMyId, getLook } from "../lib/session";
import { DEFAULT_LOOK, normalizeLook } from "../lib/pixelCharacter";
import { ROOMS, rememberFrom, takeArrival, lastExitOf, inZone, isRoomOpen, isHost, getForceOpen, setForceOpen, inSchedule, scheduleText } from "../lib/rooms";
import GreetToast from "./GreetToast";
import Avatar, { AVATAR_WIDTH, AVATAR_HEIGHT } from "./Avatar";
import InteractButton from "./InteractButton";
import ChatBox from "./ChatBox";
import ChatInput from "./ChatInput";
import MobileControls from "./MobileControls";
import LoadingScreen from "./LoadingScreen";
import TapRipple, { TAP_FX_MS } from "./TapRipple";
import { EMOTE_KEYS } from "./EmoteBubble";

// ================== 찻집·전시장 같은 "가벼운 방"의 공통 엔진 ==================
//  - 걷기(방향키 + 터치 이동), 다른 사람 보기, 말풍선 채팅, 표정, 문으로 다른 방 가기
//  - 각 방(cafe/page.js, gallery/page.js)은 지도 정보와 그림(Scene)만 넘겨주면 돼요
//
//  roomId   : "teaHouse" | "exhibitionRoom" (Firebase users/{ID}.room 에 저장 → 같은 방 사람만 보여요)
//  mapW/H   : 지도 크기 (맵 기준 px)
//  outside  : 지도 바깥(휴대폰 빈 곳) 색
//  blockers : 못 지나가는 곳 [{ x, y, w, h }] (0~1 비율)
//  spots    : 가까이 가면 버튼이 뜨는 물건 [{ id, rect, near: {x,y}, icon, title }]
//  exits    : 통로 [{ id, to: "livingRoom", zone: {x,y,w,h}, sign: {x,y}, label }] — 발이 닿으면 그 방으로 이동
//             (거실·전시회가 오픈 기간이 아니면 sign 자리에 "준비중" 팻말이 뜨고 막혀요)
//  spawns   : 시작 위치 (발 가운데) { default, livingRoom, "exhibitionRoom:exitLeft", ... }
//             "온 방:이 방에서 나갔던 통로" 로 적으면, 나갔던 그 통로 앞에서 다시 시작해요
//  children : 지도 그림 (바닥·벽·가구) / renderModals(openId, close): 상세 창들
//  onEnter  : 방에 들어왔을 때 한 번 ({ openDetail }) — 예: 첫 방문이면 안내 창 열기
//  spots의 radius: 버튼이 뜨는 거리 (맵 기준 px, 기본 90)
const SPEED = 320;
const SYNC_INTERVAL = 100;
const EMOTE_MS = 3000;
const CHAT_MS = 5000;
const CHAT_COOLDOWN = 800;
const NEAR_RADIUS = 90;
const CAMERA_FIT_BELOW = 0.45; // 휴대폰처럼 좁은 화면 → 내 캐릭터를 따라다니는 카메라
const CAMERA_ZOOM = 0.5;
const UI_BOOST = 1.6;
const FEET_W = 52;
const FEET_H = 26;
const FEET = { offsetX: (AVATAR_WIDTH - FEET_W) / 2, offsetY: AVATAR_HEIGHT - FEET_H, width: FEET_W, height: FEET_H };

const KEY_MAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const isTyping = (e) => {
  const t = e.target;
  return t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const feetRect = (x, y) => ({ x: x + FEET.offsetX, y: y + FEET.offsetY, w: FEET.width, h: FEET.height });
// 발 가운데가 (fx, fy)에 오도록 아바타 위치 계산
const posFromFeet = (fx, fy) => ({ x: fx - (FEET.offsetX + FEET.width / 2), y: fy - (FEET.offsetY + FEET.height / 2) });

export default function SimpleRoom({
  roomId,
  roomName,
  welcome,
  mapW = 1600,
  mapH = 1200,
  outside = "#2b1d1a",
  blockers = [],
  spots = [],
  exits = [],
  spawns = { default: { x: 0.5, y: 0.9 } },
  children,
  renderModals,
  onEnter,
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(null);
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [myId, setMyId] = useState(null);
  const [pos, setPos] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [dir, setDir] = useState("down");
  const [others, setOthers] = useState({});
  const [emote, setEmote] = useState(null);
  const [bubbles, setBubbles] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [tapFx, setTapFx] = useState(null);
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [isTouch, setIsTouch] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [arriving, setArriving] = useState(true); // 들어올 때 어두운 화면이 스르륵 밝아져요
  const [toast, setToast] = useState(null);       // 화면 위 알림 { id, text }
  const [forceOpen, setForceOpenState] = useState(false); // 호스트 테스트용 강제 오픈
  const [hostPanel, setHostPanel] = useState(false);
  const [clock, setClock] = useState(0);          // 1분마다 오픈 기간 다시 확인
  const lockedNoticeRef = useRef(null);           // 이미 "준비중" 안내를 띄운 통로

  const pressedKeys = useRef(new Set());
  const posRef = useRef(null);
  const targetRef = useRef(null);
  const stuckRef = useRef(0);
  const mapElRef = useRef(null);
  const openIdRef = useRef(null);
  const nearIdRef = useRef(null);
  const chatInputRef = useRef(null);
  const seenChat = useRef({});
  const lastChatSent = useRef(0);
  const armedRef = useRef(false);
  const latest = useRef({ x: 0, y: 0, isMoving: false, dir: "down" });

  const rects = useMemo(() => blockers.map((o) => ({ x: o.x * mapW, y: o.y * mapH, w: o.w * mapW, h: o.h * mapH })), [blockers, mapW, mapH]);
  const blocked = useCallback((x, y) => rects.some((r) => overlaps(feetRect(x, y), r)), [rects]);

  // 1) 닉네임·캐릭터·ID, 시작 위치 (어느 문으로 들어왔는지)
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("partyNickname");
    } catch {}
    if (!saved) {
      router.replace("/");
      return;
    }
    // 기간이 아닌데 주소로 바로 들어오면 → 찻집으로
    if (!isRoomOpen(roomId, saved)) {
      router.replace(ROOMS.teaHouse.href);
      return;
    }
    setNickname(saved);
    setLook(normalizeLook(getLook()));
    setMyId(getMyId());
    setForceOpenState(getForceOpen());
    const from = takeArrival();
    const s = (from && spawns[`${from}:${lastExitOf(roomId)}`]) ?? spawns[from] ?? spawns.default;
    const p = posFromFeet(s.x * mapW, s.y * mapH);
    const start = { x: clamp(p.x, 0, mapW - AVATAR_WIDTH), y: clamp(p.y, 0, mapH - AVATAR_HEIGHT) };
    posRef.current = start;
    setPos(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 방에 들어왔을 때 한 번 알려주기 (첫 방문 안내 등)
  const enteredRef = useRef(false);
  useEffect(() => {
    if (enteredRef.current || !nickname || !pos) return;
    enteredRef.current = true;
    onEnter?.({ openDetail: (id) => openDetailRef.current(id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickname, pos]);

  // 화면 크기 + 터치 기기인지
  useEffect(() => {
    const check = () => {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
    };
    check();
    window.addEventListener("resize", check);
    window.visualViewport?.addEventListener("resize", check);
    const timer = setTimeout(() => setShowWelcome(false), 8000);
    const fade = setTimeout(() => setArriving(false), 60);
    const tick = setInterval(() => setClock((c) => c + 1), 60000);
    return () => {
      clearTimeout(fade);
      clearInterval(tick);
      window.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("resize", check);
      clearTimeout(timer);
    };
  }, []);

  // 2) 접속자 등록 (users/{내 ID}, room = 이 방) — 방을 나가면 지워져요
  useEffect(() => {
    if (!nickname || !myId || !db || !posRef.current) return;
    const myRef = ref(db, `users/${myId}`);
    onDisconnect(myRef).remove();
    latest.current = { x: Math.round(posRef.current.x), y: Math.round(posRef.current.y), isMoving: false, dir: "down" };
    set(myRef, { nickname, ...look, room: roomId, joinedAt: serverTimestamp(), ...latest.current, isSitting: false, seatId: null, emote: null }).catch(() => {});
    return () => {
      remove(myRef).catch(() => {});
    };
  }, [nickname, myId, look, roomId]);

  // 3) 내 위치를 0.1초마다 보내기
  useEffect(() => {
    if (pos) latest.current = { x: Math.round(pos.x), y: Math.round(pos.y), isMoving, dir };
  }, [pos, isMoving, dir]);
  useEffect(() => {
    if (!nickname || !myId || !db) return;
    const myRef = ref(db, `users/${myId}`);
    let lastSent = "";
    const timer = setInterval(() => {
      const snap = JSON.stringify(latest.current);
      if (snap === lastSent) return;
      lastSent = snap;
      update(myRef, latest.current).catch(() => {});
    }, SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [nickname, myId]);

  // 4) 같은 방 사람들 구독
  useEffect(() => {
    if (!myId || !db) return;
    return onValue(ref(db, "users"), (snap) => {
      const all = {};
      snap.forEach((child) => {
        const u = child.val();
        if (child.key !== myId && u && typeof u.x === "number" && u.room === roomId) all[child.key] = u;
      });
      setOthers(all);
    });
  }, [myId, roomId]);

  // 5) 표정 (3초) + 모두에게 알리기
  useEffect(() => {
    if (myId && db) update(ref(db, `users/${myId}`), { emote: emote ?? null }).catch(() => {});
    if (!emote) return;
    const timer = setTimeout(() => setEmote(null), EMOTE_MS);
    return () => clearTimeout(timer);
  }, [emote, myId]);

  // 6) 말풍선 채팅
  const showBubble = (id, text, key) => {
    setBubbles((b) => ({ ...b, [id]: { text, key } }));
    setTimeout(() => {
      setBubbles((b) => {
        if (b[id]?.key !== key) return b;
        const next = { ...b };
        delete next[id];
        return next;
      });
    }, CHAT_MS);
  };
  useEffect(() => {
    const now = Date.now();
    for (const [id, u] of Object.entries(others)) {
      const ts = u.chatTimestamp;
      if (typeof ts !== "number" || !u.chatMessage || seenChat.current[id] === ts) continue;
      const firstSeen = seenChat.current[id] === undefined;
      seenChat.current[id] = ts;
      if (firstSeen && now - ts > CHAT_MS) continue;
      showBubble(id, u.chatMessage, ts);
    }
  }, [others]);
  const sendChat = (text) => {
    const now = Date.now();
    if (now - lastChatSent.current < CHAT_COOLDOWN) return;
    lastChatSent.current = now;
    showBubble("me", text, now);
    if (!db || !myId) return;
    update(ref(db, `users/${myId}`), { chatMessage: text, chatTimestamp: now }).catch(() => {});
    push(ref(db, "chat"), { nickname, text, createdAt: serverTimestamp() }).catch(() => {});
  };

  // 7) 가까운 물건 (발 가운데 ↔ 물건 앞 "서는 자리")
  const near = useMemo(() => {
    if (!pos) return null;
    const fx = pos.x + FEET.offsetX + FEET.width / 2;
    const fy = pos.y + FEET.offsetY + FEET.height / 2;
    let best = null;
    let bestDist = Infinity;
    for (const s of spots) {
      const d = Math.hypot(fx - s.near.x * mapW, fy - s.near.y * mapH);
      if (d <= (s.radius ?? NEAR_RADIUS) && d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }, [pos, spots, mapW, mapH]);
  useEffect(() => {
    nearIdRef.current = near?.id ?? null;
  }, [near]);
  useEffect(() => {
    openIdRef.current = openId;
    if (openId) {
      pressedKeys.current.clear();
      targetRef.current = null;
    }
  }, [openId]);
  const openDetail = useCallback((id) => {
    pressedKeys.current.clear();
    targetRef.current = null;
    setOpenId(id);
  }, []);
  const closeDetail = useCallback(() => setOpenId(null), []);
  const openDetailRef = useRef(openDetail);
  openDetailRef.current = openDetail;
  const interact = () => {
    if (nearIdRef.current) openDetail(nearIdRef.current);
  };
  const interactRef = useRef(interact);
  interactRef.current = interact;

  // 8) 키보드
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTyping(e) || openIdRef.current) return;
      if (e.code === "KeyE" && !e.repeat) return interactRef.current();
      if (e.key === "Enter" && !e.isComposing) {
        const t = e.target;
        const onButton = t instanceof HTMLElement && ["BUTTON", "A"].includes(t.tagName);
        if (!onButton && !document.querySelector('[role="dialog"]')) {
          e.preventDefault();
          pressedKeys.current.clear();
          setChatOpen(true);
        }
        return;
      }
      const emoteType = EMOTE_KEYS[e.code];
      if (emoteType && emoteType !== "toast" && !e.repeat) return setEmote({ type: emoteType, id: Date.now() });
      const d = KEY_MAP[e.code];
      if (!d) return;
      e.preventDefault();
      targetRef.current = null; // 방향키 → 터치 자동 이동 멈춤
      pressedKeys.current.add(d);
    };
    const onKeyUp = (e) => {
      const d = KEY_MAP[e.code];
      if (d) pressedKeys.current.delete(d);
    };
    const onBlur = () => pressedKeys.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // 9) 매 프레임 이동 (방향키 또는 터치한 곳으로) + 충돌
  useEffect(() => {
    let frameId;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const keys = pressedKeys.current;
      let dx = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
      let dy = (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
      let autoDist = 0;
      const p0 = posRef.current;
      if (dx || dy) {
        targetRef.current = null;
        if (dx && dy) {
          dx *= Math.SQRT1_2;
          dy *= Math.SQRT1_2;
        }
      } else if (targetRef.current && p0) {
        const tx = targetRef.current.x - (p0.x + FEET.offsetX + FEET.width / 2);
        const ty = targetRef.current.y - (p0.y + FEET.offsetY + FEET.height / 2);
        autoDist = Math.hypot(tx, ty);
        if (autoDist < 4) targetRef.current = null;
        else {
          dx = tx / autoDist;
          dy = ty / autoDist;
        }
      }
      const moving = (dx !== 0 || dy !== 0) && !!p0;
      setIsMoving(moving);
      if (moving) {
        if (autoDist) {
          if (Math.abs(dx) > Math.abs(dy)) setDir(dx < 0 ? "left" : "right");
          else setDir(dy < 0 ? "up" : "down");
        } else if (dx < 0) setDir("left");
        else if (dx > 0) setDir("right");
        else if (dy < 0) setDir("up");
        else setDir("down");
        let step = SPEED * dt;
        if (autoDist) step = Math.min(step, autoDist);
        const p = posRef.current;
        const nx = clamp(p.x + dx * step, 0, mapW - AVATAR_WIDTH);
        const ny = clamp(p.y + dy * step, 0, mapH - AVATAR_HEIGHT);
        const x = blocked(nx, p.y) ? p.x : nx;
        const y = blocked(x, ny) ? p.y : ny;
        if (autoDist && targetRef.current) {
          const moved = (x - p.x) * dx + (y - p.y) * dy;
          stuckRef.current = moved < step * 0.3 ? stuckRef.current + 1 : 0;
          if (stuckRef.current >= 4) targetRef.current = null; // 장애물 앞에서 멈춤
        }
        posRef.current = { x, y };
        setPos({ x, y });
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [blocked, mapW, mapH]);

  // 10) 통로에 닿으면 다른 방으로 (들어온 통로 위에서 시작했다면, 한 번 벗어난 뒤부터)
  //     오픈 기간이 아니면: 이동하지 않고 "현재 준비중입니다" 안내만
  const exitOpen = useMemo(() => {
    const o = {};
    for (const ex of exits) o[ex.id ?? ex.to] = isRoomOpen(ex.to, nickname);
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exits, nickname, forceOpen, clock]);

  const showToast = (text, icon) => {
    const id = Date.now();
    setToast({ id, text, icon });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
  };

  useEffect(() => {
    if (!pos || leaving) return;
    const feet = feetRect(pos.x, pos.y);
    const exit = exits.find((ex) => inZone(feet, ex.zone, mapW, mapH));
    if (!exit) {
      armedRef.current = true;
      lockedNoticeRef.current = null;
      return;
    }
    if (!armedRef.current) return;
    const exitId = exit.id ?? exit.to;
    if (!exitOpen[exitId]) {
      if (lockedNoticeRef.current !== exitId) {
        lockedNoticeRef.current = exitId;
        targetRef.current = null;
        showToast(`현재 준비중입니다${scheduleText() ? ` (${scheduleText()} 오픈)` : ""}`, "🚧");
      }
      return;
    }
    setLeaving(true);
    targetRef.current = null;
    pressedKeys.current.clear();
    rememberFrom(roomId, exitId);
    setTimeout(() => router.push(ROOMS[exit.to].href), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, leaving, exitOpen]);

  // 11) 화면 배율 + 카메라 (휴대폰은 내 캐릭터를 따라가요)
  const fitScale = Math.min(vp.w / mapW, vp.h / mapH);
  const cameraMode = fitScale < CAMERA_FIT_BELOW;
  const scale = cameraMode ? Math.max(CAMERA_ZOOM, vp.w / mapW) : fitScale;
  const uiBoost = cameraMode ? UI_BOOST : 1;
  let camX = (vp.w - mapW * scale) / 2;
  let camY = (vp.h - mapH * scale) / 2;
  if (cameraMode && pos) {
    const sw = mapW * scale;
    const sh = mapH * scale;
    const cx = (pos.x + AVATAR_WIDTH / 2) * scale;
    const cy = (pos.y + AVATAR_HEIGHT * 0.6) * scale;
    camX = sw <= vp.w ? (vp.w - sw) / 2 : clamp(vp.w / 2 - cx, vp.w - sw, 0);
    camY = sh <= vp.h ? (vp.h - sh) / 2 : clamp(vp.h * 0.42 - cy, vp.h - sh - 120, 60);
  }

  // 12) 터치(클릭)한 곳으로 걷기
  const handleMapTap = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const el = mapElRef.current;
    if (!el || !el.contains(e.target)) return;
    if (e.target.closest('button, a, input, textarea, select, [role="dialog"]')) return;
    if (openIdRef.current) return;
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / scale, 0, mapW);
    const y = clamp((e.clientY - rect.top) / scale, 0, mapH);
    pressedKeys.current.clear();
    stuckRef.current = 0;
    targetRef.current = { x, y };
    setTapFx({ x, y, id: Date.now() });
  };
  useEffect(() => {
    if (!tapFx) return;
    const timer = setTimeout(() => setTapFx((t) => (t?.id === tapFx.id ? null : t)), TAP_FX_MS);
    return () => clearTimeout(timer);
  }, [tapFx]);

  const openChat = useCallback(() => {
    pressedKeys.current.clear();
    setChatOpen(true);
    chatInputRef.current?.focus();
  }, []);

  if (!nickname || !pos) return <LoadingScreen />;

  const nearTarget = near && !openId ? { x: near.rect.x * mapW, y: near.rect.y * mapH, width: near.rect.w * mapW, height: near.rect.h * mapH } : null;

  return (
    <main className="relative h-screen w-screen select-none overflow-hidden" style={{ background: outside, touchAction: "manipulation" }}>
      {/* 안내 문구 (8초 뒤 사라짐) */}
      <div
        className={`safe-top safe-left pointer-events-none absolute z-30 max-w-[calc(100vw-5.5rem)] rounded-xl bg-slate-900/70 px-4 py-2 shadow-lg backdrop-blur transition-opacity duration-1000 sm:max-w-[60vw] ${
          showWelcome ? "opacity-100" : "opacity-0"
        }`}
      >
        <h1 className="text-base font-bold text-amber-100">
          {nickname}님, {roomName}에 오신 걸 환영해요!
        </h1>
        <p className="mt-0.5 text-xs text-amber-100/80">
          {isTouch ? "가고 싶은 곳을 터치하면 걸어가요 · " : "방향키·W·A·S·D 또는 바닥 클릭으로 이동 · E키 = 살펴보기 · Enter = 말풍선 · "}
          {welcome}
        </p>
      </div>

      {/* 지도 */}
      <div
        ref={mapElRef}
        onPointerDown={handleMapTap}
        className="absolute left-0 top-0 cursor-pointer will-change-transform"
        style={{
          width: mapW,
          height: mapH,
          transformOrigin: "0 0",
          transform: `translate3d(${camX}px, ${camY}px, 0) scale(${scale})`,
          "--ui-boost": uiBoost,
          imageRendering: "pixelated",
        }}
      >
        {children}

        {/* 통로 팻말: 열려 있으면 가는 곳 이름, 기간이 아니면 "준비중" */}
        {exits
          .filter((ex) => ex.sign)
          .map((ex) => {
            const open = exitOpen[ex.id ?? ex.to];
            return (
              <div key={ex.id ?? ex.to} className="pointer-events-none absolute z-[6] flex w-0 flex-col items-center" style={{ left: ex.sign.x * mapW, top: ex.sign.y * mapH }}>
                <span
                  className={`shrink-0 whitespace-nowrap border-4 border-[#2b1d1a] px-3 py-1 text-xl font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] ${open ? "bg-[#f5e6c8] text-[#2b1d1a]" : "bg-[#fde68a] text-[#7c2d12]"}`}
                >
                  {open ? ex.label ?? ROOMS[ex.to]?.name : "🚧 준비중"}
                </span>
                {/* 팻말 기둥 */}
                <span className="h-6 w-2.5 shrink-0 bg-[#6e4530]" />
              </div>
            );
          })}

        {tapFx && <TapRipple key={tapFx.id} x={tapFx.x} y={tapFx.y} size={Math.max(64, 44 / scale)} />}

        {Object.entries(others).map(([id, u]) => (
          <Avatar key={id} nickname={u.nickname || "손님"} x={u.x} y={u.y} isMoving={!!u.isMoving} dir={u.dir || "down"} look={normalizeLook(u)} emote={u.emote} chat={bubbles[id]} smooth />
        ))}
        <Avatar nickname={nickname} x={pos.x} y={pos.y} isMoving={isMoving} dir={dir} look={look} emote={emote} chat={bubbles.me} isMe />

        <InteractButton target={nearTarget} onClick={interact} icon={near?.icon} text={near?.title} boost={uiBoost} />
      </div>

      {renderModals?.(openId, closeDetail)}

      <ChatBox compact={isTouch} nickname={nickname} onOpenInput={openChat} />
      {isTouch && <MobileControls onAction={interact} actionIcon={nearTarget ? near.icon : null} onEmote={(type) => setEmote({ type, id: Date.now() })} />}
      <ChatInput ref={chatInputRef} open={chatOpen} onSend={sendChat} onClose={() => setChatOpen(false)} />

      {/* 화면 위 알림 ("현재 준비중입니다") */}
      <GreetToast toast={toast} />

      {/* 🔧 호스트 설정 (data.js의 hostNickname과 닉네임이 같을 때만 보여요) */}
      {isHost(nickname) && (
        <div className="safe-top safe-right fixed z-40 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setHostPanel((o) => !o)}
            aria-label="호스트 설정"
            className="flex h-12 w-12 items-center justify-center border-4 border-[#1a110e] bg-[#f5e6c8] text-2xl shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-none"
          >
            🔧
          </button>
          {hostPanel && (
            <div className="w-72 max-w-[calc(100vw-1.5rem)] border-4 border-[#1a110e] bg-[#2b1d1a] p-3 text-white shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]">
              <p className="text-sm font-black text-amber-300">🔧 호스트 설정</p>
              <p className="mt-1 text-xs text-white/70">
                거실·전시회 오픈 기간: {scheduleText() || "제한 없음"} · 지금은 {inSchedule() ? "✅ 오픈 중" : "🚧 준비중"}
              </p>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 border-2 border-white/20 bg-black/20 px-3 py-2">
                <span className="text-sm font-bold">🔓 기간 외에도 열기 (테스트용)</span>
                <input
                  type="checkbox"
                  checked={forceOpen}
                  onChange={(e) => {
                    setForceOpen(e.target.checked);
                    setForceOpenState(e.target.checked);
                    lockedNoticeRef.current = null;
                  }}
                  className="h-5 w-5 accent-amber-400"
                />
              </label>
              <p className="mt-2 text-[11px] leading-snug text-white/50">이 브라우저의 호스트에게만 열려요. 친구들 화면은 기간이 될 때까지 계속 "준비중"이에요.</p>
            </div>
          )}
        </div>
      )}

      {/* 방을 옮길 때: 화면이 스르륵 어두워졌다가 밝아져요 */}
      <div className={`pointer-events-none fixed inset-0 z-[90] bg-black transition-opacity duration-300 ${leaving || arriving ? "opacity-100" : "opacity-0"}`} />
    </main>
  );
}
