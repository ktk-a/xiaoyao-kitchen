// 入口：bootstrap game + renderer + input + animation loop。

import { createGame, pickTile, getStatus } from './game/index.js';
import { createRenderer } from './render/renderer.js';
import { bindClick } from './input/click.js';
import { createAnimQueue } from './animation/queue.js';
import { scheduleEvents } from './animation/handlers.js';

const canvas = document.getElementById('game');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const restartBtn = document.getElementById('restart');

const seedParam = new URLSearchParams(location.search).get('seed');
const initialSeed = seedParam ? Number(seedParam) : undefined;
let state = createGame(initialSeed !== undefined ? { seed: initialSeed } : undefined);
let renderer = createRenderer(canvas, state);
let aq = createAnimQueue(renderer.fx);

bindClick(canvas, state, renderer.coords, handleClick);
restartBtn.addEventListener('click', restart);

const params = new URLSearchParams(location.search);

// ?freeze=Tms&pickN=N — debug：同步點 N 張、把動畫時鐘推到 Tms、畫一幀就停。
//   給 headless 截圖用：在動畫中段（如 alpha pop 時刻）拍 deterministic 截圖。
const freezeMs = Number(params.get('freeze') ?? -1);
const pickN = Number(params.get('pickN') ?? 1);
if (freezeMs >= 0) {
  let virtualNow = 0;
  aq = createAnimQueue(renderer.fx, () => virtualNow);
  for (let i = 0; i < pickN; i++) {
    const id = state.plan[i];
    const r = pickTile(state, id);
    scheduleEvents(r.events, aq, state, renderer.coords, () => virtualNow);
    // 假設每張 pick + insert ~360ms，先把 cursor 推到 i+1 張的起點
    virtualNow += 360;
  }
  // 最後再把 virtualNow 設成想凍的時刻（相對於最後一次 click）
  virtualNow = (pickN - 1) * 360 + freezeMs;
  aq.step();
  renderer.frame(virtualNow);
  // 不再 rAF，畫面就這麼凍住
} else {
  // 正常主迴圈
  function loop(now) {
    aq.step();
    renderer.frame(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// debug 模式（測試 / 截圖用）
const autoplayN = Number(params.get('autoplay') ?? 0);
const loseMode = params.get('lose') === '1';
const rejectMode = params.get('reject') === '1';

if (autoplayN > 0) {
  let i = 0;
  const tick = () => {
    if (i >= autoplayN || state.status !== 'playing') return;
    if (!aq.isIdle()) { requestAnimationFrame(tick); return; }
    handleClick(state.plan[i]);
    i++;
    setTimeout(tick, 250);
  };
  setTimeout(tick, 600);
}

if (loseMode) {
  // 故意挑「跟 slot 裡沒有重複 type」的自由牌 → 把 slot 塞到 7 → lose
  const tick = () => {
    if (state.status !== 'playing') return;
    if (!aq.isIdle()) { requestAnimationFrame(tick); return; }
    const slotTypes = new Set(state.slot.map((t) => t.type));
    let target = null;
    for (const [id, t] of state.tiles) {
      if (t.blockedBy.size === 0 && !slotTypes.has(t.type)) { target = id; break; }
    }
    if (!target) {
      for (const [id, t] of state.tiles) {
        if (t.blockedBy.size === 0) { target = id; break; }
      }
    }
    if (target) {
      handleClick(target);
      setTimeout(tick, 250);
    }
  };
  setTimeout(tick, 600);
}

if (rejectMode) {
  // 找一張被擋住的 tile → 反覆點下去（讓截圖隨時都抓到抖動 + 紅光）
  setTimeout(() => {
    let blockedId = null;
    for (const [id, t] of state.tiles) {
      if (t.blockedBy.size > 0) { blockedId = id; break; }
    }
    if (blockedId) {
      const bang = () => {
        if (aq.isIdle()) handleClick(blockedId);
        setTimeout(bang, 100);
      };
      bang();
    }
  }, 400);
}

// ?modal=won|lost：直接秀對應的勝負 modal（截圖驗收用）
const modalMode = params.get('modal');
if (modalMode === 'won' || modalMode === 'lost') {
  setTimeout(() => showModal(modalMode), 300);
}

function handleClick(tileId) {
  if (!tileId) return;
  if (!aq.isIdle()) return;            // 動畫播放期間鎖點擊
  if (state.status !== 'playing') return;
  const result = pickTile(state, tileId);
  scheduleEvents(result.events, aq, state, renderer.coords, () => performance.now());

  // status:changed 由 game 回傳了，但動畫播完才秀 modal，等 idle 再檢查
  if (state.status !== 'playing') {
    waitIdleThen(() => showModal(state.status));
  }
}

function waitIdleThen(fn) {
  const tick = () => (aq.isIdle() ? fn() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}

function showModal(status) {
  modalText.textContent = status === 'won' ? '通關了！🍜' : '待消區滿了，再試一次';
  modal.classList.add('open');
}

function restart() {
  // MVP：直接重整頁面，避免重綁 listeners 與 renderer state 殘留問題
  location.reload();
}
