// 공간(방) 사이 이동 도우미
//   입장 → ☕ 찻집(/cafe) ─ 위쪽 문 → 🛋️ 거실(/living-room)
//                         └ 오른쪽 문 → 🖼️ 전시장(/gallery)
//  - 어느 방에서 왔는지 기억해 두면, 도착한 방에서 그 문 앞에 서서 시작해요

export const ROOMS = {
  cafe: { href: "/cafe", name: "☕ 찻집" },
  living: { href: "/living-room", name: "🛋️ 거실" },
  gallery: { href: "/gallery", name: "🖼️ 전시장" },
};

// 다른 방으로 가기 전에 "지금 방"을 기억
export function rememberFrom(roomId) {
  try {
    sessionStorage.setItem("partyFrom", roomId);
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

// 발 사각형이 문 영역(비율 좌표)과 겹치는지
export function inZone(feet, zone, mapW, mapH) {
  const z = { x: zone.x * mapW, y: zone.y * mapH, w: zone.w * mapW, h: zone.h * mapH };
  return feet.x < z.x + z.w && feet.x + feet.w > z.x && feet.y < z.y + z.h && feet.y + feet.h > z.y;
}
