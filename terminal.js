// Terminal modal UI: handles the in-game terminal that opens when the
// player presses E next to a room's terminal sprite. Renders:
// - agent identity header
// - department metrics (from economy)
// - chat window backed by agents.js

import { AGENTS, getHistory, sendToAgent, resetHistory } from "./agents.js";
import {
  formatMetric,
  getAgentMetrics,
  tryUpgrade,
  upgradeCost,
  awardXp,
} from "./economy.js";

const el = {
  root: document.getElementById("terminal"),
  avatar: document.getElementById("agentAvatar"),
  name: document.getElementById("agentName"),
  title: document.getElementById("agentTitle"),
  deptMetrics: document.getElementById("deptMetrics"),
  roomMetrics: document.getElementById("roomMetrics"),
  upgradeBtn: document.getElementById("upgradeBtn"),
  assignBtn: document.getElementById("assignBtn"),
  upgradeHint: document.getElementById("upgradeHint"),
  close: document.getElementById("closeTerminal"),
  chatLog: document.getElementById("chatLog"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
};

let currentRoomId = null;
let hooks = null; // { getStation, getApiConfig, log, onUpgraded }

export function initTerminal(h) {
  hooks = h;

  el.close.addEventListener("click", closeTerminal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.root.classList.contains("hidden")) {
      closeTerminal();
    }
  });

  el.chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if (!text || !currentRoomId) return;
    el.chatInput.value = "";
    await submitMessage(text);
  });

  el.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.chatForm.requestSubmit();
    }
  });

  el.upgradeBtn.addEventListener("click", () => {
    if (!currentRoomId) return;
    const station = hooks.getStation();
    const result = tryUpgrade(station, currentRoomId, hooks.log);
    if (!result.ok) {
      hooks.log("sys", result.reason);
    } else {
      hooks.onUpgraded?.();
      renderMetrics();
    }
  });

  el.assignBtn.addEventListener("click", () => {
    if (!currentRoomId) return;
    const station = hooks.getStation();
    const room = station.rooms[currentRoomId];
    const agent = AGENTS[room.agentId];
    // Assigning a task: bump the room's department metrics and award XP
    const boost = 1 + room.level;
    const m = station.deptMetrics[room.agentId];
    if (m.active_tasks !== undefined) m.active_tasks += 1;
    if (m.active_projects !== undefined) m.active_projects += 1;
    if (m.upgrade_queue !== undefined) m.upgrade_queue += 1;
    if (m.broadcasts_wk !== undefined) m.broadcasts_wk += 1;
    if (m.deals_open !== undefined) m.deals_open += 1;
    if (station.state.credits < 20) {
      hooks.log("sys", "Not enough credits to assign a task (need 20).");
      return;
    }
    station.state.credits -= 20;
    hooks.log("gm", `Assigned a new task to ${agent.name}. (-20 credits, +${boost} XP)`);
    awardXp(station, boost, hooks.log);
    renderMetrics();
    hooks.onUpgraded?.();
  });
}

export function isTerminalOpen() {
  return !el.root.classList.contains("hidden");
}

export function openTerminal(roomId) {
  const station = hooks.getStation();
  const room = station.rooms[roomId];
  if (!room) return;
  const agent = AGENTS[room.agentId];
  if (!agent) return;

  currentRoomId = roomId;
  el.avatar.style.background = `linear-gradient(135deg, ${agent.accent}, #8a5cff)`;
  el.name.textContent = agent.name;
  el.title.textContent = `${agent.title} · ${room.name}`;

  renderMetrics();
  renderChat();

  el.root.classList.remove("hidden");
  // Focus input so player can type immediately
  setTimeout(() => el.chatInput.focus(), 50);
}

export function closeTerminal() {
  el.root.classList.add("hidden");
  currentRoomId = null;
}

function renderMetrics() {
  if (!currentRoomId) return;
  const station = hooks.getStation();
  const room = station.rooms[currentRoomId];
  const agent = AGENTS[room.agentId];

  // Department metrics
  const dept = getAgentMetrics(station, room.agentId);
  el.deptMetrics.innerHTML = "";
  // Follow the ordering defined on agent.metrics when present.
  const keys = agent.metrics?.length ? agent.metrics : Object.keys(dept);
  for (const key of keys) {
    if (dept[key] === undefined) continue;
    const { label, value } = formatMetric(key, dept[key]);
    const li = document.createElement("li");
    li.innerHTML = `<span class="k">${label}</span><span>${value}</span>`;
    el.deptMetrics.appendChild(li);
  }

  // Room metrics
  el.roomMetrics.innerHTML = "";
  for (const [k, v] of [
    ["level", room.level],
    ["online", room.online ? "yes" : "no"],
    ["deck", room.deck + 1],
    ["agent", agent.name],
  ]) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="k">${k}</span><span>${v}</span>`;
    el.roomMetrics.appendChild(li);
  }

  const cost = upgradeCost(room);
  el.upgradeHint.textContent = `Upgrade cost: ${cost} credits. You have ${station.state.credits}.`;
}

function renderChat() {
  el.chatLog.innerHTML = "";
  const history = getHistory(AGENTS[hooks.getStation().rooms[currentRoomId].agentId].id);
  if (!history.length) {
    addBubble("system", `Opened terminal. Say hi to ${AGENTS[hooks.getStation().rooms[currentRoomId].agentId].name}.`);
  }
  for (const m of history) {
    addBubble(m.role === "assistant" ? "agent" : "user", m.content);
  }
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function addBubble(kind, text) {
  const div = document.createElement("div");
  div.className = `msg ${kind}`;
  div.textContent = text;
  el.chatLog.appendChild(div);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

async function submitMessage(text) {
  const station = hooks.getStation();
  const room = station.rooms[currentRoomId];
  const agent = AGENTS[room.agentId];
  const cfg = hooks.getApiConfig();

  addBubble("user", text);

  const pending = document.createElement("div");
  pending.className = "msg agent";
  pending.textContent = `${agent.name} is thinking...`;
  el.chatLog.appendChild(pending);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;

  try {
    const reply = await sendToAgent({
      agentId: agent.id,
      userMessage: text,
      station,
      apiKey: cfg.apiKey,
      model: cfg.model,
    });
    pending.textContent = reply;
    // XP for meaningful interaction
    awardXp(station, 5, hooks.log);
    hooks.log("gm", `Talked with ${agent.name}. +5 XP.`);
    hooks.onUpgraded?.();
  } catch (err) {
    pending.remove();
    addBubble("system", `[error] ${err.message}`);
    hooks.log("err", err.message);
  }
}

export function resetTerminalHistory(agentId) {
  resetHistory(agentId);
  if (currentRoomId) renderChat();
}
