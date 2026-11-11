(function (global) {
  "use strict";

  class StarStackAudio {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
    }

    unlock() {
      if (!this.enabled) return;
      if (!this.context) {
        const AudioContext = global.AudioContext || global.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.052;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.master && this.context) {
        this.master.gain.setTargetAtTime(this.enabled ? 0.052 : 0, this.context.currentTime, 0.02);
      }
      if (this.enabled) this.unlock();
    }

    tone(frequency, duration, type, volume, endFrequency, delay) {
      if (!this.enabled || !this.context || !this.master) return;
      const start = this.context.currentTime + (delay || 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
      }
      gain.gain.setValueAtTime(Math.max(0.0001, volume || 0.03), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    play(name) {
      if (!this.enabled) return;
      this.unlock();
      switch (name) {
        case "pick":
          this.tone(420, 0.07, "triangle", 0.025, 560);
          break;
        case "match":
          this.tone(560, 0.18, "sine", 0.035, 840);
          this.tone(720, 0.18, "triangle", 0.025, 1080, 0.07);
          break;
        case "clear":
          this.tone(740, 0.22, "sine", 0.035, 1120);
          this.tone(980, 0.2, "triangle", 0.022, 1320, 0.08);
          break;
        case "invalid":
          this.tone(150, 0.12, "sawtooth", 0.025, 105);
          break;
        case "undo":
          this.tone(360, 0.15, "triangle", 0.03, 240);
          break;
        case "shuffle":
          this.tone(300, 0.12, "triangle", 0.025, 540);
          this.tone(420, 0.16, "sine", 0.02, 240, 0.06);
          break;
        case "hint":
          this.tone(620, 0.12, "sine", 0.025, 820);
          this.tone(820, 0.12, "sine", 0.02, 1020, 0.1);
          break;
        case "level":
          [392, 523, 659].forEach((freq, index) => this.tone(freq, 0.3, "triangle", 0.03, freq * 1.08, index * 0.12));
          break;
        case "victory":
          [523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, 0.38, "triangle", 0.035, freq * 1.1, index * 0.11));
          break;
        case "gameover":
          this.tone(210, 0.55, "sawtooth", 0.028, 75);
          break;
        default:
          break;
      }
    }
  }

  global.StarStackAudio = StarStackAudio;
})(typeof window !== "undefined" ? window : globalThis);
