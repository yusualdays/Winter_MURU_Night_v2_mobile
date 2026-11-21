'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CharacterCustomizer from './components/CharacterCustomizer';
import { DEFAULT_LOOK, normalizeLook } from './lib/pixelCharacter';
import { getLook, saveLook } from './lib/session';
import { playEnterSound } from './lib/doorbell';
import EntranceScene from './components/EntranceScene';
import LoadingScreen from './components/LoadingScreen';
import { acceptInviteFromUrl } from './lib/invite';

export default function EntranceGate() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false); // 찻집으로 들어가는 중 (로딩 화면)
  // 🔑 코드가 붙은 링크(?invite=코드)로 오면 거실 입장 코드를 미리 기억해요 (찻집은 누구나)
  useEffect(() => {
    acceptInviteFromUrl();
  }, []);

  // 거실 화면을 미리 준비해 두기 → 입장할 때 더 빨리 열려요
  useEffect(() => {
    router.prefetch('/cafe');
  }, [router]);
  const inputRef = useRef(null);

  // 예전에 꾸민 캐릭터·닉네임이 있으면 불러오기
  useEffect(() => {
    const saved = getLook();
    if (saved) setLook(normalizeLook(saved));
    try {
      setNickname(localStorage.getItem('partyNickname') || '');
    } catch {}
  }, []);

  useEffect(() => {
    // 휴대폰에서는 키보드가 캐릭터 꾸미기 창을 가리니까 자동으로 키보드를 올리지 않아요
    if (isModalOpen && window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, [isModalOpen]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setIsModalOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return setError('닉네임을 입력해 주세요.');
    if (name.length > 12)
      return setError('닉네임은 12자 이내로 입력해 주세요.');
    try {
      localStorage.setItem('partyNickname', name);
    } catch {}
    saveLook(look); // 거실에 들어가면 Firebase 접속자 정보에도 함께 저장돼요
    setEntering(true); // 거실이 열릴 때까지 로딩 화면
    router.push('/cafe');
  };

  return (
    <main className="relative min-h-screen min-h-dvh overflow-hidden bg-[#0b1026]">
      {/* 🍵 찻집(無害林) 가게 앞 — 배경은 계절마다 바뀌어요 */}
      <EntranceScene
        onEnter={() => {
          playEnterSound(); // 드르륵 + 딸랑
          setError('');
          setIsModalOpen(true);
        }}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-3"
          onClick={() => setIsModalOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[94vh] max-h-[94dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-slate-800 px-4 pt-5 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl sm:p-5"
          >
            <p className="mb-1 text-xl"> </p>
            <label htmlFor="nickname" className="mb-2 block text-slate-200">
              😊 찻집에서 쓸 이름을 입력해 주세요
            </label>
            <input
              id="nickname"
              ref={inputRef}
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError('');
              }}
              placeholder="예: 눈사람"
              maxLength={20}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-600 focus:ring-2 focus:ring-amber-400"
            />
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

            {/* 캐릭터 꾸미기 */}
            <h2 className="mb-3 mt-6 text-lg  text-white">
              🧑‍🎄 찻집에서 쓸 모습을 골라 주세요
            </h2>
            <CharacterCustomizer look={look} onChange={setLook} />

            <div className="sticky bottom-0 -mx-4 mt-6 flex gap-2 bg-slate-800 px-4 pt-2 pb-[calc(var(--sab,0px)+0.75rem)] sm:mx-0 sm:px-0 sm:pb-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-lg bg-slate-700 py-3.5 text-slate-200 transition hover:bg-slate-600"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-[2] rounded-lg bg-amber-400 py-3.5 font-bold text-slate-900 transition hover:bg-amber-300"
              >
                이 모습으로 입장하기
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 거실로 넘어가는 동안 로딩 화면 */}
      {entering && <LoadingScreen kind="cafe" />}
    </main>
  );
}
