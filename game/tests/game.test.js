"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../js/levels.js");
require("../js/board.js");
require("../js/game.js");

const catalog = globalThis.StarStackLevels;
const StarStackGame = globalThis.StarStackGame;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createLevel(overrides) {
  const result = catalog.createCatalog([Object.assign({
    id: "engine-test",
    name: "引擎测试关",
    columns: 7,
    rows: 7,
    layerCounts: [12],
    kindCount: 4,
    traySize: 7,
    seed: 77,
    tools: { undo: 2, shuffle: 2, hint: 2 },
  }, overrides || {})]);
  return result.list[0];
}

test("game engine resolves triples and completes a level", async (t) => {
  const game = new StarStackGame([createLevel()]);
  t.after(() => game.destroy());
  game.startRun();

  const order = [...game.solutionOrder];
  for (let index = 0; index < order.length; index += 3) {
    const group = order.slice(index, index + 3);
    group.forEach((tileId) => assert.equal(game.chooseTile(tileId), true));
    await wait(370);
  }

  assert.equal(game.status, "victory");
  assert.equal(game.matchedCount, game.level.totalTiles);
  assert.equal(game.tray.length, 0);
  assert.ok(game.score > 0);
});

test("undo restores the last tray tile", (t) => {
  const game = new StarStackGame([createLevel()]);
  t.after(() => game.destroy());
  game.startRun();
  const tileId = game.solutionOrder[0];
  assert.equal(game.chooseTile(tileId), true);
  assert.equal(game.tray.length, 1);
  assert.equal(game.useUndo(), true);
  assert.equal(game.tray.length, 0);
  assert.equal(game.tiles.find((tile) => tile.id === tileId).state, "board");
});

test("a full tray can be rescued with one undo", async (t) => {
  const game = new StarStackGame([createLevel({ layerCounts: [21], kindCount: 7, seed: 19 })]);
  t.after(() => game.destroy());
  game.startRun();

  const pickedKinds = new Set();
  for (let guard = 0; guard < 30 && game.tray.length < game.level.traySize; guard += 1) {
    const tile = StarStackBoard.getAvailableTiles(game.tiles).find((item) => !pickedKinds.has(item.kindId));
    if (!tile) break;
    pickedKinds.add(tile.kindId);
    game.chooseTile(tile.id);
  }
  await wait(370);
  assert.equal(game.status, "gameOver");
  assert.equal(game.tray.length, game.level.traySize);
  assert.equal(game.useUndo(), true);
  assert.equal(game.status, "playing");
  assert.equal(game.tray.length, game.level.traySize - 1);
});
