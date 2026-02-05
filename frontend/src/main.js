import { Events } from "@wailsio/runtime";

// ---------------------------------------------------------
// ✅ 核心修复：路径必须匹配你截图里的 "changeme"
// ---------------------------------------------------------
import * as App from "../bindings/changeme/bilibreakservice.js";

const $ = (id) => document.getElementById(id);

const els = {
  statusPill: $("statusPill"),
  btnStartStop: $("btnStartStop"),
  statTotal: $("statTotal"),
  statNext: $("statNext"),
  statWindow: $("statWindow"),
  statProcess: $("statProcess"),
  btnManual: $("btnManual"),
  btnReset: $("btnReset"),
  intervalRange: $("intervalRange"),
  intervalNumber: $("intervalNumber"),
  intervalNote: $("intervalNote"),
  toggleSystem: $("toggleSystem"),
  togglePopup: $("togglePopup"),
  toggleSound: $("toggleSound"),
  snoozeNumber: $("snoozeNumber"),
  btnSnooze: $("btnSnooze"),
  snoozeHint: $("snoozeHint"),
  keywords: $("keywords"),
  processes: $("processes"),
  toggleAutoStart: $("toggleAutoStart"),
  btnSave: $("btnSave"),
  saveHint: $("saveHint"),
  modalOverlay: $("modalOverlay"),
  modalBody: $("modalBody"),
  modalOk: $("modalOk"),
  modalSnooze: $("modalSnooze"),
};

let state = {
  cfg: null,
  stats: null,
  dirty: false,
};

function markDirty(on = true) {
  state.dirty = on;
  els.saveHint.textContent = on ? "未保存" : "";
}

function clampInt(v, min, max) {
  const n = Number.parseInt(String(v), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function splitList(text) {
  return String(text || "")
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtHMS(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function fmtMMSS(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function applyCfgToUI(cfg) {
  if (!cfg) return;
  els.intervalRange.value = String(cfg.intervalMinutes ?? 30);
  els.intervalNumber.value = String(cfg.intervalMinutes ?? 30);
  els.toggleSystem.checked = !!cfg.notifySystem;
  els.togglePopup.checked = !!cfg.notifyPopup;
  els.toggleSound.checked = !!cfg.notifySound;
  els.snoozeNumber.value = String(cfg.snoozeMinutes ?? 10);
  els.keywords.value = (cfg.keywords || []).join(", ");
  els.processes.value = (cfg.processes || []).join(", ");
  els.toggleAutoStart.checked = !!cfg.autoStart;
}

function collectCfgFromUI() {
  const intervalMinutes = clampInt(els.intervalNumber.value, 1, 240);
  const snoozeMinutes = clampInt(els.snoozeNumber.value, 0, 240);
  return {
    intervalMinutes,
    monitorEnabled: state.cfg?.monitorEnabled ?? true,
    notifySystem: !!els.toggleSystem.checked,
    notifyPopup: !!els.togglePopup.checked,
    notifySound: !!els.toggleSound.checked,
    snoozeMinutes,
    autoStart: !!els.toggleAutoStart.checked,
    keywords: splitList(els.keywords.value),
    processes: splitList(els.processes.value),
  };
}

function renderStats(stats) {
  if (!stats) return;
  els.statTotal.textContent = fmtHMS(stats.totalWatchedSeconds);
  if (typeof stats.nextBreakInSeconds === "number") {
    els.statNext.textContent = fmtMMSS(stats.nextBreakInSeconds);
  } else {
    els.statNext.textContent = "--:--";
  }
  els.statWindow.textContent = stats.activeTitle || "--";
  els.statProcess.textContent = stats.activeProcess || "--";

  if (stats.running) {
    els.statusPill.classList.remove("pill--stopped");
    els.statusPill.classList.add("pill--running");
    els.statusPill.textContent = stats.watching ? "监测中 · 计时中" : "监测中 · 未识别到B站";
    els.btnStartStop.textContent = "停止监控";
  } else {
    els.statusPill.classList.remove("pill--running");
    els.statusPill.classList.add("pill--stopped");
    els.statusPill.textContent = "未运行";
    els.btnStartStop.textContent = "启动监控";
  }

  if (stats.snoozedUntil) {
    els.snoozeHint.textContent = `已 Snooze 到：${stats.snoozedUntil.replace("T", " ").replace("Z", "")}`;
  } else {
    els.snoozeHint.textContent = "";
  }
}

function showModal(message) {
  els.modalBody.textContent = message || "";
  els.modalOverlay.classList.remove("hidden");
}

function hideModal() {
  els.modalOverlay.classList.add("hidden");
}

function beep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 220);
  } catch (e) {
    console.warn("beep failed:", e);
  }
}

async function refreshOnce() {
  try {
    // ✅ 使用 App (从 changeme 文件夹导入的)
    const cfg = await App.GetConfig();
    state.cfg = cfg;
    applyCfgToUI(cfg);
    const stats = await App.GetStats();
    state.stats = stats;
    renderStats(stats);
    markDirty(false);
  } catch (e) {
    console.error("refreshOnce failed:", e);
    els.saveHint.textContent = "连接后端失败";
  }
}

function wireUI() {
  const syncInterval = (from) => {
    const v = clampInt(from.value, 1, 240);
    els.intervalRange.value = String(v);
    els.intervalNumber.value = String(v);
    els.intervalNote.textContent = `当前：${v} 分钟（最小 1 分钟）`;
    markDirty(true);
  };

  els.intervalRange.addEventListener("input", () => syncInterval(els.intervalRange));
  els.intervalNumber.addEventListener("input", () => syncInterval(els.intervalNumber));

  document.querySelectorAll(".chip[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = clampInt(btn.getAttribute("data-preset"), 1, 240);
      els.intervalRange.value = String(v);
      els.intervalNumber.value = String(v);
      els.intervalNote.textContent = `当前：${v} 分钟（最小 1 分钟）`;
      markDirty(true);
    });
  });

  [
    els.toggleSystem,
    els.togglePopup,
    els.toggleSound,
    els.toggleAutoStart,
    els.snoozeNumber,
    els.keywords,
    els.processes,
  ].forEach((el) => el.addEventListener("input", () => markDirty(true)));

  els.btnSave.addEventListener("click", async () => {
    els.saveHint.textContent = "保存中...";
    try {
      const cfg = collectCfgFromUI();
      await App.SetConfig(cfg); // ✅ Direct call
      state.cfg = cfg;
      markDirty(false);
      els.saveHint.textContent = "已保存";
      setTimeout(() => (els.saveHint.textContent = ""), 1200);
    } catch (e) {
      console.error(e);
      els.saveHint.textContent = "保存失败";
    }
  });

  els.btnStartStop.addEventListener("click", async () => {
    try {
      if (state.stats?.running) {
        await App.Stop(); // ✅ Direct call
      } else {
        await App.Start(); // ✅ Direct call
      }
    } catch (e) {
      console.error(e);
    }
  });

  els.btnManual.addEventListener("click", async () => {
    try {
      await App.ManualRemind(); // ✅ Direct call
    } catch (e) {
      console.error(e);
    }
  });

  els.btnReset.addEventListener("click", async () => {
    try {
      await App.ResetToday(); // ✅ Direct call
    } catch (e) {
      console.error(e);
    }
  });

  els.btnSnooze.addEventListener("click", async () => {
    const mins = clampInt(els.snoozeNumber.value, 0, 240);
    try {
      await App.Snooze(mins); // ✅ Direct call
    } catch (e) {
      console.error(e);
    }
  });

  els.modalOk.addEventListener("click", hideModal);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) hideModal();
  });
  els.modalSnooze.addEventListener("click", async () => {
    const mins = clampInt(els.snoozeNumber.value, 0, 240);
    try {
      await App.Snooze(mins); // ✅ Direct call
    } catch (e) {
      console.error(e);
    } finally {
      hideModal();
    }
  });
}

function wireEvents() {
  Events.On("bili:stats", (event) => {
    state.stats = event.data;
    renderStats(event.data);
  });

  Events.On("bili:config", (event) => {
    state.cfg = event.data;
    applyCfgToUI(event.data);
  });

  Events.On("bili:remind", (event) => {
    const payload = event.data || {};
    if (state.cfg?.notifySound) beep();
    if (state.cfg?.notifyPopup) showModal(payload.message || "该休息啦～");
  });
}

async function main() {
  wireUI();
  wireEvents();
  setTimeout(refreshOnce, 100);
}

main();