(function (global) {
  "use strict";

  class StarStackUI {
    constructor(game, audio, config) {
      this.game = game;
      this.audio = audio;
      this.configErrors = (config && config.errors) || [];
      this.tileElements = new Map();
      this.traySizeRendered = 0;
      this.hintTimer = null;
      this.toastTimer = null;
      this.announcementTimer = null;
      this.resizeFrame = null;
      this.startedOnce = false;
      this.currentLevelId = null;

      const byId = (id) => document.getElementById(id);
      this.elements = {
        app: byId("app-shell"),
        overlay: byId("overlay"),
        levelValue: byId("level-value"),
        progressValue: byId("progress-value"),
        progressBar: byId("progress-bar"),
        timerValue: byId("timer-value"),
        scoreValue: byId("score-value"),
        bestValue: byId("best-value"),
        levelKicker: byId("level-kicker"),
        levelName: byId("level-name"),
        levelSubtitle: byId("level-subtitle"),
        comboBadge: byId("combo-badge"),
        comboValue: byId("combo-value"),
        board: byId("game-board"),
        effects: byId("effects-layer"),
        tray: byId("tray"),
        trayCount: byId("tray-count"),
        undoButton: byId("undo-button"),
        shuffleButton: byId("shuffle-button"),
        hintButton: byId("hint-button"),
        undoCount: byId("undo-count"),
        shuffleCount: byId("shuffle-count"),
        hintCount: byId("hint-count"),
        soundButton: byId("sound-button"),
        soundLabel: byId("sound-label"),
        pauseButton: byId("pause-button"),
        announcement: byId("announcement"),
        toast: byId("toast"),
        clearTitle: byId("clear-title"),
        clearCopy: byId("clear-copy"),
        clearMatched: byId("clear-matched"),
        clearTime: byId("clear-time"),
        clearScore: byId("clear-score"),
        gameoverCopy: byId("gameover-copy"),
        gameoverScore: byId("gameover-score"),
        gameoverProgress: byId("gameover-progress"),
        gameoverBest: byId("gameover-best"),
        rescueButton: byId("rescue-button"),
        victoryScore: byId("victory-score"),
        victoryBest: byId("victory-best"),
        runMeta: byId("run-meta"),
        runSummary: byId("run-summary"),
      };
      this.screens = Array.from(document.querySelectorAll("[data-screen]"));
    }

    init() {
      this.bindEvents();
      this.restoreSoundPreference();
      this.applyTheme(this.game.level.theme);
      this.updateRunSummary();
      this.renderBoard(this.game.getBoardState());
      this.updateHud(this.game.snapshot());
      this.syncState(this.game.snapshot());
      if (this.configErrors.length > 0) console.warn("关卡配置提示：\n" + this.configErrors.join("\n"));
    }


    updateRunSummary() {
      const levels = this.game.levels;
      const tileTotal = levels.reduce((sum, level) => sum + level.totalTiles, 0);
      const minMinutes = Math.max(5, Math.round(levels.length * 2.5));
      const maxMinutes = Math.max(minMinutes + 3, levels.length * 5);
      this.elements.runMeta.textContent = `${levels.length} 关 · 约 ${minMinutes}–${maxMinutes} 分钟 · 支持撤销、洗牌与提示`;
      this.elements.runSummary.textContent = `${levels.length} MEADOWS · ${tileTotal} ANIMALS · ONE RUN`;
    }

    bindEvents() {
      this.game.addEventListener("theme", (event) => this.applyTheme(event.detail.theme));
      this.game.addEventListener("board", (event) => this.renderBoard(event.detail));
      this.game.addEventListener("hud", (event) => this.updateHud(event.detail));
      this.game.addEventListener("state", (event) => this.syncState(event.detail));
      this.game.addEventListener("levelstart", (event) => this.handleLevelStart(event.detail));
      this.game.addEventListener("trayMatch", (event) => this.animateMatch(event.detail));
      this.game.addEventListener("hint", (event) => this.showHint(event.detail));
      this.game.addEventListener("feedback", (event) => this.showFeedback(event.detail));

      this.elements.soundButton.addEventListener("click", () => {
        const enabled = !this.audio.enabled;
        this.audio.setEnabled(enabled);
        this.persistSoundPreference(enabled);
        this.updateSoundButton(enabled);
      });

      this.elements.pauseButton.addEventListener("click", () => {
        this.audio.unlock();
        this.game.togglePause();
      });

      this.elements.undoButton.addEventListener("click", () => {
        this.audio.unlock();
        if (!this.game.useUndo()) this.showToast("当前没有可以放回的小动物", "danger");
      });
      this.elements.shuffleButton.addEventListener("click", () => {
        this.audio.unlock();
        if (!this.game.useShuffle()) this.showToast("当前无法洗牌", "danger");
      });
      this.elements.hintButton.addEventListener("click", () => {
        this.audio.unlock();
        if (!this.game.useHint()) this.showToast("当前没有可用提示", "danger");
      });

      document.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
          this.audio.unlock();
          const action = button.dataset.action;
          if (action === "start" || action === "restart") {
            this.startedOnce = true;
            this.game.startRun();
          } else if (action === "continue") {
            this.game.continueRun();
          } else if (action === "retry") {
            this.game.retryLevel();
          } else if (action === "resume") {
            this.game.resume();
          } else if (action === "undo-rescue") {
            this.game.useUndo();
          } else if (action === "title") {
            this.game.returnToTitle();
          }
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.code === "KeyP" || event.code === "Escape") {
          if (this.game.status === "playing" || this.game.status === "paused") {
            event.preventDefault();
            this.game.togglePause();
          }
          return;
        }
        if (event.code !== "Enter") return;
        if (event.target && event.target.closest && event.target.closest("button")) return;
        if (this.game.status === "idle") this.game.startRun();
        else if (this.game.status === "levelClear") this.game.continueRun();
        else if (this.game.status === "gameOver") this.game.retryLevel();
        else if (this.game.status === "victory") this.game.startRun();
      });

      global.addEventListener("resize", () => {
        global.cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = global.requestAnimationFrame(() => {
          this.renderBoard(this.game.getBoardState());
        });
      });
    }

    handleLevelStart(detail) {
      this.currentLevelId = detail.level.id;
      this.tileElements.clear();
      this.elements.board.replaceChildren();
      this.applyTheme(detail.level.theme);
      this.elements.levelKicker.textContent = `MEADOW ${String(detail.levelIndex + 1).padStart(2, "0")} / ${String(detail.totalLevels).padStart(2, "0")}`;
      this.elements.levelName.textContent = detail.level.name;
      this.elements.levelSubtitle.textContent = detail.level.subtitle;
      this.showAnnouncement(`${detail.level.name} · ${detail.level.totalTiles} 只小动物`);
      if (this.startedOnce && this.configErrors.length > 0) {
        this.showToast(`关卡配置有 ${this.configErrors.length} 条提示，详见控制台`, "danger", 3000);
        this.configErrors = [];
      }
    }

    renderBoard(state) {
      if (!state) return;
      const boardWidth = this.elements.board.clientWidth;
      const boardHeight = this.elements.board.clientHeight;
      const level = this.game.level;
      if (!boardWidth || !boardHeight) return;

      const cellWidth = boardWidth / level.columns;
      const cellHeight = boardHeight / level.rows;
      const size = Math.max(22, Math.min(cellWidth, cellHeight) * 0.9);
      const activeBoardIds = new Set();
      const availableIds = new Set(state.availableIds || []);

      state.tiles.forEach((tile) => {
        if (tile.state !== "board") return;
        activeBoardIds.add(tile.id);
        const kind = state.kinds.find((item) => item.id === tile.kindId);
        let element = this.tileElements.get(tile.id);

        if (!element) {
          element = document.createElement("button");
          element.type = "button";
          element.className = "game-tile is-entering";
          element.dataset.tileId = tile.id;
          element.style.setProperty("--enter-delay", `${Math.min(420, (tile.sequence % 24) * 18)}ms`);
          element.addEventListener("click", () => this.handleTileClick(tile.id, element));
          element.addEventListener("animationend", () => element.classList.remove("is-entering"), { once: true });
          this.elements.board.appendChild(element);
          this.tileElements.set(tile.id, element);
        }

        const centerX = (tile.x + 0.5) * cellWidth;
        const centerY = (tile.y + 0.5) * cellHeight;
        const left = centerX - size / 2;
        const top = centerY - size / 2;
        const isAvailable = availableIds.has(tile.id);

        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.zIndex = String(10 + tile.layer * 30 + Math.round(tile.y * 2));
        element.style.setProperty("--tile-font-size", `${Math.max(17, size * 0.43)}px`);
        element.style.setProperty("--kind-color", kind ? kind.color : "#507167");
        element.textContent = kind ? kind.glyph : "?";
        element.classList.toggle("is-available", isAvailable);
        element.classList.toggle("is-covered", !isAvailable);
        element.setAttribute("aria-disabled", String(!isAvailable));
        element.setAttribute("aria-label", `${kind ? kind.label : "未知小动物"}，第 ${tile.layer + 1} 层${isAvailable ? "，可点击" : "，被遮挡"}`);
        element.dataset.layer = String(tile.layer);
      });

      this.tileElements.forEach((element, tileId) => {
        if (!activeBoardIds.has(tileId)) {
          element.remove();
          this.tileElements.delete(tileId);
        }
      });

      if (state.change && state.change.type === "shuffle") this.animateShuffle();
      this.renderTray(state);
    }

    renderTray(state) {
      if (this.traySizeRendered !== state.traySize) {
        this.elements.tray.replaceChildren();
        for (let index = 0; index < state.traySize; index += 1) {
          const slot = document.createElement("div");
          slot.className = "tray-slot";
          this.elements.tray.appendChild(slot);
        }
        this.traySizeRendered = state.traySize;
      }

      const slots = Array.from(this.elements.tray.children);
      state.tray.forEach((tile, index) => {
        const slot = slots[index];
        if (!slot) return;
        const kind = state.kinds.find((item) => item.id === tile.kindId);
        slot.replaceChildren();
        const chip = document.createElement("div");
        chip.className = "tray-tile";
        chip.dataset.tileId = tile.id;
        chip.style.setProperty("--kind-color", kind ? kind.color : "#507167");
        chip.textContent = kind ? kind.glyph : "?";
        chip.title = kind ? kind.label : "小动物";
        slot.appendChild(chip);
      });
      for (let index = state.tray.length; index < slots.length; index += 1) {
        if (slots[index]) slots[index].replaceChildren();
      }
      this.elements.trayCount.textContent = `${state.tray.length} / ${state.traySize}`;
    }

    handleTileClick(tileId, element) {
      if (this.game.status !== "playing" || this.game.matchLock) return;
      const rect = element.getBoundingClientRect();
      this.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, element.style.getPropertyValue("--kind-color"), 7);
      this.game.chooseTile(tileId);
    }

    animateShuffle() {
      this.tileElements.forEach((element, index) => {
        element.classList.add("is-shuffling");
        global.setTimeout(() => element.classList.remove("is-shuffling"), 400 + (index % 5) * 22);
      });
    }

    animateMatch(detail) {
      const ids = new Set(detail.tileIds || []);
      this.elements.tray.querySelectorAll(".tray-tile").forEach((chip) => {
        if (!ids.has(chip.dataset.tileId)) return;
        chip.classList.add("is-matching");
        const rect = chip.getBoundingClientRect();
        this.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, chip.style.getPropertyValue("--kind-color"), 12);
      });
      this.showAnnouncement(`三消 · +${detail.points}`);
    }

    showHint(detail) {
      global.clearTimeout(this.hintTimer);
      detail.tileIds.forEach((tileId) => {
        const element = this.tileElements.get(tileId);
        if (element) element.classList.add("is-hint");
      });
      this.hintTimer = global.setTimeout(() => {
        this.tileElements.forEach((element) => element.classList.remove("is-hint"));
      }, 2050);
    }

    burstAt(clientX, clientY, color, count) {
      const layerRect = this.elements.effects.getBoundingClientRect();
      const localX = clientX - layerRect.left;
      const localY = clientY - layerRect.top;
      for (let index = 0; index < count; index += 1) {
        const particle = document.createElement("i");
        const angle = Math.random() * Math.PI * 2;
        const distance = 18 + Math.random() * 38;
        particle.className = "effect-particle";
        particle.style.left = `${localX}px`;
        particle.style.top = `${localY}px`;
        particle.style.setProperty("--effect-color", color || "var(--accent-2)");
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        particle.style.animationDelay = `${Math.random() * 55}ms`;
        this.elements.effects.appendChild(particle);
        global.setTimeout(() => particle.remove(), 760);
      }
    }

    updateHud(state) {
      const total = Math.max(1, state.totalLevels);
      const progress = state.totalTiles > 0 ? state.matchedCount / state.totalTiles : 0;
      this.elements.levelValue.textContent = `${state.levelIndex + 1} / ${total}`;
      this.elements.progressValue.textContent = `${state.matchedCount} / ${state.totalTiles}`;
      this.elements.progressBar.style.width = `${Math.min(100, progress * 100)}%`;
      this.elements.timerValue.textContent = this.formatTime(state.elapsed);
      this.elements.scoreValue.textContent = this.formatScore(state.score);
      this.elements.bestValue.textContent = this.formatScore(state.best);
      this.elements.trayCount.textContent = `${state.trayCount} / ${state.traySize}`;
      this.elements.comboBadge.hidden = state.combo < 1 || state.status !== "playing";
      this.elements.comboValue.textContent = `×${state.combo}`;

      this.elements.undoCount.textContent = `×${state.tools.undo}`;
      this.elements.shuffleCount.textContent = `×${state.tools.shuffle}`;
      this.elements.hintCount.textContent = `×${state.tools.hint}`;

      const canPlay = state.status === "playing" && !state.interactionLocked;
      this.elements.undoButton.disabled = !state.canUndo || state.tools.undo <= 0 ||
        !["playing", "gameOver"].includes(state.status) ||
        (state.status === "playing" && state.interactionLocked);
      this.elements.shuffleButton.disabled = !canPlay || state.tools.shuffle <= 0;
      this.elements.hintButton.disabled = !canPlay || state.tools.hint <= 0;

      const pauseEnabled = (state.status === "playing" && !state.interactionLocked) || state.status === "paused";
      this.elements.pauseButton.disabled = !pauseEnabled;
      const pauseLabel = this.elements.pauseButton.querySelector("b");
      if (pauseLabel) pauseLabel.textContent = state.status === "paused" ? "继续" : "暂停";
    }

    syncState(state) {
      const screenByStatus = {
        idle: "start",
        paused: "paused",
        levelClear: "levelClear",
        gameOver: "gameOver",
        victory: "victory",
      };

      this.updateHud(state);
      if (state.status === "playing") {
        this.hideOverlay();
      } else {
        this.showOverlay(screenByStatus[state.status] || "start");
      }

      if (state.status === "idle") {
        this.showOverlay("start");
        this.elements.board.replaceChildren();
        this.elements.tray.replaceChildren();
        this.tileElements.clear();
        this.traySizeRendered = 0;
      }

      if (state.status === "levelClear") {
        const stats = state.lastLevelStats || {};
        this.elements.clearTitle.textContent = `${state.levelName} 已完成`;
        this.elements.clearCopy.textContent = state.nextLevel
          ? `下一片草地「${state.nextLevel.name}」正在展开，所有道具会重新补充。`
          : "所有小动物都已经回家了。";
        this.elements.clearMatched.textContent = `${stats.matched || state.matchedCount} / ${stats.total || state.totalTiles}`;
        this.elements.clearTime.textContent = this.formatTime(stats.elapsed || state.elapsed);
        this.elements.clearScore.textContent = this.formatScore(state.score);
      }

      if (state.status === "gameOver") {
        this.elements.gameoverCopy.textContent =
          state.failureReason === "tray-full"
            ? "小窝没有空位，也没有凑出三只相同的小动物。可以先放回最后一只继续。"
            : "小动物们暂时挤成一团了。";
        this.elements.gameoverScore.textContent = this.formatScore(state.score);
        this.elements.gameoverProgress.textContent = `${state.matchedCount} / ${state.totalTiles}`;
        this.elements.gameoverBest.textContent = this.formatScore(state.best);
        this.elements.rescueButton.hidden = !state.canUndo || state.tools.undo <= 0;
      }

      if (state.status === "victory") {
        this.elements.victoryScore.textContent = this.formatScore(state.score);
        this.elements.victoryBest.textContent = this.formatScore(state.best);
      }
    }

    showOverlay(screenName) {
      this.elements.overlay.classList.remove("is-hidden");
      this.screens.forEach((screen) => {
        screen.classList.toggle("is-active", screen.dataset.screen === screenName);
      });
    }

    hideOverlay() {
      this.elements.overlay.classList.add("is-hidden");
    }

    applyTheme(theme) {
      if (!theme) return;
      const style = this.elements.app.style;
      style.setProperty("--accent", theme.accent);
      style.setProperty("--accent-2", theme.accent2);
      style.setProperty("--danger", theme.danger);
      style.setProperty("--text", theme.text);
      style.setProperty("--board", theme.board);
      style.setProperty("--tile-top", theme.tileTop);
      style.setProperty("--tile-bottom", theme.tileBottom);
      style.setProperty("--tile-edge", theme.tileEdge);
      style.setProperty("--page-start", theme.backgroundStart);
      style.setProperty("--page-end", theme.backgroundEnd);
    }

    showFeedback(detail) {
      if (!detail) return;
      const tone = detail.tone === "danger" ? "danger" : detail.tone === "success" ? "success" : "info";
      this.showToast(detail.text, tone, 1600);
    }

    showToast(text, tone, duration) {
      if (!text) return;
      this.elements.toast.textContent = text;
      this.elements.toast.className = "toast is-visible";
      if (tone === "danger") this.elements.toast.classList.add("is-danger");
      if (tone === "success") this.elements.toast.classList.add("is-success");
      global.clearTimeout(this.toastTimer);
      this.toastTimer = global.setTimeout(() => {
        this.elements.toast.classList.remove("is-visible");
      }, duration || 1700);
    }

    showAnnouncement(text) {
      if (!text) return;
      this.elements.announcement.textContent = text;
      this.elements.announcement.classList.remove("is-visible");
      void this.elements.announcement.offsetWidth;
      this.elements.announcement.classList.add("is-visible");
      global.clearTimeout(this.announcementTimer);
      this.announcementTimer = global.setTimeout(() => {
        this.elements.announcement.classList.remove("is-visible");
      }, 1950);
    }

    restoreSoundPreference() {
      let enabled = true;
      try {
        enabled = global.localStorage.getItem("star-stack-sound") !== "off";
      } catch (_error) {
        enabled = true;
      }
      this.audio.setEnabled(enabled);
      this.updateSoundButton(enabled);
    }

    persistSoundPreference(enabled) {
      try {
        global.localStorage.setItem("star-stack-sound", enabled ? "on" : "off");
      } catch (_error) {
        // Sound remains available for this session.
      }
    }

    updateSoundButton(enabled) {
      this.elements.soundButton.setAttribute("aria-pressed", String(enabled));
      this.elements.soundLabel.textContent = enabled ? "声音开" : "声音关";
      this.elements.soundButton.title = enabled ? "关闭声音" : "开启声音";
    }

    formatTime(seconds) {
      const safe = Math.max(0, Math.floor(Number(seconds) || 0));
      return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
    }

    formatScore(score) {
      return String(Math.max(0, Math.round(Number(score) || 0))).padStart(6, "0");
    }
  }

  global.StarStackUI = StarStackUI;
})(typeof window !== "undefined" ? window : globalThis);
