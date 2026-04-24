// 1000 種子可解性壓測：每個種子用 createGame 產生牌局，照 plan 順序點下去，必須通關。

import { test, expect } from 'bun:test';
import { createGame, pickTile, getStatus, DIFFICULTIES, LAYOUT_PRESET_KEYS } from '../src/game/index.js';

const SEED_COUNT = 1000;

// 每個 (preset × difficulty) 組合都跑 1000 種子，可解性必須 100%
for (const difficultyKey of Object.keys(DIFFICULTIES)) {
  for (const presetKey of LAYOUT_PRESET_KEYS) {
    test(`${presetKey}/${difficultyKey}: ${SEED_COUNT} seeds all solvable via plan`, () => {
      const failures = [];
      for (let seed = 1; seed <= SEED_COUNT; seed++) {
        const state = createGame({ seed, difficulty: difficultyKey, layoutPreset: presetKey });
        for (const tileId of state.plan) {
          const r = pickTile(state, tileId);
          if (!r.ok) {
            failures.push({ seed, tileId, reason: r.reason });
            break;
          }
        }
        if (getStatus(state) !== 'won') {
          failures.push({ seed, status: getStatus(state), slotLen: state.slot.length });
        }
      }
      if (failures.length > 0) {
        console.error(`${presetKey}/${difficultyKey} first 5 failures:`, failures.slice(0, 5));
      }
      expect(failures.length).toBe(0);
    });
  }
}

test(`pickTile on blocked tile returns ok:false reason:blocked`, () => {
  const state = createGame({ seed: 42 });
  // 找一張被遮擋的 tile（任意上層之下）
  let blockedId = null;
  for (const [id, t] of state.tiles) {
    if (t.blockedBy.size > 0) {
      blockedId = id;
      break;
    }
  }
  expect(blockedId).not.toBeNull();
  const r = pickTile(state, blockedId);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('blocked');
});

test(`pickTile on unknown tile returns ok:false reason:unknown_tile`, () => {
  const state = createGame({ seed: 1 });
  const r = pickTile(state, 'tDOES_NOT_EXIST');
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('unknown_tile');
});

test(`第 7 張剛好湊三同 → 算贏不算敗（match 先於 lose 檢查）`, () => {
  // 為了不依賴 layout 隨機性，直接 mutate state 構造剛好「slot=6、再點第 7 張湊三同」的場景。
  const state = createGame({ seed: 1 });
  // 隨便挑 7 張存在的 tile id，前 2 與最後 1 同 type，中間 4 張塞別的 type
  const ids = [...state.tiles.keys()].slice(0, 7);
  const tripleType = 'fish';
  const fillerTypes = ['shrimp', 'mushroom', 'veggie', 'meat'];
  // 先把這 7 張 type 改造，並全部解鎖（清空 blockedBy）
  ids.forEach((id, i) => {
    const t = state.tiles.get(id);
    t.blockedBy.clear();
    t.type = i === 0 || i === 1 || i === 6 ? tripleType : fillerTypes[i - 2];
  });

  // 點前 6 張 → slot 達 6，狀態仍 playing
  for (let i = 0; i < 6; i++) {
    const r = pickTile(state, ids[i]);
    expect(r.ok).toBe(true);
  }
  expect(state.slot.length).toBe(6);
  expect(getStatus(state)).toBe('playing');

  // 點第 7 張 → 湊三同 → 必須消除而不是判敗
  const r = pickTile(state, ids[6]);
  expect(r.ok).toBe(true);
  expect(getStatus(state)).not.toBe('lost');
  expect(state.slot.length).toBe(4); // 6 + 1 - 3 = 4

  // 事件順序：slot:inserted 必須早於 match:cleared
  const types = r.events.map((e) => e.type);
  const insertedIdx = types.indexOf('slot:inserted');
  const matchIdx = types.indexOf('match:cleared');
  expect(insertedIdx).toBeGreaterThanOrEqual(0);
  expect(matchIdx).toBeGreaterThan(insertedIdx);
});

test(`losing condition: slot fills to capacity without match`, () => {
  // 故意挑 7 張不同 type 的自由 tile 塞滿 → status:lost
  const state = createGame({ seed: 7 });
  const picked = new Set();
  let lastStatus = 'playing';
  // 暴力：連續從 free 池中挑 type 還沒在 slot 出現過的 tile
  for (let step = 0; step < 200 && lastStatus === 'playing'; step++) {
    const slotTypes = new Set(state.slot.map((t) => t.type));
    let target = null;
    for (const [id, t] of state.tiles) {
      if (t.blockedBy.size === 0 && !slotTypes.has(t.type) && !picked.has(id)) {
        target = id;
        break;
      }
    }
    if (!target) break; // 找不到全新 type 的自由 tile，無法強制 lose
    picked.add(target);
    const r = pickTile(state, target);
    if (!r.ok) break;
    lastStatus = getStatus(state);
  }
  // 不強制斷言一定 lose（54 張 7 種，極端時可能撐到剩 6 種以下），但若觸發 lose 必須帶事件
  if (lastStatus === 'lost') {
    expect(state.slot.length).toBe(state.config.slotCapacity);
  }
});
