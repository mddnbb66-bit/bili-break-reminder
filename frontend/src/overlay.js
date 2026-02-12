import { Events } from "@wailsio/runtime";
import * as App from "../bindings/changeme/bilibreakservice.js";

const clock = document.getElementById("overlayClock");

const state = {
  cfg: null,
  stats: null,
  hideTimer: null,
  leaveTimer: null,
};

function clampInt(v, min, max) {
  const n = Number.parseInt(String(v), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function fmtMMSS(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
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

function shouldForceShow() {
  if (state.cfg?.clockAlwaysOn) return true;
  return !!state.cfg?.clockAutoShowAlert && isInAlertWindow();
}

function getVisibleOpacity() {
  return clampInt(state.cfg?.clockOpacity ?? 100, 10, 100) / 100;
}

function getHiddenOpacity() {
  const visible = getVisibleOpacity();
  return Math.max(0.02, Math.min(visible * 0.08, 0.25));
}

function clearTimers() {
  if (state.hideTimer) {
    clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
  if (state.leaveTimer) {
    clearTimeout(state.leaveTimer);
    state.leaveTimer = null;
  }
}

function showClock() {
  clock.style.opacity = String(getVisibleOpacity());
  clock.classList.add("floatingClock--visible");
  clock.classList.remove("floatingClock--hidden");
}

function hideClock() {
  if (shouldForceShow()) {
    showClock();
    return;
  }
  clock.style.opacity = String(getHiddenOpacity());
  clock.classList.remove("floatingClock--visible");
  clock.classList.add("floatingClock--hidden");
}

function scheduleHide() {
  if (shouldForceShow()) {
    clearTimers();
    showClock();
    return;
  }
  const secs = clampInt(state.cfg?.clockFadeAfterSecs ?? 20, 3, 600);
  if (state.hideTimer) clearTimeout(state.hideTimer);
  state.hideTimer = setTimeout(() => hideClock(), secs * 1000);
}

function refreshClock() {
  const remaining = getRemainingSeconds();
  clock.textContent = remaining === null ? "--:--" : fmtMMSS(remaining);
  clock.classList.toggle("floatingClock--alert", isInAlertWindow());
  if (shouldForceShow()) {
    clearTimers();
    showClock();
  }
}

function wireEvents() {
  clock.addEventListener("mouseenter", () => {
    clearTimers();
    showClock();
  });

  clock.addEventListener("mouseleave", () => {
    if (shouldForceShow()) return;
    if (state.leaveTimer) clearTimeout(state.leaveTimer);
    state.leaveTimer = setTimeout(() => hideClock(), 5000);
  });

  Events.On("bili:stats", (event) => {
    state.stats = event.data;
    refreshClock();
  });

  Events.On("bili:config", (event) => {
    state.cfg = event.data;
    refreshClock();
    scheduleHide();
  });
}

async function main() {
  wireEvents();
  state.cfg = await App.GetConfig();
  state.stats = await App.GetStats();
  refreshClock();
  showClock();
  scheduleHide();
}

main();
