// 牌面位置：固定座標（邏輯座標、左上原點、+x 右、+y 下）。
// 五層金字塔，54 張，每層相對下層偏移半張，造成上層遮擋下層的 bbox。
// 邏輯尺寸 = 384 寬 × 256 高（單位＝邏輯點，不是 px）。

/**
 * @typedef {Object} LayoutSlot
 * @property {number} x
 * @property {number} y
 * @property {number} layer
 */

const LAYER_SHAPES = [
  // [layer, xStart, xStep, xCount, yStart, yStep, yCount]
  [0, 0, 64, 6, 0, 64, 4],     // 24
  [1, 32, 64, 5, 32, 64, 3],   // 15
  [2, 64, 64, 4, 64, 64, 2],   // 8
  [3, 96, 64, 3, 96, 64, 2],   // 6
  [4, 160, 0, 1, 96, 0, 1],    // 1
];

/** @returns {LayoutSlot[]} */
export function buildLayout() {
  const slots = [];
  for (const [layer, xStart, xStep, xCount, yStart, yStep, yCount] of LAYER_SHAPES) {
    for (let row = 0; row < yCount; row++) {
      for (let col = 0; col < xCount; col++) {
        slots.push({ x: xStart + col * xStep, y: yStart + row * yStep, layer });
      }
    }
  }
  return slots;
}

export const BOARD_WIDTH = 384;
export const BOARD_HEIGHT = 256;
