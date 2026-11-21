// 🔊 모든 방 공통 소리 설정 (찻집 · 거실 · 전시실 · 무해림)
//  - 🎵 배경음악(BGM): 방마다 흐르는 음악
//  - 🔔 효과음: 백색소음(찻물·빗소리·장작불·바람), 새소리, 건배·미니게임·문 여는 소리 등
//  - 한 방에서 바꾸면 이 기기의 다른 방에도 그대로 적용돼요 (localStorage "partySound")
import { useEffect, useState } from "react";

const KEY = "partySound";
const DEFAULT = { bgmOn: true, bgmVol: 20, sfxOn: true, sfxVol: 20 }; // 처음 소리 크기 20
let cur = null;
const subs = new Set();

function load() {
  if (cur) return cur;
  cur = { ...DEFAULT };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") cur = { ...DEFAULT, ...v };
  } catch {}
  return cur;
}
export function getSound() {
  if (typeof window === "undefined") return { ...DEFAULT };
  return load();
}
export function setSound(patch) {
  cur = { ...load(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {}
  subs.forEach((f) => f(cur));
}
// 0~1 (꺼져 있으면 0)
export const bgmLevel = () => {
  const s = getSound();
  return s.bgmOn ? s.bgmVol / 100 : 0;
};
export const sfxLevel = () => {
  const s = getSound();
  return s.sfxOn ? s.sfxVol / 100 : 0;
};
// 바뀔 때마다 알려 주기 → () => 구독 끊기
export function onSound(f) {
  subs.add(f);
  return () => subs.delete(f);
}
// 다른 탭(창)에서 바꿔도 따라가요
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cur = null;
    const s = load();
    subs.forEach((f) => f(s));
  });
}

// 화면에서 쓰기: const [sound, setSound] = useSound();
export function useSound() {
  const [s, setS] = useState(DEFAULT);
  useEffect(() => {
    setS(load());
    return onSound((v) => setS({ ...v }));
  }, []);
  return [s, setSound];
}
