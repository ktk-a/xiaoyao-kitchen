// Canvas 渲染：把 game state + RenderState（動畫覆蓋層）畫成一幀。
// 邏輯座標 → Canvas px 換算集中在這裡，game / animation 都不直接碰 px。

import {
  drawWoodBackground,
  drawTileFrame,
  drawFoodTile,
  PALETTE,
} from './sprites.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../game/layout.js';

const SLOT_GAP = 24;        // 板子下方到待消區的間距（邏輯點）
const SLOT_TOP_PAD = 12;    // 待消區上方標籤空間
const SIDE_PAD = 32;        // 兩側留白
const TOP_PAD = 32;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../game/types.js').GameState} state
 */
export function createRenderer(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { tileWidth: TW, tileHeight: TH, slotCapacity } = state.config;

  const slotW = slotCapacity * TW;
  const logicalW = Math.max(BOARD_WIDTH, slotW) + SIDE_PAD * 2;
  const logicalH = TOP_PAD + BOARD_HEIGHT + SLOT_GAP + SLOT_TOP_PAD + TH + 24;

  // 設備像素比放大，畫面銳利
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const displayScale = 1.6; // 邏輯點 → CSS px 倍率
  canvas.width = logicalW * displayScale * dpr;
  canvas.height = logicalH * displayScale * dpr;
  canvas.style.width = `${logicalW * displayScale}px`;
  canvas.style.height = `${logicalH * displayScale}px`;
  ctx.scale(displayScale * dpr, displayScale * dpr);

  // 預先 render 食材牌的快取（每種一張，用完就 drawImage）
  const tileCache = new Map();
  for (const food of state.config.foodTypes) {
    const off = createOffscreen(TW, TH);
    drawFoodTile(off.ctx, TW, TH, food);
    tileCache.set(food, off.canvas);
  }
  const emptyFrame = createOffscreen(TW, TH);
  drawTileFrame(emptyFrame.ctx, TW, TH);

  // 背景快取（重畫成本不低，cache 起來）
  const bg = createOffscreen(logicalW, logicalH);
  drawWoodBackground(bg.ctx, logicalW, logicalH);

  // 邏輯座標下的「板子起始 (x, y)」、待消區起始 y
  const boardX = (logicalW - BOARD_WIDTH) / 2;
  const boardY = TOP_PAD;
  const slotX = (logicalW - slotW) / 2;
  const slotY = boardY + BOARD_HEIGHT + SLOT_GAP + SLOT_TOP_PAD;

  /** @type {RenderState} */
  const fx = {
    tileFx: new Map(),
    slotFx: new Map(),
    flying: new Map(),     // 正在飛行（board → slot）的 tile，渲染由它接管
    flashes: [],
    slotShake: 0,
  };

  function frame(nowMs) {
    // 清掉舊的動畫覆蓋（非進行中的）
    cullExpired(fx, nowMs);

    ctx.clearRect(0, 0, logicalW, logicalH);
    ctx.drawImage(bg.canvas, 0, 0);

    drawHeader(ctx, logicalW, state);
    drawSlotTrack(ctx, slotX, slotY, slotCapacity, TW, TH, fx.slotShake);

    // 板子的牌：低 layer 先畫；飛行中的 tile 跳過（已不在 state.tiles 但仍可能在 fx.flying）
    const tilesByLayer = [...state.tiles.values()].sort((a, b) => a.layer - b.layer || a.y - b.y);
    for (const t of tilesByLayer) {
      if (fx.flying.has(t.id)) continue;
      drawBoardTile(ctx, t, fx, tileCache, boardX, boardY, TW, TH);
    }

    // 待消區的牌（drawSlotTile 內部也會跳過 fx.flying 中的）
    state.slot.forEach((t, i) => {
      drawSlotTile(ctx, t, i, fx, tileCache, slotX, slotY, TW, TH);
    });

    // 飛行中的 tile：在所有 board / slot 之上畫（從 board 飛到 slot 的中段）
    for (const fly of fx.flying.values()) {
      drawFlyingTile(ctx, fly, tileCache, TW, TH);
    }

    // flashes（在所有 tile 上層）
    for (const f of fx.flashes) drawFlash(ctx, f, nowMs, boardX, boardY, slotX, slotY, TW, TH);

    // status overlay 由 main.js 處理（DOM modal）
  }

  return {
    frame,
    fx,
    coords: { boardX, boardY, slotX, slotY, logicalW, logicalH, TW, TH, displayScale, dpr },
  };
}

function createOffscreen(w, h) {
  // 環境兼容：瀏覽器有 OffscreenCanvas 時用，否則退回 document.createElement
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(w, h);
    return { canvas: oc, ctx: oc.getContext('2d') };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

function drawHeader(ctx, w, state) {
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 16px "Noto Serif TC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('逍遙大食堂', w / 2, 22);
  ctx.font = '11px "Noto Serif TC", serif';
  ctx.fillStyle = '#e8d8b8';
  ctx.fillText(`剩餘 ${state.remainingCount} / ${state.config.tileCount}`, w / 2, 36);
}

function drawSlotTrack(ctx, x, y, cap, tw, th, shake) {
  // 待消區的木盤底
  ctx.save();
  if (shake !== 0) ctx.translate(shake, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 6, y - 6, cap * tw + 12, th + 12);
  // 7 個 slot 凹槽
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = 'rgba(255,240,210,0.06)';
    ctx.fillRect(x + i * tw + 1, y + 1, tw - 2, th - 2);
    ctx.strokeStyle = 'rgba(255,240,210,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i * tw + 0.5, y + 0.5, tw - 1, th - 1);
  }
  ctx.restore();
}

function drawBoardTile(ctx, tile, fx, tileCache, boardX, boardY, TW, TH) {
  const eff = fx.tileFx.get(tile.id);
  const alpha = eff?.alpha ?? 1;
  if (alpha <= 0.01) return;
  const dx = eff?.dx ?? 0;
  const dy = eff?.dy ?? 0;
  const scale = eff?.scale ?? 1;
  const sprite = tileCache.get(tile.type);
  if (!sprite) return;

  const px = boardX + tile.x + dx;
  const py = boardY + tile.y + dy;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(px + TW / 2, py + TH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-TW / 2, -TH / 2);
  ctx.drawImage(sprite, 0, 0, TW, TH);
  // 被擋住的牌 → 暗化
  if (tile.blockedBy.size > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, TW, TH);
  }
  ctx.restore();
}

function drawSlotTile(ctx, tile, index, fx, tileCache, slotX, slotY, TW, TH) {
  // 飛行中的 tile 不在這裡畫（由 drawFlyingTiles 接手），避免雙畫
  if (fx.flying.has(tile.id)) return;
  const eff = fx.slotFx.get(tile.id);
  const alpha = eff?.alpha ?? 1;
  if (alpha <= 0.01) return;
  const dx = eff?.dx ?? 0;
  const dy = eff?.dy ?? 0;
  const sprite = tileCache.get(tile.type);
  if (!sprite) return;
  const renderIndex = eff?.indexOverride ?? index;
  const px = slotX + renderIndex * TW + dx;
  const py = slotY + dy;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, px, py, TW, TH);
  ctx.restore();
}

function drawFlyingTile(ctx, fly, tileCache, TW, TH) {
  const sprite = tileCache.get(fly.tile.type);
  if (!sprite) return;
  const alpha = fly.alpha ?? 1;
  const scale = fly.scale ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(fly.x + TW / 2, fly.y + TH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-TW / 2, -TH / 2);
  ctx.drawImage(sprite, 0, 0, TW, TH);
  ctx.restore();
}

function drawFlash(ctx, f, nowMs, boardX, boardY, slotX, slotY, TW, TH) {
  const t = (nowMs - f.startMs) / f.durMs;
  if (t < 0 || t > 1) return;
  const easeOut = 1 - Math.pow(1 - t, 3);
  if (f.kind === 'matchFlash') {
    // 在三個 slot 位置上閃黃白光
    for (const idx of f.slotIndices) {
      const px = slotX + idx * TW;
      const py = slotY;
      ctx.save();
      ctx.globalAlpha = (1 - easeOut) * 0.7;
      const grad = ctx.createRadialGradient(
        px + TW / 2, py + TH / 2, 0,
        px + TW / 2, py + TH / 2, TW * (0.5 + easeOut * 0.6),
      );
      grad.addColorStop(0, 'rgba(255, 235, 160, 0.9)');
      grad.addColorStop(1, 'rgba(255, 235, 160, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - TW / 2, py - TH / 2, TW * 2, TH * 2);
      ctx.restore();
    }
  } else if (f.kind === 'unblockGlow') {
    // 在新解鎖的牌上閃綠光
    for (const tile of f.tiles) {
      const px = boardX + tile.x;
      const py = boardY + tile.y;
      ctx.save();
      ctx.globalAlpha = (1 - easeOut) * 0.6;
      ctx.fillStyle = 'rgba(170, 255, 180, 0.5)';
      ctx.fillRect(px, py, TW, TH);
      ctx.strokeStyle = 'rgba(220, 255, 200, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TW - 2, TH - 2);
      ctx.restore();
    }
  } else if (f.kind === 'rejectShake') {
    // 拒絕抖動：在 tile 上紅光
    const tile = f.tile;
    const shake = Math.sin(t * Math.PI * 6) * 4 * (1 - t);
    const px = boardX + tile.x + shake;
    const py = boardY + tile.y;
    ctx.save();
    ctx.globalAlpha = (1 - easeOut) * 0.6;
    ctx.fillStyle = 'rgba(220, 60, 50, 0.5)';
    ctx.fillRect(px, py, TW, TH);
    ctx.restore();
  }
}

function cullExpired(fx, nowMs) {
  fx.flashes = fx.flashes.filter((f) => nowMs - f.startMs < f.durMs);
}

/**
 * @typedef {Object} RenderState
 * @property {Map<string, {dx?: number, dy?: number, alpha?: number, scale?: number, indexOverride?: number}>} tileFx
 * @property {Map<string, {dx?: number, dy?: number, alpha?: number, indexOverride?: number}>} slotFx
 * @property {Map<string, {tile: any, x: number, y: number, alpha?: number, scale?: number}>} flying
 * @property {Array<any>} flashes
 * @property {number} slotShake
 */
