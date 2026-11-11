(function (global) {
  "use strict";

  class StarStackGame extends EventTarget {
    constructor(levels, options) {
      super();
      if (!Array.isArray(levels) || levels.length === 0) {
        throw new Error("StarStackGame 至少需要一个有效关卡。");
      }
      if (!global.StarStackBoard) {
        throw new Error("棋盘引擎未载入。");
      }

      this.levels = levels;
      this.audio = options && options.audio ? options.audio : null;
      this.level = levels[0];
      this.levelIndex = 0;
      this.status = "idle";
      this.score = 0;
      this.best = this.readBestScore();
      this.tiles = [];
      this.tray = [];
      this.tools = { undo: 0, shuffle: 0, hint: 0 };
      this.matchedCount = 0;
      this.elapsed = 0;
      this.combo = 0;
      this.lastMove = null;
      this.matchLock = false;
      this.pendingMatch = null;
      this.pendingFail = null;
      this.levelStartScore = 0;
      this.lastLevelStats = null;
      this.failureReason = "";
      this.rng = global.StarStackBoard.createRng(this.level.seed);
      this.lastClock = performance.now();

      this.clock = global.setInterval(() => this.tick(), 250);
      this.emitHud(true);
      this.emitState();
    }

    destroy() {
      global.clearInterval(this.clock);
      global.clearTimeout(this.pendingMatch);
      global.clearTimeout(this.pendingFail);
    }

    readBestScore() {
      try {
        const value = Number(global.localStorage.getItem("star-stack-best"));
        return Number.isFinite(value) && value > 0 ? value : 0;
      } catch (_error) {
        return 0;
      }
    }

    saveBestScore() {
      this.best = Math.max(this.best, this.score);
      try {
        global.localStorage.setItem("star-stack-best", String(this.best));
      } catch (_error) {
        // Local storage is optional.
      }
    }

    tick() {
      const now = performance.now();
      if (this.status === "playing") {
        this.elapsed += (now - this.lastClock) / 1000;
        this.emitHud();
      }
      this.lastClock = now;
    }

    startRun() {
      this.score = 0;
      this.levelIndex = 0;
      this.lastLevelStats = null;
      this.failureReason = "";
      this.loadLevel(0);
    }

    retryLevel() {
      this.score = this.levelStartScore;
      this.failureReason = "";
      this.loadLevel(this.levelIndex);
    }

    returnToTitle() {
      this.clearPendingTimers();
      this.status = "idle";
      this.levelIndex = 0;
      this.level = this.levels[0];
      this.tiles = [];
      this.tray = [];
      this.matchedCount = 0;
      this.elapsed = 0;
      this.combo = 0;
      this.lastMove = null;
      this.matchLock = false;
      this.emitTheme();
      this.emitBoard({ type: "title" });
      this.emitHud(true);
      this.emitState();
    }

    loadLevel(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.levels.length) {
        this.status = "victory";
        this.emitState();
        return;
      }

      this.clearPendingTimers();
      const level = this.levels[index];
      const board = global.StarStackBoard.generateBoard(level);
      this.level = level;
      this.levelIndex = index;
      this.tiles = board.tiles;
      this.solutionOrder = board.solutionOrder;
      this.availableIds = board.availableIds;
      this.tray = [];
      this.matchedCount = 0;
      this.elapsed = 0;
      this.combo = 0;
      this.lastMove = null;
      this.matchLock = false;
      this.failureReason = "";
      this.tools = { ...level.tools };
      this.levelStartScore = this.score;
      this.rng = global.StarStackBoard.createRng(level.seed + index * 7919 + Date.now() % 10000);
      this.lastClock = performance.now();
      this.status = "playing";

      this.emitTheme();
      this.emit("levelstart", {
        level,
        levelIndex: index,
        totalLevels: this.levels.length,
      });
      this.emitBoard({ type: "level" });
      this.emitHud(true);
      this.emitState();
    }

    clearPendingTimers() {
      global.clearTimeout(this.pendingMatch);
      global.clearTimeout(this.pendingFail);
      this.pendingMatch = null;
      this.pendingFail = null;
    }

    getKind(kindId) {
      return this.level.kinds.find((kind) => kind.id === kindId) || null;
    }

    isTileAvailable(tile) {
      return Boolean(tile && tile.state === "board" && !global.StarStackBoard.isCovered(tile, this.tiles));
    }

    chooseTile(tileId) {
      if (this.status !== "playing" || this.matchLock) return false;
      const tile = this.tiles.find((item) => item.id === tileId);
      if (!tile || tile.state !== "board") return false;

      if (!this.isTileAvailable(tile)) {
        this.audio && this.audio.play("invalid");
        this.emit("feedback", { tone: "danger", text: "这只小动物被上面的伙伴压住了" });
        return false;
      }

      tile.state = "tray";
      this.insertTrayTile(tile);
      this.lastMove = { tileId: tile.id, kindId: tile.kindId };
      this.audio && this.audio.play("pick");
      this.emitBoard({ type: "pick", tileId: tile.id });

      const matchingTiles = this.tray.filter((item) => item.kindId === tile.kindId);
      if (matchingTiles.length >= 3) {
        this.matchLock = true;
        this.combo = Math.min(5, this.combo + 1);
        const points = 120 * this.combo * (this.levelIndex + 1);
        this.pendingMatch = global.setTimeout(
          () => this.resolveMatch(tile.kindId, points),
          340
        );
        this.audio && this.audio.play("match");
        this.emit("trayMatch", {
          kindId: tile.kindId,
          tileIds: matchingTiles.slice(0, 3).map((item) => item.id),
          points,
          combo: this.combo,
        });
        this.emitHud(true);
        return true;
      }

      if (this.tray.length >= this.level.traySize) {
        this.matchLock = true;
        this.pendingFail = global.setTimeout(() => this.fail("tray-full"), 340);
        this.emit("feedback", { tone: "danger", text: "小窝挤满了，动物们快放不下了" });
      }
      this.emitHud(true);
      return true;
    }

    insertTrayTile(tile) {
      let insertAt = this.tray.length;
      for (let index = this.tray.length - 1; index >= 0; index -= 1) {
        if (this.tray[index].kindId === tile.kindId) {
          insertAt = index + 1;
          break;
        }
      }
      this.tray.splice(insertAt, 0, tile);
    }

    resolveMatch(kindId, points) {
      this.pendingMatch = null;
      const matches = this.tray.filter((tile) => tile.kindId === kindId).slice(0, 3);
      if (matches.length < 3) {
        this.matchLock = false;
        return;
      }
      const matchIds = new Set(matches.map((tile) => tile.id));
      matches.forEach((tile) => {
        tile.state = "matched";
      });
      this.tray = this.tray.filter((tile) => !matchIds.has(tile.id));
      this.matchedCount += 3;
      this.score += points;
      this.lastMove = null;
      this.matchLock = false;
      this.audio && this.audio.play("clear");
      this.emitBoard({ type: "match", tileIds: [...matchIds], points });
      this.emitHud(true);
      this.emit("feedback", {
        tone: "success",
        text: `三只相同动物已回家 · +${points} · 连携 ×${this.combo}`,
      });

      if (this.matchedCount >= this.level.totalTiles) {
        this.completeLevel();
      }
    }

    useUndo() {
      if (this.tools.undo <= 0 || !this.lastMove) return false;
      if (this.status === "playing" && this.matchLock) return false;
      if (this.status !== "playing" && this.status !== "gameOver") return false;

      const tile = this.tiles.find((item) => item.id === this.lastMove.tileId && item.state === "tray");
      if (!tile) return false;

      global.clearTimeout(this.pendingFail);
      this.pendingFail = null;
      this.tray = this.tray.filter((item) => item.id !== tile.id);
      tile.state = "board";
      this.tools.undo -= 1;
      this.lastMove = null;
      this.matchLock = false;
      this.status = "playing";
      this.failureReason = "";
      this.lastClock = performance.now();
      this.audio && this.audio.play("undo");
      this.emitBoard({ type: "undo", tileId: tile.id });
      this.emitHud(true);
      this.emitState();
      this.emit("feedback", { tone: "success", text: "已放回上一只小动物" });
      return true;
    }

    useShuffle() {
      if (this.status !== "playing" || this.matchLock || this.tools.shuffle <= 0) return false;
      const remaining = this.tiles.filter((tile) => tile.state === "board");
      if (remaining.length < 2) return false;
      global.StarStackBoard.shuffleRemainingKinds(this.tiles, this.rng);
      this.tools.shuffle -= 1;
      this.audio && this.audio.play("shuffle");
      this.emitBoard({ type: "shuffle" });
      this.emitHud(true);
      this.emit("feedback", { tone: "info", text: "小动物的排列已经重新洗过" });
      return true;
    }

    useHint() {
      if (this.status !== "playing" || this.matchLock || this.tools.hint <= 0) return null;
      const hint = global.StarStackBoard.findHint(this.tiles);
      if (!hint || hint.tileIds.length === 0) return null;
      this.tools.hint -= 1;
      this.audio && this.audio.play("hint");
      this.emit("hint", hint);
      this.emitHud(true);
      this.emit("feedback", {
        tone: "info",
        text: hint.complete ? "找到三只可以配对的小动物啦" : "暂时凑不齐三只，已高亮相同的小动物",
      });
      return hint;
    }

    pause() {
      if (this.status !== "playing" || this.matchLock) return;
      this.status = "paused";
      this.tick();
      this.emitState();
    }

    resume() {
      if (this.status !== "paused") return;
      this.status = "playing";
      this.lastClock = performance.now();
      this.emitState();
    }

    togglePause() {
      if (this.status === "playing") this.pause();
      else if (this.status === "paused") this.resume();
    }

    fail(reason) {
      if (this.status !== "playing") return;
      this.status = "gameOver";
      this.failureReason = reason || "tray-full";
      this.matchLock = false;
      this.saveBestScore();
      this.audio && this.audio.play("gameover");
      this.emitHud(true);
      this.emitState();
    }

    completeLevel() {
      if (this.status !== "playing") return;
      const toolBonus = (this.tools.undo + this.tools.shuffle + this.tools.hint) * 100;
      this.score += toolBonus;
      this.lastLevelStats = {
        levelName: this.level.name,
        matched: this.matchedCount,
        total: this.level.totalTiles,
        score: this.score,
        elapsed: this.elapsed,
        toolBonus,
      };
      this.saveBestScore();

      if (this.levelIndex >= this.levels.length - 1) {
        this.status = "victory";
        this.audio && this.audio.play("victory");
      } else {
        this.status = "levelClear";
        this.audio && this.audio.play("level");
      }
      this.emitHud(true);
      this.emitState();
    }

    continueRun() {
      if (this.status !== "levelClear") return;
      if (this.levelIndex + 1 >= this.levels.length) {
        this.status = "victory";
        this.emitState();
        return;
      }
      this.loadLevel(this.levelIndex + 1);
    }

    getBoardState() {
      const availableIds = global.StarStackBoard.getAvailableIds(this.tiles);
      this.availableIds = availableIds;
      return {
        tiles: this.tiles.map((tile) => ({ ...tile })),
        tray: this.tray.map((tile) => ({ ...tile })),
        availableIds: [...availableIds],
        matchedCount: this.matchedCount,
        totalTiles: this.level.totalTiles,
        traySize: this.level.traySize,
        kinds: this.level.kinds,
        levelIndex: this.levelIndex,
      };
    }

    snapshot() {
      return {
        status: this.status,
        score: this.score,
        best: this.best,
        levelIndex: this.levelIndex,
        totalLevels: this.levels.length,
        levelName: this.level.name,
        levelSubtitle: this.level.subtitle,
        matchedCount: this.matchedCount,
        totalTiles: this.level.totalTiles,
        trayCount: this.tray.length,
        traySize: this.level.traySize,
        elapsed: this.elapsed,
        combo: this.combo,
        tools: { ...this.tools },
        canUndo: Boolean(this.tools.undo > 0 && this.lastMove),
        interactionLocked: this.matchLock,
        failureReason: this.failureReason,
        lastLevelStats: this.lastLevelStats,
        nextLevel: this.levelIndex + 1 < this.levels.length ? this.levels[this.levelIndex + 1] : null,
      };
    }

    emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    emitTheme() {
      this.emit("theme", { theme: this.level.theme });
    }

    emitBoard(change) {
      this.emit("board", Object.assign(this.getBoardState(), { change: change || null }));
    }

    emitHud(force) {
      this.emit("hud", Object.assign(this.snapshot(), { force: Boolean(force) }));
    }

    emitState(extra) {
      this.emit("state", Object.assign(this.snapshot(), extra || {}));
    }
  }

  global.StarStackGame = StarStackGame;
})(typeof window !== "undefined" ? window : globalThis);
