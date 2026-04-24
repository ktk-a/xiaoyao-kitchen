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
const LAYOUT_SHAPES = {
  pyramid: {
    easy: [   // sum 36，board 256×192
      [4, 3, 0, 0],     // 12
      [5, 2, 32, 32],   // 10
      [4, 2, 64, 64],   // 8
      [3, 2, 96, 96],   // 6
    ],
    normal: [ // sum 54，board 384×256（沿用 v1.0）
      [6, 4, 0, 0],     // 24
      [5, 3, 32, 32],   // 15
      [4, 2, 64, 64],   // 8
      [3, 2, 96, 96],   // 6
      [1, 1, 160, 96],  // 1
    ],
    hard: [   // sum 90，board 640×256
      [10, 3, 0, 0],    // 30
      [5, 4, 32, 32],   // 20
      [4, 4, 64, 64],   // 16
      [6, 2, 96, 96],   // 12
      [4, 2, 128, 128], // 8
      [3, 1, 160, 160], // 3
      [1, 1, 288, 96],  // 1
    ],
  },
};

export const LAYOUT_PRESET_KEYS = Object.keys(LAYOUT_SHAPES);

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
