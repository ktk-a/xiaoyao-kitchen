// 古風食材 sprite 生成。所有 draw* 函式都接 (ctx, w, h)，在 (0,0)–(w,h) 範圍內畫，
// 純 2D Canvas API，瀏覽器與 @napi-rs/canvas 都能跑。

export const PALETTE = {
  parchment: '#ede2c4',
  cream: '#f4e4c1',
  woodLight: '#a07f5a',
  woodMid: '#7c5e3d',
  woodDark: '#5c4630',
  outline: '#3d2a18',
  shrimp: '#e8806b',
  shrimpDark: '#b8543d',
  fish: '#88aac6',
  fishDark: '#5a7e9a',
  bowl: '#d9c39a',
  bowlDark: '#9b8155',
  mushroomCap: '#9b6745',
  mushroomCapDark: '#704826',
  mushroomStem: '#f0e0b8',
  veggie: '#7fa55a',
  veggieDark: '#52723a',
  meatPink: '#d8755e',
  meatFat: '#fae0c8',
  dumpling: '#efd49a',
  dumplingDark: '#b59054',
  riceLight: '#f8efd6',
  riceDark: '#d8c69a',
  riceBand: '#3a4a5a',  // 深色海苔帶
  eggWhite: '#fbf1d9',
  eggYolk: '#f3c34a',
  eggYolkDark: '#c89426',
};

const P = PALETTE;

// ---- 共用 ----

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---- 背景：木紋 ----

export function drawWoodBackground(ctx, w, h) {
  // 底色橫向漸層
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, P.woodMid);
  grad.addColorStop(1, P.woodDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 木紋線條：橫向、間距不規則、顏色微變
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 1;
  for (let y = 6; y < h; y += 6 + (Math.sin(y * 1.7) + 1) * 4) {
    ctx.globalAlpha = 0.18 + Math.sin(y * 0.3) * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, y);
    let x = 0;
    while (x < w) {
      const dy = Math.sin(x * 0.05 + y * 0.1) * 1.5;
      x += 4;
      ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 高光：左上角微亮
  const hi = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.6);
  hi.addColorStop(0, 'rgba(255, 230, 180, 0.12)');
  hi.addColorStop(1, 'rgba(255, 230, 180, 0)');
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, w, h);
}

// ---- Tile 外框（每張牌的底） ----

export function drawTileFrame(ctx, w, h) {
  // 主體 cream，鋪滿整個 sprite 不留外框 offset。先用真 shadowBlur 畫一層柔陰影，
  // 完全包在 body footprint 內，避免之前 offset roundRect 在右/下邊緣留下硬黑條。
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, P.cream);
  grad.addColorStop(1, P.parchment);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = grad;
  roundRect(ctx, 1, 1, w - 2, h - 2, 8);
  ctx.fill();
  ctx.restore();

  // 內邊框
  ctx.strokeStyle = P.woodLight;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 3, 3, w - 6, h - 6, 6);
  ctx.stroke();

  // 內角落朱紅小點（古風印章感）
  ctx.fillStyle = '#a8442a';
  ctx.beginPath();
  ctx.arc(w - 7, 7, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---- 食材 sprites（畫在已有 tile frame 上，自己 inset） ----

const INSET = 8; // 食材繪圖區距離 tile 邊緣

function withInset(ctx, w, h, fn) {
  const iw = w - INSET * 2;
  const ih = h - INSET * 2 - 4; // 預留底部陰影位
  ctx.save();
  ctx.translate(INSET, INSET);
  fn(ctx, iw, ih);
  ctx.restore();
}

function strokeOutline(ctx, lw = 1.5) {
  ctx.strokeStyle = P.outline;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// bowl 碗（俯視）
export function drawBowl(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 2;
    const rx = iw * 0.42;
    const ry = ih * 0.32;
    // 外圈
    c.fillStyle = P.bowlDark;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    // 內碗
    c.fillStyle = P.bowl;
    c.beginPath();
    c.ellipse(cx, cy, rx - 3, ry - 2.5, 0, 0, Math.PI * 2);
    c.fill();
    // 內陰影（半月）
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.beginPath();
    c.ellipse(cx, cy + 1.5, rx - 4, ry - 4, 0, 0, Math.PI, true);
    c.fill();
    // 高光
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(cx - rx * 0.3, cy - ry * 0.3, rx * 0.4, ry * 0.25, -0.3, 0, Math.PI);
    c.stroke();
  });
}

// fish 魚
export function drawFish(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2;
    // 身體（橢圓）
    c.fillStyle = P.fish;
    c.beginPath();
    c.ellipse(cx - 2, cy, iw * 0.32, ih * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    strokeOutline(c);
    // 尾巴
    c.fillStyle = P.fishDark;
    c.beginPath();
    c.moveTo(cx - iw * 0.32 - 2, cy);
    c.lineTo(cx - iw * 0.46 - 2, cy - ih * 0.22);
    c.lineTo(cx - iw * 0.46 - 2, cy + ih * 0.22);
    c.closePath();
    c.fill();
    strokeOutline(c);
    // 眼睛
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(cx + iw * 0.18, cy - 2, 2.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = P.outline;
    c.beginPath();
    c.arc(cx + iw * 0.19, cy - 2, 1.2, 0, Math.PI * 2);
    c.fill();
    // 鰓線
    c.strokeStyle = P.fishDark;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + iw * 0.05, cy - ih * 0.15);
    c.quadraticCurveTo(cx + iw * 0.02, cy, cx + iw * 0.05, cy + ih * 0.15);
    c.stroke();
  });
}

// shrimp 蝦（俯視捲蝦：環狀身體 + 腹節 + 鬚）
export function drawShrimp(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 1;
    const r = Math.min(iw, ih) * 0.34;
    // 身體：粗環（環內留洞）
    const innerR = r * 0.45;
    // 環本體（粉色），用 path 繞兩圈反向 fill 出甜甜圈
    c.fillStyle = P.shrimp;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    c.fill('evenodd');
    // 環外描邊
    c.strokeStyle = P.outline;
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, innerR, 0, Math.PI * 2);
    c.stroke();
    // 腹節：6 道徑向短線從內圈到外圈
    c.strokeStyle = P.shrimpDark;
    c.lineWidth = 1;
    const segs = 7;
    // 留一個缺口給「頭」
    for (let i = 0; i < segs; i++) {
      const ang = (i / segs) * Math.PI * 2 - Math.PI / 2 + 0.4;
      const x1 = cx + Math.cos(ang) * (innerR + 1);
      const y1 = cy + Math.sin(ang) * (innerR + 1);
      const x2 = cx + Math.cos(ang) * (r - 1);
      const y2 = cy + Math.sin(ang) * (r - 1);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
    // 頭部（深色小圓）
    const headAng = -Math.PI / 2;
    const hx = cx + Math.cos(headAng) * r;
    const hy = cy + Math.sin(headAng) * r;
    c.fillStyle = P.shrimpDark;
    c.beginPath();
    c.arc(hx, hy, 3, 0, Math.PI * 2);
    c.fill();
    // 鬚（兩根短曲線）
    c.strokeStyle = P.outline;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(hx - 1, hy - 1);
    c.quadraticCurveTo(hx - 5, hy - 6, hx - 7, hy - 9);
    c.stroke();
    c.beginPath();
    c.moveTo(hx + 1, hy - 1);
    c.quadraticCurveTo(hx + 5, hy - 6, hx + 7, hy - 9);
    c.stroke();
    // 眼睛白點
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(hx - 1, hy - 0.5, 0.7, 0, Math.PI * 2);
    c.fill();
  });
}

// mushroom 蘑菇
export function drawMushroom(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2;
    // 蕈柄
    c.fillStyle = P.mushroomStem;
    c.beginPath();
    c.moveTo(cx - iw * 0.12, cy + 2);
    c.quadraticCurveTo(cx - iw * 0.1, cy + ih * 0.32, cx - iw * 0.08, cy + ih * 0.4);
    c.lineTo(cx + iw * 0.08, cy + ih * 0.4);
    c.quadraticCurveTo(cx + iw * 0.1, cy + ih * 0.32, cx + iw * 0.12, cy + 2);
    c.closePath();
    c.fill();
    strokeOutline(c);
    // 蕈傘
    c.fillStyle = P.mushroomCap;
    c.beginPath();
    c.arc(cx, cy + 2, iw * 0.32, Math.PI, 0);
    c.lineTo(cx + iw * 0.32, cy + 4);
    c.lineTo(cx - iw * 0.32, cy + 4);
    c.closePath();
    c.fill();
    strokeOutline(c);
    // 蕈傘暗部
    c.fillStyle = P.mushroomCapDark;
    c.beginPath();
    c.ellipse(cx - iw * 0.18, cy + 4, iw * 0.13, 2, 0, 0, Math.PI * 2);
    c.fill();
    // 白點
    c.fillStyle = '#fbe9c9';
    [[-0.18, -0.1, 3], [0.05, -0.18, 4], [0.18, -0.05, 3]].forEach(([dx, dy, r]) => {
      c.beginPath();
      c.arc(cx + iw * dx, cy + ih * dy, r, 0, Math.PI * 2);
      c.fill();
    });
  });
}

// veggie 青菜（青江菜風）
export function drawVeggie(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 4;
    // 三片葉子
    const leaves = [
      { dx: -0.22, dy: -0.05, rot: -0.3, scale: 0.95 },
      { dx: 0.22, dy: -0.05, rot: 0.3, scale: 0.95 },
      { dx: 0, dy: -0.18, rot: 0, scale: 1.05 },
    ];
    for (const lf of leaves) {
      c.save();
      c.translate(cx + iw * lf.dx, cy + ih * lf.dy);
      c.rotate(lf.rot);
      c.scale(lf.scale, lf.scale);
      // 葉片
      c.fillStyle = P.veggie;
      c.beginPath();
      c.moveTo(0, ih * 0.25);
      c.bezierCurveTo(-iw * 0.18, ih * 0.05, -iw * 0.18, -ih * 0.25, 0, -ih * 0.32);
      c.bezierCurveTo(iw * 0.18, -ih * 0.25, iw * 0.18, ih * 0.05, 0, ih * 0.25);
      c.closePath();
      c.fill();
      strokeOutline(c);
      // 葉脈
      c.strokeStyle = P.veggieDark;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, ih * 0.22);
      c.lineTo(0, -ih * 0.28);
      c.stroke();
      c.restore();
    }
    // 根部白梗
    c.fillStyle = '#f4ecd0';
    c.beginPath();
    c.ellipse(cx, cy + ih * 0.3, iw * 0.18, ih * 0.08, 0, 0, Math.PI * 2);
    c.fill();
    strokeOutline(c);
  });
}

// meat 紅燒肉（三層疊塊：皮 + 肥 + 瘦）
export function drawMeat(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 4;
    // 三層尺寸：上層較窄，下層較寬，模擬蹄膀堆疊感
    const layers = [
      { y: cy + ih * 0.2, w: iw * 0.74, h: ih * 0.18, fill: '#7a3a26', stroke: P.outline }, // 底層醬色（紅燒醬）
      { y: cy + ih * 0.02, w: iw * 0.66, h: ih * 0.18, fill: P.meatFat, stroke: P.outline }, // 中層肥肉
      { y: cy - ih * 0.18, w: iw * 0.58, h: ih * 0.20, fill: P.meatPink, stroke: P.outline }, // 上層瘦肉/皮
    ];
    for (const L of layers) {
      c.fillStyle = L.fill;
      roundRect(c, cx - L.w / 2, L.y - L.h / 2, L.w, L.h, 6);
      c.fill();
      c.strokeStyle = L.stroke;
      c.lineWidth = 1.2;
      c.stroke();
    }
    // 上層光澤（醬汁反光）
    c.fillStyle = 'rgba(255, 200, 140, 0.5)';
    c.beginPath();
    c.ellipse(cx - iw * 0.08, cy - ih * 0.24, iw * 0.16, 1.8, 0, 0, Math.PI * 2);
    c.fill();
    // 底層醬汁滴
    c.fillStyle = '#5a2a18';
    c.beginPath();
    c.arc(cx + iw * 0.28, cy + ih * 0.3, 1.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx - iw * 0.26, cy + ih * 0.32, 1.2, 0, Math.PI * 2);
    c.fill();
  });
}

// dumpling 水餃（圓弧底 + 直線褶皺頂）
export function drawDumpling(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 6;
    const bodyW = iw * 0.78;
    const bodyH = ih * 0.55;
    // 身體：底為圓弧，頂為平直（水餃放平的側視）
    c.fillStyle = P.dumpling;
    c.beginPath();
    // 從左頂端沿著上邊到右頂端
    c.moveTo(cx - bodyW / 2, cy - bodyH * 0.05);
    c.lineTo(cx + bodyW / 2, cy - bodyH * 0.05);
    // 右側下沿圓弧到左側
    c.quadraticCurveTo(cx + bodyW * 0.55, cy + bodyH * 0.95, cx, cy + bodyH * 0.55);
    c.quadraticCurveTo(cx - bodyW * 0.55, cy + bodyH * 0.95, cx - bodyW / 2, cy - bodyH * 0.05);
    c.closePath();
    c.fill();
    strokeOutline(c, 1.4);
    // 頂部褶皺：3 條清楚直線（從邊緣往內微傾）
    c.strokeStyle = P.dumplingDark;
    c.lineWidth = 1.6;
    const pleatBase = cy - bodyH * 0.05;
    const pleatTop = cy - bodyH * 0.45;
    const pleatXs = [-bodyW * 0.22, 0, bodyW * 0.22];
    for (const dx of pleatXs) {
      c.beginPath();
      c.moveTo(cx + dx, pleatBase);
      c.lineTo(cx + dx * 0.5, pleatTop);
      c.stroke();
    }
    // 頂緣：在褶皺底部加一條淺淺的水平線強化「皮邊」
    c.strokeStyle = P.dumplingDark;
    c.lineWidth = 1;
    c.globalAlpha = 0.6;
    c.beginPath();
    c.moveTo(cx - bodyW / 2 + 2, pleatBase);
    c.lineTo(cx + bodyW / 2 - 2, pleatBase);
    c.stroke();
    c.globalAlpha = 1;
    // 底部光澤
    c.fillStyle = 'rgba(255,255,255,0.32)';
    c.beginPath();
    c.ellipse(cx - bodyW * 0.18, cy + bodyH * 0.45, bodyW * 0.18, 2, -0.15, 0, Math.PI * 2);
    c.fill();
  });
}

// rice 飯糰（三角飯糰，海苔帶）
export function drawRice(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 4;
    const tw = iw * 0.7;
    const th = ih * 0.7;
    // 三角主體（圓角）
    c.fillStyle = P.riceLight;
    c.beginPath();
    c.moveTo(cx, cy - th * 0.5);
    c.quadraticCurveTo(cx + tw * 0.55, cy + th * 0.45, cx + tw * 0.42, cy + th * 0.5);
    c.quadraticCurveTo(cx, cy + th * 0.55, cx - tw * 0.42, cy + th * 0.5);
    c.quadraticCurveTo(cx - tw * 0.55, cy + th * 0.45, cx, cy - th * 0.5);
    c.closePath();
    c.fill();
    strokeOutline(c, 1.4);
    // 米粒紋理（散布幾個小橢圓）
    c.fillStyle = P.riceDark;
    const dots = [[-0.1, -0.1], [0.12, -0.05], [-0.05, 0.1], [0.08, 0.15], [-0.18, 0.05]];
    for (const [dx, dy] of dots) {
      c.beginPath();
      c.ellipse(cx + tw * dx, cy + th * dy, 1.5, 1, 0.2, 0, Math.PI * 2);
      c.fill();
    }
    // 海苔帶
    c.fillStyle = P.riceBand;
    const bandY = cy + th * 0.18;
    const bandH = th * 0.22;
    c.fillRect(cx - tw * 0.4, bandY, tw * 0.8, bandH);
    c.strokeStyle = P.outline;
    c.lineWidth = 1;
    c.strokeRect(cx - tw * 0.4, bandY, tw * 0.8, bandH);
  });
}

// egg 蛋（俯視荷包蛋：蛋白橢圓 + 蛋黃圓）
export function drawEgg(ctx, w, h) {
  withInset(ctx, w, h, (c, iw, ih) => {
    const cx = iw / 2;
    const cy = ih / 2 + 2;
    // 蛋白：不規則橢圓（兩個圓疊一下模擬煎蛋形狀）
    c.fillStyle = P.eggWhite;
    c.beginPath();
    c.ellipse(cx, cy, iw * 0.36, ih * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx + iw * 0.08, cy + ih * 0.05, iw * 0.3, ih * 0.24, 0.3, 0, Math.PI * 2);
    c.fill();
    strokeOutline(c, 1.4);
    // 蛋黃
    c.fillStyle = P.eggYolk;
    c.beginPath();
    c.arc(cx - iw * 0.04, cy - ih * 0.02, iw * 0.16, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = P.eggYolkDark;
    c.lineWidth = 1;
    c.stroke();
    // 蛋黃高光
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(cx - iw * 0.1, cy - ih * 0.1, iw * 0.06, ih * 0.04, -0.4, 0, Math.PI * 2);
    c.fill();
  });
}

export const FOOD_DRAWERS = {
  bowl: drawBowl,
  fish: drawFish,
  shrimp: drawShrimp,
  mushroom: drawMushroom,
  veggie: drawVeggie,
  meat: drawMeat,
  dumpling: drawDumpling,
  rice: drawRice,
  egg: drawEgg,
};

// 便利：在一個 canvas 上完整畫一張食材牌（背景 frame + 食材）
export function drawFoodTile(ctx, w, h, foodType) {
  drawTileFrame(ctx, w, h);
  const drawer = FOOD_DRAWERS[foodType];
  if (!drawer) throw new Error(`unknown food type: ${foodType}`);
  drawer(ctx, w, h);
}
