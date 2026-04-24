// 入口：bootstrap game + renderer + input + animation loop。

import { createGame, pickTile, getStatus, DIFFICULTIES } from './game/index.js';
import { createRenderer } from './render/renderer.js';
import { bindClick } from './input/click.js';
import { createAnimQueue } from './animation/queue.js';
import { scheduleEvents } from './animation/handlers.js';

const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const restartBtn = document.getElementById('restart');
const picker = document.getElementById('picker');

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const initialSeed = seedParam ? Number(seedParam) : undefined;
const difficultyParam = params.get('difficulty');

let state = null;
let renderer = null;
let aq = null;
let canvas = null;       // 每次 startGame 會換一張新的（清掉舊 listeners）
let loopStarted = false;

function loop(now) {
  if (renderer) {
    aq.step();
    renderer.frame(now);
  }
  requestAnimationFrame(loop);
}

function ensureLoop() {
  if (loopStarted) return;
  loopStarted = true;
  requestAnimationFrame(loop);
}

function startGame(difficultyKey) {
  picker.classList.add('hidden');
  modal.classList.remove('open');

  // 換一張新 canvas，把舊的 listeners 一起丟掉
  const old = document.getElementById('game');
  const fresh = document.createElement('canvas');
  fresh.id = 'game';
  old.parentNode.replaceChild(fresh, old);
  canvas = fresh;

  const overrides = { difficulty: difficultyKey };
  if (initialSeed !== undefined) overrides.seed = initialSeed;
  const presetParam = params.get('preset');
  if (presetParam) overrides.layoutPreset = presetParam;
  state = createGame(overrides);
  renderer = createRenderer(canvas, state);
  aq = createAnimQueue(renderer.fx);
  bindClick(canvas, state, renderer.coords, handleClick);

  ensureLoop();
}

function showPicker() {
  picker.classList.remove('hidden');
}

restartBtn.addEventListener('click', () => {
  modal.classList.remove('open');
  showPicker();
});

picker.querySelectorAll('.card[data-difficulty]').forEach((card) => {
  card.addEventListener('click', () => startGame(card.dataset.difficulty));
});

// 啟動：?difficulty=easy|normal|hard 跳過選單；否則秀選單等使用者點
if (difficultyParam && DIFFICULTIES[difficultyParam]) {
  startGame(difficultyParam);
} else {
  showPicker();
}

// ---- handlers ----

function handleClick(tileId) {
  if (!tileId) return;
  if (!aq.isIdle()) return;
  if (state.status !== 'playing') return;
  // pickTile 之前先把 board + slot 所有 tile 快照，handlers 拿不到 cleared tile 資料就無法畫動畫。
  const snapshot = new Map();
  for (const t of state.tiles.values()) snapshot.set(t.id, t);
  for (const t of state.slot) snapshot.set(t.id, t);
  const tileLookup = (id) => snapshot.get(id) ?? state.tiles.get(id) ?? state.slot.find((t) => t.id === id);

  const result = pickTile(state, tileId);
  scheduleEvents(result.events, aq, state, renderer.coords, () => performance.now(), tileLookup);

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

// ---- debug 模式 ----

const autoplayN = Number(params.get('autoplay') ?? 0);
const loseMode = params.get('lose') === '1';
const rejectMode = params.get('reject') === '1';
const freezeMs = Number(params.get('freeze') ?? -1);
const pickN = Number(params.get('pickN') ?? 1);
const modalMode = params.get('modal');

// freeze 模式取代主迴圈：同步點 N 張、推時鐘到 Tms、畫一幀就停
if (freezeMs >= 0 && state) {
  loopStarted = true; // 阻止 ensureLoop 啟動 rAF
  let virtualNow = 0;
  aq = createAnimQueue(renderer.fx, () => virtualNow);
  for (let i = 0; i < pickN; i++) {
    const id = state.plan[i];
    const snap = new Map();
    for (const t of state.tiles.values()) snap.set(t.id, t);
    for (const t of state.slot) snap.set(t.id, t);
    const r = pickTile(state, id);
    scheduleEvents(r.events, aq, state, renderer.coords, () => virtualNow, (id) => snap.get(id));
    virtualNow += 360;
  }
  virtualNow = (pickN - 1) * 360 + freezeMs;
  aq.step();
  renderer.frame(virtualNow);
}

if (autoplayN > 0 && state) {
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

if (loseMode && state) {
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

if (rejectMode && state) {
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

if (modalMode === 'won' || modalMode === 'lost') {
  setTimeout(() => showModal(modalMode), 300);
}
