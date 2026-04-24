// 事件名稱常數。pickTile 執行完會回一組 events 給 frontend 做動畫。

export const EventType = Object.freeze({
  TilePicked: 'tile:picked',
  SlotInserted: 'slot:inserted',
  TileUnblocked: 'tile:unblocked',
  MatchCleared: 'match:cleared',
  SlotShifted: 'slot:shifted',
  StatusChanged: 'status:changed',
});

export function makeEvent(type, payload) {
  return { type, payload };
}
