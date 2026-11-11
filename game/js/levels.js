(function (global) {
  "use strict";

  const TILE_LIBRARY = [
    { id: "panda", glyph: "🐼", color: "#4d5561", label: "熊猫" },
    { id: "rabbit", glyph: "🐰", color: "#d96787", label: "兔子" },
    { id: "fox", glyph: "🦊", color: "#d86b37", label: "狐狸" },
    { id: "koala", glyph: "🐨", color: "#69717d", label: "考拉" },
    { id: "cat", glyph: "🐱", color: "#d99428", label: "猫咪" },
    { id: "dog", glyph: "🐶", color: "#a86f44", label: "小狗" },
    { id: "bear", glyph: "🐻", color: "#8a5b3d", label: "小熊" },
    { id: "tiger", glyph: "🐯", color: "#c47b13", label: "老虎" },
    { id: "frog", glyph: "🐸", color: "#4e9554", label: "青蛙" },
    { id: "penguin", glyph: "🐧", color: "#38647e", label: "企鹅" },
    { id: "owl", glyph: "🦉", color: "#886038", label: "猫头鹰" },
    { id: "chick", glyph: "🐥", color: "#bd8c11", label: "小鸡" },
  ];

  const THEMES = {
    garden: {
      backgroundStart: "#fff7e8",
      backgroundEnd: "#d9f3e8",
      accent: "#ed7658",
      accent2: "#5dbd9c",
      danger: "#e85d72",
      text: "#49382f",
      board: "#d8efdf",
      tileTop: "#fffdf7",
      tileBottom: "#f2ddbd",
      tileEdge: "#cbb087",
    },
    meadow: {
      backgroundStart: "#fff2ea",
      backgroundEnd: "#f3d9e9",
      accent: "#e879a2",
      accent2: "#77a9e2",
      danger: "#e65d70",
      text: "#4d3542",
      board: "#f0dcef",
      tileTop: "#fffaf5",
      tileBottom: "#f3d4dd",
      tileEdge: "#d4abb7",
    },
  };

  const DEFAULT_LAYER_COUNTS = [24, 20, 16, 12];

  const RAW_LEVELS = [
    {
      id: "bamboo-grove",
      name: "熊猫竹林",
      subtitle: "雨后的竹林里，小动物们叠成了一座软乎乎的小山。",
      columns: 7,
      rows: 7,
      layerCounts: [24, 20, 16, 12],
      kindCount: 8,
      traySize: 7,
      seed: 2107,
      tools: { undo: 2, shuffle: 2, hint: 3 },
      theme: THEMES.garden,
    },
    {
      id: "sunset-meadow",
      name: "晚霞牧场",
      subtitle: "晚霞落进牧场，动物们藏进了更深一层的云朵里。",
      columns: 7,
      rows: 7,
      layerCounts: [32, 30, 27, 22],
      kindCount: 10,
      traySize: 7,
      seed: 8041,
      tools: { undo: 2, shuffle: 2, hint: 2 },
      theme: THEMES.meadow,
    },
  ];

  const COLOR_PATTERN = /^(#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+\-]+\))$/i;
  const ID_PATTERN = /[^a-z0-9_-]+/g;

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeText(value, fallback, maxLength) {
    if (typeof value !== "string") return fallback;
    const text = value.trim();
    return text ? text.slice(0, maxLength || 80) : fallback;
  }

  function safeColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const candidate = value.trim();
    return COLOR_PATTERN.test(candidate) ? candidate : fallback;
  }

  function normalizeTheme(rawTheme, fallbackTheme) {
    const source = rawTheme && typeof rawTheme === "object" ? rawTheme : {};
    const base = fallbackTheme || THEMES.garden;
    return Object.freeze({
      backgroundStart: safeColor(source.backgroundStart, base.backgroundStart),
      backgroundEnd: safeColor(source.backgroundEnd, base.backgroundEnd),
      accent: safeColor(source.accent, base.accent),
      accent2: safeColor(source.accent2, base.accent2),
      danger: safeColor(source.danger, base.danger),
      text: safeColor(source.text, base.text),
      board: safeColor(source.board, base.board),
      tileTop: safeColor(source.tileTop, base.tileTop),
      tileBottom: safeColor(source.tileBottom, base.tileBottom),
      tileEdge: safeColor(source.tileEdge, base.tileEdge || "#cbb087"),
    });
  }

  function normalizeTileKind(rawKind, index, seenIds) {
    if (!rawKind || typeof rawKind !== "object") return null;
    const id = safeText(rawKind.id, `kind-${index + 1}`, 24)
      .toLowerCase()
      .replace(ID_PATTERN, "-")
      .replace(/^-+|-+$/g, "");
    if (!id || seenIds.has(id)) return null;
    seenIds.add(id);
    return Object.freeze({
      id,
      glyph: safeText(rawKind.glyph, "◆", 3),
      color: safeColor(rawKind.color, TILE_LIBRARY[index % TILE_LIBRARY.length].color),
      label: safeText(rawKind.label, `动物 ${index + 1}`, 16),
    });
  }

  function normalizeKinds(rawLevel, errors) {
    const requestedCount = clamp(Math.round(finiteNumber(rawLevel.kindCount, 8)), 3, TILE_LIBRARY.length);
    const fallbackKinds = TILE_LIBRARY.slice(0, requestedCount).map((kind) => Object.freeze({ ...kind }));

    if (!Array.isArray(rawLevel.kinds) || rawLevel.kinds.length === 0) {
      return Object.freeze(fallbackKinds);
    }

    const seenIds = new Set();
    const customKinds = rawLevel.kinds
      .map((kind, index) => normalizeTileKind(kind, index, seenIds))
      .filter(Boolean)
      .slice(0, TILE_LIBRARY.length);

    if (customKinds.length < 3) {
      errors.push(`关卡 "${safeText(rawLevel.id, "未命名", 48)}" 的自定义 kinds 少于 3 种，已使用默认图案。`);
      return Object.freeze(fallbackKinds);
    }
    return Object.freeze(customKinds);
  }

  function layerCapacity(columns, rows, layerIndex) {
    const offset = layerIndex % 2 === 1 ? 1 : 0;
    return Math.max(0, (columns - offset) * (rows - offset));
  }

  function makeCountsFromTotal(total, layerCount, columns, rows) {
    const count = Math.max(1, Math.min(8, Math.round(layerCount)));
    const counts = Array.from({ length: count }, () => 0);
    let remaining = Math.max(3, Math.round(total));
    const weights = counts.map((_, index) => Math.max(0.45, 1.2 - index * 0.12));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    counts.forEach((_, index) => {
      counts[index] = Math.floor(remaining * weights[index] / weightTotal);
    });
    let assigned = counts.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    while (assigned < remaining) {
      counts[cursor % counts.length] += 1;
      assigned += 1;
      cursor += 1;
    }
    return counts.map((value, index) => Math.min(value, layerCapacity(columns, rows, index)));
  }

  function fallbackLayerCounts(columns, rows) {
    const counts = DEFAULT_LAYER_COUNTS.map((value, index) => Math.min(value, layerCapacity(columns, rows, index)));
    let total = counts.reduce((sum, value) => sum + value, 0);
    let remainder = total % 3;
    for (let index = counts.length - 1; index >= 0 && remainder > 0; index -= 1) {
      const removed = Math.min(remainder, counts[index]);
      counts[index] -= removed;
      remainder -= removed;
    }
    return counts;
  }

  function normalizeLayerCounts(rawLevel, columns, rows, errors) {
    let sourceCounts;
    if (Array.isArray(rawLevel.layerCounts) && rawLevel.layerCounts.length > 0) {
      sourceCounts = rawLevel.layerCounts.slice(0, 8).map((value) => Math.max(0, Math.round(finiteNumber(value, 0))));
    } else {
      sourceCounts = makeCountsFromTotal(
        finiteNumber(rawLevel.tileCount, DEFAULT_LAYER_COUNTS.reduce((sum, value) => sum + value, 0)),
        finiteNumber(rawLevel.layers, DEFAULT_LAYER_COUNTS.length),
        columns,
        rows
      );
    }

    const counts = sourceCounts.map((value, index) => Math.min(value, layerCapacity(columns, rows, index)));
    let total = counts.reduce((sum, value) => sum + value, 0);
    if (total < 3) {
      errors.push(`关卡 "${safeText(rawLevel.id, "未命名", 48)}" 的有效小动物图案过少，已使用默认层数。`);
      return Object.freeze(fallbackLayerCounts(columns, rows));
    }

    let remainder = total % 3;
    for (let index = counts.length - 1; index >= 0 && remainder > 0; index -= 1) {
      const removed = Math.min(remainder, counts[index]);
      counts[index] -= removed;
      remainder -= removed;
    }

    total = counts.reduce((sum, value) => sum + value, 0);
    if (total < 3) {
      errors.push(`关卡 "${safeText(rawLevel.id, "未命名", 48)}" 的小动物数量无法组成三消组，已使用默认层数。`);
      return Object.freeze(fallbackLayerCounts(columns, rows));
    }
    return Object.freeze(counts);
  }

  function normalizeTools(rawTools) {
    const source = rawTools && typeof rawTools === "object" ? rawTools : {};
    return Object.freeze({
      undo: clamp(Math.round(finiteNumber(source.undo, 2)), 0, 9),
      shuffle: clamp(Math.round(finiteNumber(source.shuffle, 2)), 0, 9),
      hint: clamp(Math.round(finiteNumber(source.hint, 2)), 0, 9),
    });
  }

  function normalizeLevel(rawLevel, index, seenIds, errors) {
    if (!rawLevel || typeof rawLevel !== "object" || Array.isArray(rawLevel)) {
      errors.push(`第 ${index + 1} 个关卡不是有效对象，已跳过。`);
      return null;
    }

    const id = safeText(rawLevel.id, `level-${index + 1}`, 48)
      .toLowerCase()
      .replace(ID_PATTERN, "-")
      .replace(/^[-_]+|[-_]+$/g, "") || `level-${index + 1}`;
    if (seenIds.has(id)) {
      errors.push(`关卡 id "${id}" 重复，已跳过后续重复项。`);
      return null;
    }
    seenIds.add(id);

    const columns = clamp(Math.round(finiteNumber(rawLevel.columns, 7)), 4, 10);
    const rows = clamp(Math.round(finiteNumber(rawLevel.rows, 7)), 4, 10);
    const layerCounts = normalizeLayerCounts(rawLevel, columns, rows, errors);
    const kinds = normalizeKinds(rawLevel, errors);
    const traySize = clamp(Math.round(finiteNumber(rawLevel.traySize, 7)), 5, 10);
    const totalTiles = layerCounts.reduce((sum, value) => sum + value, 0);

    return Object.freeze({
      id,
      name: safeText(rawLevel.name, `第 ${index + 1} 关`, 36),
      subtitle: safeText(rawLevel.subtitle, "点击未被压住的小动物，凑齐三个相同图案。", 120),
      columns,
      rows,
      layerCounts,
      totalTiles,
      kinds,
      traySize,
      tools: normalizeTools(rawLevel.tools),
      seed: Math.max(1, Math.round(finiteNumber(rawLevel.seed, 2026 + index * 101))),
      theme: normalizeTheme(rawLevel.theme, THEMES.garden),
    });
  }

  function buildCatalog(rawLevels) {
    const errors = [];
    const levels = [];
    const seenIds = new Set();

    rawLevels.forEach((rawLevel, index) => {
      const level = normalizeLevel(rawLevel, index, seenIds, errors);
      if (level) levels.push(level);
    });

    if (levels.length === 0) {
      errors.push("没有可用关卡，已加载内置应急关卡。");
      const columns = 7;
      const rows = 7;
      const layerCounts = Object.freeze([9, 6, 3]);
      levels.push(Object.freeze({
        id: "emergency-garden",
        name: "应急小窝",
        subtitle: "关卡配置未能载入，正在执行最小的动物三消任务。",
        columns,
        rows,
        layerCounts,
        totalTiles: 18,
        kinds: Object.freeze(TILE_LIBRARY.slice(0, 3).map((kind) => Object.freeze({ ...kind }))),
        traySize: 7,
        tools: Object.freeze({ undo: 1, shuffle: 1, hint: 1 }),
        seed: 7,
        theme: normalizeTheme(THEMES.garden),
      }));
    }

    return Object.freeze({
      list: Object.freeze(levels),
      errors: Object.freeze(errors),
      defaults: Object.freeze({
        tileLibrary: TILE_LIBRARY,
        theme: normalizeTheme(THEMES.garden),
        layerCounts: DEFAULT_LAYER_COUNTS,
      }),
    });
  }

  const catalog = buildCatalog(RAW_LEVELS);
  global.StarStackLevels = Object.freeze({
    list: catalog.list,
    errors: catalog.errors,
    defaults: catalog.defaults,
    tileLibrary: Object.freeze(TILE_LIBRARY.map((kind) => Object.freeze({ ...kind }))),
    createCatalog: buildCatalog,
  });
})(typeof window !== "undefined" ? window : globalThis);
