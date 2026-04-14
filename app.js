// Orbital One — top-down AI station tycoon.
// Entry: wires the canvas, top business HUD, click-to-open terminal,
// and the simulated economy tick.

import {
  buildRooms,
  renderStation,
  roomAtPoint,
  computeLayout,
} from "./station.js";

import {
  defaultState,
  defaultDeptMetrics,
  tickEconomy,
  awardXp,
  formatCurrency,
  formatClock,
  TICK_BASE_MS,
  SPEEDS,
} from "./economy.js";

import {
  initTerminal,
  openTerminal,
  isTerminalOpen,
} from "./terminal.js";

import { AGENTS, resetAllHistories } from "./agents.js";

// ---------- DOM refs ----------
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

const ui = {
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  rememberKey: document.getElementById("rememberKey"),
  tooltip: document.getElementById("tooltip"),
  log: document.getElementById("log"),
  // Top HUD
  day: document.getElementById("dayLabel"),
  clock: document.getElementById("clockLabel"),
  revenue: document.getElementById("revenueLabel"),
  orders: document.getElementById("ordersLabel"),
  products: document.getElementById("productsLabel"),
  agentsActive: document.getElementById("agentsActiveLabel"),
  // Left panel
  level: document.getElementById("levelLabel"),
  xp: document.getElementById("xpLabel"),
  credits: document.getElementById("creditsLabel"),
  morale: document.getElementById("moraleLabel"),
  research: document.getElementById("researchLabel"),
  progAgents: document.getElementById("progAgentsLabel"),
  // Speed
  speedCtrls: document.getElementById("speedCtrls"),
};

// ---------- Game state ----------
const station = {
  state: defaultState(),
  rooms: buildRooms(),
  deptMetrics: defaultDeptMetrics(),
};

let hoveredRoomId = null;
let pointer = { x: 0, y: 0 };

// ---------- Persistence ----------
const SAVE_KEY = "orbitalOneGridSaveV1";
const API_KEY_STORE = "orbitalOneApiKey";

function saveGame() {
  const payload = {
    state: station.state,
    rooms: Object.fromEntries(
      Object.entries(station.rooms).map(([id, r]) => [id, { level: r.level, online: r.online }])
    ),
    deptMetrics: station.deptMetrics,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  log("sys", "Station configuration saved.");
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    log("sys", "No save found yet. Playing a fresh station.");
    return false;
  }
  try {
    const s = JSON.parse(raw);
    station.state = { ...defaultState(), ...s.state };
    station.deptMetrics = { ...defaultDeptMetrics(), ...s.deptMetrics };
    station.rooms = buildRooms();
    for (const [id, data] of Object.entries(s.rooms || {})) {
      if (station.rooms[id]) {
        station.rooms[id].level = data.level ?? 1;
        station.rooms[id].online = data.online ?? true;
      }
    }
    log("sys", "Save loaded. Welcome back, Commander.");
    return true;
  } catch (err) {
    log("err", `Failed to load save: ${err.message}`);
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  station.state = defaultState();
  station.rooms = buildRooms();
  station.deptMetrics = defaultDeptMetrics();
  resetAllHistories();
  setSpeed(1, false);
  log("sys", "New game started. Welcome aboard Orbital One.");
  updateHUD();
}

// ---------- HUD ----------
function log(type, msg) {
  const p = document.createElement("p");
  p.className = type;
  const prefix =
    type === "you" ? "You" :
    type === "gm" ? "Station" :
    type === "err" ? "Alert" : "System";
  p.textContent = `${prefix}: ${msg}`;
  ui.log.prepend(p);
  while (ui.log.childNodes.length > 80) ui.log.removeChild(ui.log.lastChild);
}

function updateHUD() {
  const s = station.state;
  // Top bar
  ui.day.textContent = s.day;
  ui.clock.textContent = formatClock(s.tickInDay);
  ui.revenue.textContent = formatCurrency(s.revenue);
  ui.orders.textContent = s.orders.toLocaleString();
  ui.products.textContent = s.productsLive;
  ui.agentsActive.textContent = `${s.agentsActiveCount}/${s.agentsTotal}`;
  // Left panel
  ui.level.textContent = s.level;
  ui.xp.textContent = `${s.xp} / ${s.xpToNext}`;
  ui.credits.textContent = s.credits;
  ui.morale.textContent = s.morale;
  ui.research.textContent = s.research;
  ui.progAgents.textContent = `${s.agentsActiveCount}/${s.agentsTotal}`;
}

// ---------- Speed ----------
function setSpeed(value, announce = true) {
  if (value === "pause") {
    station.state.paused = true;
    highlightSpeedButton("pause");
    if (announce) log("sys", "Simulation paused.");
    return;
  }
  const n = Number(value);
  if (!SPEEDS.includes(n)) return;
  station.state.paused = false;
  station.state.speed = n;
  highlightSpeedButton(String(n));
  if (announce) log("sys", `Simulation speed: ${n}x.`);
}

function highlightSpeedButton(key) {
  ui.speedCtrls.querySelectorAll("button").forEach((b) => {
    b.classList.remove("active", "paused");
    if (b.dataset.speed === key) b.classList.add(key === "pause" ? "paused" : "active");
  });
}

// ---------- Input ----------
function setupInput() {
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rid = roomAtPoint(station, pointer.x, pointer.y);
    hoveredRoomId = rid;
    if (rid) {
      const room = station.rooms[rid];
      const agent = AGENTS[room.agentId];
      ui.tooltip.innerHTML = `
        <div class="t-title">${room.name}</div>
        <div class="t-agent">${agent?.name || ""} · <span style="color:var(--muted)">${agent?.title || ""}</span></div>
        <div class="t-hint">Click to open terminal · Lv ${room.level} · ${room.online ? "online" : "offline"}</div>
      `;
      ui.tooltip.style.left = `${e.clientX + 14}px`;
      ui.tooltip.style.top = `${e.clientY + 14}px`;
      ui.tooltip.classList.add("show");
      canvas.style.cursor = "pointer";
    } else {
      ui.tooltip.classList.remove("show");
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hoveredRoomId = null;
    ui.tooltip.classList.remove("show");
  });

  canvas.addEventListener("click", (e) => {
    if (isTerminalOpen()) return;
    const rect = canvas.getBoundingClientRect();
    const rid = roomAtPoint(station, e.clientX - rect.left, e.clientY - rect.top);
    if (!rid) return;
    const room = station.rooms[rid];
    if (!room.online) {
      log("sys", `${room.name} is offline.`);
      return;
    }
    awardXp(station, 5, log);
    openTerminal(rid);
  });

  window.addEventListener("keydown", (e) => {
    if (isTerminalOpen()) return;
    if (e.key === " ") {
      e.preventDefault();
      if (station.state.paused) setSpeed("1");
      else setSpeed("pause");
    }
    if (e.key >= "1" && e.key <= "4") {
      const map = { 1: "1", 2: "2", 3: "5", 4: "10" };
      setSpeed(map[e.key]);
    }
  });

  ui.speedCtrls.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setSpeed(btn.dataset.speed));
  });

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "save") saveGame();
      else if (a === "load") {
        if (loadGame()) updateHUD();
      } else if (a === "reset") {
        if (confirm("Start a new game? This deletes your save.")) resetGame();
      } else if (a === "help") {
        log("sys", "Click any room tile to open its terminal and chat with that agent. Top-right speed controls change time flow (Space pauses).");
      }
    });
  });

  // API key persistence
  const saved = localStorage.getItem(API_KEY_STORE);
  if (saved) {
    ui.apiKey.value = saved;
    ui.rememberKey.checked = true;
  }
  const persist = () => {
    if (ui.rememberKey.checked && ui.apiKey.value.trim()) {
      localStorage.setItem(API_KEY_STORE, ui.apiKey.value.trim());
    } else {
      localStorage.removeItem(API_KEY_STORE);
    }
  };
  ui.rememberKey.addEventListener("change", persist);
  ui.apiKey.addEventListener("change", persist);
}

// ---------- Loop ----------
let lastFrame = performance.now();
let tickAccumMs = 0;

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function loop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!station.state.paused) {
    tickAccumMs += dt * 1000 * station.state.speed;
    while (tickAccumMs >= TICK_BASE_MS) {
      tickAccumMs -= TICK_BASE_MS;
      tickEconomy(station, log);
    }
  }

  updateHUD();

  // Render
  const layout = computeLayout(canvas.clientWidth, canvas.clientHeight);
  renderStation(ctx, layout, station, hoveredRoomId);

  requestAnimationFrame(loop);
}

// ---------- Boot ----------
function boot() {
  setupInput();
  initTerminal({
    getStation: () => station,
    getApiConfig: () => ({
      apiKey: ui.apiKey.value.trim(),
      model: ui.model.value.trim() || "claude-haiku-4-5-20251001",
    }),
    log,
    onUpgraded: updateHUD,
  });
  loadGame();
  updateHUD();
  resize();
  setSpeed(String(station.state.speed || 1), false);
  log("gm", "Orbital One online. Click any room tile to open its terminal.");
  requestAnimationFrame((t) => {
    lastFrame = t;
    loop(t);
  });
}

window.addEventListener("resize", resize);
boot();
