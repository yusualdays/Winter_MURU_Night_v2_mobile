'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// 도트 느낌 테두리 (모서리를 계단 모양으로 깎기)
export const PIXEL_CORNERS =
  'polygon(0 6px, 6px 6px, 6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px))';

// 🔍 를 누르면 화면 가운데에 열리는 픽셀 스타일 상세 창
//  - × 버튼 / ESC / 바깥(어두운 곳) 클릭으로 닫혀요
export default function PixelModal({
  open,
  onClose,
  label,
  title,
  children,
  width = 560,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4"
          style={{ paddingTop: 'max(0.75rem, var(--sat, 0px))', paddingBottom: 'max(0.75rem, var(--sab, 0px))' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.85, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a110e] p-1 shadow-[8px_8px_0_0_rgba(0,0,0,0.45)]"
            style={{ width: `min(90vw, ${width}px)`, clipPath: PIXEL_CORNERS }}
          >
            <div
              className="bg-[#f5e6c8] p-1"
              style={{ clipPath: PIXEL_CORNERS }}
            >
              <div
                className="relative max-h-[80vh] overflow-y-auto bg-[#3b2a20] p-4 text-white sm:p-5"
                style={{ clipPath: PIXEL_CORNERS, maxHeight: 'min(80dvh, 80vh)', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-1 top-0 h-11 w-11 text-2xl leading-none text-white/60 hover:text-white"
                  aria-label="닫기"
                >
                  ×
                </button>
                {label && (
                  <p className="text-xs font-bold text-amber-300">{label}</p>
                )}
                {title && (
                  <h2 className="mb-3 mt-1 pr-8 text-xl font-bold">{title}</h2>
                )}
                {children}
                <p className="mt-4 text-center text-[11px] text-white/40">
                  <span className="hidden [@media(pointer:fine)]:inline">ESC 또는 </span>바깥을 누르면 닫혀요
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
