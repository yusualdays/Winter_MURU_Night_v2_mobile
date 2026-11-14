'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PIXEL_CORNERS } from './PixelModal';

export const CHAT_MAX = 60; // 말풍선에 들어갈 최대 글자 수

// 화면 하단 중앙의 작은 픽셀 채팅 입력창
//  - Enter / [보내기]: 보내고 닫기 / ESC 또는 다른 곳 터치: 그냥 닫기
//  - 휴대폰: 입력창은 항상 만들어 두고 "누르는 순간" 바로 focus() → 아이폰에서도 키보드가 올라와요
//    (열린 뒤에 focus()를 부르면 iOS는 키보드를 안 띄워요)
//  - 키보드가 올라오면 입력창이 키보드 바로 위로 따라 올라가요 (visualViewport)
const ChatInput = forwardRef(function ChatInput({ open, onSend, onClose }, forwardedRef) {
  const [text, setText] = useState('');
  const [lift, setLift] = useState(0); // 키보드 높이만큼 위로
  const inputRef = useRef(null);
  const blurTimer = useRef(null); // 입력칸을 벗어나도 [보내기] 터치는 받아 주려고 살짝 늦게 닫아요

  useImperativeHandle(forwardedRef, () => ({
    focus: () => inputRef.current?.focus({ preventScroll: true }),
  }));

  // 열릴 때마다 비우고 바로 입력할 수 있게
  useEffect(() => {
    if (open) {
      setText('');
      inputRef.current?.focus({ preventScroll: true });
    } else {
      inputRef.current?.blur();
    }
  }, [open]);

  // 키보드 높이 따라가기 (아이폰은 키보드가 화면 위에 "덮여서" 직접 계산해야 해요)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !open) {
      setLift(0);
      return;
    }
    const update = () => setLift(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const submit = () => {
    clearTimeout(blurTimer.current);
    const body = text.trim();
    if (body) onSend(body.slice(0, CHAT_MAX));
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter는 무시 (마지막 글자 중복 방지)
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    // 바깥 칸: 화면 하단 가운데 고정 (닫혀 있을 땐 투명 + 터치 안 받음)
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 transition duration-150 ${
        open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ bottom: `calc(${lift}px + max(var(--sab, 0px), 0px) + 0.75rem)` }}
      aria-hidden={!open}
    >
      <form
        className={`w-[min(94vw,420px)] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onSubmit={(e) => {
          e.preventDefault(); // 휴대폰 키보드의 [보내기]/[이동] 키
          submit();
        }}
      >
        <div className="bg-[#1a110e] p-1 shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]" style={{ clipPath: PIXEL_CORNERS }}>
          <div className="flex items-center gap-2 bg-[#f5e6c8] px-3 py-2" style={{ clipPath: PIXEL_CORNERS }}>
            <span className="text-xl leading-none">💬</span>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => clearTimeout(blurTimer.current)}
              onBlur={() => {
                clearTimeout(blurTimer.current);
                blurTimer.current = setTimeout(onClose, 250);
              }}
              maxLength={CHAT_MAX}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              tabIndex={open ? 0 : -1}
              placeholder="말풍선으로 할 말을 입력하세요"
              aria-label="말풍선 채팅 입력"
              className="min-w-0 flex-1 bg-transparent py-1 text-base font-bold text-[#2b1d1a] outline-none placeholder:font-normal placeholder:text-[#2b1d1a]/40"
            />
            <span className="shrink-0 text-[11px] tabular-nums text-[#5b3b2a]/70">
              {text.length}/{CHAT_MAX}
            </span>
            {/* 보내기 버튼 (마우스로 누를 땐 입력칸이 포커스를 잃지 않게) */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              aria-label="보내기"
              className="shrink-0 border-2 border-[#1a110e] bg-amber-400 px-3 py-1.5 text-sm font-black text-[#2b1d1a] active:translate-y-0.5"
            >
              보내기
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[11px] font-bold text-white/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          <span className="hidden [@media(pointer:fine)]:inline">Enter 보내기 · ESC 취소</span>
          <span className="[@media(pointer:fine)]:hidden">바깥을 누르면 닫혀요</span>
        </p>
      </form>
    </div>
  );
});

export default ChatInput;
