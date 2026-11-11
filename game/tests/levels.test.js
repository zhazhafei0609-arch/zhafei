"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../js/levels.js");
require("../js/board.js");

const catalog = globalThis.StarStackLevels;
const boardEngine = globalThis.StarStackBoard;

test("default catalog contains two valid, solvable stacked levels", () => {
  assert.equal(catalog.list.length, 2);
  assert.deepEqual(catalog.errors, []);
  assert.deepEqual(catalog.list.map((level) => level.id), ["bamboo-grove", "sunset-meadow"]);

  for (const level of catalog.list) {
    assert.equal(level.layerCounts.reduce((sum, count) => sum + count, 0), level.totalTiles);
    assert.equal(level.totalTiles % 3, 0);
    assert.ok(level.kinds.length >= 3);
    assert.ok(level.traySize >= 5);

    const board = boardEngine.generateBoard(level);
    const counts = new Map();
    board.tiles.forEach((tile) => {
      counts.set(tile.kindId, (counts.get(tile.kindId) || 0) + 1);
    });
    counts.forEach((count) => assert.equal(count % 3, 0));
    assert.ok(board.availableIds.size > 0);
    assert.equal(boardEngine.verifySolution(level, board), true);
  }
});

test("duplicate and malformed levels are skipped without breaking the catalog", () => {
  const result = catalog.createCatalog([
    null,
    { id: "valid", name: "有效关卡", layerCounts: [9], kinds: catalog.tileLibrary.slice(0, 3) },
    { id: "valid", name: "重复关卡" },
  ]);

  assert.deepEqual(result.list.map((level) => level.id), ["valid"]);
  assert.ok(result.errors.some((message) => message.includes("不是有效对象")));
  assert.ok(result.errors.some((message) => message.includes("重复")));
});

test("invalid values and custom tile sets fall back safely", () => {
  const result = catalog.createCatalog([
    {
      id: "fallback",
      columns: 3,
      rows: 2,
      layerCounts: [-5, "bad", 99],
      traySize: 99,
      kinds: [{ id: "only-one", glyph: "★" }],
      tools: { undo: -1, shuffle: 99, hint: "bad" },
    },
  ]);

  const level = result.list[0];
  assert.ok(level.columns >= 4);
  assert.ok(level.rows >= 4);
  assert.ok(level.totalTiles >= 3);
  assert.equal(level.totalTiles % 3, 0);
  assert.ok(level.kinds.length >= 3);
  assert.ok(level.traySize <= 10);
  assert.ok(level.tools.undo >= 0);
  assert.ok(result.errors.some((message) => message.includes("kinds")));
});

test("the emergency level prevents an empty catalog", () => {
  const result = catalog.createCatalog([null, "bad", 42]);
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].id, "emergency-garden");
  assert.equal(result.list[0].totalTiles % 3, 0);
  assert.ok(result.errors.some((message) => message.includes("应急关卡")));
});

test("board generation is deterministic and shuffle preserves tile counts", () => {
  const level = catalog.list[0];
  const first = boardEngine.generateBoard(level, 12345);
  const second = boardEngine.generateBoard(level, 12345);
  assert.deepEqual(first.tiles, second.tiles);

  const before = first.tiles.map((tile) => tile.kindId).sort().join(",");
  boardEngine.shuffleRemainingKinds(first.tiles, boardEngine.createRng(99));
  const after = first.tiles.map((tile) => tile.kindId).sort().join(",");
  assert.equal(after, before);
  assert.ok(boardEngine.getAvailableTiles(first.tiles).length > 0);
});

test("fallback layer counts always fit reduced board sizes", () => {
  for (const size of [4, 5, 6]) {
    const result = catalog.createCatalog([
      { id: `small-${size}`, columns: size, rows: size, layerCounts: ["bad", null, -1] },
    ]);
    const level = result.list[0];
    assert.ok(level.totalTiles >= 3);
    assert.equal(level.totalTiles % 3, 0);
    const board = boardEngine.generateBoard(level);
    assert.equal(board.tiles.length, level.totalTiles);
    assert.equal(boardEngine.verifySolution(level, board), true);
  }
});
