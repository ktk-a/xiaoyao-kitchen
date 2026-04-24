/** @type {import('./types.js').GameConfig} */
export const DEFAULT_CONFIG = {
  slotCapacity: 7,
  tileCount: 54,
  foodTypes: ['bowl', 'fish', 'shrimp', 'mushroom', 'veggie', 'meat', 'dumpling'],
  tileWidth: 64,
  tileHeight: 64,
};

export function validateConfig(cfg) {
  if (cfg.tileCount % 3 !== 0) {
    throw new Error(`tileCount must be multiple of 3, got ${cfg.tileCount}`);
  }
  if (cfg.foodTypes.length < 1) {
    throw new Error(`foodTypes must have at least 1 entry`);
  }
  if (cfg.slotCapacity < 3) {
    throw new Error(`slotCapacity must be >= 3`);
  }
}
