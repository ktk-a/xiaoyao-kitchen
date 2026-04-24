// 牌面位置：固定座標（邏輯座標、左上原點、+x 右、+y 下）。
// 每個 (preset × difficulty) 組合是一張靜態 layer-shape 表。
// 之後 ③ 加新 preset 直接擴 LAYOUT_SHAPES 即可。

/**
 * @typedef {Object} LayoutSlot
 * @property {number} x
 * @property {number} y
 * @property {number} layer
 */

const TILE = 64; // 與 config.tileWidth/tileHeight 對齊

// layer-shape 簡寫：[cols, rows, xOff, yOff]
// xOff/yOff 是該 layer 第一張 tile 的左上邏輯座標
// 高 layer 通常 inset + offset 半張，產生對下層的遮擋
// 每個 preset × difficulty 都是「layer shapes」陣列：[cols, rows, xOff, yOff]
// xOff / yOff 是該 layer 第一張 tile 的左上邏輯座標（單位：邏輯點）
const LAYOUT_SHAPES = {
  // --- pyramid: 經典中央金字塔，每層越上越窄越靠中 ---
  pyramid: {
    easy: [
      [4, 3, 0, 0],     // 12
      [5, 2, 32, 32],   // 10
      [4, 2, 64, 64],   // 8
      [3, 2, 96, 96],   // 6
    ],
    normal: [
      [6, 4, 0, 0],     // 24
      [5, 3, 32, 32],   // 15
      [4, 2, 64, 64],   // 8
      [3, 2, 96, 96],   // 6
      [1, 1, 160, 96],  // 1
    ],
    hard: [
      [8, 3, 0, 0],     // 24
      [7, 3, 32, 32],   // 21
      [6, 3, 64, 64],   // 18
      [5, 2, 96, 96],   // 10
      [4, 2, 128, 128], // 8
      [3, 2, 160, 160], // 6
      [3, 1, 192, 192], // 3
    ],
  },

  // --- diamond: 寬底寬頂、中間更寬，菱形剪影感 ---
  diamond: {
    easy: [
      [4, 2, 0, 0],     // 8  底層窄
      [5, 2, -32, 64],  // 10 中下層寬
      [5, 2, -32, 128], // 10 中上層寬
      [4, 2, 0, 192],   // 8  頂層窄  → 形成菱形剪影
    ],
    normal: [
      [5, 2, 0, 0],     // 10
      [7, 2, -64, 64],  // 14 寬肩
      [7, 2, -64, 128], // 14 寬肩
      [5, 2, 0, 192],   // 10
      [3, 2, 64, 96],   // 6  中央懸浮小塊（最高 layer）
    ],
    hard: [
      [6, 2, 0, 0],     // 12
      [8, 2, -64, 64],  // 16
      [10, 2, -128, 128], // 20 最寬
      [8, 2, -64, 192], // 16
      [6, 2, 0, 256],   // 12
      [4, 2, 64, 128],  // 8 中央 layer 5
      [3, 2, 96, 160],  // 6 中央 layer 6
    ],
  },

  // --- butterfly: 左右兩坨對稱，中央懸浮一小塊 ---
  butterfly: {
    easy: [
      [3, 2, 0, 32],     // 6  左翼
      [3, 2, 192, 32],   // 6  右翼
      [3, 2, 32, 96],    // 6  左中
      [3, 2, 160, 96],   // 6  右中
      [3, 2, 64, 32],    // 6  中央上層
      [3, 2, 64, 160],   // 6  中央下層
    ],
    normal: [
      [3, 3, 0, 0],      // 9  左翼 base
      [3, 3, 256, 0],    // 9  右翼 base
      [4, 2, 32, 32],    // 8  左 layer 2
      [4, 2, 224, 32],   // 8  右 layer 2
      [3, 2, 64, 64],    // 6  左 layer 3
      [3, 2, 256, 64],   // 6  右 layer 3
      [4, 2, 160, 96],   // 8  中央連接
    ],
    hard: [
      [3, 4, 0, 0],      // 12 左翼底
      [3, 4, 320, 0],    // 12 右翼底
      [4, 3, 32, 32],    // 12 左 L1
      [4, 3, 288, 32],   // 12 右 L1
      [3, 3, 64, 64],    // 9  左 L2
      [3, 3, 320, 64],   // 9  右 L2
      [3, 2, 96, 96],    // 6  左 L3
      [3, 2, 320, 96],   // 6  右 L3
      [4, 3, 192, 32],   // 12 中央連接（覆蓋左右）
    ],
  },
};

export const LAYOUT_PRESET_KEYS = Object.keys(LAYOUT_SHAPES);

/**
 * 隨機挑一個 preset（同難度）。傳 seed-derived random 進來保證重現性。
 * @param {() => number} rand
 */
export function pickRandomPreset(rand = Math.random) {
  const idx = Math.floor(rand() * LAYOUT_PRESET_KEYS.length);
  return LAYOUT_PRESET_KEYS[idx];
}

/**
 * @param {{ key: string, layerCount: number }} difficulty
 * @param {string} [presetKey='pyramid']
 * @returns {LayoutSlot[]}
 */
export function buildLayout(difficulty, presetKey = 'pyramid') {
  const shapeSet = LAYOUT_SHAPES[presetKey];
  if (!shapeSet) throw new Error(`unknown layout preset: ${presetKey}`);
  const shapes = shapeSet[difficulty.key];
  if (!shapes) throw new Error(`preset "${presetKey}" missing shape for difficulty "${difficulty.key}"`);

  const slots = [];
  shapes.forEach(([cols, rows, xOff, yOff], layerIdx) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        slots.push({
          x: xOff + col * TILE,
          y: yOff + row * TILE,
          layer: layerIdx,
        });
      }
    }
  });
  // 正規化：把所有座標平移成 minX = minY = 0（因為某些 preset 用負 xOff）
  let minX = Infinity, minY = Infinity;
  for (const s of slots) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
  }
  for (const s of slots) {
    s.x -= minX;
    s.y -= minY;
  }
  return slots;
}

/**
 * 給 renderer 算出板子需要的邏輯尺寸（含所有 preset / difficulty 組合的最大值）
 * @param {{ key: string }} difficulty
 * @param {string} [presetKey]
 */
export function getBoardSize(difficulty, presetKey = 'pyramid') {
  const slots = buildLayout(difficulty, presetKey);
  let maxX = 0, maxY = 0;
  for (const s of slots) {
    maxX = Math.max(maxX, s.x + TILE);
    maxY = Math.max(maxY, s.y + TILE);
  }
  return { width: maxX, height: maxY };
}
