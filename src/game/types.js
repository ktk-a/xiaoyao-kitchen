/**
 * @typedef {Object} Tile
 * @property {string} id
 * @property {string} type
 * @property {number} layer
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {Set<string>} blockedBy
 * @property {Set<string>} blocking
 */

/**
 * @typedef {Object} GameConfig
 * @property {number} slotCapacity
 * @property {number} tileCount
 * @property {string[]} foodTypes
 * @property {number} tileWidth
 * @property {number} tileHeight
 * @property {number} [seed]
 */

/**
 * @typedef {'playing'|'won'|'lost'} GameStatus
 */

/**
 * @typedef {Object} GameState
 * @property {GameConfig} config
 * @property {Map<string, Tile>} tiles
 * @property {Tile[]} slot
 * @property {GameStatus} status
 * @property {number} remainingCount
 */

/**
 * @typedef {Object} GameEvent
 * @property {string} type
 * @property {Object} [payload]
 */

/**
 * @typedef {Object} PickResult
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {GameEvent[]} events
 */

export {};
