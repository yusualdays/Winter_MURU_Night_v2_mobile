// 💌 초대 링크 — 초대받은 사람만 들어올 수 있어요
//  - data.js inviteCode 에 초대 코드를 적으면, 아래처럼 코드가 붙은 주소로 들어온 사람만 입장할 수 있어요
//      https://(사이트 주소)/?invite=초대코드
//  - 한 번 초대 링크로 들어오면 그 기기(브라우저)는 기억해요 → 다음부터는 그냥 주소로 와도 돼요
//  - inviteCode 를 바꾸면 예전 링크로 들어왔던 사람도 다시 새 링크가 필요해요
//  - inviteCode 를 비워 두면("") 예전처럼 누구나 들어올 수 있어요
//  ※ 화면에서 막는 방식이라, 코드를 뜯어볼 줄 아는 사람까지 막는 진짜 보안은 아니에요
import { partyData } from "../data";

const KEY = "partyInvite";
export const INVITE_CODE = String(partyData?.inviteCode ?? "").trim();

// 주소에 ?invite=코드 가 있으면 확인해서 기억하고, 주소창에서는 지워요 (화면 캡처로 코드가 퍼지지 않게)
export function acceptInviteFromUrl() {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("invite") ?? "").trim();
    if (!code) return false;
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    if (INVITE_CODE && code === INVITE_CODE) {
      localStorage.setItem(KEY, INVITE_CODE);
      return true;
    }
  } catch {}
  return false;
}

// 직접 코드를 입력했을 때
export function acceptInviteCode(code) {
  if (!INVITE_CODE || (code ?? "").trim() !== INVITE_CODE) return false;
  try {
    localStorage.setItem(KEY, INVITE_CODE);
  } catch {}
  return true;
}

// 이 기기가 초대받았는지 (초대 코드를 안 정했으면 항상 true)
export function hasInvite() {
  if (!INVITE_CODE) return true;
  try {
    return localStorage.getItem(KEY) === INVITE_CODE;
  } catch {
    return false;
  }
}
