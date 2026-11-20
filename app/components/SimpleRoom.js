"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, set, update, remove, push, onValue, onDisconnect, runTransaction, serverTimestamp } from "firebase/database";
import { findPath } from "../lib/pathfind";
import { db } from "../lib/firebase";
import { getMyId, getLook } from "../lib/session";
import { DEFAULT_LOOK, normalizeLook } from "../lib/pixelCharacter";
import { ROOMS, rememberFrom, takeArrival, lastExitOf, inZone, isRoomOpen, getForceOpen, setForceOpen, scheduleText, getOwnerLocal, setOwnerLocal } from "../lib/rooms";
import GreetToast from "./GreetToast";
import Avatar, { AVATAR_WIDTH, AVATAR_HEIGHT } from "./Avatar";
import TeaChat from "./TeaChat";
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
//  children : 지도 그림 (바닥·벽·가구) / renderModals(openId, close, api): 상세 창들 (api는 아래 hud와 같아요)
//  onEnter  : 방에 들어왔을 때 한 번 ({ openDetail }) — 예: 첫 방문이면 안내 창 열기
//  seats    : 앉을 수 있는 자리 [{ id, x, y, dir, stand: {x,y}, label }]
//             x,y = 앉았을 때 엉덩이 자리(캐릭터 아래 가운데), stand = 의자 옆 서는 자리 (모두 0~1 비율)
//             stands: [{x,y}, ...] → 서는 자리를 여러 개 (상하좌우 어디서든 앉기, 일어나면 다가온 자리로)
//             legs: true → 다리를 자르지 않고 의자 앞으로 늘어뜨려요 (앞이 트인 벤치). 이때 x,y = 발끝 자리
//  hud(api) : 화면 위에 덧붙일 UI (설정 창·배너 등). api = { nickname, myId, isOwner, setOwner,
//             forceOpen, changeForceOpen, mySeat, showToast, playAction, focus, setFocus, focusProp, setFocusProp }
//  📖 focus: 공부 집중 모드 (users/{ID}.focus → 머리 위 "📖 집중 중...", 파티 UI 숨김, 1:1 대화 신청 막힘)
//  🍵 다른 사람 캐릭터를 누르면 [🍵 대화 신청하기] → 상대가 수락하면 둘만의 1:1 찻자리 채팅 (TeaChat.js)
//  onSeatLeave(seatId): 자리에서 일어나거나 방을 나갈 때 (예: 테이블 위 주문 치우기)
//  playAction("drinking" | "eating" | "pouring"): 내 아바타 모션 (Firebase users/{ID}.action 으로 모두에게)
//  exits의 paintedSign: true면 열려 있을 땐 코드 팻말을 숨기고(배경 그림 팻말 사용), 준비중일 때만 "🚧 준비중" 팻말
//  spots의 radius: 버튼이 뜨는 거리 (맵 기준 px, 기본 90)
const SPEED = 320;
const SYNC_INTERVAL = 100;
const EMOTE_MS = 3000;
const CHAT_MS = 5000;
const CHAT_COOLDOWN = 800;
const NEAR_RADIUS = 90;
const SEAT_RADIUS = 60; // 의자 옆 서는 자리에서 이만큼 안이면 [🪑 앉기]
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
  seats = [],
  hud,
  onSeatLeave,
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
  const [isOwner, setIsOwner] = useState(false);           // 🍵 사장님 모드 (앞치마 + 배지)
  const [seatId, setSeatId] = useState(null);              // 내가 앉아 있는 자리
  const [action, setAction] = useState(null);              // 내 식음료 모션 { type, at }
  const [focus, setFocusState] = useState(false);          // 📖 공부 집중 모드
  const [focusProp, setFocusPropState] = useState("book"); // 집중 모드 소품: "book"(책) | "laptop"(노트북)
  const [picked, setPicked] = useState(null);              // 누른 다른 사람 캐릭터 id (대화 신청 버튼)
  const onSeatLeaveRef = useRef(onSeatLeave);
  onSeatLeaveRef.current = onSeatLeave;
  const seatIdRef = useRef(null);
  const standPointRef = useRef(null);
  const [clock, setClock] = useState(0);          // 1분마다 오픈 기간 다시 확인
  const lockedNoticeRef = useRef(null);           // 이미 "준비중" 안내를 띄운 통로

  const pressedKeys = useRef(new Set());
  const posRef = useRef(null);
  const targetRef = useRef(null);
  const stuckRef = useRef(0);
  const pathRef = useRef([]); // 🧭 터치 이동: 장애물을 피해 차례로 지나갈 점들
  const mapElRef = useRef(null);
  const openIdRef = useRef(null);
  const nearIdRef = useRef(null);
  const chatInputRef = useRef(null);
  const seenChat = useRef({});
  const lastChatSent = useRef(0);
  const armedRef = useRef(false);
  const othersRef = useRef({});
  const latest = useRef({ x: 0, y: 0, isMoving: false, dir: "down" });

  const rects = useMemo(() => blockers.map((o) => ({ x: o.x * mapW, y: o.y * mapH, w: o.w * mapW, h: o.h * mapH })), [blockers, mapW, mapH]);
  const blocked = useCallback((x, y) => rects.some((r) => overlaps(feetRect(x, y), r)), [rects]);
  // 발 가운데가 (fx, fy)일 때 갈 수 있는지 (길찾기용)
  const feetFree = useCallback(
    (fx, fy) => {
      const x = fx - FEET.offsetX - FEET.width / 2;
      const y = fy - FEET.offsetY - FEET.height / 2;
      if (x < 0 || y < 0 || x > mapW - AVATAR_WIDTH || y > mapH - AVATAR_HEIGHT) return false;
      return !blocked(x, y);
    },
    [blocked, mapW, mapH]
  );

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
    setIsOwner(getOwnerLocal());
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
    const savedFocus = () => {
      try {
        return { focus: roomId === "teaHouse" && localStorage.getItem("partyFocus") === "true", focusProp: localStorage.getItem("partyFocusProp") === "laptop" ? "laptop" : "book" };
      } catch {
        return { focus: false, focusProp: "book" };
      }
    };
    set(myRef, { nickname, ...look, room: roomId, joinedAt: serverTimestamp(), ...latest.current, isSitting: false, seatId: null, emote: null, isOwner: getOwnerLocal(), ...savedFocus() }).catch(() => {});
    // 📶 휴대폰이 잠들었다 깨는 등 연결이 끊겼다 다시 붙으면, 서버가 내 정보를 지웠을 수 있어요
    //    → 이름·방·모습까지 다시 등록하고 "창 닫으면 지우기"도 다시 걸어요 (안 그러면 위치만 남은 유령 '손님'이 생겨요)
    let firstConn = true;
    const offConn = onValue(ref(db, ".info/connected"), (s) => {
      if (s.val() !== true) return;
      if (firstConn) {
        firstConn = false;
        return;
      }
      onDisconnect(myRef).remove();
      update(myRef, { nickname, ...look, room: roomId, isOwner: getOwnerLocal(), ...savedFocus(), ...latest.current }).catch(() => {});
    });
    return () => {
      offConn();
      remove(myRef).catch(() => {});
    };
  }, [nickname, myId, look, roomId]);

  // 사장님 모드가 바뀌면 모두에게 알리기
  useEffect(() => {
    if (myId && db && nickname) update(ref(db, `users/${myId}`), { isOwner }).catch(() => {});
  }, [isOwner, myId, nickname]);
  // 📖 집중 모드 (이 브라우저에 기억 + 모두에게 알리기)
  useEffect(() => {
    try {
      // 집중 모드 토글은 찻집에만 있어서, 다른 방에서는 꺼진 채로 보여요
      setFocusState(roomId === "teaHouse" && localStorage.getItem("partyFocus") === "true");
      if (localStorage.getItem("partyFocusProp") === "laptop") setFocusPropState("laptop");
    } catch {}
  }, []);
  useEffect(() => {
    if (myId && db && nickname) update(ref(db, `users/${myId}`), { focus, focusProp }).catch(() => {});
  }, [focus, focusProp, myId, nickname]);
  const setFocusProp = useCallback((p) => {
    const v = p === "laptop" ? "laptop" : "book";
    try {
      localStorage.setItem("partyFocusProp", v);
    } catch {}
    setFocusPropState(v);
  }, []);
  const setFocus = useCallback((on) => {
    try {
      localStorage.setItem("partyFocus", on ? "true" : "false");
    } catch {}
    setFocusState(!!on);
  }, []);
  const setOwner = useCallback((on) => {
    setOwnerLocal(on);
    setIsOwner(!!on);
  }, []);

  // 3) 내 위치를 0.1초마다 보내기
  useEffect(() => {
    if (pos) latest.current = { x: Math.round(pos.x), y: Math.round(pos.y), isMoving, dir, isSitting: !!seatId, seatId: seatId ?? null };
  }, [pos, isMoving, dir, seatId]);
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
        if (child.key !== myId && u && typeof u.x === "number" && u.room === roomId && u.nickname) all[child.key] = u; // 이름 없는 유령 기록은 빼요
      });
      setOthers(all);
      othersRef.current = all;
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
    // 의자: 의자 옆 서는 자리에서 SEAT_RADIUS 안
    for (const seat of seats) {
      for (const st of seat.stands ?? [seat.stand]) {
        const d = Math.hypot(fx - st.x * mapW, fy - st.y * mapH);
        if (d <= SEAT_RADIUS && d < bestDist) {
          best = { id: `seat:${seat.id}`, seat, stand: st };
          bestDist = d;
        }
      }
    }
    return best;
  }, [pos, spots, seats, mapW, mapH]);
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
  // ===== 의자에 앉기 / 일어나기 =====
  // 다른 사람이 앉아 있는 자리 { 자리id: 닉네임 }
  const takenSeats = {};
  for (const u of Object.values(others)) if (u.isSitting && u.seatId) takenSeats[u.seatId] = u.nickname || "손님";

  const sitDown = async (seat, stand) => {
    if (!seat || seatIdRef.current || takenSeats[seat.id]) return;
    if (db && myId) {
      const seatRef = ref(db, `roomSeats/${roomId}/${seat.id}`);
      try {
        const result = await runTransaction(seatRef, (cur) => (cur && cur !== myId && othersRef.current[cur] ? undefined : myId));
        if (!result.committed) return;
        onDisconnect(seatRef).remove();
      } catch {
        return;
      }
    }
    pressedKeys.current.clear();
    targetRef.current = null;
    standPointRef.current = stand ?? seat.stand ?? seat.stands?.[0];
    seatIdRef.current = seat.id;
    setSeatId(seat.id);
    setDir(seat.dir ?? "down");
    const p = { x: seat.x * mapW - AVATAR_WIDTH / 2, y: seat.y * mapH - AVATAR_HEIGHT };  // legs 자리는 발끝이 y
    posRef.current = p;
    setPos(p);
  };
  const standUp = () => {
    const id = seatIdRef.current;
    if (!id) return;
    seatIdRef.current = null;
    setSeatId(null);
    const st = standPointRef.current;
    if (st) {
      const p = posFromFeet(st.x * mapW, st.y * mapH);
      posRef.current = p;
      setPos(p);
    }
    if (db) {
      const seatRef = ref(db, `roomSeats/${roomId}/${id}`);
      remove(seatRef).catch(() => {});
      onDisconnect(seatRef).cancel().catch(() => {});
    }
    onSeatLeaveRef.current?.(id);
  };

  // 내 아바타 모션 (차 마시기 · 다식 먹기 등) → 모두에게
  const playAction = useCallback(
    (type) => {
      const a = { type, at: Date.now() };
      setAction(a);
      if (db && myId) update(ref(db, `users/${myId}`), { action: a }).catch(() => {});
    },
    [myId]
  );
  const standUpRef = useRef(standUp);
  standUpRef.current = standUp;
  // 방을 나가면 자리 비우기
  useEffect(
    () => () => {
      if (seatIdRef.current && db) remove(ref(db, `roomSeats/${roomId}/${seatIdRef.current}`)).catch(() => {});
      if (seatIdRef.current) onSeatLeaveRef.current?.(seatIdRef.current);
    },
    [roomId]
  );

  // 버튼/E키: 앉아 있으면 일어나기, 의자 옆이면 앉기, 물건 옆이면 상세 창
  const interact = () => {
    if (seatIdRef.current) return standUp();
    if (near?.seat) return sitDown(near.seat, near.stand);
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
      if (seatIdRef.current) standUpRef.current(); // 앉아 있을 때 방향키 → 일어나서 걷기
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
      if (seatIdRef.current) {
        dx = 0;
        dy = 0;
        targetRef.current = null;
      }
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
        if (autoDist < 4) {
          // 이 점에 도착 → 다음 점으로 (없으면 도착!)
          targetRef.current = pathRef.current.shift() || null;
          autoDist = 0;
        } else {
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
          if (stuckRef.current >= 10) {
            // 길을 따라가다 정말 막히면 멈춤
            targetRef.current = null;
            pathRef.current = [];
          }
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
    setPicked(null);
    if (openIdRef.current || seatIdRef.current) return; // 창이 열려 있거나 앉아 있으면 무시 (일어나기는 버튼으로만)
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / scale, 0, mapW);
    const y = clamp((e.clientY - rect.top) / scale, 0, mapH);
    pressedKeys.current.clear();
    stuckRef.current = 0;
    // 🧭 장애물을 피해서 가는 길 찾기 (못 가는 곳을 누르면 가장 가까운 갈 수 있는 곳까지)
    const p = posRef.current;
    const path = p ? findPath({ x: p.x + FEET.offsetX + FEET.width / 2, y: p.y + FEET.offsetY + FEET.height / 2 }, { x, y }, feetFree, mapW, mapH) : [];
    if (path.length) {
      targetRef.current = path[0];
      pathRef.current = path.slice(1);
    } else {
      targetRef.current = { x, y };
      pathRef.current = [];
    }
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

  // 버튼 위치·이름: 앉아 있으면 [🚶 자리에서 일어나기], 의자 옆이면 [🪑 앉기], 물건 옆이면 물건 이름
  let nearTarget = null;
  let nearIcon = near?.icon;
  let nearTitle = near?.title;
  if (seatId) {
    nearTarget = { x: pos.x, y: pos.y + 10, width: AVATAR_WIDTH, height: 10 };
    nearIcon = "🚶";
    nearTitle = "자리에서 일어나기";
  } else if (near?.seat) {
    const st = near.seat;
    nearTarget = { x: st.x * mapW - AVATAR_WIDTH / 2, y: st.y * mapH - AVATAR_HEIGHT + 30, width: AVATAR_WIDTH, height: 10 };
    if (takenSeats[st.id]) {
      nearIcon = "🚫";
      nearTitle = `${takenSeats[st.id]}님 자리예요`;
    } else {
      nearIcon = "🪑";
      nearTitle = st.label ?? "앉기";
    }
  } else if (near) {
    nearTarget = { x: near.rect.x * mapW, y: near.rect.y * mapH, width: near.rect.w * mapW, height: near.rect.h * mapH };
  }
  if (openId) nearTarget = null;
  const mySeat = seats.find((st) => st.id === seatId) ?? null;
  // 방마다 덧붙이는 화면 UI(hud)·상세 창(renderModals)에 넘겨주는 도구 모음
  const hudApi = {
        openDetail,
        nickname,
        myId,
        isOwner,
        setOwner,
        forceOpen,
        changeForceOpen: (on) => {
          setForceOpen(on);
          setForceOpenState(on);
          lockedNoticeRef.current = null;
        },
        mySeat,
        showToast,
        playAction,
        focus,
        setFocus,
        focusProp,
        setFocusProp,
      };
  const seatLegs = Object.fromEntries(seats.map((st) => [st.id, !!st.legs]));

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
            if (open && ex.paintedSign) return null; // 배경 그림에 팻말이 그려져 있으면, 열려 있을 땐 그림 팻말만
            return (
              <div key={ex.id ?? ex.to} className="pointer-events-none absolute flex w-0 flex-col items-center" style={{ left: ex.sign.x * mapW, top: ex.sign.y * mapH, zIndex: 2400 }}>
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
          <Avatar key={id} nickname={u.nickname || "손님"} x={u.x} y={u.y} isMoving={!!u.isMoving} dir={u.dir || "down"} look={normalizeLook(u)} emote={u.emote} chat={bubbles[id]} sitting={!!u.isSitting} sitLegs={!!(u.isSitting && seatLegs[u.seatId])} owner={!!u.isOwner} focus={!!u.focus} focusProp={u.focusProp} eating={false} action={u.action} z={100 + Math.round(u.y + AVATAR_HEIGHT)} smooth />
        ))}
        <Avatar nickname={nickname} x={pos.x} y={pos.y} isMoving={isMoving} dir={dir} look={look} emote={emote} chat={bubbles.me} sitting={!!seatId} sitLegs={!!seatLegs[seatId]} owner={isOwner} focus={focus} focusProp={focusProp} eating={false} action={action} z={100 + Math.round(pos.y + AVATAR_HEIGHT)} isMe />

        {/* 🍵 다른 사람 캐릭터 누르기 → [대화 신청하기] (투명 버튼) */}
        {Object.entries(others).map(([id, u]) => (
          <button
            key={`pick-${id}`}
            type="button"
            aria-label={`${u.nickname || "손님"}님에게 대화 신청`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPicked((p) => (p === id ? null : id))}
            className="absolute cursor-pointer bg-transparent"
            style={{ zIndex: 2800, left: u.x, top: u.y + (u.isSitting ? 20 : 0), width: AVATAR_WIDTH, height: AVATAR_HEIGHT - (u.isSitting ? 30 : 0), transition: "left 0.12s linear, top 0.12s linear" }}
          />
        ))}

        {/* 버튼은 테이블·분재보다 항상 위에 */}
        <div className="pointer-events-none absolute inset-0 [&_button]:pointer-events-auto" style={{ zIndex: 3000 }}>
          <InteractButton target={nearTarget} onClick={interact} icon={nearIcon} text={nearTitle} boost={uiBoost} />
        </div>
      </div>

      {renderModals?.(openId, closeDetail, hudApi)}

      {/* 🍵 1:1 찻자리 채팅 (신청 버튼 · 수락/거절 알림 · 둘만의 채팅창) */}
      <TeaChat myId={myId} nickname={nickname} focus={focus} others={others} picked={picked} setPicked={setPicked} pickedPos={picked && others[picked] ? { x: others[picked].x * scale + camX, y: others[picked].y * scale + camY, w: AVATAR_WIDTH * scale } : null} showToast={showToast} />

      {!focus && <ChatBox compact={isTouch} nickname={nickname} onOpenInput={openChat} />}
      {isTouch && <MobileControls onAction={interact} actionIcon={nearTarget ? nearIcon : null} onEmote={(type) => setEmote({ type, id: Date.now() })} />}
      <ChatInput ref={chatInputRef} open={chatOpen} onSend={sendChat} onClose={() => setChatOpen(false)} />

      {/* 화면 위 알림 ("현재 준비중입니다") */}
      <GreetToast toast={toast} />

      {/* 방마다 덧붙이는 화면 UI (찻집: ⚙️ 설정·사장님 관리·공지 배너) */}
      {hud?.(hudApi)}

      {/* 방을 옮길 때: 화면이 스르륵 어두워졌다가 밝아져요 */}
      <div className={`pointer-events-none fixed inset-0 z-[90] bg-black transition-opacity duration-300 ${leaving || arriving ? "opacity-100" : "opacity-0"}`} />
    </main>
  );
}
