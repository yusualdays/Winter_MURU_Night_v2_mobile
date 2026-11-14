'use client';

import { useEffect, useState } from 'react';
import PixelCharacter from './PixelCharacter';
import {
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  OUTFITS,
} from '../lib/pixelCharacter';

const DIRS = ['down', 'right', 'up', 'left'];
const DIR_NAMES = { down: '앞', right: '오른쪽', up: '뒤', left: '왼쪽' };

// 옵션 버튼 하나 (작은 캐릭터 미리보기 + 이름)
function OptionCard({ selected, onClick, look, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center rounded-lg p-1 transition ${
        selected
          ? 'bg-amber-400/25 ring-2 ring-amber-400'
          : 'bg-slate-900/60 ring-1 ring-white/10 hover:bg-slate-700'
      }`}
    >
      <PixelCharacter look={look} scale={2} />
      <span className="mt-0.5 w-full truncate text-center text-[10px] text-slate-200">
        {label}
      </span>
    </button>
  );
}

// 색 동그라미
function Swatch({ selected, onClick, color, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-9 w-9 rounded-full border-2 transition md:h-7 md:w-7 ${
        selected
          ? 'scale-110 border-amber-300'
          : 'border-slate-900 hover:scale-105'
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

// 캐릭터 꾸미기: 왼쪽 실시간 미리보기 + 오른쪽 선택 창
export default function CharacterCustomizer({ look, onChange }) {
  const [dirIndex, setDirIndex] = useState(0);
  const [cheerPreview, setCheerPreview] = useState(false);
  const [compact, setCompact] = useState(false); // 휴대폰: 미리보기를 작게 해서 위에 붙여 둬요 (스크롤해도 내 모습이 보이게)
  const set = (key, value) => onChange({ ...look, [key]: value });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // 미리보기: 걷는 모습을 앞 → 옆 → 뒤 → 옆으로 돌려 가며 보여주기
  useEffect(() => {
    const id = setInterval(
      () => setDirIndex((i) => (i + 1) % DIRS.length),
      1800
    );
    return () => clearInterval(id);
  }, []);

  const previewCheer = () => {
    setCheerPreview(true);
    setTimeout(() => setCheerPreview(false), 2000);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      {/* 실시간 미리보기 (휴대폰: 위에 붙어서 따라다녀요) */}
      <div className="sticky top-0 z-10 flex flex-row items-center justify-center gap-4 rounded-xl bg-slate-900 p-2 ring-1 ring-white/10 md:flex-col md:gap-0 md:self-start md:bg-gradient-to-b md:from-amber-900/40 md:to-slate-900 md:p-3">
        <div className="flex h-[110px] items-end md:h-[160px]">
          <PixelCharacter
            look={look}
            dir={DIRS[dirIndex]}
            moving={!cheerPreview}
            cheering={cheerPreview}
            scale={compact ? 4 : 6}
          />
        </div>
        <div className="flex flex-col items-start md:items-center">
          <p className="text-xs text-slate-400 md:mt-2">
            {cheerPreview
              ? '건배! 🍻'
              : `${DIR_NAMES[DIRS[dirIndex]]} 모습 · 걷는 중`}
          </p>
          <button
            type="button"
            onClick={previewCheer}
            className="mt-2 rounded-full bg-slate-700 px-3 py-2 text-xs text-amber-100 hover:bg-slate-600"
          >
            🍻 건배 포즈 보기
          </button>
        </div>
      </div>

      {/* 선택 창 */}
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="mb-2 text-sm font-bold text-amber-200">헤어스타일</h3>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {HAIR_STYLES.map((h) => (
              <OptionCard
                key={h.id}
                label={h.name}
                selected={look.hair === h.id}
                onClick={() => set('hair', h.id)}
                look={{ ...look, hair: h.id }}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-wrap gap-6">
          <div>
            <h3 className="mb-2 text-sm font-bold text-amber-200">머리색</h3>
            <div className="flex gap-2">
              {HAIR_COLORS.map((c) => (
                <Swatch
                  key={c.id}
                  label={c.name}
                  color={c.base}
                  selected={look.hairColor === c.id}
                  onClick={() => set('hairColor', c.id)}
                />
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-amber-200">피부색</h3>
            <div className="flex gap-2">
              {SKIN_TONES.map((s) => (
                <Swatch
                  key={s.id}
                  label={s.name}
                  color={s.base}
                  selected={look.skin === s.id}
                  onClick={() => set('skin', s.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-amber-200">옷 스타일</h3>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {OUTFITS.map((o) => (
              <OptionCard
                key={o.id}
                label={o.name}
                selected={look.outfit === o.id}
                onClick={() => set('outfit', o.id)}
                look={{ ...look, outfit: o.id }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
