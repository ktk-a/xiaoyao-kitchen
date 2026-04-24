// 事件動畫播放器：把 pickTile 回傳的 events 排成一條 timeline，
// 每個 event 變成 1+ 個 tween，依時間 lerp 到 RenderState 的 tileFx / slotFx。
//
// 設計：
//   - 動畫是「視覺覆蓋」，不改動 game state
//   - 同一次 pickTile 的 events 串行播放（簡單、節奏清楚）
//   - 點擊在動畫播放期間鎖住（main.js 控制）

const EASE = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function createAnimQueue(fx, getNow = () => performance.now()) {
  /** @type {Array<Tween>} */
  let tweens = [];
  let nextId = 1;

  function push(tween) {
    tween._id = nextId++;
    tweens.push(tween);
    return tween;
  }

  function step() {
    const now = getNow();
    const remaining = [];
    for (const tw of tweens) {
      const t = (now - tw.start) / tw.dur;
      if (t < 0) {
        remaining.push(tw);
        continue;
      }
      const tt = Math.min(1, t);
      const eased = (EASE[tw.ease] ?? EASE.linear)(tt);
      tw.apply(eased, fx);
      if (tt < 1) {
        remaining.push(tw);
      } else if (tw.onDone) {
        tw.onDone(fx);
      }
    }
    tweens = remaining;
  }

  function isIdle() {
    return tweens.length === 0;
  }

  function clear() {
    tweens = [];
  }

  return { push, step, isIdle, clear };
}

/**
 * @typedef {Object} Tween
 * @property {number} start  performance.now() 時間戳
 * @property {number} dur    毫秒
 * @property {keyof EASE} [ease]
 * @property {(t: number, fx: any) => void} apply  t = 0..1
 * @property {(fx: any) => void} [onDone]
 * @property {number} [_id]
 */
