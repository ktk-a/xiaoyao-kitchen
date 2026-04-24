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

let state = createGame();
let renderer = createRenderer(canvas, state);
let aq = createAnimQueue(renderer.fx);

bindClick(canvas, state, renderer.coords, handleClick);
restartBtn.addEventListener('click', restart);

// 主迴圈
function loop(now) {
  aq.step();
  renderer.frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// debug 模式（測試 / 截圖用）
const params = new URLSearchParams(location.search);
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
