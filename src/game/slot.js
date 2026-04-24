// 待消區：嚴格插入順序，不自動靠攏。湊滿三同 → 整批移除 → 右側左移填洞。

export function insertToSlot(slot, tile) {
  const index = slot.length;
  slot.push(tile);
  return index;
}

export function findTriple(slot) {
  const counts = new Map();
  for (const t of slot) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  for (const [type, n] of counts) if (n >= 3) return type;
  return null;
}

export function clearTriple(slot, type) {
  const cleared = [];
  const next = [];
  for (let i = 0; i < slot.length; i++) {
    const t = slot[i];
    if (t.type === type && cleared.length < 3) {
      cleared.push({ tile: t, index: i });
    } else {
      next.push(t);
    }
  }
  const shifts = [];
  let writeIdx = 0;
  for (let i = 0; i < slot.length; i++) {
    if (cleared.some((c) => c.index === i)) continue;
    if (writeIdx !== i) shifts.push({ tileId: slot[i].id, fromIndex: i, toIndex: writeIdx });
    writeIdx++;
  }
  slot.length = 0;
  for (const t of next) slot.push(t);
  return { cleared, shifts };
}
