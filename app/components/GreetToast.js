"use client";

import { motion, AnimatePresence } from "framer-motion";

// 화면 위쪽 가운데에 뜨는 귀여운 픽셀 토스트 알림 (3초)
//  - toast: { id, text, icon? } 또는 null (icon을 안 주면 손 흔드는 👋)
export default function GreetToast({ toast }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--sat,0px)+4.5rem)] z-[70] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="flex items-center gap-2 border-4 border-[#1a110e] bg-[#f5e6c8] px-4 py-2.5 text-base font-black text-[#2b1d1a] shadow-[6px_6px_0_0_rgba(0,0,0,0.35)]"
          >
            <span className={`text-2xl ${toast.icon ? "" : "wave-hand"}`}>{toast.icon ?? "👋"}</span>
            {toast.text}
            <style>{`
              @keyframes wave-hand { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-18deg) } 75% { transform: rotate(18deg) } }
              .wave-hand { display: inline-block; transform-origin: 70% 80%; animation: wave-hand .5s steps(3, jump-none) infinite; }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
