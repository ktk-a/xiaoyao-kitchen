// 遊戲設定 + 三檔難度。layoutPreset 由 layout.js 解讀，可後續加更多預設。

export const ALL_FOOD_TYPES = [
  'bowl', 'fish', 'shrimp', 'mushroom', 'veggie',
  'meat', 'dumpling', 'rice', 'egg',
];

/** @type {Record<string, import('./types.js').Difficulty>} */
export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    label: '簡單',
    tileCount: 36,
    layerCount: 4,
    foodTypes: ['bowl', 'fish', 'shrimp', 'mushroom', 'veggie'],
  },
  normal: {
    key: 'normal',
    label: '普通',
    tileCount: 54,
    layerCount: 5,
    foodTypes: ['bowl', 'fish', 'shrimp', 'mushroom', 'veggie', 'meat', 'dumpling'],
  },
  hard: {
    key: 'hard',
    label: '困難',
    tileCount: 90,
    layerCount: 7,
    foodTypes: [
      'bowl', 'fish', 'shrimp', 'mushroom', 'veggie',
      'meat', 'dumpling', 'rice', 'egg',
    ],
  },
};

/** @type {import('./types.js').GameConfig} */
export const DEFAULT_CONFIG = {
  slotCapacity: 7,
  tileWidth: 64,
  tileHeight: 64,
  difficulty: DIFFICULTIES.normal,
};

/**
 * 把難度欄位攤平進 config，方便下游用。
 * @param {Partial<import('./types.js').GameConfig>} overrides
 * @returns {import('./types.js').GameConfig}
 */
export function resolveConfig(overrides = {}) {
  const base = { ...DEFAULT_CONFIG, ...overrides };
  // overrides 可以塞 difficultyKey 字串或整個 difficulty 物件
  if (typeof base.difficulty === 'string') {
    const found = DIFFICULTIES[base.difficulty];
    if (!found) throw new Error(`unknown difficulty: ${base.difficulty}`);
    base.difficulty = found;
  }
  base.tileCount = base.difficulty.tileCount;
  base.foodTypes = base.difficulty.foodTypes;
  base.layerCount = base.difficulty.layerCount;
  return base;
}

export function validateConfig(cfg) {
  if (cfg.tileCount % 3 !== 0) {
    throw new Error(`tileCount must be multiple of 3, got ${cfg.tileCount}`);
  }
  if (!cfg.foodTypes || cfg.foodTypes.length < 1) {
    throw new Error(`foodTypes must have at least 1 entry`);
  }
  if (cfg.slotCapacity < 3) {
    throw new Error(`slotCapacity must be >= 3`);
  }
}
