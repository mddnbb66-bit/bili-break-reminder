import { Events } from "@wailsio/runtime";
import * as App from "../bindings/changeme/bilibreakservice.js";

const els = {
  timerText: document.getElementById("timerText"),
};

const state = {
  cfg: null,
  stats: null,
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

function applyOpacity() {
  const opacity = clampInt(state.cfg?.clockOpacity ?? 100, 10, 100) / 100;
  els.timerText.style.opacity = String(opacity);
}

function render() {
  const remaining = getRemainingSeconds();
  els.timerText.textContent = remaining === null ? "--:--" : fmtMMSS(remaining);
  els.timerText.classList.toggle("timerText--alert", isInAlertWindow());
  applyOpacity();
}

async function refreshOnce() {
  try {
    state.cfg = await App.GetConfig();
    state.stats = await App.GetStats();
    render();
  } catch (e) {
    console.error("clock refresh failed:", e);
  }
}

function wireEvents() {
  Events.On("bili:stats", (event) => {
    state.stats = event.data;
    render();
  });

  Events.On("bili:config", (event) => {
    state.cfg = event.data;
    render();
  });
}

async function main() {
  wireEvents();
  await refreshOnce();
}

main();
