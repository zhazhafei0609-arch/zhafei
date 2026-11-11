(function (global) {
  "use strict";

  const TILE_SIZE = 0.88;
  const COVER_THRESHOLD = 0.08;

  function createRng(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return function rng() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rng) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const target = Math.floor(rng() * (index + 1));
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }

  function candidatePositions(columns, rows, layerIndex) {
    const offset = layerIndex % 2 === 1 ? 0.5 : 0;
    const positions = [];
    for (let row = 0; row < rows; row += 1) {
      if (row + offset + TILE_SIZE > rows + 0.001) continue;
      for (let column = 0; column < columns; column += 1) {
        if (column + offset + TILE_SIZE > columns + 0.001) continue;
        positions.push({ x: column + offset, y: row + offset });
      }
    }
    return positions;
  }

  function createPositions(level, rng) {
    const tiles = [];
    let sequence = 0;
    level.layerCounts.forEach((count, layer) => {
      const positions = shuffle(candidatePositions(level.columns, level.rows, layer), rng).slice(0, count);
      positions.forEach((position) => {
        tiles.push({
          id: `tile-${sequence}`,
          sequence,
          layer,
          x: position.x,
          y: position.y,
          kindId: null,
          state: "board",
        });
        sequence += 1;
      });
    });
    return tiles;
  }

  function overlapAmount(a, b) {
    const overlapX = Math.min(a.x + TILE_SIZE, b.x + TILE_SIZE) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + TILE_SIZE, b.y + TILE_SIZE) - Math.max(a.y, b.y);
    return Math.min(overlapX, overlapY);
  }

  function isCovered(tile, tiles) {
    if (!tile || tile.state !== "board") return false;
    return tiles.some((other) => {
      if (other.id === tile.id || other.state !== "board" || other.layer <= tile.layer) return false;
      return overlapAmount(tile, other) > COVER_THRESHOLD;
    });
  }

  function getAvailableTiles(tiles) {
    return tiles.filter((tile) => tile.state === "board" && !isCovered(tile, tiles));
  }

  function getAvailableIds(tiles) {
    return new Set(getAvailableTiles(tiles).map((tile) => tile.id));
  }

  function assignSolvableKinds(level, tiles, rng) {
    const order = [];
    for (let layer = level.layerCounts.length - 1; layer >= 0; layer -= 1) {
      const layerTiles = tiles.filter((tile) => tile.layer === layer);
      shuffle(layerTiles, rng);
      order.push(...layerTiles);
    }

    const groupCount = Math.floor(tiles.length / 3);
    const groupKinds = Array.from({ length: groupCount }, (_, index) => level.kinds[index % level.kinds.length].id);
    shuffle(groupKinds, rng);

    for (let group = 0; group < groupCount; group += 1) {
      const kindId = groupKinds[group];
      for (let offset = 0; offset < 3; offset += 1) {
        order[group * 3 + offset].kindId = kindId;
      }
    }

    return order.map((tile) => tile.id);
  }

  function generateBoard(level, seed) {
    const rng = createRng(seed === undefined ? level.seed : seed);
    const tiles = createPositions(level, rng);
    const solutionOrder = assignSolvableKinds(level, tiles, rng);
    return {
      tiles,
      solutionOrder,
      availableIds: getAvailableIds(tiles),
    };
  }

  function shuffleRemainingKinds(tiles, rng) {
    const remaining = tiles.filter((tile) => tile.state === "board");
    const kinds = shuffle(remaining.map((tile) => tile.kindId), rng);
    remaining.forEach((tile, index) => {
      tile.kindId = kinds[index];
    });
    return remaining;
  }

  function findHint(tiles) {
    const available = getAvailableTiles(tiles);
    const byKind = new Map();
    available.forEach((tile) => {
      if (!byKind.has(tile.kindId)) byKind.set(tile.kindId, []);
      byKind.get(tile.kindId).push(tile);
    });

    let best = [];
    byKind.forEach((group) => {
      if (group.length > best.length) best = group;
    });
    const completeGroups = Array.from(byKind.values()).filter((group) => group.length >= 3);
    const selected = completeGroups.length > 0
      ? completeGroups.sort((a, b) => b.length - a.length)[0].slice(0, 3)
      : best.slice(0, 3);

    return {
      kindId: selected[0] ? selected[0].kindId : null,
      tileIds: selected.map((tile) => tile.id),
      complete: selected.length >= 3,
    };
  }

  function verifySolution(level, boardState) {
    const tiles = boardState.tiles.map((tile) => ({ ...tile }));
    const tray = [];
    const traySize = level.traySize;
    for (const tileId of boardState.solutionOrder) {
      const tile = tiles.find((item) => item.id === tileId);
      if (!tile || tile.state !== "board" || isCovered(tile, tiles)) return false;
      tile.state = "tray";
      tray.push(tile);
      const matching = tray.filter((item) => item.kindId === tile.kindId);
      if (matching.length >= 3) {
        let removed = 0;
        for (let index = tray.length - 1; index >= 0 && removed < 3; index -= 1) {
          if (tray[index].kindId === tile.kindId) {
            tray[index].state = "matched";
            tray.splice(index, 1);
            removed += 1;
          }
        }
      }
      if (tray.length >= traySize) return false;
    }
    return tiles.every((tile) => tile.state === "matched") && tray.length === 0;
  }

  global.StarStackBoard = Object.freeze({
    TILE_SIZE,
    COVER_THRESHOLD,
    createRng,
    shuffle,
    candidatePositions,
    generateBoard,
    isCovered,
    getAvailableTiles,
    getAvailableIds,
    shuffleRemainingKinds,
    findHint,
    verifySolution,
  });
})(typeof window !== "undefined" ? window : globalThis);
