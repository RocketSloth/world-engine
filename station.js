// Station geometry, rendering, and room definitions.
// Coordinate system: station is placed at a fixed origin in world space,
// and rendered inside the canvas. The player walks in this same space.

import { AGENTS } from "./agents.js";

// --- Layout constants (world units = pixels in our simple sim) ---
export const DECK_HEIGHT = 140;
export const DECK_COUNT = 3;
export const ROOM_WIDTH = 210;
export const ROOMS_PER_DECK = 3;
export const ELEVATOR_WIDTH = 50;

export const STATION_WIDTH = ELEVATOR_WIDTH + ROOM_WIDTH * ROOMS_PER_DECK; // 680
export const STATION_HEIGHT = DECK_HEIGHT * DECK_COUNT; // 420

// Floor Y positions (bottom of each deck where player stands)
// deck 0 is top, deck 2 is bottom (like Fallout Shelter)
export function deckFloorY(deck) {
  return DECK_HEIGHT * (deck + 1) - 6; // 6px "floor" offset
}

// Room definitions.
// Layout (left to right within each deck): Room A | Room B | Room C
// Elevator shaft is the leftmost column.
const ROOM_LAYOUT = [
  // deck 0 (top)
  [
    { id: "airlock", deck: 0, col: 0 },
    { id: "bridge", deck: 0, col: 1 },
    { id: "comms", deck: 0, col: 2 },
  ],
  // deck 1 (middle)
  [
    { id: "ops", deck: 1, col: 0 },
    { id: "sales", deck: 1, col: 1 },
    { id: "research", deck: 1, col: 2 },
  ],
  // deck 2 (bottom)
  [
    { id: "engineering", deck: 2, col: 0 },
    { id: "habitation", deck: 2, col: 1 },
    { id: "medbay", deck: 2, col: 2 },
  ],
];

// Room metadata, keyed by room id. Agents reference rooms by id.
const ROOM_META = {
  airlock: { name: "Airlock", agentId: "airlock", color: "#1e2a4f" },
  bridge: { name: "Command Bridge", agentId: "commander", color: "#1a2d4a" },
  comms: { name: "Comms Array", agentId: "comms", color: "#2a1f3f" },
  ops: { name: "Operations", agentId: "ops", color: "#1a3a2a" },
  sales: { name: "Sales Bay", agentId: "sales", color: "#3a2d1a" },
  research: { name: "Research Lab", agentId: "research", color: "#2a1a3d" },
  engineering: { name: "Engineering", agentId: "engineering", color: "#3a2a1a" },
  habitation: { name: "Habitation", agentId: "habitation", color: "#1a3a3a" },
  medbay: { name: "Medbay", agentId: "medbay", color: "#3a1a2a" },
};

// Build the rooms map with geometry baked in.
export function buildRooms() {
  const rooms = {};
  for (const deck of ROOM_LAYOUT) {
    for (const { id, deck: d, col } of deck) {
      const meta = ROOM_META[id];
      const x = ELEVATOR_WIDTH + col * ROOM_WIDTH;
      const y = d * DECK_HEIGHT;
      rooms[id] = {
        id,
        name: meta.name,
        agentId: meta.agentId,
        color: meta.color,
        x,
        y,
        w: ROOM_WIDTH,
        h: DECK_HEIGHT,
        deck: d,
        col,
        level: 1,
        online: true,
        // terminal anchor (where the player interacts)
        terminalX: x + ROOM_WIDTH - 32,
        terminalY: y + DECK_HEIGHT - 40,
      };
    }
  }
  return rooms;
}

// Is world-point (x,y) inside the elevator shaft?
export function inElevator(x) {
  return x >= 0 && x <= ELEVATOR_WIDTH;
}

// Which room contains world-point (x,y)? Returns room or null.
export function roomAt(rooms, x, y) {
  for (const r of Object.values(rooms)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

// Which deck (0..DECK_COUNT-1) does world-y fall into?
export function deckAt(y) {
  return Math.max(0, Math.min(DECK_COUNT - 1, Math.floor(y / DECK_HEIGHT)));
}

// ---- Rendering ----

export function renderStation(ctx, camera, station, player, nearestTerminal) {
  const { rooms } = station;

  // Starfield background
  drawStars(ctx, camera);

  // Station hull background
  const hullX = -camera.x;
  const hullY = -camera.y;
  ctx.fillStyle = "#0a1024";
  ctx.fillRect(hullX - 20, hullY - 20, STATION_WIDTH + 40, STATION_HEIGHT + 40);

  // Hull border
  ctx.strokeStyle = "#2a8fa0";
  ctx.lineWidth = 2;
  ctx.strokeRect(hullX - 20, hullY - 20, STATION_WIDTH + 40, STATION_HEIGHT + 40);

  // Elevator shaft
  ctx.fillStyle = "#0d1d3a";
  ctx.fillRect(hullX, hullY, ELEVATOR_WIDTH, STATION_HEIGHT);
  ctx.strokeStyle = "#1c2748";
  for (let d = 0; d <= DECK_COUNT; d++) {
    const ly = hullY + d * DECK_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(hullX, ly);
    ctx.lineTo(hullX + STATION_WIDTH, ly);
    ctx.stroke();
  }
  // Elevator rails
  ctx.strokeStyle = "#2a8fa0";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(hullX + ELEVATOR_WIDTH / 2 - 6, hullY);
  ctx.lineTo(hullX + ELEVATOR_WIDTH / 2 - 6, hullY + STATION_HEIGHT);
  ctx.moveTo(hullX + ELEVATOR_WIDTH / 2 + 6, hullY);
  ctx.lineTo(hullX + ELEVATOR_WIDTH / 2 + 6, hullY + STATION_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rooms
  for (const r of Object.values(rooms)) {
    drawRoom(ctx, r, camera, nearestTerminal);
  }

  // Player
  drawPlayer(ctx, player, camera);
}

function drawRoom(ctx, room, camera, nearestTerminal) {
  const x = room.x - camera.x;
  const y = room.y - camera.y;
  const w = room.w;
  const h = room.h;

  // Floor
  ctx.fillStyle = room.color;
  ctx.fillRect(x, y, w, h);

  // Subtle scanline
  ctx.fillStyle = "rgba(92,241,255,0.03)";
  for (let sy = y + 4; sy < y + h; sy += 6) {
    ctx.fillRect(x, sy, w, 1);
  }

  // Room border
  ctx.strokeStyle = "#22305c";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Floor line
  ctx.fillStyle = "#22305c";
  ctx.fillRect(x, y + h - 6, w, 2);

  // Room label (top-left)
  ctx.fillStyle = "rgba(5, 7, 15, 0.7)";
  ctx.fillRect(x + 6, y + 6, 130, 20);
  ctx.fillStyle = "#5cf1ff";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillText(room.name.toUpperCase(), x + 12, y + 20);

  // Level pip (top-right)
  ctx.fillStyle = "rgba(5, 7, 15, 0.7)";
  ctx.fillRect(x + w - 48, y + 6, 42, 20);
  ctx.fillStyle = "#ffb86b";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillText(`Lv ${room.level}`, x + w - 42, y + 20);

  // Agent "NPC" (idle character)
  const agent = AGENTS[room.agentId];
  if (agent) {
    drawAgentSprite(ctx, x + 50, y + h - 10, agent);
    // Name plate
    ctx.fillStyle = "rgba(5,7,15,0.8)";
    ctx.fillRect(x + 28, y + h - 56, 100, 14);
    ctx.fillStyle = "#e6ecff";
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillText(agent.name, x + 32, y + h - 45);
  }

  // Terminal
  const tx = room.terminalX - camera.x;
  const ty = room.terminalY - camera.y;
  drawTerminal(ctx, tx, ty, nearestTerminal === room.id);

  // Offline overlay
  if (!room.online) {
    ctx.fillStyle = "rgba(2,4,10,0.6)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ff6b8a";
    ctx.font = "bold 14px 'JetBrains Mono', monospace";
    ctx.fillText("OFFLINE", x + w / 2 - 28, y + h / 2);
  }
}

function drawAgentSprite(ctx, cx, floorY, agent) {
  // Simple humanoid: head + body, tinted by agent.accent.
  const color = agent.accent || "#5cf1ff";

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, floorY + 1, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = color;
  ctx.fillRect(cx - 5, floorY - 20, 10, 16);
  // head
  ctx.fillStyle = "#e6ecff";
  ctx.beginPath();
  ctx.arc(cx, floorY - 25, 5, 0, Math.PI * 2);
  ctx.fill();
  // visor
  ctx.fillStyle = color;
  ctx.fillRect(cx - 4, floorY - 26, 8, 2);
}

function drawTerminal(ctx, x, y, highlight) {
  // Pedestal
  ctx.fillStyle = "#1c2748";
  ctx.fillRect(x - 10, y - 4, 20, 14);
  // Screen
  ctx.fillStyle = highlight ? "#5cf1ff" : "#2a8fa0";
  ctx.fillRect(x - 8, y - 16, 16, 12);
  ctx.fillStyle = highlight ? "#05070f" : "#0a1024";
  ctx.fillRect(x - 6, y - 14, 12, 8);
  // "E" prompt pulse
  if (highlight) {
    ctx.strokeStyle = "#5cf1ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 12, y - 18, 24, 30);
  }
}

function drawPlayer(ctx, player, camera) {
  const cx = player.x - camera.x;
  const floorY = player.y - camera.y;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, floorY + 1, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.fillStyle = "#243c6b";
  ctx.fillRect(cx - 6, floorY - 10, 4, 10);
  ctx.fillRect(cx + 2, floorY - 10, 4, 10);
  // torso
  ctx.fillStyle = "#5cf1ff";
  ctx.fillRect(cx - 7, floorY - 22, 14, 14);
  // head
  ctx.fillStyle = "#e6ecff";
  ctx.beginPath();
  ctx.arc(cx, floorY - 28, 6, 0, Math.PI * 2);
  ctx.fill();
  // helmet visor
  ctx.fillStyle = "#5cf1ff";
  ctx.fillRect(cx - 5, floorY - 30, 10, 3);
}

// Stable starfield cache, redrawn relative to camera for parallax.
let STARS = null;
function initStars() {
  const s = [];
  for (let i = 0; i < 180; i++) {
    s.push({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      r: Math.random() * 1.4 + 0.2,
      t: Math.random(),
    });
  }
  STARS = s;
}
function drawStars(ctx, camera) {
  if (!STARS) initStars();
  ctx.fillStyle = "#ffffff";
  for (const s of STARS) {
    const px = s.x - camera.x * 0.2;
    const py = s.y - camera.y * 0.2;
    const a = 0.4 + 0.6 * Math.sin(performance.now() / 800 + s.t * 7);
    ctx.globalAlpha = a * 0.7;
    ctx.fillRect(px, py, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}
