function bboxOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function computeBlocking(tiles) {
  const list = [...tiles.values()];
  for (const t of list) {
    t.blockedBy = new Set();
    t.blocking = new Set();
  }
  for (const a of list) {
    for (const b of list) {
      if (a === b) continue;
      if (b.layer > a.layer && bboxOverlap(a, b)) {
        a.blockedBy.add(b.id);
        b.blocking.add(a.id);
      }
    }
  }
}

export function isPickable(tile) {
  return tile.blockedBy.size === 0;
}

export function removeTileFromBoard(tiles, tileId) {
  const tile = tiles.get(tileId);
  if (!tile) return [];
  const unblocked = [];
  for (const belowId of tile.blocking) {
    const below = tiles.get(belowId);
    if (!below) continue;
    below.blockedBy.delete(tileId);
    if (below.blockedBy.size === 0) unblocked.push(belowId);
  }
  tiles.delete(tileId);
  return unblocked;
}
