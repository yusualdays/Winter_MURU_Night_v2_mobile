// 🔐 무해림 비밀 나무용 로그인
//  - 손님: 익명 로그인 (화면에 아무것도 안 보여요) → 비밀 나무를 쓸 때 "내가 쓴 글"인지 서버가 알아보는 용도
//  - 관리자(주인장): 이메일·비밀번호 로그인 → 서버 규칙이 이 계정에게만 forestSecrets 읽기를 허락해요
//  ※ Firebase 콘솔 → Authentication → 로그인 방법에서 "익명"과 "이메일/비밀번호"를 켜야 해요
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseApp } from "./firebase";

let auth = null;
function getA() {
  if (!firebaseApp) return null;
  if (!auth) auth = getAuth(firebaseApp);
  return auth;
}

// 지금 로그인한 사람 (없으면 익명 로그인)
export async function ensureUser() {
  const a = getA();
  if (!a) throw new Error("firebase");
  if (a.currentUser) return a.currentUser;
  const r = await signInAnonymously(a);
  return r.user;
}

export function watchUser(cb) {
  const a = getA();
  if (!a) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(a, cb);
}

export async function adminLogin(email, password) {
  const a = getA();
  if (!a) throw new Error("firebase");
  return (await signInWithEmailAndPassword(a, email, password)).user;
}

export async function logout() {
  const a = getA();
  if (a) await signOut(a);
}
