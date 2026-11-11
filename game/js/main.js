(function (global) {
  "use strict";

  function showFatalError(error) {
    console.error(error);
    const overlay = document.getElementById("overlay");
    const startScreen = document.querySelector('[data-screen="start"]');
    if (!overlay || !startScreen) return;
    overlay.classList.remove("is-hidden");
    document.querySelectorAll("[data-screen]").forEach((screen) => {
      screen.classList.toggle("is-active", screen === startScreen);
    });
    const panel = startScreen.querySelector(".screen-panel");
    if (panel) {
      panel.innerHTML = `
        <p class="eyebrow danger-text">BOOT FAILURE</p>
        <h2>动物乐园未能启动</h2>
        <p class="screen-copy">请确认脚本文件完整，并使用现代浏览器打开。错误信息：${String(error.message || error)}</p>
      `;
    }
  }


  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("离线缓存注册失败，但游戏仍可正常游玩：", error);
      });
    }, { once: true });
  }

  function boot() {
    try {
      const levels = global.StarStackLevels;
      if (!levels || !Array.isArray(levels.list) || levels.list.length === 0) {
        throw new Error("无法载入关卡配置。");
      }
      if (!global.StarStackBoard || !global.StarStackGame || !global.StarStackUI || !global.StarStackAudio) {
        throw new Error("游戏脚本未完整载入。");
      }

      const audio = new global.StarStackAudio();
      const game = new global.StarStackGame(levels.list, { audio });
      const ui = new global.StarStackUI(game, audio, { errors: levels.errors });
      ui.init();
      global.starStack = { game, ui, audio, levels };
    } catch (error) {
      showFatalError(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  registerServiceWorker();
})(window);
