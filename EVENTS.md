# 逍遙大食堂 — Events Spec v0.1

`pickTile(state, tileId)` 回傳 `{ ok, reason?, events[] }`。前端只接 `events`，依序播動畫。

## 座標系（重要！）

**全部 events 內的 `x / y / w / h` 都是邏輯座標**，不是 Canvas pixel：

- 原點：左上角 `(0, 0)`
- 方向：+x 向右、+y 向下（與 Canvas 一致）
- 單位：邏輯點，**非 pixel**
- 棋盤總尺寸：`BOARD_WIDTH = 384`、`BOARD_HEIGHT = 256`（從 `layout.js` import）
- 每張 tile 預設 `w = 64`、`h = 64`（從 `config.js`，可調）

前端自己決定縮放比例：`scale = canvasWidth / BOARD_WIDTH`，渲染時 `pixelX = logicalX * scale`。Tile 的座標欄位由 `state.tiles.get(tileId)` 取得，**不會在 events 裡重複帶**（避免不一致）。

## 初始 render（events 不負責這段）

第一次畫面要從 `state.tiles` 自己讀，**不會走 events**。範例：

```js
const state = createGame({ seed: 1 });
for (const tile of state.tiles.values()) {
  // tile.x / tile.y / tile.w / tile.h / tile.layer / tile.type / tile.id
  drawTile(tile);
}
// 待消區一開始是空的：state.slot === []
```

events 只描述「狀態變化」（pick / unblock / insert / match / shift / status 切換），不重複描述初始狀態。重新開始一局也是 `createGame()` → 重新讀 `state.tiles`。

## 流程順序保證（v0.1 鎖死）

`pickTile` 內部一定是：

```
remove from board → insert to slot → match 檢查（湊三同就清）→ lose 檢查（slot 是否滿 capacity）
```

「第 7 張剛好湊三同」**算贏不算敗** — 因為清除把 slot 降回 4，lose 檢查時不會誤判。已用 `tests/solvability.test.js` 鎖住（`第 7 張剛好湊三同` 那條測試）。

## 共通格式

```ts
type GameEvent = { type: string; payload: object }
```

`pickTile` 的 events 是「依時序」的陣列。前端可以一次播完，也可以排隊逐一動畫，順序保證如下：

```
TilePicked → (TileUnblocked) → SlotInserted → (MatchCleared → SlotShifted?) → (StatusChanged)
```

括號內代表「條件成立才會出現」。

## Event 一覽

### `tile:picked`

點擊回饋。被遮擋時也會出，附 `blocked: true` 讓前端做「抖動 + 紅光」之類的拒絕動畫。

| 欄位         | 型別                  | 說明                                       |
| ------------ | --------------------- | ------------------------------------------ |
| `tileId`     | `string`              | 被點的 tile id                             |
| `blocked`    | `boolean`             | `true` = 被遮無法點；`false` = 成功拿走    |
| `blockedBy?` | `string[]`            | 只有 `blocked=true` 才有，列出擋住它的 ids |

### `tile:unblocked`

某張 tile 拿走後，下層的 tile 變成可點。

| 欄位      | 型別       | 說明                                |
| --------- | ---------- | ----------------------------------- |
| `tileIds` | `string[]` | 這次新解鎖的 tile ids（可能為空陣列就不會發出此事件） |

### `slot:inserted`

tile 進入待消區。**嚴格插入順序**，`slotIndex` 就是它在待消區的位置（0-based）。

| 欄位          | 型別     | 說明                                 |
| ------------- | -------- | ------------------------------------ |
| `tileId`      | `string` |                                      |
| `type`        | `string` | 食材種類                             |
| `slotIndex`   | `number` | 插入後在待消區的 index               |
| `slotLength`  | `number` | 插入後待消區總長度（含這張）         |

### `match:cleared`

待消區出現 3 張同 type → 整批移除。**只取最早出現的 3 張**，不會把 4+ 張全清。

| 欄位           | 型別       | 說明                                              |
| -------------- | ---------- | ------------------------------------------------- |
| `type`         | `string`   | 被消除的食材種類                                  |
| `tileIds`      | `string[]` | 被消除的 3 張 tile ids（依插入順序）              |
| `slotIndices`  | `number[]` | 被消除的 3 個 slot index（依插入順序，**消除前的位置**） |

### `slot:shifted`

3 張被拿走後，右側 tile 左移填洞。

| 欄位     | 型別                                                          | 說明                       |
| -------- | ------------------------------------------------------------- | -------------------------- |
| `shifts` | `Array<{ tileId: string; fromIndex: number; toIndex: number }>` | 每筆是「某張從 from 移到 to」 |

`shifts` 已經是「最終目標」（同步算好），前端只要播 from → to 的補間動畫即可。空陣列就不會發出此事件。

### `status:changed`

只在 `playing → won` 或 `playing → lost` 時觸發。

| 欄位     | 型別               | 說明 |
| -------- | ------------------ | ---- |
| `status` | `'won' \| 'lost'`  |      |

- `won` 條件：所有 tile 都被消除（board 空 + slot 空）
- `lost` 條件：slot 達 `slotCapacity`（預設 7）且本回合沒湊出三同

## pickTile 失敗回傳

| `reason`        | 觸發                                                          |
| --------------- | ------------------------------------------------------------- |
| `not_playing`   | `state.status` 不是 `'playing'`                               |
| `unknown_tile`  | tileId 不存在於 `state.tiles`                                 |
| `blocked`       | tile 被遮擋（events 仍會帶一個 `tile:picked` blocked event）  |
| `slot_full`     | 防呆，理論上不會走到（slot 滿時 status 已經是 `lost`）        |

## 範例 — 一次成功消除的事件序列

點 `t12`（type=`fish`），slot 已有 2 張 fish 在 index 0、3：

```js
[
  { type: 'tile:picked',   payload: { tileId: 't12', blocked: false } },
  { type: 'tile:unblocked', payload: { tileIds: ['t31'] } },
  { type: 'slot:inserted', payload: { tileId: 't12', type: 'fish', slotIndex: 5, slotLength: 6 } },
  { type: 'match:cleared', payload: { type: 'fish', tileIds: ['tA','tB','t12'], slotIndices: [0, 3, 5] } },
  { type: 'slot:shifted',  payload: { shifts: [
      { tileId: 'tX', fromIndex: 1, toIndex: 0 },
      { tileId: 'tY', fromIndex: 2, toIndex: 1 },
      { tileId: 'tZ', fromIndex: 4, toIndex: 2 },
    ]}
  },
]
```

## 變更紀錄

- v0.1（2026-04-24）— 初版，PM 驗收通過；補「初始 render」與「流程順序保證」兩節
