"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, set, update, remove, push, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { getMyId, getLook } from "../lib/session";
import { DEFAULT_LOOK, normalizeLook } from "../lib/pixelCharacter";
import { ROOMS, rememberFrom, takeArrival, inZone } from "../lib/rooms";
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
//  roomId   : "cafe" | "gallery" (Firebase users/{ID}.room 에 저장 → 같은 방 사람만 보여요)
//  mapW/H   : 지도 크기 (맵 기준 px)
//  outside  : 지도 바깥(휴대폰 빈 곳) 색
//  blockers : 못 지나가는 곳 [{ x, y, w, h }] (0~1 비율)
//  spots    : 가까이 가면 버튼이 뜨는 물건 [{ id, rect, near: {x,y}, icon, title }]
//  exits    : 문 [{ to: "living", zone: {x,y,w,h} }] — 발이 닿으면 그 방으로 이동
//  spawns   : 시작 위치 (발 가운데) { default: {x,y}, living: {x,y}, ... } — 어느 방에서 왔는지에 따라
//  children : 지도 그림 (바닥·벽·가구) / renderModals(openId, close): 상세 창들
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
    setNickname(saved);
    setLook(normalizeLook(getLook()));
    setMyId(getMyId());
    const from = takeArrival();
    const s = spawns[from] ?? spawns.default;
    const p = posFromFeet(s.x * mapW, s.y * mapH);
    const start = { x: clamp(p.x, 0, mapW - AVATAR_WIDTH), y: clamp(p.y, 0, mapH - AVATAR_HEIGHT) };
    posRef.current = start;
    setPos(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return () => {
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
    let bestDist = NEAR_RADIUS;
    for (const s of spots) {
      const d = Math.hypot(fx - s.near.x * mapW, fy - s.near.y * mapH);
      if (d <= bestDist) {
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

  // 10) 문에 닿으면 다른 방으로 (들어온 문 위에서 시작했다면, 한 번 벗어난 뒤부터)
  useEffect(() => {
    if (!pos || leaving) return;
    const feet = feetRect(pos.x, pos.y);
    const exit = exits.find((ex) => inZone(feet, ex.zone, mapW, mapH));
    if (!exit) {
      armedRef.current = true;
      return;
    }
    if (!armedRef.current) return;
    setLeaving(true);
    targetRef.current = null;
    pressedKeys.current.clear();
    rememberFrom(roomId);
    setTimeout(() => router.push(ROOMS[exit.to].href), 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, leaving]);

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

      {/* 다른 방으로 가는 중: 화면이 스르륵 어두워져요 */}
      <div className={`pointer-events-none fixed inset-0 z-[90] bg-black transition-opacity duration-300 ${leaving ? "opacity-100" : "opacity-0"}`} />
    </main>
  );
}
