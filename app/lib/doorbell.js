// ===== 초인종 "딩~동~" =====
// mp3 파일 없이 브라우저가 실시간으로 소리를 만들어요 (Web Audio API) → 업로드 용량 0

const VOLUME = 0.18; // 전체 크기 (0 ~ 1) — "살짝" 들리도록 작게

let ctx = null;

// 종소리 한 번 (기본음 + 맑은 배음을 겹쳐서 천천히 사라지게)
function chime(freq, start, length) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(VOLUME, start + 0.01); // 톡 치고
  master.gain.exponentialRampToValueAtTime(0.0001, start + length); // 은은하게 사라짐
  master.connect(ctx.destination);

  // [배수, 크기] — 위쪽 배음일수록 작게
  [
    [1, 1],
    [2, 0.35],
    [3, 0.12],
  ].forEach(([mult, amp]) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.value = amp;
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + length + 0.05);
  });
}

export function playDoorbell() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.02;
    chime(659.25, now, 1.2); // 딩~ (미)
    chime(523.25, now + 0.45, 1.6); // 동~ (도)
  } catch {
    // 소리가 안 나도 입장에는 문제없게 조용히 넘어가요
  }
}

// ===== 찻집 문 "드르륵" + 풍경 "딸랑" (입장하기) =====
export function playEnterSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.02;
    // 드르륵: 짧게 끊긴 나무 마찰 소리 (잡음을 낮은 소리로 걸러서 여러 번)
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 260));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    g.gain.setValueAtTime(0.22, now + 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.52);
    // 딸랑: 맑은 풍경 소리 두 번
    const bell = (freq, t) => {
      [1, 2.76, 5.4].forEach((m, i) => {
        const o = ctx.createOscillator();
        const gg = ctx.createGain();
        o.frequency.value = freq * m;
        gg.gain.setValueAtTime(0.12 / (i + 1), t);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 - i * 0.4);
        o.connect(gg).connect(ctx.destination);
        o.start(t);
        o.stop(t + 1.7);
      });
    };
    bell(1318.5, now + 0.42);
    bell(1568, now + 0.62);
  } catch {
    // 소리가 안 나도 입장에는 문제없게
  }
}
