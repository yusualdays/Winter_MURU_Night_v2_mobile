// 🐦 조용한 새소리 (WebAudio로 직접 만들어요 — 소리 파일이 필요 없어요)
//  startBirds() → 몇 초마다 짧게 지저귀어요 / stopBirds()
//  브라우저 규칙상 화면을 한 번 누르거나 키를 누른 뒤에만 소리가 나요
let ctx = null;
let timer = null;
let master = null;

function chirp(at, f0, f1, dur) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(1, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function song() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  const kind = Math.random();
  const base = 2600 + Math.random() * 1600;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.09 + Math.random() * 0.06);
    if (kind < 0.5) chirp(at, base, base * 1.35, 0.07);
    else chirp(at, base * 1.3, base * 0.85, 0.09);
  }
  // 가끔 먼 새 (더 작게, 낮게)
  if (Math.random() < 0.35) chirp(t + 0.8, base * 0.7, base * 0.9, 0.12);
  timer = setTimeout(song, 2500 + Math.random() * 6000);
}

export function startBirds(volume = 0.05) {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    master.gain.value = volume;
    if (ctx.state === "suspended") ctx.resume();
    if (!timer) timer = setTimeout(song, 600);
  } catch {}
}

export function stopBirds() {
  clearTimeout(timer);
  timer = null;
  try {
    ctx?.suspend();
  } catch {}
}
