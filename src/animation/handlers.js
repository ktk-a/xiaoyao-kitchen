// 把 GameEvent 串轉成一連串 Tween，依序排程到 animQueue。
// 每個 handler 知道前面累積的 timeShift，回傳「下一個 event 的起始位移」。

import { EventType } from '../game/events.js';

const T_PICK = 140;
const T_UNBLOCK = 200;
const T_INSERT = 220;
const T_MATCH = 320;
const T_SHIFT = 200;
const T_REJECT = 250;

/**
 * @param {import('../game/types.js').GameEvent[]} events
 * @param {ReturnType<typeof import('./queue.js').createAnimQueue>} aq
 * @param {import('../game/types.js').GameState} state
 * @param {{ slotX: number, slotY: number, TW: number, TH: number }} coords
 * @param {() => number} now
 */
export function scheduleEvents(events, aq, state, coords, now) {
  let cursor = now();

  for (const ev of events) {
    const dt = handleOne(ev, aq, state, coords, cursor);
    cursor += dt;
  }
  return cursor;
}

function handleOne(ev, aq, state, coords, t0) {
  const { type, payload } = ev;
  switch (type) {
    case EventType.TilePicked: return onTilePicked(payload, aq, state, t0);
    case EventType.TileUnblocked: return onTileUnblocked(payload, aq, state, t0);
    case EventType.SlotInserted: return onSlotInserted(payload, aq, state, t0);
    case EventType.MatchCleared: return onMatchCleared(payload, aq, state, t0);
    case EventType.SlotShifted: return onSlotShifted(payload, aq, state, coords, t0);
    case EventType.StatusChanged: return 0;
    default: return 0;
  }
}

function onTilePicked({ tileId, blocked }, aq, state, t0) {
  if (blocked) {
    // 拒絕：tile 抖動 + 紅光 flash
    const tile = state.tiles.get(tileId);
    if (!tile) return 0;
    aq.push({
      start: t0,
      dur: T_REJECT,
      ease: 'outCubic',
      apply(t, fx) {
        const eff = ensureTileFx(fx, tileId);
        eff.dx = Math.sin(t * Math.PI * 6) * 4 * (1 - t);
      },
      onDone(fx) {
        const eff = fx.tileFx.get(tileId);
        if (eff) eff.dx = 0;
      },
    });
    aq.push({
      start: t0,
      dur: T_REJECT,
      apply() {},
      onDone(fx) {
        fx.flashes.push({ kind: 'rejectShake', tile, startMs: t0, durMs: T_REJECT });
      },
    });
    return T_REJECT;
  }
  // 正常 pick：tile lift + slight scale up + start fade
  aq.push({
    start: t0,
    dur: T_PICK,
    ease: 'outCubic',
    apply(t, fx) {
      const eff = ensureTileFx(fx, tileId);
      eff.dy = -8 * t;
      eff.scale = 1 + 0.12 * t;
      eff.alpha = 1 - 0.3 * t;
    },
    onDone(fx) {
      // 待會 SlotInserted 會接手把 tile 移到 slot；先讓 board 上保留低透明度殘影
      const eff = ensureTileFx(fx, tileId);
      eff.alpha = 0; // 從 board 消失，讓 slot 那邊的 tween 接走
    },
  });
  return T_PICK;
}

function onTileUnblocked({ tileIds }, aq, state, t0) {
  if (!tileIds || tileIds.length === 0) return 0;
  const tiles = tileIds.map((id) => state.tiles.get(id)).filter(Boolean);
  if (tiles.length === 0) return 0;
  aq.push({
    start: t0,
    dur: T_UNBLOCK,
    apply() {},
    onDone(fx) {
      fx.flashes.push({ kind: 'unblockGlow', tiles, startMs: t0, durMs: T_UNBLOCK + 200 });
    },
  });
  // 不獨佔時間軸：unblock 跟下一個事件可以併行
  return 0;
}

function onSlotInserted({ tileId, slotIndex }, aq, state, t0) {
  // 視覺上 tile 從 board 位置「飛」到 slot 位置 → tween slotFx 的 dx/dy/alpha
  // 由於 game state 已經把 tile 從 tiles map 移除，我們需要用 tile 的最後位置做起始
  const tile = findTileAnywhere(state, tileId);
  if (!tile) return 0;
  // 起始 fx：tile 從 board 的位置出現在 slot 上方
  aq.push({
    start: t0,
    dur: T_INSERT,
    ease: 'outCubic',
    apply(t, fx) {
      const eff = ensureSlotFx(fx, tileId);
      // 起始位置用 board 偏移（負的 dx/dy 從 slot 方向回推 board 的相對位置）
      // 簡化：tile 從 slot 上方掉下來，dy 由 -40 → 0；alpha 0 → 1
      eff.dy = -40 * (1 - t);
      eff.alpha = t;
    },
    onDone(fx) {
      const eff = fx.slotFx.get(tileId);
      if (eff) {
        eff.dy = 0;
        eff.alpha = 1;
      }
    },
  });
  return T_INSERT;
}

function onMatchCleared({ tileIds, slotIndices }, aq, state, t0) {
  // 三張同時 flash 後淡出
  aq.push({
    start: t0,
    dur: T_MATCH,
    apply(t, fx) {
      for (const id of tileIds) {
        const eff = ensureSlotFx(fx, id);
        eff.alpha = 1 - t;
        eff.dy = -8 * t;
      }
    },
    onDone(fx) {
      for (const id of tileIds) fx.slotFx.delete(id);
      fx.flashes.push({ kind: 'matchFlash', slotIndices, startMs: t0, durMs: T_MATCH + 100 });
    },
  });
  return T_MATCH;
}

function onSlotShifted({ shifts }, aq, state, coords, t0) {
  if (!shifts || shifts.length === 0) return 0;
  aq.push({
    start: t0,
    dur: T_SHIFT,
    ease: 'inOutCubic',
    apply(t, fx) {
      for (const s of shifts) {
        const eff = ensureSlotFx(fx, s.tileId);
        const totalDx = (s.toIndex - s.fromIndex) * coords.TW;
        eff.dx = totalDx * (t - 1); // -totalDx → 0
        eff.indexOverride = s.toIndex;
      }
    },
    onDone(fx) {
      for (const s of shifts) {
        const eff = fx.slotFx.get(s.tileId);
        if (eff) {
          eff.dx = 0;
          eff.indexOverride = undefined;
        }
      }
    },
  });
  return T_SHIFT;
}

function ensureTileFx(fx, id) {
  let eff = fx.tileFx.get(id);
  if (!eff) {
    eff = {};
    fx.tileFx.set(id, eff);
  }
  return eff;
}
function ensureSlotFx(fx, id) {
  let eff = fx.slotFx.get(id);
  if (!eff) {
    eff = {};
    fx.slotFx.set(id, eff);
  }
  return eff;
}

function findTileAnywhere(state, id) {
  return state.tiles.get(id) ?? state.slot.find((t) => t.id === id) ?? null;
}
