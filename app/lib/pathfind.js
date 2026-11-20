// 🧭 터치한 곳까지 장애물을 피해 가는 길 찾기 (A* 길찾기)
//  - 지도를 작은 칸(CELL px)으로 나눠서, 발이 들어갈 수 있는 칸만 지나가요
//  - 찾은 길은 "직선으로 갈 수 있으면 중간 점을 건너뛰기"로 다듬어서 자연스럽게 걸어요
//  - 터치한 곳이 테이블 위처럼 못 가는 곳이면 → 가장 가까운 갈 수 있는 곳으로 가요
//  - isFree(fx, fy): 발 가운데가 (fx, fy)일 때 갈 수 있으면 true
//  - 결과: [{ x, y }, ...] 발 가운데가 차례로 지나갈 점들 (출발점 제외). 갈 수 없으면 []

const CELL = 16;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

// 두 점 사이를 직선으로 걸어갈 수 있는지 (조금씩 나눠서 확인)
export function canWalkStraight(a, b, isFree, stepPx = 6) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d / stepPx));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!isFree(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

export function findPath(start, goal, isFree, mapW, mapH) {
  // 바로 갈 수 있으면 그냥 직선
  if (isFree(goal.x, goal.y) && canWalkStraight(start, goal, isFree)) return [goal];

  const W = Math.ceil(mapW / CELL);
  const H = Math.ceil(mapH / CELL);
  const N = W * H;
  const free = new Int8Array(N).fill(-1); // -1 = 아직 모름, 0 = 막힘, 1 = 감
  const cx = (i) => (i % W) * CELL + CELL / 2;
  const cy = (i) => Math.floor(i / W) * CELL + CELL / 2;
  const ok = (i) => {
    if (free[i] === -1) free[i] = isFree(cx(i), cy(i)) ? 1 : 0;
    return free[i] === 1;
  };
  const idx = (x, y) => clampI(Math.floor(y / CELL), H) * W + clampI(Math.floor(x / CELL), W);

  // 출발 칸 (지금 서 있는 곳이 칸 경계에 걸려 있으면 근처 갈 수 있는 칸)
  const s = nearestFree(idx(start.x, start.y), W, H, ok, 3);
  // 도착 칸 (못 가는 곳을 눌렀으면 가장 가까운 갈 수 있는 칸)
  const g = nearestFree(idx(goal.x, goal.y), W, H, ok, 40);
  if (s < 0 || g < 0) return [];

  // A*
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap();
  const gx = g % W, gy = Math.floor(g / W);
  const h = (i) => {
    const dx = Math.abs((i % W) - gx), dy = Math.abs(Math.floor(i / W) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  gScore[s] = 0;
  heap.push(s, h(s));
  let found = false;
  let guard = 0;
  while (heap.size && guard++ < N * 2) {
    const cur = heap.pop();
    if (cur === g) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % W, y = Math.floor(cur / W);
    for (const [ddx, ddy, cost] of DIRS) {
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni] || !ok(ni)) continue;
      // 대각선은 양옆이 다 열려 있을 때만 (모서리 끼임 방지)
      if (ddx && ddy && (!ok(y * W + nx) || !ok(ny * W + x))) continue;
      const ng = gScore[cur] + cost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        came[ni] = cur;
        heap.push(ni, ng + h(ni));
      }
    }
  }
  if (!found) return [];

  // 칸 경로 → 점 경로
  const cells = [];
  for (let i = g; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map((i) => ({ x: cx(i), y: cy(i) }));
  // 마지막 점: 누른 곳이 갈 수 있는 곳이면 정확히 그 자리로
  if (isFree(goal.x, goal.y)) pts[pts.length - 1] = { x: goal.x, y: goal.y };

  // 다듬기: 직선으로 갈 수 있는 가장 먼 점으로 건너뛰기
  const out = [];
  let from = start;
  let k = 0;
  while (k < pts.length) {
    let far = k;
    for (let j = pts.length - 1; j > k; j--) {
      if (canWalkStraight(from, pts[j], isFree)) { far = j; break; }
    }
    out.push(pts[far]);
    from = pts[far];
    k = far + 1;
  }
  return out;
}

function clampI(v, n) {
  return Math.max(0, Math.min(n - 1, v));
}

// i 근처에서 갈 수 있는 칸 찾기 (넓혀 가며)
function nearestFree(i, W, H, ok, maxR) {
  if (ok(i)) return i;
  const x0 = i % W, y0 = Math.floor(i / W);
  for (let r = 1; r <= maxR; r++) {
    let best = -1, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x;
        const d = dx * dx + dy * dy;
        if (d < bestD && ok(j)) { best = j; bestD = d; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

class MinHeap {
  constructor() { this.a = []; this.p = []; }
  get size() { return this.a.length; }
  push(v, pr) {
    const a = this.a, p = this.p;
    a.push(v); p.push(pr);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= p[i]) break;
      [a[i], a[j]] = [a[j], a[i]]; [p[i], p[j]] = [p[j], p[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a, p = this.p;
    const top = a[0];
    const lv = a.pop(), lp = p.pop();
    if (a.length) {
      a[0] = lv; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && p[l] < p[m]) m = l;
        if (r < a.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}
