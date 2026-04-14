// Orbital One — AI-crewed space station tycoon.
// Entry point: boots the station, wires input + render loop + terminal UI.

import {
  buildRooms,
  renderStation,
  STATION_WIDTH,
  STATION_HEIGHT,
  DECK_COUNT,
  DECK_HEIGHT,
  ELEVATOR_WIDTH,
  deckFloorY,
  inElevator,
  roomAt,
} from "./station.js";

import {
  defaultState,
  defaultDeptMetrics,
  tickEconomy,
  awardXp,
} from "./economy.js";

import {
  initTerminal,
  openTerminal,
  isTerminalOpen,
  closeTerminal,
} from "./terminal.js";

import { AGENTS, resetAllHistories } from "./agents.js";

// ---------- DOM refs ----------
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

const ui = {
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  rememberKey: document.getElementById("rememberKey"),
  level: document.getElementById("levelLabel"),
  xp: document.getElementById("xpLabel"),
  credits: document.getElementById("creditsLabel"),
  power: document.getElementById("powerLabel"),
  morale: document.getElementById("moraleLabel"),
  research: document.getElementById("researchLabel"),
  stardate: document.getElementById("stardateLabel"),
  missionTitle: document.getElementById("missionTitle"),
  missionDesc: document.getElementById("missionDesc"),
  missionProgress: document.getElementById("missionProgress"),
  prompt: document.getElementById("interactPrompt"),
  log: document.getElementById("log"),
};

// ---------- Game state ----------
const station = {
  state: defaultState(),
  rooms: buildRooms(),
  deptMetrics: defaultDeptMetrics(),
  mission: {
    id: "welcome",
    title: "Meet your AI crew",
    desc: "Visit each terminal and talk to the agent on duty. 3 of 9 to go.",
    target: 9,
    visited: new Set(),
  },
};

const player = {
  x: ELEVATOR_WIDTH + 40, // spawn in Airlock (top-left room)
  deck: 0,
  y: deckFloorY(0),
  speed: 160, // pixels per second
  elevatorCooldown: 0, // ms
};

const camera = { x: 0, y: 0 };
const keys = new Set();

// ---------- Persistence ----------
const SAVE_KEY = "orbitalOneSaveV1";
const API_KEY_STORE = "orbitalOneApiKey";

function saveGame() {
  const payload = {
    state: station.state,
    rooms: serializableRooms(station.rooms),
    deptMetrics: station.deptMetrics,
    mission: {
      ...station.mission,
      visited: [...station.mission.visited],
    },
    player: { x: player.x, deck: player.deck },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  log("sys", "Station configuration saved.");
}

function serializableRooms(rooms) {
  const out = {};
  for (const [id, r] of Object.entries(rooms)) {
    out[id] = { level: r.level, online: r.online };
  }
  return out;
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
    // Only pull mutable per-room fields; geometry stays from buildRooms()
    station.rooms = buildRooms();
    for (const [id, data] of Object.entries(s.rooms || {})) {
      if (station.rooms[id]) {
        station.rooms[id].level = data.level ?? 1;
        station.rooms[id].online = data.online ?? true;
      }
    }
    station.mission = {
      ...station.mission,
      ...s.mission,
      visited: new Set(s.mission?.visited || []),
    };
    if (s.player) {
      player.x = s.player.x;
      player.deck = s.player.deck;
      player.y = deckFloorY(player.deck);
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
  station.mission = {
    id: "welcome",
    title: "Meet your AI crew",
    desc: "Visit each terminal and talk to the agent on duty.",
    target: Object.keys(station.rooms).length,
    visited: new Set(),
  };
  player.x = ELEVATOR_WIDTH + 40;
  player.deck = 0;
  player.y = deckFloorY(0);
  resetAllHistories();
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
  // keep log bounded
  while (ui.log.childNodes.length > 80) ui.log.removeChild(ui.log.lastChild);
}

function updateHUD() {
  const s = station.state;
  ui.level.textContent = s.level;
  ui.xp.textContent = `${s.xp} / ${s.xpToNext}`;
  ui.credits.textContent = s.credits;
  ui.power.textContent = `${s.power} / ${s.powerMax}`;
  ui.morale.textContent = s.morale;
  ui.research.textContent = s.research;
  ui.stardate.textContent = s.stardate.toFixed(2);

  // mission progress
  const visitedCount = station.mission.visited.size;
  const target = station.mission.target;
  const pct = Math.round((visitedCount / target) * 100);
  ui.missionTitle.textContent = station.mission.title;
  ui.missionDesc.textContent =
    visitedCount >= target
      ? "Full crew contact established. Open the Help quick action for what's next."
      : `${visitedCount}/${target} crew terminals accessed.`;
  ui.missionProgress.style.width = `${Math.min(100, pct)}%`;
}

// ---------- Interaction ----------
function nearestInteractableRoom() {
  // Player can interact with a terminal if they're standing in that room.
  if (inElevator(player.x)) return null;
  const r = roomAt(station.rooms, player.x, player.y - 2);
  return r && r.online ? r : null;
}

function tryInteract() {
  const room = nearestInteractableRoom();
  if (!room) return;
  // mark mission visited
  if (!station.mission.visited.has(room.id)) {
    station.mission.visited.add(room.id);
    awardXp(station, 10, log);
    log("gm", `Made first contact at ${room.name}. +10 XP.`);
    updateHUD();
  }
  openTerminal(room.id);
}

function updateInteractPrompt() {
  const room = nearestInteractableRoom();
  if (room && !isTerminalOpen()) {
    const agent = AGENTS[room.agentId];
    ui.prompt.textContent = `Press E to access ${room.name} terminal (${agent.name})`;
    ui.prompt.classList.add("show");
  } else {
    ui.prompt.classList.remove("show");
  }
}

// ---------- Input ----------
function setupInput() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (isTerminalOpen()) {
      // let terminal handle its own keys, but allow Escape to close (terminal.js)
      return;
    }
    keys.add(k);

    if (k === "e") {
      e.preventDefault();
      tryInteract();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
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
        log(
          "sys",
          "Walk with A/D. Use the central elevator (W/S) to change decks. Press E at a terminal to chat with that room's AI agent. Upgrade rooms to boost revenue."
        );
      }
    });
  });

  // API key persistence
  const saved = localStorage.getItem(API_KEY_STORE);
  if (saved) {
    ui.apiKey.value = saved;
    ui.rememberKey.checked = true;
  }
  ui.rememberKey.addEventListener("change", () => {
    if (ui.rememberKey.checked && ui.apiKey.value.trim()) {
      localStorage.setItem(API_KEY_STORE, ui.apiKey.value.trim());
    } else {
      localStorage.removeItem(API_KEY_STORE);
    }
  });
  ui.apiKey.addEventListener("change", () => {
    if (ui.rememberKey.checked && ui.apiKey.value.trim()) {
      localStorage.setItem(API_KEY_STORE, ui.apiKey.value.trim());
    }
  });
}

// ---------- Movement ----------
function updatePlayer(dt) {
  if (isTerminalOpen()) return;

  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const up = keys.has("w") || keys.has("arrowup");
  const down = keys.has("s") || keys.has("arrowdown");

  if (left) player.x -= player.speed * dt;
  if (right) player.x += player.speed * dt;
  player.x = Math.max(8, Math.min(STATION_WIDTH - 8, player.x));

  // Elevator: only when player is in the shaft
  if (inElevator(player.x)) {
    player.elevatorCooldown -= dt * 1000;
    if (player.elevatorCooldown <= 0) {
      if (up && player.deck > 0) {
        player.deck -= 1;
        player.y = deckFloorY(player.deck);
        player.elevatorCooldown = 220;
      } else if (down && player.deck < DECK_COUNT - 1) {
        player.deck += 1;
        player.y = deckFloorY(player.deck);
        player.elevatorCooldown = 220;
      }
    }
  }

  player.y = deckFloorY(player.deck);
}

// ---------- Loop ----------
let lastFrame = performance.now();
let lastTick = performance.now();
const TICK_MS = 4000;

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function updateCamera() {
  // Center the station within the visible canvas. Add small gentle follow on Y
  // so the current deck is highlighted without the full station going offscreen.
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  camera.x = (STATION_WIDTH - cw) / 2;
  camera.y = (STATION_HEIGHT - ch) / 2;
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  updatePlayer(dt);
  updateCamera();

  // Economy tick
  if (now - lastTick > TICK_MS) {
    lastTick = now;
    tickEconomy(station, log);
    updateHUD();
  }

  // Which room has the highlighted terminal?
  const nearest = nearestInteractableRoom();
  renderStation(ctx, camera, station, player, nearest?.id || null);

  updateInteractPrompt();
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
  loadGame(); // safe if no save
  updateHUD();
  resize();
  log("gm", "Orbital One online. Walk (A/D), ride the lift (W/S), press E at a terminal.");
  requestAnimationFrame((t) => {
    lastFrame = t;
    lastTick = t;
    loop(t);
  });
}

window.addEventListener("resize", resize);
boot();
