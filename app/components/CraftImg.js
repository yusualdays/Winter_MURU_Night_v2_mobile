"use client";

import { useEffect, useState } from "react";

// 🎨 찻집 그림 파일 (public/craft/*.png)
//  - 파일이 아직 없거나 못 불러오면 → fallback(코드로 그린 그림)을 대신 보여줘요
//  - 그래서 그림 파일을 public/craft 에 넣기만 하면 코드를 안 고쳐도 바로 바뀌어요
export const craftSrc = (name) => `/craft/${name}.png`;

const okCache = {};
export function useImgOk(name) {
  const [ok, setOk] = useState(okCache[name] ?? null);
  useEffect(() => {
    if (okCache[name] !== undefined) {
      setOk(okCache[name]);
      return;
    }
    let alive = true;
    const im = new Image();
    im.onload = () => { okCache[name] = true; if (alive) setOk(true); };
    im.onerror = () => { okCache[name] = false; if (alive) setOk(false); };
    im.src = craftSrc(name);
    return () => { alive = false; };
  }, [name]);
  return ok; // null = 확인 중, true = 있음, false = 없음
}

export function CraftImg({ name, fallback = null, className = "", style }) {
  const ok = useImgOk(name);
  if (ok === false) return fallback;
  return <img src={craftSrc(name)} alt="" draggable={false} className={`pointer-events-none select-none ${className}`} style={style} />;
}
