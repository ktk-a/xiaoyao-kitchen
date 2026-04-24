// 對外 API：createGame / pickTile / getStatus。
// 純 JS、無 DOM、無 Canvas 依賴。frontend 只接 events 做動畫。

import { DEFAULT_CONFIG, validateConfig } from './config.js';
import { generateGame } from './generator.js';
import { isPickable, removeTileFromBoard } from './board.js';
import { insertToSlot, findTriple, clearTriple } from './slot.js';
import { EventType, makeEvent } from './events.js';

/**
 * @param {Partial<import('./types.js').GameConfig>} [overrides]
 * @returns {import('./types.js').GameState}
 */
export function createGame(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  validateConfig(config);
  const { tiles, plan } = generateGame(config);
  return {
    config,
    tiles,
    slot: [],
    status: 'playing',
    remainingCount: tiles.size,
    plan,
  };
}

/**
 * @param {import('./types.js').GameState} state
 * @param {string} tileId
 * @returns {import('./types.js').PickResult}
 */
export function pickTile(state, tileId) {
  if (state.status !== 'playing') {
    return { ok: false, reason: 'not_playing', events: [] };
  }
  const tile = state.tiles.get(tileId);
  if (!tile) {
    return { ok: false, reason: 'unknown_tile', events: [] };
  }
  if (!isPickable(tile)) {
    return {
      ok: false,
      reason: 'blocked',
      events: [makeEvent(EventType.TilePicked, { tileId, blocked: true, blockedBy: [...tile.blockedBy] })],
    };
  }
  if (state.slot.length >= state.config.slotCapacity) {
    // 防呆：理論上 status 已經會變 lost，這裡只是收尾
    return { ok: false, reason: 'slot_full', events: [] };
  }

  // 流程順序鎖定：insert → match 檢查 → lose 檢查。
  // 「第 7 張剛好湊三同」必算贏不算敗 — 因為 clearTriple 會把 slot.length 降回 4，
  // computeStatus 之後才看 slot.length >= capacity，所以此時不會誤判 lost。
  // 千萬不要把 lose 檢查搬到 match 前面。
  const events = [];
  events.push(makeEvent(EventType.TilePicked, { tileId, blocked: false }));

  const unblockedIds = removeTileFromBoard(state.tiles, tileId);
  if (unblockedIds.length > 0) {
    events.push(makeEvent(EventType.TileUnblocked, { tileIds: unblockedIds }));
  }

  const slotIndex = insertToSlot(state.slot, tile);
  events.push(
    makeEvent(EventType.SlotInserted, {
      tileId,
      type: tile.type,
      slotIndex,
      slotLength: state.slot.length,
    }),
  );

  const tripleType = findTriple(state.slot);
  if (tripleType) {
    const { cleared, shifts } = clearTriple(state.slot, tripleType);
    state.remainingCount -= cleared.length;
    events.push(
      makeEvent(EventType.MatchCleared, {
        type: tripleType,
        tileIds: cleared.map((c) => c.tile.id),
        slotIndices: cleared.map((c) => c.index),
      }),
    );
    if (shifts.length > 0) {
      events.push(makeEvent(EventType.SlotShifted, { shifts }));
    }
  }

  const nextStatus = computeStatus(state);
  if (nextStatus !== state.status) {
    state.status = nextStatus;
    events.push(makeEvent(EventType.StatusChanged, { status: nextStatus }));
  }
  return { ok: true, events };
}

/**
 * @param {import('./types.js').GameState} state
 * @returns {import('./types.js').GameStatus}
 */
export function getStatus(state) {
  return state.status;
}

function computeStatus(state) {
  if (state.tiles.size === 0 && state.slot.length === 0) return 'won';
  if (state.slot.length >= state.config.slotCapacity) return 'lost';
  return 'playing';
}
