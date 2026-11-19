"use client";

import { useState } from "react";

// 🎧 전시회 청음실 (아래 가운데) — 고급 LP 플레이어 + 음반 거치대 + 유튜브 재생목록
//  - 재생목록은 app/spaceData.js 의 galleryData.listening.playlists 에 유튜브 링크를 적어요
//    (재생목록 링크 https://www.youtube.com/playlist?list=... 또는 영상 링크 https://youtu.be/... 모두 돼요)
//  - 손님이 직접 링크를 붙여 넣어 들을 수도 있어요
//  - 음악은 "나만" 들려요. 유튜브 규칙에 따라 화면 아래에 가장 작은 크기(200×200) 영상 플레이어가 떠요
//  - 전시회를 나가면 음악이 멈춰요

// 유튜브 링크 → 퍼가기 주소 (재생목록이면 videoseries, 영상이면 영상 id)
export function toEmbed(url) {
  const s = (url || "").trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i.test(u.hostname)) return null;
  const clean = (v) => (v && /^[\w-]{5,64}$/.test(v) ? v : null);
  const list = clean(u.searchParams.get("list"));
  let video = clean(u.searchParams.get("v"));
  if (!video && /youtu\.be$/i.test(u.hostname)) video = clean(u.pathname.slice(1));
  if (!video) {
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/);
    if (m && m[1] !== "videoseries") video = clean(m[1]);
  }
  const base = "https://www.youtube-nocookie.com/embed/";
  const q = "autoplay=1&playsinline=1&rel=0&modestbranding=1";
  if (video) return `${base}${video}?${q}${list ? `&list=${list}` : `&loop=1&playlist=${video}`}`;
  if (list) return `${base}videoseries?list=${list}&${q}&loop=1`;
  return null;
}

const SLEEVES = ["#7f1d1d", "#1e3a5f", "#b45309", "#14532d", "#4c1d95", "#0f172a", "#9f1239", "#a16207"];

// ---------------- 🗺️ 지도 위 그림 (픽셀 SVG) ----------------
// area: 0~1 비율 { x, y, w, h } — 카펫 전체 자리. 안에 음반 거치대 · LP 콘솔 · 스피커
export function ListeningCorner({ area, playing }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}>
      <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}@keyframes lp-note{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-46px)}}`}</style>
      <svg viewBox="0 0 120 54" width="100%" height="100%" shapeRendering="crispEdges" style={{ overflow: "visible" }}>
        {/* 카펫 (버건디 + 금색 테두리) */}
        <rect x="0" y="6" width="120" height="48" fill="#2b1d1a" />
        <rect x="1" y="7" width="118" height="46" fill="#5b1420" />
        <rect x="3" y="9" width="114" height="42" fill="none" stroke="#c9a24a" strokeWidth="1" />
        <rect x="6" y="12" width="108" height="36" fill="none" stroke="#8a2a36" strokeWidth="1" />
        {[...Array(12)].map((_, i) => <rect key={i} x={2 + i * 10} y="53" width="2" height="2" fill="#c9a24a" />)}

        {/* 🎼 음반 거치대 (왼쪽) */}
        <g transform="translate(10 4)">
          <rect x="0" y="22" width="26" height="16" fill="#2b1d1a" />
          <rect x="1" y="23" width="24" height="14" fill="#6b3f22" />
          <rect x="1" y="23" width="24" height="2" fill="#8a5530" />
          <rect x="2" y="29" width="22" height="1" fill="#4a2a16" />
          {SLEEVES.slice(0, 6).map((c, i) => (
            <g key={i}>
              <rect x={2 + i * 4} y={10 + (i % 2) * 2} width="4" height={14 - (i % 2) * 2} fill="#2b1d1a" />
              <rect x={2.5 + i * 4} y={10.5 + (i % 2) * 2} width="3" height={13 - (i % 2) * 2} fill={c} />
              <rect x={2.5 + i * 4} y={10.5 + (i % 2) * 2} width="3" height="1" fill="#ffffff55" />
            </g>
          ))}
          {/* 앞에 세워 둔 대표 음반 */}
          <rect x="7" y="3" width="13" height="13" fill="#2b1d1a" />
          <rect x="8" y="4" width="11" height="11" fill="#e8d5a8" />
          <circle cx="13.5" cy="9.5" r="3.5" fill="#1a110e" />
          <circle cx="13.5" cy="9.5" r="1" fill="#c9a24a" />
          <rect x="1" y="38" width="2" height="3" fill="#2b1d1a" />
          <rect x="23" y="38" width="2" height="3" fill="#2b1d1a" />
        </g>

        {/* 🎶 LP 콘솔 (가운데, 월넛 + 황동) */}
        <g transform="translate(40 0)">
          {/* 콘솔 몸통 */}
          <rect x="0" y="16" width="40" height="24" fill="#2b1d1a" />
          <rect x="1" y="17" width="38" height="22" fill="#6e3b1f" />
          <rect x="1" y="17" width="38" height="2" fill="#93532d" />
          <rect x="3" y="22" width="16" height="14" fill="#2b1d1a" />
          <rect x="4" y="23" width="14" height="12" fill="#4a2512" />
          <rect x="21" y="22" width="16" height="14" fill="#2b1d1a" />
          <rect x="22" y="23" width="14" height="12" fill="#4a2512" />
          {[25, 28, 31].map((y) => <rect key={y} x="5" y={y} width="12" height="1" fill="#3a1d0e" />)}
          {[25, 28, 31].map((y) => <rect key={y} x="23" y={y} width="12" height="1" fill="#3a1d0e" />)}
          <rect x="18" y="28" width="4" height="2" fill="#c9a24a" />
          <rect x="2" y="40" width="3" height="4" fill="#2b1d1a" />
          <rect x="35" y="40" width="3" height="4" fill="#2b1d1a" />
          {/* 턴테이블 판 */}
          <rect x="2" y="2" width="36" height="16" fill="#2b1d1a" />
          <rect x="3" y="3" width="34" height="14" fill="#3b2116" />
          <rect x="3" y="3" width="34" height="1" fill="#5a3322" />
          {/* LP (돌아가요) */}
          <g style={{ transformOrigin: "16px 10px", transformBox: "view-box", animation: playing ? "lp-spin 1.8s linear infinite" : "none" }}>
            <ellipse cx="16" cy="10" rx="11" ry="6" fill="#0b0b0b" shapeRendering="auto" />
            <ellipse cx="16" cy="10" rx="8" ry="4.3" fill="none" stroke="#2a2a2a" strokeWidth="0.6" shapeRendering="auto" />
            <ellipse cx="16" cy="10" rx="3.2" ry="1.8" fill={playing ? "#b91c1c" : "#c9a24a"} shapeRendering="auto" />
            <rect x="9" y="7" width="3" height="1" fill="#ffffff40" />
          </g>
          {/* 톤암 (황동) */}
          <rect x="31" y="4" width="3" height="3" fill="#c9a24a" />
          <rect x="31" y="5" width="1" height="1" fill="#2b1d1a" />
          <rect x={playing ? 25 : 30} y={playing ? 8 : 7} width={playing ? 7 : 1.5} height="1" fill="#e5c76b" />
          {playing ? <rect x="24" y="8" width="2" height="2" fill="#e5c76b" /> : <rect x="30" y="7" width="1.5" height="8" fill="#e5c76b" />}
          {/* 노브 */}
          <rect x="33" y="12" width="2" height="2" fill="#c9a24a" />
          <rect x="33" y="15" width="2" height="1" fill={playing ? "#4ade80" : "#57534e"} />
        </g>

        {/* 🔊 스피커 (오른쪽) */}
        <g transform="translate(88 6)">
          <rect x="0" y="4" width="22" height="34" fill="#2b1d1a" />
          <rect x="1" y="5" width="20" height="32" fill="#5b3018" />
          <rect x="3" y="7" width="16" height="28" fill="#2b2420" />
          <circle cx="11" cy="14" r="4" fill="#1a1512" stroke="#c9a24a" strokeWidth="0.6" shapeRendering="auto" />
          <circle cx="11" cy="26" r="6" fill="#1a1512" stroke="#c9a24a" strokeWidth="0.6" shapeRendering="auto" />
          <circle cx="11" cy="26" r="2" fill="#3a302a" shapeRendering="auto" />
          <rect x="2" y="38" width="3" height="3" fill="#2b1d1a" />
          <rect x="17" y="38" width="3" height="3" fill="#2b1d1a" />
        </g>
      </svg>
      {/* 🎵 음표 (내가 듣는 중일 때) */}
      {playing &&
        [0, 1, 2].map((i) => (
          <span key={i} className="absolute text-2xl text-[#c9a24a]" style={{ left: `${48 + i * 6}%`, top: "-4%", animation: `lp-note 2.4s ${i * 0.8}s ease-out infinite`, opacity: 0, textShadow: "1px 1px 0 #2b1d1a" }}>
            {i % 2 ? "♫" : "♪"}
          </span>
        ))}
      {/* 팻말 */}
      <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap border-4 border-[#2b1d1a] bg-[#2b1d1a] px-2 py-0.5 text-base font-black tracking-wider text-[#e5c76b] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]" style={{ top: "-16%" }}>
        🎧 청음실
      </span>
    </div>
  );
}

// ---------------- 🎧 고르기 창 (모달 안) ----------------
export function ListeningPicker({ playlists = [], playing, onPlay, onStop }) {
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const play = (title, url) => {
    const embed = toEmbed(url);
    if (!embed) return setMsg("유튜브 재생목록이나 영상 링크를 넣어 주세요.");
    setMsg("");
    onPlay({ title, embed });
  };
  return (
    <div>
      <p className="text-sm leading-relaxed text-amber-50/90">LP 한 장을 골라 올려 보세요. 음악은 나에게만 들리고, 화면 왼쪽 아래 작은 플레이어로 재생돼요.</p>

      {playing && (
        <div className="mt-3 flex items-center gap-2 border-4 border-[#1a110e] bg-[#2b1d1a] px-3 py-2">
          <span className="text-xl">💿</span>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#e5c76b]">지금 듣는 중 · {playing.title}</p>
          <button type="button" onClick={onStop} className="shrink-0 border-4 border-[#1a110e] bg-[#6e4530] px-3 py-1 text-sm font-black text-white">
            ⏹ 끄기
          </button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {playlists.map((pl, i) => {
          const ok = !!toEmbed(pl.url);
          const on = playing?.title === pl.title;
          return (
            <button
              key={pl.id ?? i}
              type="button"
              disabled={!ok}
              onClick={() => play(pl.title, pl.url)}
              className={`flex items-center gap-3 border-4 p-2 text-left shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-[#e5c76b] bg-[#3b2116]" : "border-[#1a110e] bg-[#2b1d1a] hover:bg-[#3b2116]"}`}
            >
              {/* 음반 표지 */}
              <span className="relative h-14 w-14 shrink-0 border-2 border-[#1a110e]" style={{ background: pl.color ?? SLEEVES[i % SLEEVES.length] }}>
                <span className={`absolute inset-1.5 rounded-full bg-[#0b0b0b] ${on ? "animate-spin [animation-duration:2s]" : ""}`}>
                  <span className="absolute inset-[38%] rounded-full bg-[#c9a24a]" />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black text-[#f5e6c8]">{pl.title}</span>
                <span className="block text-xs text-white/60">{ok ? pl.desc : "링크 준비 중"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 직접 링크 */}
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          play("내가 고른 음악", link);
        }}
      >
        <p className="text-xs font-bold text-amber-200">🔗 유튜브 재생목록·영상 링크 직접 넣기</p>
        <div className="mt-1.5 flex gap-2">
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setMsg("");
            }}
            placeholder="https://www.youtube.com/playlist?list=..."
            className="min-w-0 flex-1 border-4 border-[#1a110e] bg-[#fdf6e3] px-2.5 py-1.5 text-sm text-[#2b1d1a] outline-none placeholder:text-[#2b1d1a]/40 focus:border-amber-400"
          />
          <button type="submit" className="shrink-0 border-4 border-[#1a110e] bg-amber-400 px-3 py-1.5 text-sm font-black text-[#2b1d1a]">
            ▶ 틀기
          </button>
        </div>
        {msg && <p className="mt-1 text-xs text-rose-300">{msg}</p>}
      </form>
    </div>
  );
}

// ---------------- 📺 왼쪽 아래 작은 플레이어 (유튜브 규칙: 영상이 보여야 하고 최소 200×200) ----------------
export function MiniPlayer({ playing, onStop }) {
  if (!playing) return null;
  return (
    <div className="fixed z-[45] w-[208px] border-4 border-[#1a110e] bg-[#2b1d1a] shadow-[4px_4px_0_0_rgba(0,0,0,0.45)]" style={{ bottom: "max(12px, var(--sab, 0px))", left: "max(12px, var(--sal, 0px))" }}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <span className="animate-spin text-sm [animation-duration:3s]">💿</span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#e5c76b]">{playing.title}</p>
        <button type="button" onClick={onStop} aria-label="음악 끄기" className="shrink-0 border-2 border-[#1a110e] bg-[#6e4530] px-1.5 text-[11px] font-black text-white">
          ⏹ 끄기
        </button>
      </div>
      <iframe
        key={playing.embed}
        src={playing.embed}
        title={`유튜브 플레이어 - ${playing.title}`}
        width="200"
        height="200"
        className="block h-[200px] w-[200px] border-0 bg-black"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
