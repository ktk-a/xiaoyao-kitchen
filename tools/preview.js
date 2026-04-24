// 用 @napi-rs/canvas 把 sprites.js 渲染成一張預覽 PNG，方便丟頻道給 PM 看方向。
// 跑法：bun run tools/preview.js

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import {
  drawWoodBackground,
  drawTileFrame,
  drawFoodTile,
  PALETTE,
} from '../src/render/sprites.js';

const TILE = 64;
const COLS = 4;
const ROWS = 2; // 7 食材 + 1 空格示範
const PAD = 24;
const LABEL_H = 18;
const FOODS = ['bowl', 'fish', 'shrimp', 'mushroom', 'veggie', 'meat', 'dumpling'];

const W = COLS * (TILE + PAD) + PAD;
const H = ROWS * (TILE + PAD + LABEL_H) + PAD * 2 + 40;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// 木質背景
drawWoodBackground(ctx, W, H);

// 標題
ctx.fillStyle = PALETTE.cream;
ctx.font = 'bold 18px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('逍遙大食堂 — sprite 預覽 v0.2', W / 2, 28);

// 每張牌
FOODS.forEach((food, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PAD + col * (TILE + PAD);
  const y = 50 + PAD + row * (TILE + PAD + LABEL_H);

  // 畫一張完整食材牌（frame + 食材）
  ctx.save();
  ctx.translate(x, y);
  drawFoodTile(ctx, TILE, TILE, food);
  ctx.restore();

  // 食材名稱標籤
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(food, x + TILE / 2, y + TILE + 14);
});

// 第 8 格：空 frame 給比對
const i = 7;
const col = i % COLS;
const row = Math.floor(i / COLS);
const x = PAD + col * (TILE + PAD);
const y = 50 + PAD + row * (TILE + PAD + LABEL_H);
ctx.save();
ctx.translate(x, y);
drawTileFrame(ctx, TILE, TILE);
ctx.restore();
ctx.fillStyle = PALETTE.cream;
ctx.font = '12px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('(empty frame)', x + TILE / 2, y + TILE + 14);

const buf = canvas.toBuffer('image/png');
writeFileSync(new URL('./sprite_preview.png', import.meta.url), buf);
console.log(`wrote sprite_preview.png (${W}x${H})`);
