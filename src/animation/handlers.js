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
 * @param {{ boardX:number, boardY:number, slotX: number, slotY: number, TW: number, TH: number }} coords
 * @param {() => number} now
 * @param {(id: string) => any} tileLookup  pickTile 之前捕捉的 tile 快照（含已被消除的）
 */
export function scheduleEvents(events, aq, state, coords, now, tileLookup) {
  let cursor = now();

  for (const ev of events) {
    const dt = handleOne(ev, aq, state, coords, cursor, tileLookup);
    cursor += dt;
  }
  return cursor;
}

function handleOne(ev, aq, state, coords, t0, tileLookup) {
  const { type, payload } = ev;
  switch (type) {
    case EventType.TilePicked: return onTilePicked(payload, aq, state, coords, t0, tileLookup);
    case EventType.TileUnblocked: return onTileUnblocked(payload, aq, state, t0);
    case EventType.SlotInserted: return onSlotInserted(payload, aq, state, coords, t0, tileLookup);
    case EventType.MatchCleared: return onMatchCleared(payload, aq, state, coords, t0, tileLookup);
    case EventType.SlotShifted: return onSlotShifted(payload, aq, state, coords, t0);
    case EventType.StatusChanged: return 0;
    default: return 0;
  }
}

function onTilePicked({ tileId, blocked, blockedBy }, aq, state, coords, t0, tileLookup) {
  if (blocked) {
    // 拒絕：tile 抖動 + 紅光 flash（仍走 tileFx，因為被拒絕的 tile 留在 board）
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
  // 正常 pick：把 tile 快照塞 fx.flying，從 board 位置開始 lift（scale up + 少許上抬）
  // 之後 onSlotInserted 接手做 board → slot 的 fly。
  // 用 tileLookup（pickTile 前的 snapshot），因為 state.slot 可能已被 clearTriple 清掉
  // （第 3 張湊成三同的瞬間）→ 從 state.slot[last] 拿不到。
  const tile = tileLookup(tileId);
  if (!tile) return T_PICK;
  const startX = coords.boardX + tile.x;
  const startY = coords.boardY + tile.y;
  // 立即在 fx.flying 寫入起始狀態（**這是 jitter bug 的關鍵**：
  //   不能等 tween 第一次 apply 才寫入，否則 frame 1 還沒有 flying entry，
  //   slot 那邊的 real-state 渲染會先閃出滿 alpha 的 tile）
  aq.push({
    start: t0,
    dur: T_PICK,
    ease: 'outCubic',
    apply(t, fx) {
      const fly = ensureFlying(fx, tileId, tile, startX, startY);
      fly.x = startX;
      fly.y = startY - 10 * t;
      fly.scale = 1 + 0.1 * t;
      fly.alpha = 1;
    },
  });
  // 同步寫初始狀態（tween 還沒跑就先讓 flying 接管渲染，避免 slot 那邊閃滿 alpha）
  return T_PICK;
}

function ensureFlying(fx, tileId, tile, x, y) {
  let fly = fx.flying.get(tileId);
  if (!fly) {
    fly = { tile, x, y, alpha: 1, scale: 1 };
    fx.flying.set(tileId, fly);
  }
  return fly;
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

function onSlotInserted({ tileId, slotIndex }, aq, state, coords, t0, tileLookup) {
  // 從 fx.flying 的當前位置（board + lift）一條 path 飛到 slot 目標位置。
  // 完成後從 flying 移除 → slot 真實 state 接手畫。
  // 用 tileLookup 因為這張 tile 可能立刻就被 clearTriple 拿掉了（第 3 張同 type 的瞬間）。
  const tile = tileLookup(tileId);
  if (!tile) return 0;
  const targetX = coords.slotX + slotIndex * coords.TW;
  const targetY = coords.slotY;
  let captured = null; // tween 第一次 apply 才捕獲起點，避免 schedule 時取錯
  aq.push({
    start: t0,
    dur: T_INSERT,
    ease: 'outCubic',
    apply(t, fx) {
      const fly = ensureFlying(
        fx,
        tileId,
        tile,
        coords.boardX + tile.x,  // fallback 起點：board 原位（理論上 onTilePicked 已建好）
        coords.boardY + tile.y,
      );
      if (!captured) captured = { x: fly.x, y: fly.y, scale: fly.scale ?? 1 };
      fly.x = captured.x + (targetX - captured.x) * t;
      fly.y = captured.y + (targetY - captured.y) * t;
      fly.scale = captured.scale + (1 - captured.scale) * t;
      fly.alpha = 1;
    },
    onDone(fx) {
      fx.flying.delete(tileId);
    },
  });
  return T_INSERT;
}

function onMatchCleared({ tileIds, slotIndices }, aq, state, coords, t0, tileLookup) {
  // 三張被消除的 tile 已經從 state.slot 拿掉了 → 只能從 tileLookup 拿快照。
  // 用 fx.flying 渲染（在 slot 位置淡出 + 上飄）；fx.flying 已經是 absolute coord，正合用。
  const tiles = tileIds.map((id) => tileLookup(id)).filter(Boolean);
  if (tiles.length === 0) return 0;

  // 確保進入 fade tween 時 flying 已存在（onSlotInserted 對「剛飛到 slot 的第 3 張」會 onDone 把 flying 刪除，
  // 我們在這裡把它加回去；前 2 張本來就沒在 flying，要新建）
  aq.push({
    start: t0,
    dur: 1, // 這是個 setup-only tween：在 t0 把 fade 起點塞進 flying，不做插值
    apply(t, fx) {
      tiles.forEach((tile, i) => {
        const slotIdx = slotIndices[i];
        const fly = ensureFlying(
          fx,
          tile.id,
          tile,
          coords.slotX + slotIdx * coords.TW,
          coords.slotY,
        );
        fly.x = coords.slotX + slotIdx * coords.TW;
        fly.y = coords.slotY;
        fly.alpha = 1;
        fly.scale = 1;
      });
    },
  });
  // 真正的淡出 tween：alpha 1 → 0 + 上飄
  aq.push({
    start: t0,
    dur: T_MATCH,
    ease: 'outCubic',
    apply(t, fx) {
      tiles.forEach((tile, i) => {
        const fly = fx.flying.get(tile.id);
        if (!fly) return;
        fly.alpha = 1 - t;
        fly.y = coords.slotY - 12 * t;
        fly.scale = 1 + 0.2 * t;
      });
    },
    onDone(fx) {
      for (const tile of tiles) fx.flying.delete(tile.id);
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
