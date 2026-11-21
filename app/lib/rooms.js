// 공간(방) 사이 이동 도우미 + 오픈 기간
//   입장 → ☕ 군산 온라인 찻집(teaHouse, /cafe)
//            ├ 위쪽 가운데 통로        → 🛋️ 거실(livingRoom, /living-room)
//            ├ 카운터·다구 선반 사이 길 → 🖼️ 전시회(exhibitionRoom, /gallery)
//            └ 오른쪽 아래 통로        → 🌳 무해림(forest, /forest) — 옆으로 걷는 숲길 기획전
//  - 어느 방(어느 통로)에서 왔는지 기억해 두면, 도착한 방에서 그 통로 앞에 서서 시작해요
//  - 거실·전시회·무해림은 오픈 기간에만 열려요 (호스트는 테스트용으로 강제 오픈 가능)
//    기간: 찻집 📋 사장님 관리 → 🗓️ 공간 오픈 기간 (Firebase roomSchedule/{방}) — 안 정한 방은 data.js eventSchedule
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "./firebase";
import { partyData } from "../data";

export const ROOMS = {
  teaHouse: { href: "/cafe", name: "☕ 군산 온라인 찻집" },
  livingRoom: { href: "/living-room", name: "🛋️ 거실" },
  exhibitionRoom: { href: "/gallery", name: "🖼️ 전시회" },
  forest: { href: "/forest", name: "🌳 무해림" },
};

// 기간이 정해진 방
export const LOCKABLE_ROOMS = ["livingRoom", "exhibitionRoom", "forest"];

// ---------- 방 이동 기억 ----------
// 다른 방으로 가기 전에 "지금 방"과 "지나간 통로"를 기억
export function rememberFrom(roomId, exitId = "") {
  try {
    sessionStorage.setItem("partyFrom", roomId);
    if (exitId) sessionStorage.setItem(`partyExit:${roomId}`, exitId);
  } catch {}
}

// 도착한 방에서: 어디서 왔는지 (한 번 읽으면 지워요)
export function takeArrival() {
  try {
    const from = sessionStorage.getItem("partyFrom");
    sessionStorage.removeItem("partyFrom");
    return from;
  } catch {
    return null;
  }
}

// 이 방에서 마지막으로 나갔던 통로 (돌아올 때 그 통로 앞에 서려고)
export function lastExitOf(roomId) {
  try {
    return sessionStorage.getItem(`partyExit:${roomId}`);
  } catch {
    return null;
  }
}

// 발 사각형이 통로 영역(비율 좌표)과 겹치는지
export function inZone(feet, zone, mapW, mapH) {
  const z = { x: zone.x * mapW, y: zone.y * mapH, w: zone.w * mapW, h: zone.h * mapH };
  return feet.x < z.x + z.w && feet.x + feet.w > z.x && feet.y < z.y + z.h && feet.y + feet.h > z.y;
}

// ---------- 오픈 기간 ----------
// 오늘 날짜 "2026-12-01" (내 컴퓨터 시간 기준)
export function todayKey(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ---------- 🗓️ 방마다 오픈 기간 (사장님이 찻집에서 정해요) ----------
//  Firebase roomSchedule/{livingRoom|exhibitionRoom|forest} = { startDate: "2026-12-01", endDate: "2026-12-31" }
let schedules = null; // 아직 못 불러왔으면 null
let watching = false;
const schedSubs = new Set();
let readyResolve;
const readyPromise = new Promise((r) => (readyResolve = r));
function watchSchedules() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  if (!db) {
    schedules = {};
    readyResolve();
    return;
  }
  onValue(
    ref(db, "roomSchedule"),
    (snap) => {
      schedules = snap.val() || {};
      readyResolve();
      schedSubs.forEach((f) => f());
    },
    () => {
      schedules = schedules || {};
      readyResolve();
    }
  );
  // 인터넷이 느려도 3초 뒤엔 기본 기간(data.js)으로 진행
  setTimeout(() => {
    if (!schedules) {
      schedules = {};
      readyResolve();
    }
  }, 3000);
}
export const schedulesLoaded = () => schedules !== null;
// 기간을 불러올 때까지 기다리기 (주소로 바로 들어왔을 때 확인용)
export function schedulesReady() {
  watchSchedules();
  return readyPromise;
}
// 화면에서: 사장님이 기간을 바꾸면 바로 다시 그리기 → [버전 숫자, 지금 기간들]
export function useRoomSchedules() {
  const [v, setV] = useState(0);
  useEffect(() => {
    watchSchedules();
    const f = () => setV((n) => n + 1);
    schedSubs.add(f);
    if (schedules) f();
    return () => schedSubs.delete(f);
  }, []);
  return [v, schedules || {}];
}
// 이 방의 오픈 기간 (사장님이 안 정했으면 data.js eventSchedule)
export function scheduleOf(roomId) {
  watchSchedules();
  const s = roomId && schedules?.[roomId];
  return s && (s.startDate || s.endDate) ? s : partyData?.eventSchedule;
}

// 오늘이 오픈 기간 안인지 (시작일·마지막 날 모두 포함)
export function inSchedule(d = new Date(), roomId) {
  const s = scheduleOf(roomId);
  if (!s) return true; // 기간을 안 정했으면 항상 열림
  const t = todayKey(d);
  return (!s.startDate || t >= s.startDate) && (!s.endDate || t <= s.endDate);
}

// 호스트인지 (data.js의 hostNickname과 닉네임이 같으면)
export function isHost(nickname) {
  const host = (partyData?.hostNickname ?? "").trim();
  return !!host && host === (nickname ?? "").trim();
}

// 호스트 테스트용 강제 오픈 (이 브라우저에만 적용돼요)
export function getForceOpen() {
  try {
    return localStorage.getItem("partyForceOpen") === "1";
  } catch {
    return false;
  }
}
export function setForceOpen(on) {
  try {
    if (on) localStorage.setItem("partyForceOpen", "1");
    else localStorage.removeItem("partyForceOpen");
  } catch {}
}

// 🍵 사장님 모드 (사장님 인증을 한 브라우저에 기억)
export function getOwnerLocal() {
  try {
    return localStorage.getItem("teaOwner") === "1";
  } catch {
    return false;
  }
}
export function setOwnerLocal(on) {
  try {
    if (on) localStorage.setItem("teaOwner", "1");
    else localStorage.removeItem("teaOwner");
  } catch {}
}

// 이 방에 지금 들어갈 수 있는지 (기간 밖이면: 강제 오픈을 켠 호스트·사장님만)
export function isRoomOpen(roomId, nickname) {
  if (!LOCKABLE_ROOMS.includes(roomId)) return true;
  if (inSchedule(new Date(), roomId)) return true;
  return getForceOpen() && (isHost(nickname) || getOwnerLocal());
}

// "12월 1일 ~ 12월 31일" 같은 안내 문구
export function scheduleText(roomId) {
  const s = scheduleOf(roomId);
  if (!s) return "";
  const f = (v) => {
    const [, m, d] = (v || "").split("-").map(Number);
    return m && d ? `${m}월 ${d}일` : "";
  };
  return [f(s.startDate), f(s.endDate)].filter(Boolean).join(" ~ ");
}
