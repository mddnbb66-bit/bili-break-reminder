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
  statCumulative: $("statCumulative"),
  statNext: $("statNext"),
  statDailyAvg: $("statDailyAvg"),
  statWeeklyAvg: $("statWeeklyAvg"),
  statWindow: $("statWindow"),
  statProcess: $("statProcess"),
  btnManual: $("btnManual"),
  btnReset: $("btnReset"),
  btnClearNext: $("btnClearNext"),
  btnCycleCumulativeFormat: $("btnCycleCumulativeFormat"),
  cumulativeFormatHint: $("cumulativeFormatHint"),
  intervalRange: $("intervalRange"),
  intervalNumber: $("intervalNumber"),
  intervalNote: $("intervalNote"),
  alertLeadRange: $("alertLeadRange"),
  alertLeadNumber: $("alertLeadNumber"),
  toggleAutoShowNearBreak: $("toggleAutoShowNearBreak"),
  toggleSystem: $("toggleSystem"),
  togglePopup: $("togglePopup"),
  toggleSound: $("toggleSound"),
  snoozeNumber: $("snoozeNumber"),
  btnSnooze: $("btnSnooze"),
  snoozeHint: $("snoozeHint"),
  keywords: $("keywords"),
  processes: $("processes"),
  toggleAutoStart: $("toggleAutoStart"),
  toggleClockAlwaysOn: $("toggleClockAlwaysOn"),
  clockFadeAfter: $("clockFadeAfter"),
  btnSave: $("btnSave"),
  saveHint: $("saveHint"),
  modalOverlay: $("modalOverlay"),
  modalBody: $("modalBody"),
  modalOk: $("modalOk"),
  modalSnooze: $("modalSnooze"),
  floatingClock: $("floatingClock"),
};

const cumulativeDisplayModes = ["hms", "day", "month", "year", "smart"];

let state = {
  cfg: null,
  stats: null,
  dirty: false,
  cumulativeDisplayMode: "hms",
};

const clockState = {
  hideTimer: null,
  leaveTimer: null,
  dragging: false,
  offsetX: 0,
  offsetY: 0,
  x: null,
  y: null,
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

function fmtDecimal(value) {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getCumulativeModeLabel(mode) {
  switch (mode) {
    case "day":
      return "累计格式：天";
    case "month":
      return "累计格式：月";
    case "year":
      return "累计格式：年";
    case "smart":
      return "累计格式：智能";
    default:
      return "累计格式：时分秒";
  }
}

function formatCumulativeSeconds(totalSeconds, mode = state.cumulativeDisplayMode) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const daySeconds = 24 * 3600;
  const monthSeconds = 30 * daySeconds;
  const yearSeconds = 365 * daySeconds;

  switch (mode) {
    case "day":
      return `${fmtDecimal(s / daySeconds)} 天`;
    case "month":
      return `${fmtDecimal(s / monthSeconds)} 月`;
    case "year":
      return `${fmtDecimal(s / yearSeconds)} 年`;
    case "smart":
      if (s >= yearSeconds) return `${fmtDecimal(s / yearSeconds)} 年`;
      if (s >= monthSeconds) return `${fmtDecimal(s / monthSeconds)} 月`;
      if (s >= daySeconds) return `${fmtDecimal(s / daySeconds)} 天`;
      return fmtHMS(s);
    default:
      return fmtHMS(s);
  }
}

function cycleCumulativeDisplayMode() {
  const currentIndex = cumulativeDisplayModes.indexOf(state.cumulativeDisplayMode);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cumulativeDisplayModes.length : 0;
  state.cumulativeDisplayMode = cumulativeDisplayModes[nextIndex];
  els.btnCycleCumulativeFormat.textContent = getCumulativeModeLabel(state.cumulativeDisplayMode);
  els.cumulativeFormatHint.textContent = state.cumulativeDisplayMode === "smart"
    ? "智能模式会自动切到天 / 月 / 年。"
    : "可在时分秒 / 天 / 月 / 年 / 智能之间切换。";
  if (state.stats) renderStats(state.stats);
}

function applyCfgToUI(cfg) {
  if (!cfg) return;
  els.intervalRange.value = String(cfg.intervalMinutes ?? 30);
  els.intervalNumber.value = String(cfg.intervalMinutes ?? 30);
  els.alertLeadRange.value = String(cfg.clockAlertMinutes ?? 5);
  els.alertLeadNumber.value = String(cfg.clockAlertMinutes ?? 5);
  els.toggleAutoShowNearBreak.checked = cfg.clockAutoShowAlert ?? true;
  els.toggleSystem.checked = !!cfg.notifySystem;
  els.togglePopup.checked = !!cfg.notifyPopup;
  els.toggleSound.checked = !!cfg.notifySound;
  els.snoozeNumber.value = String(cfg.snoozeMinutes ?? 10);
  els.keywords.value = (cfg.keywords || []).join(", ");
  els.processes.value = (cfg.processes || []).join(", ");
  els.toggleAutoStart.checked = !!cfg.autoStart;
  els.toggleClockAlwaysOn.checked = !!cfg.clockAlwaysOn;
  els.clockFadeAfter.value = String(cfg.clockFadeAfterSecs ?? 20);
  updateClockVisibility(true);
}

function collectCfgFromUI() {
  const intervalMinutes = clampInt(els.intervalNumber.value, 1, 240);
  const snoozeMinutes = clampInt(els.snoozeNumber.value, 0, 240);
  const clockFadeAfterSecs = clampInt(els.clockFadeAfter.value, 3, 600);
  const clockAlertMinutes = clampInt(els.alertLeadNumber.value, 1, 60);
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
    clockAlwaysOn: !!els.toggleClockAlwaysOn.checked,
    clockFadeAfterSecs,
    clockAlertMinutes,
    clockAutoShowAlert: !!els.toggleAutoShowNearBreak.checked,
  };
}

function getRemainingSeconds() {
  const n = state.stats?.nextBreakInSeconds;
  if (typeof n !== "number") return null;
  return Math.max(0, n);
}

function isInAlertWindow() {
  const remaining = getRemainingSeconds();
  if (remaining === null) return false;
  const alertSecs = clampInt(state.cfg?.clockAlertMinutes ?? 5, 1, 60) * 60;
  return !!state.stats?.running && remaining <= alertSecs;
}

function shouldForceShowClock() {
  if (state.cfg?.clockAlwaysOn) return true;
  return !!state.cfg?.clockAutoShowAlert && isInAlertWindow();
}

function updateFloatingClockFromStats() {
  const remaining = getRemainingSeconds();
  els.floatingClock.textContent = remaining === null ? "--:--" : fmtMMSS(remaining);
  els.floatingClock.classList.toggle("floatingClock--alert", isInAlertWindow());

  if (shouldForceShowClock()) {
    clearClockTimers();
    showClock();
  }
}

function showClock() {
  els.floatingClock.classList.add("floatingClock--visible");
  els.floatingClock.classList.remove("floatingClock--hidden");
}

function hideClock() {
  if (shouldForceShowClock()) {
    showClock();
    return;
  }
  els.floatingClock.classList.remove("floatingClock--visible");
  els.floatingClock.classList.add("floatingClock--hidden");
}

function clearClockTimers() {
  if (clockState.hideTimer) {
    clearTimeout(clockState.hideTimer);
    clockState.hideTimer = null;
  }
  if (clockState.leaveTimer) {
    clearTimeout(clockState.leaveTimer);
    clockState.leaveTimer = null;
  }
}

function scheduleClockHide() {
  if (shouldForceShowClock()) {
    clearClockTimers();
    showClock();
    return;
  }
  if (clockState.hideTimer) clearTimeout(clockState.hideTimer);
  const secs = clampInt(state.cfg?.clockFadeAfterSecs ?? 20, 3, 600);
  clockState.hideTimer = setTimeout(() => hideClock(), secs * 1000);
}

function updateClockVisibility(forceShow = false) {
  clearClockTimers();
  if (forceShow) showClock();
  scheduleClockHide();
}

function setClockPosition(x, y) {
  clockState.x = x;
  clockState.y = y;
  els.floatingClock.style.left = `${x}px`;
  els.floatingClock.style.top = `${y}px`;
  els.floatingClock.style.transform = "translate(0, 0) skewX(-12deg)";
}

function wireClock() {
  if (!els.floatingClock) return;
  els.floatingClock.textContent = "--:--";
  els.floatingClock.classList.add("floatingClock--visible");

  const onPointerMove = (event) => {
    if (!clockState.dragging) return;
    const x = event.clientX - clockState.offsetX;
    const y = event.clientY - clockState.offsetY;
    setClockPosition(x, y);
  };

  const onPointerUp = () => {
    clockState.dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    scheduleClockHide();
  };

  els.floatingClock.addEventListener("pointerdown", (event) => {
    const rect = els.floatingClock.getBoundingClientRect();
    clockState.dragging = true;
    clockState.offsetX = event.clientX - rect.left;
    clockState.offsetY = event.clientY - rect.top;
    clearClockTimers();
    showClock();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });

  els.floatingClock.addEventListener("mouseenter", () => {
    clearClockTimers();
    showClock();
  });

  els.floatingClock.addEventListener("mouseleave", () => {
    if (shouldForceShowClock()) return;
    if (clockState.leaveTimer) clearTimeout(clockState.leaveTimer);
    clockState.leaveTimer = setTimeout(() => {
      hideClock();
    }, 5000);
  });

}

function renderStats(stats) {
  if (!stats) return;
  updateFloatingClockFromStats();
  els.statTotal.textContent = fmtHMS(stats.totalWatchedSeconds);
  els.statCumulative.textContent = formatCumulativeSeconds(stats.cumulativeWatchedSeconds);
  els.btnCycleCumulativeFormat.textContent = getCumulativeModeLabel(state.cumulativeDisplayMode);
  els.statDailyAvg.textContent = fmtHMS(stats.dailyAvgSeconds ?? 0);
  els.statWeeklyAvg.textContent = fmtHMS(stats.weeklyAvgSeconds ?? 0);
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
  const syncAlertLead = (from) => {
    const v = clampInt(from.value, 1, 60);
    els.alertLeadRange.value = String(v);
    els.alertLeadNumber.value = String(v);
    markDirty(true);
    state.cfg = {
      ...(state.cfg || {}),
      clockAlertMinutes: v,
      clockAutoShowAlert: !!els.toggleAutoShowNearBreak.checked,
    };
    updateFloatingClockFromStats();
    updateClockVisibility(true);
  };

  const syncInterval = (from) => {
    const v = clampInt(from.value, 1, 240);
    els.intervalRange.value = String(v);
    els.intervalNumber.value = String(v);
    els.intervalNote.textContent = `当前：${v} 分钟（最小 1 分钟）`;
    markDirty(true);
  };

  els.intervalRange.addEventListener("input", () => syncInterval(els.intervalRange));
  els.intervalNumber.addEventListener("input", () => syncInterval(els.intervalNumber));
  els.alertLeadRange.addEventListener("input", () => syncAlertLead(els.alertLeadRange));
  els.alertLeadNumber.addEventListener("input", () => syncAlertLead(els.alertLeadNumber));

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
    els.toggleClockAlwaysOn,
    els.toggleAutoShowNearBreak,
    els.snoozeNumber,
    els.clockFadeAfter,
    els.keywords,
    els.processes,
  ].forEach((el) =>
    el.addEventListener("input", () => {
      markDirty(true);
      if (el === els.toggleClockAlwaysOn || el === els.clockFadeAfter || el === els.toggleAutoShowNearBreak) {
        state.cfg = {
          ...(state.cfg || {}),
          clockAlwaysOn: !!els.toggleClockAlwaysOn.checked,
          clockFadeAfterSecs: clampInt(els.clockFadeAfter.value, 3, 600),
          clockAlertMinutes: clampInt(els.alertLeadNumber.value, 1, 60),
          clockAutoShowAlert: !!els.toggleAutoShowNearBreak.checked,
        };
        updateFloatingClockFromStats();
        updateClockVisibility(true);
      }
    }),
  );

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

  els.btnClearNext.addEventListener("click", async () => {
    try {
      await App.Snooze(0);
    } catch (e) {
      console.error(e);
    }
  });

  els.btnCycleCumulativeFormat.addEventListener("click", () => {
    cycleCumulativeDisplayMode();
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
  wireClock();
  wireUI();
  wireEvents();
  els.btnCycleCumulativeFormat.textContent = getCumulativeModeLabel(state.cumulativeDisplayMode);
  els.cumulativeFormatHint.textContent = "可在时分秒 / 天 / 月 / 年 / 智能之间切换。";
  setTimeout(refreshOnce, 100);
}

main();
