// 逆向生成器：先決定一個合法的「消除順序」→ 反推牌種指派，
// 保證至少存在一條照此順序遊玩、待消區只用 3 格就能通關的解。
//
// 步驟：
//   1. 用 bbox + layer 算靜態遮擋（高 layer 蓋低 layer，bbox 重疊就算遮擋）
//   2. 拓樸排序：每步從目前無遮擋的 tile 中，依 PRNG 隨機挑一張「移除」
//   3. 把消除順序切成 18 組三連，每組指派同一個 type（types 採 round-robin）
//   4. 重置 blockedBy/blocking 回到初始狀態並回傳 tiles Map
//
// 為什麼一定可解：玩家只要照生成器決定的順序點，就會把 3 張同 type 連續放進待消區，
// 立即湊齊三同 → 待消區任一刻最多 3 張 → 永遠不會塞滿 7 格。

import { buildLayout, pickRandomPreset } from './layout.js';
import { computeBlocking } from './board.js';

// mulberry32：種子 → 0~1 的偽隨機，純函式、可重現。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {import('./types.js').GameConfig} config
 * @returns {{ tiles: Map<string, import('./types.js').Tile>, plan: string[] }}
 */
export function generateGame(config) {
  const seed = config.seed ?? Date.now();
  const rand = mulberry32(seed);
  // preset：明確指定就用，否則同難度隨機挑（同種子可重現）
  const preset = config.layoutPreset ?? pickRandomPreset(rand);
  const layout = buildLayout(config.difficulty, preset);
  if (layout.length !== config.tileCount) {
    throw new Error(`layout "${preset}" has ${layout.length} slots but tileCount=${config.tileCount}`);
  }

  const tiles = new Map();
  for (let i = 0; i < layout.length; i++) {
    const slot = layout[i];
    tiles.set(`t${i}`, {
      id: `t${i}`,
      type: '',
      layer: slot.layer,
      x: slot.x,
      y: slot.y,
      w: config.tileWidth,
      h: config.tileHeight,
      blockedBy: new Set(),
      blocking: new Set(),
    });
  }
  computeBlocking(tiles);

  const removalOrder = topoRemovalOrder(tiles, rand);
  assignTypesByTriplet(removalOrder, config.foodTypes);

  // 拓樸排序時 mutate 了 blockedBy，重新算回來給遊戲執行期使用
  computeBlocking(tiles);
  return { tiles, plan: removalOrder.map((t) => t.id) };
}

function topoRemovalOrder(tiles, rand) {
  const working = new Map();
  for (const [id, t] of tiles) {
    working.set(id, { id, blockedBy: new Set(t.blockedBy), blocking: new Set(t.blocking) });
  }
  const order = [];
  while (working.size > 0) {
    const free = [];
    for (const [id, t] of working) if (t.blockedBy.size === 0) free.push(id);
    if (free.length === 0) {
      throw new Error('layout has cycle: no free tile but tiles remain');
    }
    const pick = free[Math.floor(rand() * free.length)];
    const node = working.get(pick);
    for (const belowId of node.blocking) {
      const below = working.get(belowId);
      if (below) below.blockedBy.delete(pick);
    }
    working.delete(pick);
    order.push(tiles.get(pick));
  }
  return order;
}

function assignTypesByTriplet(removalOrder, foodTypes) {
  if (removalOrder.length % 3 !== 0) {
    throw new Error(`removalOrder length ${removalOrder.length} not multiple of 3`);
  }
  const groupCount = removalOrder.length / 3;
  for (let g = 0; g < groupCount; g++) {
    const type = foodTypes[g % foodTypes.length];
    removalOrder[g * 3].type = type;
    removalOrder[g * 3 + 1].type = type;
    removalOrder[g * 3 + 2].type = type;
  }
}
