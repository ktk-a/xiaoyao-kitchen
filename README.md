# 逍遙大食堂 (xiaoyao-kitchen)

古劍奇譚 Online 風的羊了個羊式三消遊戲 MVP。

## 玩法

- 上層牌會擋住下層，**只有最上層可點**
- 點到的牌進入 **7 格待消區**（嚴格插入順序、不自動靠攏）
- 待消區出現 **3 張同 type** 自動消除
- 全清為勝、待消區滿為敗

## 規格

- 預設 54 張、7 種食材（bowl / fish / shrimp / mushroom / veggie / meat / dumpling）
- 三消規則鎖死（不允許兩同配對）
- 純前端、單關 MVP、無道具
- 技術：HTML5 Canvas + vanilla JS（ES modules，無 build step）

## 目錄結構

```
apps/xiaoyao-kitchen/
├── EVENTS.md           # pickTile 回傳的 events spec（v0.1）
├── package.json
├── src/
│   └── game/           # 純 JS 遊戲核心，無 DOM
│       ├── index.js    # 對外入口
│       ├── game.js     # createGame / pickTile / getStatus
│       ├── generator.js# 逆向生成器（保證可解）
│       ├── layout.js   # 54 張固定座標
│       ├── board.js    # 遮擋判定
│       ├── slot.js     # 待消區邏輯
│       ├── events.js   # event 名稱常數
│       ├── config.js   # 預設參數
│       └── types.js    # JSDoc 型別
└── tests/
    └── solvability.test.js  # 1000 種子可解性壓測
```

## 開發

```sh
bun test       # 跑測試（含 1000 種子壓測）
```

前端 / 部署檔案會在 Step 2 / Step 3 補。
