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

// debug：?autoplay=N 會自動照 plan 點 N 步（測試動畫 / 截圖用）
const autoplayN = Number(new URLSearchParams(location.search).get('autoplay') ?? 0);
if (autoplayN > 0) {
  let i = 0;
  const tick = () => {
    if (i >= autoplayN || state.status !== 'playing') return;
    if (!aq.isIdle()) {
      requestAnimationFrame(tick);
      return;
    }
    handleClick(state.plan[i]);
    i++;
    setTimeout(tick, 250);
  };
  setTimeout(tick, 600);
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
