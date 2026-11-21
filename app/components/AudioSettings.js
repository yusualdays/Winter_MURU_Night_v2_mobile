"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { partyData } from "../data";
import { startFire, stopFire, setFireVolume as applyFireVolume } from "../lib/fireSound";
import { LIGHTING_MODES, WEATHER_MODES } from "./RoomAmbience";
import { PIXEL_CORNERS, PixelGear, ChoiceRow, SoundSection } from "./RoomSettings";
import { useSound } from "../lib/sound";

// 설정창 모양 조각은 RoomSettings.js에서 같이 써요 (찻집·전시실·무해림과 같은 생김새)

// ================== 설정 (⚙️ 버튼 + 팝업) + 화면 없는 BGM ==================
export default function AudioSettings({
  bgmPlaying,
  setBgmPlaying,
  bgmVolume,
  setBgmVolume,
  firePlaying,
  setFirePlaying,
  fireVolume,
  setFireVolume,
  lighting,
  setLighting,
  weather,
  setWeather,
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  // 🔊 소리 크기는 모든 방 공통 (배경음악 · 효과음) — lib/sound.js
  const [snd] = useSound();
  bgmVolume = snd.bgmOn ? snd.bgmVol : 0;
  fireVolume = snd.sfxOn ? Math.min(100, snd.sfxVol * 3) : 0; // 🔥 장작불 = 효과음 (효과음 20 = 예전 장작불 60)

    // --- BGM (내 음악 파일, 화면에 플레이어 없이 소리만) ---
  //  아이폰은 <audio>의 볼륨을 바꿀 수 없어서, 소리를 "볼륨 조절기(GainNode)"에 통과시켜 조절해요
  const bgmSrc = partyData?.bgmFile || "";
  const audioRef = useRef(null);
  const ctxRef = useRef(null);  // 소리 처리기 (Web Audio)
  const gainRef = useRef(null); // 볼륨 조절기
  const [bgmError, setBgmError] = useState(false);
  const autoStartAt = useRef(0); // "첫 터치로 재생"한 시각 (같은 터치로 바로 멈추지 않게)

  useEffect(() => {
    if (!bgmSrc) return;
    const audio = new Audio(bgmSrc);
    audio.loop = true; // 끝나면 처음부터 다시
    audio.preload = "auto";
    audioRef.current = audio;

    // 볼륨 조절기 연결: 음악 → 볼륨 조절기 → 스피커
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx = null;
    if (AudioCtx) {
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback"; // 아이폰 무음 모드에서도 소리 나게
        ctx = new AudioCtx();
        const gain = ctx.createGain();
        gain.gain.value = bgmVolume / 100;
        ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
        ctxRef.current = ctx;
        gainRef.current = gain;
      } catch {
        ctx = null; // 안 되는 브라우저는 그냥 <audio> 볼륨으로
      }
    }
    if (!ctx) audio.volume = bgmVolume / 100;

    const onPlay = () => setBgmPlaying(true);
    const onPause = () => setBgmPlaying(false);
    const onError = () => {
      setBgmError(true);
      setBgmPlaying(false);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    // 거실에 들어오면 자동 재생 (data.js에서 bgmAutoplay: false 로 끌 수 있어요)
    //  → 브라우저가 막으면, 화면을 처음 누르거나 키를 누르는 순간 재생
    const startOnTouch = () => {
      removeWaiters();
      autoStartAt.current = Date.now();
      ctx?.resume().catch(() => {});
      audio.play().catch(() => {});
    };
    const removeWaiters = () => {
      window.removeEventListener("pointerdown", startOnTouch);
      window.removeEventListener("keydown", startOnTouch);
    };
    const addWaiters = () => {
      window.addEventListener("pointerdown", startOnTouch);
      window.addEventListener("keydown", startOnTouch);
    };
    if (partyData?.bgmAutoplay !== false && bgmVolume > 0) {
      ctx?.resume().catch(() => {});
      audio
        .play()
        .then(() => {
          // 재생은 됐는데 소리 처리기가 아직 잠겨 있으면 → 첫 터치 때 깨우기
          if (ctx && ctx.state !== "running") addWaiters();
        })
        .catch(addWaiters);
    }

    return () => {
      removeWaiters();
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.src = "";
      ctx?.close().catch(() => {});
      audioRef.current = null;
      ctxRef.current = null;
      gainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmSrc, setBgmPlaying]);

  // 볼륨 바꾸기 (볼륨 조절기가 있으면 그걸로 → 아이폰에서도 작동) · 배경음악을 끄면 멈추고, 켜면 다시
  useEffect(() => {
    const v = bgmVolume / 100;
    if (gainRef.current && ctxRef.current) gainRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.05);
    else if (audioRef.current) audioRef.current.volume = v;
    const audio = audioRef.current;
    if (!audio) return;
    if (v === 0) audio.pause();
    else if (audio.paused) {
      ctxRef.current?.resume().catch(() => {});
      audio.play().catch(() => {});
    }
  }, [bgmVolume]);

  const toggleBgm = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Date.now() - autoStartAt.current < 600) return; // 방금 첫 터치로 켜졌으면 그대로 두기
    setBgmError(false);
    ctxRef.current?.resume().catch(() => {});
    if (audio.paused) audio.play().catch(() => setBgmError(true));
    else audio.pause();
  };

  // --- 🔥 장작불 ASMR (효과음): 효과음이 켜져 있으면 화면을 한 번 누른 뒤부터 타닥타닥 ---
  useEffect(() => {
    applyFireVolume(fireVolume);
    if (fireVolume === 0) {
      stopFire();
      setFirePlaying(false);
      return;
    }
    const go = () => setFirePlaying(startFire());
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireVolume]);

  useEffect(() => () => stopFire(), []); // 거실을 나가면 소리 끄기

  const toggleFire = () => {
    if (firePlaying) {
      stopFire();
      setFirePlaying(false);
    } else {
      applyFireVolume(fireVolume);
      setFirePlaying(startFire());
    }
  };

  // --- 팝업: ESC / 바깥 클릭으로 닫기 ---
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  let bgmHint = "";
  if (!bgmSrc) bgmHint = "data.js의 bgmFile에 음악 파일 주소를 넣어 주세요 (예: /bgm.mp3)";
  else if (bgmError) bgmHint = "음악 파일을 찾을 수 없어요. public 폴더의 파일 이름을 확인해 주세요";

  return (
    <>
      {/* ⚙️ 설정 버튼 + 팝업 (오른쪽 위) */}
      <div ref={panelRef} className="safe-top safe-right fixed z-40">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="오디오 설정"
          title="오디오 설정"
          className="flex h-12 w-12 items-center justify-center bg-[#2b1d1a] transition hover:scale-105 active:scale-95"
          style={{ clipPath: PIXEL_CORNERS }}
        >
          <span className="flex h-10 w-10 items-center justify-center bg-[#6e4833]" style={{ clipPath: PIXEL_CORNERS }}>
            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.3 }} className="flex">
              <PixelGear />
            </motion.span>
          </span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 top-14 max-h-[80vh] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto origin-top-right bg-[#2b1d1a] p-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]"
              style={{ clipPath: PIXEL_CORNERS }}
            >
              <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto bg-[#f5e6c8] p-4" style={{ clipPath: PIXEL_CORNERS, overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-black text-[#2b1d1a]">⚙️ 설정</p>
                  <button type="button" onClick={() => setOpen(false)} className="h-9 w-9 text-xl leading-none text-[#5b3b2a] hover:text-[#2b1d1a]" aria-label="닫기">
                    ×
                  </button>
                </div>
                {/* 🔊 소리 (모든 방 공통: 배경음악 · 효과음) */}
                <p className="mb-2 text-sm font-black text-[#2b1d1a]">🔊 소리</p>
                <SoundSection bgmHint={bgmHint} sfxHint="🔥 장작불 소리도 효과음이에요" />

                {/* 거실 분위기 설정 (나에게만 적용돼요) */}
                <div className="mt-4 border-t-2 border-dashed border-[#2b1d1a]/25 pt-3">
                  <p className="mb-2 text-sm font-black text-[#2b1d1a]">🏠 거실 분위기</p>
                  <div className="flex flex-col gap-3">
                    <ChoiceRow title="💡 거실 조명" options={LIGHTING_MODES} value={lighting} onChange={setLighting} />
                    <ChoiceRow title="🪟 창밖 날씨" options={WEATHER_MODES} value={weather} onChange={setWeather} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
