// 點擊偵測：Canvas px → 邏輯座標 → 最上層的 hit tile id。
// 板子上有重疊時，layer 高的優先（玩家想點到「看得到」的那張）。

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../game/types.js').GameState} state
 * @param {{ boardX: number, boardY: number, displayScale: number, dpr: number, TW: number, TH: number }} coords
 * @param {(tileId: string | null) => void} onTileClick
 */
export function bindClick(canvas, state, coords, onTileClick) {
  function handle(ev) {
    const rect = canvas.getBoundingClientRect();
    const point = ev.touches ? ev.touches[0] : ev;
    const cssX = point.clientX - rect.left;
    const cssY = point.clientY - rect.top;
    // 反推邏輯座標：CSS px / displayScale
    const lx = cssX / coords.displayScale - coords.boardX;
    const ly = cssY / coords.displayScale - coords.boardY;

    const tileId = pickAtPoint(state, lx, ly, coords.TW, coords.TH);
    onTileClick(tileId);
  }
  canvas.addEventListener('mousedown', handle);
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handle(e);
  }, { passive: false });
}

function pickAtPoint(state, lx, ly, TW, TH) {
  // layer 高的優先（同 layer 用 y 高的 = 視覺上靠下、晚畫的）
  let best = null;
  for (const t of state.tiles.values()) {
    if (lx < t.x || lx >= t.x + TW) continue;
    if (ly < t.y || ly >= t.y + TH) continue;
    if (!best || t.layer > best.layer || (t.layer === best.layer && t.y > best.y)) {
      best = t;
    }
  }
  return best ? best.id : null;
}
