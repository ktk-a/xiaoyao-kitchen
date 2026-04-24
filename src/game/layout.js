// 牌面位置：固定座標（邏輯座標、左上原點、+x 右、+y 下）。
// 每個 (preset × difficulty) 組合是一張靜態 layer-shape 表。
//
// Layer shape spec 兩種寫法：
//   ① rect:    [cols, rows, xOff, yOff]
//      → 從 (xOff, yOff) 開始畫 cols × rows 的矩形 grid
//   ② rhombus: { rh: number[], xCenter, yStart }
//      → 多行不等寬，每行中心對齊 xCenter，第 i 行有 rh[i] 張、y = yStart + i*TILE
//
// pyramid / butterfly 用 rect；diamond 用 rhombus 在同 Y 區疊層做菱形剪影 + 立體遮擋。

/**
 * @typedef {Object} LayoutSlot
 * @property {number} x
 * @property {number} y
 * @property {number} layer
 */

const TILE = 64; // 與 config.tileWidth/tileHeight 對齊
const HALF = TILE / 2;

const LAYOUT_SHAPES = {
  // --- pyramid: 經典中央金字塔 ---
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

  // --- diamond: 菱形剪影 + 同 Y 區疊層（pyramid-style 立體感） ---
  diamond: {
    easy: [   // 36
      { rh: [2, 4, 4, 2], xCenter: 128, yStart: 0 },     // 12  L0 底層菱形
      { rh: [3, 4, 3],    xCenter: 128, yStart: 32 },    // 10  L1 inset 半張
      { rh: [3, 3, 2],    xCenter: 128, yStart: 64 },    //  8  L2
      { rh: [3, 3],       xCenter: 128, yStart: 96 },    //  6  L3 頂層
    ],
    normal: [  // 54
      { rh: [2, 4, 4, 2],    xCenter: 192, yStart: 0 },   // 12  L0
      { rh: [3, 4, 4, 3],    xCenter: 192, yStart: 32 },  // 14  L1（最寬中間）
      { rh: [3, 3, 3, 3],    xCenter: 192, yStart: 64 },  // 12  L2
      { rh: [2, 3, 3, 2],    xCenter: 192, yStart: 96 },  // 10  L3
      { rh: [3, 3],          xCenter: 192, yStart: 128 }, //  6  L4 頂層小塊
    ],
    hard: [   // 90
      { rh: [3, 5, 5, 3], xCenter: 256, yStart: 0 },      // 16  L0
      { rh: [4, 5, 5, 4], xCenter: 256, yStart: 32 },     // 18  L1（最寬）
      { rh: [3, 4, 4, 3], xCenter: 256, yStart: 64 },     // 14  L2
      { rh: [3, 4, 4, 3], xCenter: 256, yStart: 96 },     // 14  L3
      { rh: [3, 4, 3],    xCenter: 256, yStart: 128 },    // 10  L4
      { rh: [3, 3, 3],    xCenter: 256, yStart: 160 },    //  9  L5
      { rh: [3, 3, 3],    xCenter: 256, yStart: 192 },    //  9  L6
    ],
  },

  // --- butterfly: 左右兩翼 + 中央連接 ---
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
      [3, 3, 0, 0],      // 9  左翼底
      [3, 3, 256, 0],    // 9  右翼底
      [4, 2, 32, 32],    // 8  左 L1
      [4, 2, 224, 32],   // 8  右 L1
      [3, 2, 64, 64],    // 6  左 L2
      [3, 2, 256, 64],   // 6  右 L2
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
      [4, 3, 192, 32],   // 12 中央連接
    ],
  },
};

export const LAYOUT_PRESET_KEYS = Object.keys(LAYOUT_SHAPES);

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
  shapes.forEach((spec, layerIdx) => {
    if (Array.isArray(spec)) {
      const [cols, rows, xOff, yOff] = spec;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          slots.push({ x: xOff + col * TILE, y: yOff + row * TILE, layer: layerIdx });
        }
      }
    } else if (spec.rh) {
      // rhombus 行：每行 count 張，中心對齊 xCenter；count 偶數時兩側剛好半張位移
      spec.rh.forEach((count, rowIdx) => {
        const rowWidth = count * TILE;
        const xStart = spec.xCenter - rowWidth / 2;
        for (let col = 0; col < count; col++) {
          slots.push({
            x: xStart + col * TILE,
            y: spec.yStart + rowIdx * TILE,
            layer: layerIdx,
          });
        }
      });
    }
  });

  // 正規化：把所有座標平移成 minX = minY = 0
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
