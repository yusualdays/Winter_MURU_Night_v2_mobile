// 🌰 찻집 방문 횟수 · 보늬밤조림 해금
//  - 방문은 "하루에 한 번"만 세어요 (같은 날 전시실·숲을 오가며 여러 번 들어와도 1회)
//  - UNLOCK_AT 번째 방문부터 미니게임에 🌰 보늬밤조림이 생겨요
//  - 이 기기(브라우저)에만 저장돼요 (localStorage)
//  - 테스트: 주소 끝에 ?visits=3 을 붙이면 3번 온 손님처럼 보여요
export const UNLOCK_AT = 3;
const KEY = "teaHouseVisits"; // { count, last: "2026-12-01" }
const SEEN_KEY = "bonibamUnlockSeen"; // 해금 안내(다연 ❗)를 이미 들었는지
const NEW_KEY = "bonibamPlayed"; // 보늬밤조림을 한 번이라도 열어 봤는지 (NEW 표시)

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function testVisits() {
  try {
    const v = Number(new URLSearchParams(window.location.search).get("visits"));
    return v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.count === "number") return v;
  } catch {}
  return { count: 0, last: "" };
}

// 찻집에 들어올 때 한 번 → 지금까지 방문 횟수
export function recordCafeVisit() {
  if (typeof window === "undefined") return 0;
  const v = read();
  const t = today();
  if (v.last !== t) {
    v.count += 1;
    v.last = t;
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  }
  return Math.max(v.count, testVisits());
}
export function cafeVisits() {
  if (typeof window === "undefined") return 0;
  return Math.max(read().count, testVisits());
}
export const bonibamUnlocked = () => cafeVisits() >= UNLOCK_AT;

// 해금 안내를 들었는지
export function unlockSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}
export function markUnlockSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch {}
}
// 미니게임 목록의 NEW 표시
export function bonibamIsNew() {
  try {
    return localStorage.getItem(NEW_KEY) !== "true";
  } catch {
    return false;
  }
}
export function markBonibamPlayed() {
  try {
    localStorage.setItem(NEW_KEY, "true");
  } catch {}
}
