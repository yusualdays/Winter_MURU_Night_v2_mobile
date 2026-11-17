"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar, { AVATAR_WIDTH, AVATAR_HEIGHT } from "../components/Avatar";
import DiningTable from "../components/DiningTable";
import Bookshelf from "../components/Bookshelf";
import MovieWall from "../components/MovieWall";
import InteractButton from "../components/InteractButton";
import WallPosters from "../components/WallPosters";
import WishTree from "../components/WishTree";
import QuoteWall from "../components/QuoteWall";
import ChatBox from "../components/ChatBox";
import ChatInput from "../components/ChatInput";
import CallInvite from "../components/CallInvite";
import { partyData } from "../data";
import AudioSettings from "../components/AudioSettings";
import RoomAmbience from "../components/RoomAmbience";
import LoadingScreen from "../components/LoadingScreen";
import MobileControls from "../components/MobileControls";
import UserActions from "../components/UserActions";
import GreetToast from "../components/GreetToast";
import ProfileModal from "../components/ProfileModal";
import ToastParty from "../components/ToastParty";
import SnowGame from "../components/SnowGame";
import TapRipple, { TAP_FX_MS } from "../components/TapRipple";
import { ROOMS, rememberFrom, inZone, isRoomOpen } from "../lib/rooms";
import { EMOTE_KEYS } from "../components/EmoteBubble";
import { ref, set, update, remove, push, onValue, onDisconnect, runTransaction, serverTimestamp } from "firebase/database";
import { db } from "../lib/firebase";
import { getMyId, getLook } from "../lib/session";
import { DEFAULT_LOOK, normalizeLook } from "../lib/pixelCharacter";
import {
  BACKGROUND_SRC,
  MAP_WIDTH,
  FALLBACK_MAP,
  SPAWN,
  BLOCKERS,
  SPOTS,
  FOOD_SPOTS,
  NEAR_POINTS,
  NEAR_RADIUS,
  SPOT_TITLES,
  SEATS,
  SEAT_RADIUS,
} from "../lib/mapConfig";

// 맵 위의 "안 움직이는" 그림들은 내 위치가 바뀔 때마다 다시 그리지 않게 (휴대폰이 훨씬 가벼워져요)
const StaticWallPosters = memo(WallPosters);
const StaticQuoteWall = memo(QuoteWall);
const StaticDiningTable = memo(DiningTable);
const StaticCallInvite = memo(CallInvite);
const StaticWishTree = memo(WishTree);
const StaticRoomAmbience = memo(RoomAmbience);

// ================== 화면 설정 ==================
// (노란 점선 원 = 🔍 버튼이 뜨는 범위. SHOW_OBSTACLES를 true로 하면 같이 보여요)
const SPEED = 320;            // 1초에 이동하는 거리(맵 단위)
const SHOW_OBSTACLES = false; // true로 바꾸면 이동 불가 영역(빨강)과 클릭 영역(파랑)이 보여요
const SYNC_INTERVAL = 100;    // 내 위치를 Firebase에 보내는 간격 (0.1초)
const EMOTE_MS = 3000;        // 표정 말풍선이 떠 있는 시간 (3초)
const CHAT_MS = 5000;         // 채팅 말풍선이 떠 있는 시간 (5초)
const CHAT_COOLDOWN = 800;    // 도배 방지 (0.8초에 한 번)
const FRIEND_RADIUS = 60;     // 친구와 이만큼(맵 기준 px) 가까우면 [🤝 인사하기] [🔍 프로필]
const GREET_EMOTE = "smile";  // 인사할 때 두 캐릭터가 짓는 표정 ("smile" 방긋 / "heart" 하트 / "hurray" 만세)
const CAFE_DOOR = { x: 0.4, y: 0.965, w: 0.2, h: 0.035 }; // 아래쪽 가운데 출구 경계 → ☕ 군산 온라인 찻집 (비율 좌표)
const GREET_COOLDOWN = 3000;  // 인사 도배 방지 (3초에 한 번)

// ===== 휴대폰 카메라 =====
// 화면 전체에 맵을 욱여넣으면 폰에서는 너무 작아져요 → 좁은 화면에서는 "내 캐릭터를 따라다니는 카메라"로 바꿔요
const CAMERA_FIT_BELOW = 0.45; // 맵 전체가 이 배율보다 작게 보여야 하면 카메라 모드
const CAMERA_ZOOM = 0.5;       // 카메라 모드 배율 (배경 그림이 4배 확대라서 0.75면 도트가 정확히 3px로 또렷해요)
const UI_BOOST = 1.6; 
const WALL_EXT_SRC = "/wall-extension.png"; // 배경 그림 위에 이어 붙이는 벽 + 천장 몰딩 (포스터·책꽂이 위 여유 공간)
const WALL_EXT_H = 256; // 위로 늘린 벽 높이 (맵 기준 px, 그림 64px × 4배)
const FLOOR_EXT_SRC = "/floor-extension.png"; // 배경 그림 아래에 이어 붙이는 나무 바닥 (세로로 긴 휴대폰 화면의 빈 곳 채우기)         // 카메라 모드에서 닉네임·버튼을 이만큼 키워서 읽기 쉽게

// 충돌은 아바타의 "발밑" 부분으로만 판정 (위에서 내려다보는 시점이라 자연스러움)
// (캐릭터 크기가 바뀌어도 항상 발밑 가운데에 오도록 자동 계산)
const FEET_W = 52;
const FEET_H = 26;
const FEET = { offsetX: (AVATAR_WIDTH - FEET_W) / 2, offsetY: AVATAR_HEIGHT - FEET_H, width: FEET_W, height: FEET_H };
// ==============================================

const KEY_MAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 입력창(글쓰기 칸)에 타자 치는 중인지 확인 → 이때는 아바타가 움직이지 않게
const isTyping = (e) => {
  const t = e.target;
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
  );
};

// 비율(0~1) 좌표를 실제 맵 좌표로 바꾸기
const toRect = (o, mapW, mapH) => ({ x: o.x * mapW, y: o.y * mapH, w: o.w * mapW, h: o.h * mapH });
// 컴포넌트에 넘길 모양 { x, y, width, height }
const toProps = (o, mapW, mapH) => ({ x: o.x * mapW, y: o.y * mapH, width: o.w * mapW, height: o.h * mapH });

// 두 사각형이 겹치는지 검사
const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// 아바타가 (x, y)에 있을 때 발밑 사각형
const feetRect = (x, y) => ({ x: x + FEET.offsetX, y: y + FEET.offsetY, w: FEET.width, h: FEET.height });

// (x, y)로 가면 장애물에 부딪히는지
const isBlocked = (x, y, rects) => rects.some((r) => overlaps(feetRect(x, y), r));

// 의자 찾기 + 의자 관련 위치 계산
const findSeat = (id) => SEATS.find((s) => s.id === id);
// 앉았을 때 아바타 위치 (아바타 바닥 가운데 = 의자 엉덩이 자리)
const seatPos = (seat, w, h) => ({ x: seat.sit.x * w - AVATAR_WIDTH / 2, y: seat.sit.y * h - AVATAR_HEIGHT });
// 일어났을 때 아바타 위치 (발 가운데 = 앉기 전에 섰던 자리)
const standPos = (point, w, h) => ({
  x: point.x * w - (FEET.offsetX + FEET.width / 2),
  y: point.y * h - (FEET.offsetY + FEET.height / 2),
});

export default function LivingRoom() {
  const router = useRouter();
  const [nickname, setNickname] = useState(null);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [dir, setDir] = useState("up"); // 바라보는 방향: down(앞) | up(뒤) | left | right
  const [look, setLook] = useState(DEFAULT_LOOK); // 입장할 때 꾸민 캐릭터
  const pressedKeys = useRef(new Set());
  const posRef = useRef({ x: 0, y: 0 });  // 지금 내 위치 (자동 이동 계산용)
  const targetRef = useRef(null);         // 터치(클릭)한 목표 지점 { x, y } — 발 가운데가 여기로 가요
  const stuckRef = useRef(0);             // 장애물에 막혀 못 가는 프레임 수
  const mapElRef = useRef(null);          // 맵 화면(div)
  const [tapFx, setTapFx] = useState(null); // 터치한 곳 파동 { x, y, id }
  const doorArmedRef = useRef(false);     // 문 밖으로 한 번 나와야 문이 작동 (도착하자마자 되돌아가지 않게)
  const [leaving, setLeaving] = useState(false); // 다른 방으로 가는 중 (화면이 어두워져요)
  const [arriving, setArriving] = useState(true); // 들어올 때 어두운 화면이 스르륵 밝아져요

  const [showWelcome, setShowWelcome] = useState(true); // 환영 문구 (8초 뒤 사라짐)
  const [mapSize, setMapSize] = useState(null); // { w, h }
  const [hasBackground, setHasBackground] = useState(false);
  const [vp, setVp] = useState({ w: 1280, h: 720 }); // 화면(뷰포트) 크기
  const mapRef = useRef(null); // 이동 계산용: { w, h, rects }

  // ===== 멀티플레이어 =====
  const [myId, setMyId] = useState(null);
  const [others, setOthers] = useState({}); // 다른 접속자들 { id: { nickname, hair, outfit, x, y, dir, isMoving, emote } }
  const [emote, setEmote] = useState(null); // 내 표정 { type, id }
  const latest = useRef({ x: 0, y: 0, isMoving: false, dir: "up", isSitting: false, seatId: null }); // 보낼 최신 내 상태
  const cheeringRef = useRef(false); // 건배 포즈 중에는 제자리에 서 있기
  const speedRef = useRef(1);        // 이동 속도 배율 (눈덩이에 맞으면 잠깐 느려져요)

  // ===== 상호작용 =====
  const [openId, setOpenId] = useState(null); // 지금 열린 상세 창 (예: "pizza", "bookshelf", "posters", "tree")
  const openIdRef = useRef(null);  // 키보드 처리용 (창이 열려 있으면 캐릭터가 멈춰요)
  const nearIdRef = useRef(null);  // 키보드 처리용 (E키를 누르면 이 물건을 열어요)

  // ===== 의자에 앉기 =====
  const [seatId, setSeatId] = useState(null); // 내가 앉아 있는 의자 id (없으면 null)
  const seatIdRef = useRef(null);
  const standPointRef = useRef(null); // 앉기 전에 섰던 자리 (일어나면 여기로)
  const othersRef = useRef({});
  const interactRef = useRef(() => {}); // E키를 눌렀을 때 할 일 (매번 최신 상태로 바뀜)

  // ===== 말풍선 채팅 =====
  const [chatOpen, setChatOpen] = useState(false); // 하단 가운데 입력창이 열려 있는지
  const [bubbles, setBubbles] = useState({});      // 머리 위 말풍선 { 유저ID 또는 "me": { text, key } }
  const seenChat = useRef({});                     // 유저별로 마지막으로 본 chatTimestamp
  const lastChatSent = useRef(0);
  const chatInputRef = useRef(null);               // 휴대폰: 버튼을 누르는 "그 순간" 입력칸에 포커스를 줘야 키보드가 떠요

  // ===== 친구와 인사·프로필 =====
  const [toast, setToast] = useState(null);           // 화면 위 알림 { id, text }
  const [profileUser, setProfileUser] = useState(null); // 프로필을 보는 친구
  const lastGreetAt = useRef(0);
  const enteredAt = useRef(Date.now());               // 들어온 시각 (그 전에 온 인사는 무시)

  // ===== 휴대폰 조작 =====
  const [isTouch, setIsTouch] = useState(false);  // 손가락으로 쓰는 기기인지 (휴대폰·태블릿)

  // ===== 오디오 상태 (각각 독립된 useState) =====
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(50);
  const [firePlaying, setFirePlaying] = useState(false);
  const [fireVolume, setFireVolume] = useState(60);

  // ===== 거실 분위기 (나에게만 적용, 다음에 들어와도 기억) =====
  const [lighting, setLighting] = useState("default"); // "default" | "warm" | "night"
  const [weather, setWeather] = useState("snow");      // "snow" | "blizzard" | "fireworks"

  // 1) 닉네임 불러오기
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem("partyNickname");
    } catch {}
    if (!saved) router.replace("/");
    else if (!isRoomOpen("livingRoom", saved)) router.replace(ROOMS.teaHouse.href); // 오픈 기간이 아니면 찻집으로
    else setNickname(saved);
    setLook(normalizeLook(getLook()));
  }, [router]);

  // 1-0) 거실 분위기: 저장해 둔 설정 불러오기 → 바뀔 때마다 저장
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("partyAmbience") || "{}");
      if (saved.lighting) setLighting(saved.lighting);
      if (saved.weather) setWeather(saved.weather);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("partyAmbience", JSON.stringify({ lighting, weather }));
    } catch {}
  }, [lighting, weather]);

  // 1-0-1) 휴대폰인지 확인 (손가락 입력) + 화면 크기 추적 (회전·주소창 변화 포함)
  useEffect(() => {
    const check = () => {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    window.visualViewport?.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, []);

  // 1-1) 환영 문구는 8초 뒤에 사라지게 (포스터를 가리지 않도록) + 들어올 때 화면 밝아지기
  useEffect(() => {
    const fade = setTimeout(() => setArriving(false), 60);
    return () => clearTimeout(fade);
  }, [mapSize]);
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // 1-2) 이 탭의 고유 ID 정하기
  useEffect(() => {
    setMyId(getMyId());
  }, []);

  // 1-3) 접속자 목록에 나를 등록 (users/{내 ID}) — 창을 닫으면 자동으로 지워짐
  useEffect(() => {
    if (!nickname || !myId || !db) return;
    const myRef = ref(db, `users/${myId}`);
    onDisconnect(myRef).remove();
    // 유저 데이터: { nickname, hair, hairColor, skin, outfit } + 위치
    set(myRef, { nickname, ...look, room: "livingRoom", joinedAt: serverTimestamp(), ...latest.current, emote: null }).catch((err) =>
      console.error("접속자 등록 실패:", err)
    );
    return () => {
      remove(myRef).catch(() => {});
    };
  }, [nickname, myId, look]);

  // 1-4) 내 위치를 0.1초마다 보내기 (바뀐 게 있을 때만)
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    latest.current = { x: Math.round(pos.x), y: Math.round(pos.y), isMoving, dir, isSitting: !!seatId, seatId: seatId ?? null };
  }, [pos, isMoving, dir, seatId]);

  useEffect(() => {
    if (!nickname || !myId || !db) return;
    const myRef = ref(db, `users/${myId}`);
    let lastSent = "";
    const timer = setInterval(() => {
      const snapshot = JSON.stringify(latest.current);
      if (snapshot === lastSent) return;
      lastSent = snapshot;
      update(myRef, latest.current).catch(() => {});
    }, SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [nickname, myId]);

  // 1-5) 다른 사람들 실시간 구독
  useEffect(() => {
    if (!myId || !db) return;
    const unsubscribe = onValue(ref(db, "users"), (snap) => {
      const all = {};
      snap.forEach((child) => {
        const u = child.val();
        if (child.key !== myId && u && typeof u.x === "number" && (u.room ?? "livingRoom") === "livingRoom") all[child.key] = u; // 거실에 있는 사람만
      });
      setOthers(all);
      othersRef.current = all;
    });
    return () => unsubscribe();
  }, [myId]);

  // 1-6) 내 표정: 3초 뒤 자동으로 사라지고, Firebase로 모두에게 알리기
  useEffect(() => {
    cheeringRef.current = emote?.type === "toast";
    if (myId && db) update(ref(db, `users/${myId}`), { emote: emote ?? null }).catch(() => {});
    if (!emote) return;
    const timer = setTimeout(() => setEmote(null), EMOTE_MS);
    return () => clearTimeout(timer);
  }, [emote, myId]);

  // 1-7) 다른 사람의 채팅 말풍선: chatTimestamp가 새로 바뀌면 5초 동안 머리 위에 보여주기
  useEffect(() => {
    const now = Date.now();
    for (const [id, u] of Object.entries(others)) {
      const ts = u.chatTimestamp;
      if (typeof ts !== "number" || !u.chatMessage || seenChat.current[id] === ts) continue;
      const firstSeen = seenChat.current[id] === undefined;
      seenChat.current[id] = ts;
      if (firstSeen && now - ts > CHAT_MS) continue; // 내가 들어오기 전의 오래된 메시지는 무시
      showBubble(id, u.chatMessage, ts);
    }
  }, [others]);

  // 머리 위 말풍선 띄우기 → 5초 뒤 스르륵 사라짐
  const showBubble = (id, text, key) => {
    setBubbles((b) => ({ ...b, [id]: { text, key } }));
    setTimeout(() => {
      setBubbles((b) => {
        if (b[id]?.key !== key) return b; // 그 사이 새 말풍선이 떴으면 그대로 두기
        const next = { ...b };
        delete next[id];
        return next;
      });
    }, CHAT_MS);
  };

  // 채팅 보내기: 내 아바타 데이터(chatMessage, chatTimestamp) + 채팅 기록(chat)
  const sendChat = (text) => {
    const now = Date.now();
    if (now - lastChatSent.current < CHAT_COOLDOWN) return;
    lastChatSent.current = now;
    showBubble("me", text, now); // 내 화면에는 바로 보여주기
    if (!db || !myId) return;
    update(ref(db, `users/${myId}`), { chatMessage: text, chatTimestamp: now }).catch(() => {});
    push(ref(db, "chat"), { nickname, text, createdAt: serverTimestamp() }).catch(() => {});
  };

  // 1-8) 화면 위 알림 띄우기 (3초)
  const showToast = (text) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3000);
  };

  // 1-9) 누가 나에게 인사하면 (events/greetings/내ID) → 알림 + 방긋 표정
  useEffect(() => {
    if (!myId || !db) return;
    const myGreetRef = ref(db, `events/greetings/${myId}`);
    onDisconnect(myGreetRef).remove();
    let lastSeen = 0;
    const unsubscribe = onValue(myGreetRef, (snap) => {
      const g = snap.val();
      if (!g || typeof g.at !== "number" || g.at === lastSeen || g.at < enteredAt.current) return;
      lastSeen = g.at;
      showToast(`${g.fromName || "손님"}님이 손을 흔들며 인사합니다!`);
      setEmote({ type: GREET_EMOTE, id: Date.now() });
    });
    return () => {
      unsubscribe();
      remove(myGreetRef).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // 내가 친구에게 인사하기
  const greet = (friendId) => {
    const now = Date.now();
    if (now - lastGreetAt.current < GREET_COOLDOWN) return;
    lastGreetAt.current = now;
    const friend = others[friendId];
    setEmote({ type: GREET_EMOTE, id: now }); // 나도 방긋
    showToast(`${friend?.nickname || "친구"}님에게 인사했어요!`);
    if (db && myId) {
      set(ref(db, `events/greetings/${friendId}`), { fromId: myId, fromName: nickname, at: now }).catch(() => {});
    }
  };

  // 2) 배경 이미지를 불러와서 맵 크기 정하기 (없으면 임시 맵 사용)
  useEffect(() => {
    const setupMap = (w, h, withImage) => {
      const rects = BLOCKERS.map((o) => toRect(o, w, h));
      mapRef.current = { w, h, rects };
      setHasBackground(withImage);
      setMapSize({ w, h });
      setPos({
        x: clamp(SPAWN.x * w - AVATAR_WIDTH / 2, 0, w - AVATAR_WIDTH),
        y: clamp(SPAWN.y * h - AVATAR_HEIGHT, 0, h - AVATAR_HEIGHT),
      });
    };

    const img = new window.Image();
    img.onload = () =>
      setupMap(MAP_WIDTH, Math.round((MAP_WIDTH * img.naturalHeight) / img.naturalWidth), true);
    img.onerror = () => setupMap(FALLBACK_MAP.w, FALLBACK_MAP.h, false);
    img.src = BACKGROUND_SRC;
  }, []);

  // 4) 키보드 누름/뗌 기록
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTyping(e)) return; // 글 쓰는 중에는 W·A·S·D가 글자로 입력되게

      // 상세 창이 열려 있으면 캐릭터는 움직이지 않아요 (ESC로 닫기)
      if (openIdRef.current) return;

      // E키 → 가까이 있는 물건 열기 / 의자에 앉기 / 일어나기
      if (e.code === "KeyE" && !e.repeat) {
        interactRef.current();
        return;
      }

      // Enter → 하단 가운데 채팅 입력창 열기 (다른 창이 열려 있지 않을 때만)
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

      // 숫자키 1·2·3 → 표정, T → 건배 포즈 (꾹 누르고 있어도 한 번만)
      const emoteType = EMOTE_KEYS[e.code];
      if (emoteType && !e.repeat) {
        setEmote({ type: emoteType, id: Date.now() });
        return;
      }

      const dir = KEY_MAP[e.code];
      if (!dir) return;
      e.preventDefault();
      targetRef.current = null; // 방향키를 누르면 터치 자동 이동은 바로 멈춰요
      if (seatIdRef.current) standUpRef.current(); // 앉아 있을 때 방향키 → 일어나서 바로 걷기
      pressedKeys.current.add(dir);
    };
    const onKeyUp = (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) pressedKeys.current.delete(dir);
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

  // 5) 매 프레임 이동 + 충돌 판정
  useEffect(() => {
    let frameId;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const keys = pressedKeys.current;
      let dx = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
      let dy = (keys.has("down") ? 1 : 0) - (keys.has("up") ? 1 : 0);
      if (cheeringRef.current || seatIdRef.current) { dx = 0; dy = 0; targetRef.current = null; } // 건배하거나 앉아 있는 동안은 제자리

      // 터치(클릭)한 곳으로 자동 이동: 방향키를 안 누르고 있을 때만
      let autoDist = 0;
      if (dx !== 0 || dy !== 0) {
        targetRef.current = null;
        if (dx !== 0 && dy !== 0) {
          dx *= Math.SQRT1_2;
          dy *= Math.SQRT1_2;
        }
      } else if (targetRef.current) {
        const p = posRef.current;
        const tx = targetRef.current.x - (p.x + FEET.offsetX + FEET.width / 2);
        const ty = targetRef.current.y - (p.y + FEET.offsetY + FEET.height / 2);
        autoDist = Math.hypot(tx, ty);
        if (autoDist < 4) targetRef.current = null; // 도착!
        else {
          dx = tx / autoDist;
          dy = ty / autoDist;
        }
      }
      const moving = (dx !== 0 || dy !== 0) && mapRef.current !== null;

      setIsMoving(moving);

      if (moving) {
        // 바라보는 방향 (자동 이동은 더 많이 가는 쪽, 방향키 대각선은 옆모습)
        if (autoDist) {
          if (Math.abs(dx) > Math.abs(dy)) setDir(dx < 0 ? "left" : "right");
          else setDir(dy < 0 ? "up" : "down");
        } else if (dx < 0) setDir("left");
        else if (dx > 0) setDir("right");
        else if (dy < 0) setDir("up");
        else if (dy > 0) setDir("down");

        let step = SPEED * speedRef.current * dt; // 눈덩이에 맞으면 speedRef가 작아져요
        if (autoDist) step = Math.min(step, autoDist); // 목표를 지나치지 않게

        setPos((p) => {
          const { w, h, rects } = mapRef.current;
          const nextX = clamp(p.x + dx * step, 0, w - AVATAR_WIDTH);
          const nextY = clamp(p.y + dy * step, 0, h - AVATAR_HEIGHT);

          // 가로, 세로를 따로 검사 → 가구 모서리를 따라 미끄러지듯 이동 가능
          const x = isBlocked(nextX, p.y, rects) ? p.x : nextX;
          const y = isBlocked(x, nextY, rects) ? p.y : nextY;

          // 자동 이동 중 장애물(식탁·벽)에 막혀 목표에 가까워지지 않으면 → 그 앞에서 멈춤
          if (autoDist && targetRef.current) {
            const moved = (x - p.x) * dx + (y - p.y) * dy; // 목표 쪽으로 간 거리
            stuckRef.current = moved < step * 0.3 ? stuckRef.current + 1 : 0;
            if (stuckRef.current >= 4) targetRef.current = null;
          }
          posRef.current = { x, y };
          return { x, y };
        });
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 6) 근접 판정: 아바타 발 위치와 각 물건의 "서는 자리" 사이 거리 계산 → 가장 가까운 하나만 활성화
  const near = useMemo(() => {
    if (!mapSize) return { id: null, point: null };
    const feetX = pos.x + FEET.offsetX + FEET.width / 2;
    const feetY = pos.y + FEET.offsetY + FEET.height / 2;
    let best = null;
    let bestPoint = null;
    let bestDist = Infinity;
    for (const [id, p] of Object.entries(NEAR_POINTS)) {
      const dist = Math.hypot(feetX - p.x * mapSize.w, feetY - p.y * mapSize.h);
      if (dist <= NEAR_RADIUS && dist < bestDist) {
        best = id;
        bestPoint = p;
        bestDist = dist;
      }
    }
    // 의자: 의자 양옆·뒤의 "서는 자리" 중 하나에서 SEAT_RADIUS(60px) 안
    for (const seat of SEATS) {
      for (const p of seat.approach) {
        const dist = Math.hypot(feetX - p.x * mapSize.w, feetY - p.y * mapSize.h);
        if (dist <= SEAT_RADIUS && dist < bestDist) {
          best = seat.id;
          bestPoint = p;
          bestDist = dist;
        }
      }
    }
    return { id: best, point: bestPoint };
  }, [pos, mapSize]);
  const nearId = near.id;

  // 6-1) 키보드 처리에서 쓸 수 있게 최신 값 기억
  useEffect(() => {
    nearIdRef.current = nearId;
  }, [nearId]);
  useEffect(() => {
    openIdRef.current = openId;
    if (openId) pressedKeys.current.clear(); // 창이 열리면 걷기 멈춤
  }, [openId]);

  const openDetail = useCallback((id) => {
    pressedKeys.current.clear();
    targetRef.current = null;
    setOpenId(id);
  }, []);
  const closeDetail = useCallback(() => setOpenId(null), []);
  const openChat = useCallback(() => {
    pressedKeys.current.clear();
    setChatOpen(true);
    chatInputRef.current?.focus();
  }, []);
  const openInvite = useCallback(() => openDetail("invite"), [openDetail]);

  // ===== 의자에 앉기 / 일어나기 =====
  // 다른 친구가 앉아 있는 의자: { 의자id: 닉네임 }
  const takenSeats = {};
  for (const u of Object.values(others)) {
    if (u.isSitting && u.seatId) takenSeats[u.seatId] = u.nickname || "손님";
  }

  const sitDown = async (id) => {
    const seat = findSeat(id);
    if (!seat || !mapSize || seatIdRef.current) return;
    if (takenSeats[id]) return; // 이미 누가 앉아 있으면 못 앉아요

    // 파이어베이스 "seats/의자id"에 내 ID를 적어서 자리 잡기 (동시에 눌러도 한 명만 성공)
    if (db && myId) {
      const seatRef = ref(db, `seats/${id}`);
      try {
        const result = await runTransaction(seatRef, (current) => {
          // 다른 사람이 앉아 있고, 그 사람이 아직 접속 중이면 → 취소
          if (current && current !== myId && othersRef.current[current]) return undefined;
          return myId;
        });
        if (!result.committed) return;
        onDisconnect(seatRef).remove(); // 창을 닫으면 자리 비우기
      } catch (err) {
        console.error("의자 자리 잡기 실패:", err);
        return;
      }
    }

    pressedKeys.current.clear();
    targetRef.current = null;
    standPointRef.current = near.point ?? seat.approach[0]; // 일어나면 돌아올 자리
    seatIdRef.current = id;
    setSeatId(id);
    setDir(seat.dir);
    setPos(seatPos(seat, mapSize.w, mapSize.h));
  };

  const standUp = () => {
    const id = seatIdRef.current;
    const seat = findSeat(id);
    if (!id) return;
    seatIdRef.current = null;
    setSeatId(null);
    if (seat && mapSize) setPos(standPos(standPointRef.current ?? seat.approach[0], mapSize.w, mapSize.h)); // 앉기 전에 섰던 자리로 나오기
    if (db) {
      const seatRef = ref(db, `seats/${id}`);
      remove(seatRef).catch(() => {});
      onDisconnect(seatRef).cancel().catch(() => {}); // 창 닫을 때 지우기 예약 취소
    }
  };
  const standUpRef = useRef(standUp);
  standUpRef.current = standUp;

  // 버튼/E키: 앉아 있으면 일어나기, 의자 근처면 앉기, 물건 근처면 상세 창
  const interact = () => {
    if (seatIdRef.current) return standUp();
    if (!nearId) return;
    if (findSeat(nearId)) return sitDown(nearId);
    openDetail(nearId);
  };
  interactRef.current = interact;

  // 맵의 바닥·물건을 터치(클릭)하면 그곳으로 걸어가기
  const handleMapTap = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // 마우스 왼쪽 버튼·손가락만
    const el = mapElRef.current;
    if (!el || !el.contains(e.target)) return; // 창(모달) 안을 누른 건 무시
    if (e.target.closest('button, a, input, textarea, select, [role="dialog"]')) return; // 버튼은 버튼대로
    if (openIdRef.current || seatIdRef.current || !mapRef.current) return; // 창이 열려 있거나 앉아 있으면 무시
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / scale, 0, mapRef.current.w);
    const y = clamp((e.clientY - rect.top) / scale, 0, mapRef.current.h);
    pressedKeys.current.clear();
    stuckRef.current = 0;
    targetRef.current = { x, y };
    setTapFx({ x, y, id: Date.now() });
  };

  // 터치 파동은 0.8초 뒤 사라져요
  useEffect(() => {
    if (!tapFx) return;
    const timer = setTimeout(() => setTapFx((t) => (t?.id === tapFx.id ? null : t)), TAP_FX_MS);
    return () => clearTimeout(timer);
  }, [tapFx]);

  // 아래쪽 문에 닿으면 → ☕ 찻집으로 (도착한 자리가 문 위라면, 한 번 문 밖으로 나온 뒤부터 작동)
  useEffect(() => {
    if (!mapSize || leaving) return;
    const feet = { x: pos.x + FEET.offsetX, y: pos.y + FEET.offsetY, w: FEET.width, h: FEET.height };
    const onDoor = inZone(feet, CAFE_DOOR, mapSize.w, mapSize.h);
    if (!onDoor) {
      doorArmedRef.current = true;
      return;
    }
    if (!doorArmedRef.current || seatIdRef.current) return;
    setLeaving(true);
    targetRef.current = null;
    pressedKeys.current.clear();
    rememberFrom("livingRoom");
    setTimeout(() => router.push(ROOMS.teaHouse.href), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, mapSize, leaving]);

  // 가장 가까운 친구 (발끼리 FRIEND_RADIUS 안) → 친구 머리 위에 [🤝] [🔍]
  let nearFriend = null;
  if (mapSize && !openId) {
    let best = FRIEND_RADIUS;
    for (const [id, u] of Object.entries(others)) {
      const d = Math.hypot(u.x - pos.x, u.y - pos.y); // 같은 크기 아바타라 왼쪽 위끼리 비교 = 발끼리 비교
      if (d <= best) {
        best = d;
        nearFriend = { id, x: u.x, y: u.y, nickname: u.nickname || "손님" };
      }
    }
  }

  // 버튼을 띄울 위치 + 아이콘·이름
  //  - 앉아 있으면: 내 의자 위에 [🚶 자리에서 일어나기] (빈 바닥을 눌러도 안 일어나요)
  //  - 의자 근처: [🪑 앉기] 또는 [🚫 OO님 자리예요]
  //  - 물건 근처: [🔍 올해의 책] [🔍 🍕 페퍼로니 피자] ...
  const mySeat = findSeat(seatId);
  const nearSeat = findSeat(nearId);
  const buttonId = mySeat ? mySeat.id : nearId;
  const buttonRect = mySeat?.chair ?? nearSeat?.chair ?? SPOTS[nearId] ?? FOOD_SPOTS[nearId];
  const nearTarget = mapSize && buttonId && buttonRect ? toProps(buttonRect, mapSize.w, mapSize.h) : null;

  const nearFood = partyData?.foods?.find((f) => f.id === nearId);
  let nearInfo;
  if (mySeat) nearInfo = { icon: "🚶", title: "자리에서 일어나기" };
  else if (nearSeat) nearInfo = takenSeats[nearSeat.id] ? { icon: "🚫", title: `${takenSeats[nearSeat.id]}님 자리예요` } : { icon: "🪑", title: "앉기" };
  else nearInfo = SPOT_TITLES[nearId] ?? { icon: "🔍", title: nearFood ? `${nearFood.emoji} ${nearFood.name}` : "" };

  // ===== 카메라 / 화면 배율 =====
  //  - 넓은 화면(PC·태블릿): 맵 전체가 한눈에 보이게 맞춰요 (예전과 동일)
  //  - 좁은 화면(휴대폰): 일정한 배율로 키우고 내 캐릭터를 따라가요
  const fitScale = mapSize ? Math.min(vp.w / mapSize.w, vp.h / mapSize.h) : 1;
  const cameraMode = !!mapSize && fitScale < CAMERA_FIT_BELOW;
  // (가로 화면에서 맵 양옆이 비지 않게, 가로가 꽉 차는 배율보다 작아지지는 않아요)
  const scale = cameraMode ? Math.max(CAMERA_ZOOM, vp.w / mapSize.w) : fitScale;
  const uiBoost = cameraMode ? UI_BOOST : 1;
  const portrait = vp.h > vp.w;
  let camX = 0;
  let camY = 0;
  if (mapSize) {
    const sw = mapSize.w * scale;
    const sh = mapSize.h * scale;
    if (!cameraMode) {
      camX = (vp.w - sw) / 2;
      camY = (vp.h - sh) / 2;
    } else {
      // 캐릭터를 화면 가운데(조금 위)에 두고, 맵 끝에서는 멈춰요
      // 아래쪽은 조작 버튼에 가리지 않도록 여백을 더 줘요
      const bottomPad = portrait ? 190 : 100;
      const cx = (pos.x + AVATAR_WIDTH / 2) * scale;
      const cy = (pos.y + AVATAR_HEIGHT * 0.6) * scale;
      camX = sw <= vp.w ? (vp.w - sw) / 2 : clamp(vp.w / 2 - cx, vp.w - sw, 0);
      // 맵이 화면보다 짧으면 위에 붙이고, 아래 빈 곳은 바닥 그림을 이어 붙여 채워요 (아래 FLOOR_EXT_SRC)
      // 위로는 늘린 벽(WALL_EXT_H)까지 올라가서, 포스터·책꽂이 위에 여유가 생겨요
      const topRoom = WALL_EXT_H * scale;
      camY = clamp(vp.h * (portrait ? 0.4 : 0.45) - cy, Math.min(topRoom, vp.h - sh - bottomPad), topRoom);
    }
  }

  if (!nickname) return <LoadingScreen />;

  return (
    <main id="party-room" className={`relative h-screen w-screen select-none overflow-hidden ${cameraMode ? "bg-[#f7c17f]" : "bg-slate-950"}`} style={{ touchAction: "manipulation" }}>
      {/* 안내 문구 (왼쪽 위에 작게, 8초 뒤 사라짐) */}
      <div
        className={`safe-top safe-left pointer-events-none absolute z-30 max-w-[calc(100vw-5.5rem)] rounded-xl bg-slate-900/70 px-4 py-2 shadow-lg backdrop-blur transition-opacity duration-1000 sm:max-w-[60vw] ${
          showWelcome ? "opacity-100" : "opacity-0"
        }`}
      >
        <h1 className="text-base font-bold text-amber-100">{nickname}님, 거실에 오신 걸 환영해요! 🔥</h1>
        {isTouch ? (
          <p className="mt-0.5 text-xs text-amber-100/80">가고 싶은 곳을 터치하면 걸어가요 · 물건 가까이에서 ✋ 버튼 · 💬 말풍선 · 😊 표정 · 🥂 건배 · 아래쪽 출구 = ☕ 찻집</p>
        ) : (
          <p className="mt-0.5 text-xs text-amber-100/80">방향키·W·A·S·D 또는 바닥 클릭으로 이동 · 물건·트리 가까이에서 버튼 클릭 또는 E키 · Enter = 말풍선 채팅 · 의자 옆에서 E = 앉기 · 숫자키 1·2·3 = 표정 · T = 건배</p>
        )}
      </div>

      {/* 배경 그림을 불러오는 동안 로딩 화면 */}
      {!mapSize && <LoadingScreen />}

      {/* 맵: 화면 가운데에 비율을 유지하며 확대/축소 */}
      {mapSize && (
        <div
          ref={mapElRef}
          onPointerDown={handleMapTap}
          className="absolute left-0 top-0 cursor-pointer will-change-transform"
          style={{
            width: mapSize.w,
            height: mapSize.h,
            transformOrigin: "0 0",
            transform: `translate3d(${camX}px, ${camY}px, 0) scale(${scale})`,
            "--ui-boost": uiBoost, // 닉네임·말풍선 크기 배율 (휴대폰에서 키워요)
            imageRendering: "pixelated", // 픽셀아트를 흐리지 않고 또렷하게 확대
            background: hasBackground
              ? `url(${BACKGROUND_SRC}) center / 100% 100%`
              : "repeating-linear-gradient(90deg, #6b4430 0 120px, #5e3b29 120px 240px)",
          }}
        >
          {/* 휴대폰: 배경 그림 위로 벽을 이어서 (포스터·책꽂이 버튼이 위에 넉넉히 떠요) */}
          {cameraMode && hasBackground && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0"
              style={{
                top: -WALL_EXT_H,
                width: mapSize.w,
                height: WALL_EXT_H,
                background: `url(${WALL_EXT_SRC}) 0 0 / 100% 100% no-repeat`,
                imageRendering: "pixelated",
              }}
            />
          )}

          {/* 휴대폰: 배경 그림 아래로 나무 바닥을 이어서, 조작 버튼 뒤가 까맣게 비지 않게 */}
          {cameraMode && hasBackground && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0"
              style={{
                top: mapSize.h,
                width: mapSize.w,
                height: mapSize.h * 1.2,
                background: `url(${FLOOR_EXT_SRC}) 0 0 / 100% auto repeat-y`,
                imageRendering: "pixelated",
              }}
            />
          )}

          {/* 거실 분위기: 창밖 날씨(눈·불꽃) + 조명 오버레이 (클릭을 막지 않아요) */}
          <StaticRoomAmbience lighting={lighting} weather={weather} mapW={mapSize.w} mapH={mapSize.h} />

          {/* 벽에 걸린 영화 포스터 3장 (data.js movies의 poster 그림) */}
          <StaticWallPosters mapW={mapSize.w} mapH={mapSize.h} />

          {/* 포스터와 책꽂이 사이: 방명록 액자 + 방명록 창 */}
          <StaticQuoteWall mapW={mapSize.w} mapH={mapSize.h} open={openId === "quote"} onClose={closeDetail} />

          {/* 식탁 위 음식 그림 + 김 (음식을 클릭하면 설명 창이 열려요) */}
          <StaticDiningTable mapW={mapSize.w} mapH={mapSize.h} openFoodId={openId} onOpenFood={openDetail} onClose={closeDetail} />

          {/* 식탁 오른쪽 아래 봉투: 그룹 통화 초대장 (가까이 가서 E키 또는 봉투 클릭) */}
          <StaticCallInvite
            mapW={mapSize.w}
            mapH={mapSize.h}
            open={openId === "invite"}
            onOpen={openInvite}
            onClose={closeDetail}
            nickname={nickname}
            hideMarker={nearId === "invite"}
          />

          {/* 왼쪽 아래 크리스마스 트리: 소원 쪽지 + 소원 빌기 창 */}
          <StaticWishTree mapW={mapSize.w} mapH={mapSize.h} open={openId === "tree"} onClose={closeDetail} nickname={nickname} />

          {/* 위치 맞추기용 표시: 빨강 = 이동 불가, 파랑 = 클릭 영역 */}
          {SHOW_OBSTACLES && (
            <>
              {BLOCKERS.map((o) => {
                const r = toRect(o, mapSize.w, mapSize.h);
                return (
                  <div
                    key={o.name}
                    className="pointer-events-none absolute border-2 border-dashed border-red-500 bg-red-500/20 text-sm font-bold text-white"
                    style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                  >
                    <span className="m-1 inline-block rounded bg-red-600 px-2 py-0.5">{o.name}</span>
                  </div>
                );
              })}
              {Object.entries(NEAR_POINTS).map(([name, p]) => (
                <div
                  key={"near-" + name}
                  className="pointer-events-none absolute rounded-full border-2 border-dashed border-amber-300 bg-amber-300/15 text-xs font-bold text-amber-100"
                  style={{
                    left: p.x * mapSize.w - NEAR_RADIUS,
                    top: p.y * mapSize.h - NEAR_RADIUS,
                    width: NEAR_RADIUS * 2,
                    height: NEAR_RADIUS * 2,
                  }}
                >
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{name}</span>
                </div>
              ))}
              {[...Object.entries(SPOTS), ...Object.entries(FOOD_SPOTS)].map(([name, o]) => {
                const r = toRect(o, mapSize.w, mapSize.h);
                return (
                  <div
                    key={"spot-" + name}
                    className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/20 text-sm font-bold text-white"
                    style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                  >
                    <span className="m-1 inline-block rounded bg-sky-600 px-2 py-0.5">{name}</span>
                  </div>
                );
              })}
            </>
          )}

          {/* 아래쪽 가운데 문 표시 → ☕ 찻집 */}
          <div
            className="pointer-events-none absolute z-[4] flex flex-col items-center justify-end"
            style={{ left: CAFE_DOOR.x * mapSize.w, top: (CAFE_DOOR.y - 0.05) * mapSize.h, width: CAFE_DOOR.w * mapSize.w, height: (CAFE_DOOR.h + 0.05) * mapSize.h }}
          >
            <span className="mb-1 border-4 border-[#1a110e] bg-[#f5e6c8] px-3 py-0.5 text-lg font-black text-[#2b1d1a] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]">⬇ ☕ 찻집으로</span>
            <span className="h-3 w-full bg-[#1a110e]/40" />
          </div>

          {/* 터치(클릭)한 곳의 픽셀 동그라미 파동 */}
          {tapFx && <TapRipple key={tapFx.id} x={tapFx.x} y={tapFx.y} size={Math.max(64, 44 / scale)} />}

          {/* 다른 사람들 아바타 */}
          {Object.entries(others).map(([id, u]) => (
            <Avatar
              key={id}
              nickname={u.nickname || "손님"}
              x={u.x}
              y={u.y}
              isMoving={!!u.isMoving}
              dir={u.dir || "down"}
              look={normalizeLook(u)}
              emote={u.emote}
              chat={bubbles[id]}
              sitting={!!u.isSitting}
              smooth
            />
          ))}

          {/* 내 아바타 */}
          <Avatar nickname={nickname} x={pos.x} y={pos.y} isMoving={isMoving} dir={dir} look={look} emote={emote} chat={bubbles.me} sitting={!!seatId} isMe />

          {/* ❄️ 눈덩이 피하기 미니게임 (눈덩이·"앗!"·폭죽 + 호스트 시작 버튼) */}
          <SnowGame
            mapW={mapSize.w}
            mapH={mapSize.h}
            myId={myId}
            nickname={nickname}
            myPos={pos}
            others={others}
            speedRef={speedRef}
            onStart={() => {
              closeDetail();
              setChatOpen(false);
              targetRef.current = null;
              if (seatIdRef.current) standUpRef.current();
            }}
          />

          {/* 친구 가까이 가면 친구 머리 위에 [🤝 인사하기] [🔍 프로필] */}
          <UserActions
            user={nearFriend}
            boost={uiBoost}
            onGreet={() => nearFriend && greet(nearFriend.id)}
            onProfile={() => {
              if (!nearFriend) return;
              setProfileUser(others[nearFriend.id]);
              openDetail("profile");
            }}
          />

          {/* 가까이 가면 물건 위에 톡! 뜨는 버튼 (클릭 또는 E키 → 상세 창) */}
          {/*   예: [🔍 올해의 영화] [✍️ 방명록] [🎄 소원 빌기 🙏] */}
          <InteractButton
            target={openId ? null : nearTarget}
            boost={uiBoost}
            minTop={cameraMode ? -WALL_EXT_H : 8}
            onClick={interact}
            icon={nearInfo.icon}
            text={nearInfo.title}
          />
        </div>
      )}

      {/* 휴대폰: 아래쪽을 살짝 어둡게 → 조작 버튼이 바닥 위에서 잘 보여요 */}
      {cameraMode && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-56"
          style={{ background: "linear-gradient(to bottom, rgba(26,17,14,0) 0%, rgba(26,17,14,0.45) 100%)" }}
        />
      )}

      {/* 친구 프로필 창 + 인사 알림 */}
      <ProfileModal user={profileUser} open={openId === "profile"} onClose={closeDetail} />
      <GreetToast toast={toast} />

      {/* 상세 창: 올해의 영화 / 올해의 책 (음식 설명 창은 DiningTable 안에 있어요) */}
      <MovieWall open={openId === "posters"} onClose={closeDetail} />
      <Bookshelf open={openId === "bookshelf"} onClose={closeDetail} />

      {/* 왼쪽 아래: 건배하기 버튼 + 모두의 화면에 건배 축하 */}
      <ToastParty compact={isTouch} nickname={nickname} onToast={() => setEmote({ type: "toast", id: Date.now() })} />

      {/* 오른쪽 아래: 채팅 기록 + 💬 말하기 버튼 (미니 플레이어가 뜨면 그 위로 올라가요) */}
      <ChatBox compact={isTouch} nickname={nickname} onOpenInput={openChat} />

      {/* 휴대폰·태블릿: 오른쪽 아래 행동·표정 버튼 (걷기는 화면 터치, PC에서는 안 보여요) */}
      {isTouch && (
        <MobileControls
          onAction={interact}
          actionIcon={!openId && nearTarget ? nearInfo.icon : null}
          onEmote={(type) => setEmote({ type, id: Date.now() })}
        />
      )}

      {/* 하단 가운데: 말풍선 채팅 입력창 (Enter로 열기 → Enter로 보내기) */}
      <ChatInput ref={chatInputRef} open={chatOpen} onSend={sendChat} onClose={() => setChatOpen(false)} />

      {/* 오른쪽 위 ⚙️: 오디오 설정 (BGM + 장작불 ASMR) / 오른쪽 아래: 유튜브 미니 플레이어 */}
      <AudioSettings
        bgmPlaying={bgmPlaying}
        setBgmPlaying={setBgmPlaying}
        bgmVolume={bgmVolume}
        setBgmVolume={setBgmVolume}
        firePlaying={firePlaying}
        setFirePlaying={setFirePlaying}
        fireVolume={fireVolume}
        setFireVolume={setFireVolume}
        lighting={lighting}
        setLighting={setLighting}
        weather={weather}
        setWeather={setWeather}
      />
      {/* 다른 방으로 가는 중: 화면이 스르륵 어두워져요 */}
      <div className={`pointer-events-none fixed inset-0 z-[90] bg-black transition-opacity duration-300 ${leaving || arriving ? "opacity-100" : "opacity-0"}`} />
    </main>
  );
}
