// Top-down 4x3 grid of room tiles (modeled on the reference screenshot).
// Each tile is a self-contained stylized top-down scene with the room's
// agent, a couple of props, and a status LED. Hover + click are hit-tested
// against tile rects.

import { AGENTS } from "./agents.js";

// Layout: 4 columns, 3 rows, 12 rooms.
// Column/row ordering mirrors what you see in the screenshot:
// top row = growth/exec, middle row = product/delivery, bottom = people/support.
const GRID_ORDER = [
  // row 0: Executive / Growth
  "commander", "sales", "marketing", "research",
  // row 1: Product / Delivery
  "factory", "engineering", "ops", "data",
  // row 2: People / Support
  "airlock", "habitation", "medbay", "studio",
];

const ROOM_META = {
  commander: {
    name: "Command Bridge",
    theme: { floor: "#0c2540", wall: "#1e4a78", accent: "#5cf1ff" },
    props: ["chair", "holo"],
  },
  sales: {
    name: "Sales Floor",
    theme: { floor: "#3a220b", wall: "#7a3f13", accent: "#ffb86b" },
    props: ["desk", "desk", "chart"],
  },
  marketing: {
    name: "Marketing",
    theme: { floor: "#3a0f2b", wall: "#7a1f53", accent: "#f472b6" },
    props: ["billboard", "desk"],
  },
  research: {
    name: "Research Lab",
    theme: { floor: "#1f143a", wall: "#3f2a75", accent: "#c4b5fd" },
    props: ["tank", "console"],
  },
  factory: {
    name: "Factory",
    theme: { floor: "#2e1808", wall: "#5a300f", accent: "#fb923c" },
    props: ["conveyor", "machine", "machine"],
  },
  engineering: {
    name: "Engineering",
    theme: { floor: "#2e2608", wall: "#5a4a0f", accent: "#facc15" },
    props: ["reactor", "console"],
  },
  ops: {
    name: "Operations",
    theme: { floor: "#0a2a18", wall: "#10553a", accent: "#7dffa1" },
    props: ["console", "console", "crate"],
  },
  data: {
    name: "Data Core",
    theme: { floor: "#0a1f3a", wall: "#153a74", accent: "#60a5fa" },
    props: ["server", "server", "server"],
  },
  airlock: {
    name: "Security",
    theme: { floor: "#1f2432", wall: "#3a4458", accent: "#94a3b8" },
    props: ["turret", "crate"],
  },
  habitation: {
    name: "Habitation",
    theme: { floor: "#0e2e2e", wall: "#195a5a", accent: "#a7f3d0"},
    props: ["bed", "bed", "plant"],
  },
  medbay: {
    name: "Medbay",
    theme: { floor: "#3a1020", wall: "#75203f", accent: "#ff6b8a" },
    props: ["pod", "pod"],
  },
  studio: {
    name: "Studio",
    theme: { floor: "#2a0f3a", wall: "#55205a", accent: "#d946ef" },
    props: ["camera", "monitor", "plant"],
  },
};

export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const ROOM_IDS = GRID_ORDER;

export function buildRooms() {
  const rooms = {};
  for (let i = 0; i < GRID_ORDER.length; i++) {
    const id = GRID_ORDER[i];
    const meta = ROOM_META[id];
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    rooms[id] = {
      id,
      name: meta.name,
      agentId: id,
      theme: meta.theme,
      props: meta.props,
      col,
      row,
      level: 1,
      online: true,
      hovered: false,
      // tile rect (in canvas pixels) is set each frame by renderStation
      rect: { x: 0, y: 0, w: 0, h: 0 },
    };
  }
  return rooms;
}

// ---------- Rendering ----------

let STARS = null;

export function renderStation(ctx, layout, station, hoveredId) {
  const { cw, ch } = layout;
  ctx.clearRect(0, 0, cw, ch);
  drawStars(ctx, cw, ch);

  const { tileW, tileH, gridX, gridY, gap } = layout.grid;

  // Grid background panel
  const panelPad = 14;
  ctx.fillStyle = "rgba(6, 10, 24, 0.75)";
  ctx.fillRect(
    gridX - panelPad,
    gridY - panelPad,
    tileW * GRID_COLS + gap * (GRID_COLS - 1) + panelPad * 2,
    tileH * GRID_ROWS + gap * (GRID_ROWS - 1) + panelPad * 2
  );
  ctx.strokeStyle = "#1c2748";
  ctx.strokeRect(
    gridX - panelPad,
    gridY - panelPad,
    tileW * GRID_COLS + gap * (GRID_COLS - 1) + panelPad * 2,
    tileH * GRID_ROWS + gap * (GRID_ROWS - 1) + panelPad * 2
  );

  // Tiles
  for (const room of Object.values(station.rooms)) {
    const x = gridX + room.col * (tileW + gap);
    const y = gridY + room.row * (tileH + gap);
    room.rect = { x, y, w: tileW, h: tileH };
    drawRoomTile(ctx, room, hoveredId === room.id);
  }
}

function drawRoomTile(ctx, room, hovered) {
  const { x, y, w, h } = room.rect;
  const agent = AGENTS[room.agentId];
  const th = room.theme;

  // Outer frame (porthole look)
  const r = 10;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();

  // Floor
  ctx.fillStyle = th.floor;
  ctx.fillRect(x, y, w, h);

  // Floor grid pattern
  ctx.strokeStyle = hexWithAlpha(th.accent, 0.12);
  ctx.lineWidth = 1;
  const cell = 16;
  for (let gx = x; gx < x + w; gx += cell) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += cell) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }

  // Wall strip along the top (inside the room)
  const wallH = 22;
  ctx.fillStyle = th.wall;
  ctx.fillRect(x, y, w, wallH);
  ctx.fillStyle = hexWithAlpha(th.accent, 0.25);
  ctx.fillRect(x, y + wallH - 2, w, 2);

  // Room-specific props
  drawProps(ctx, room);

  // Agent sprite (top-down)
  drawAgentTopDown(ctx, room, agent);

  // Ambient glow
  const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, Math.max(w, h));
  grad.addColorStop(0, hexWithAlpha(th.accent, hovered ? 0.2 : 0.08));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Scanline
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let sy = y + 4; sy < y + h; sy += 6) ctx.fillRect(x, sy, w, 1);

  // Top name plate
  ctx.fillStyle = "rgba(5,7,15,0.75)";
  ctx.fillRect(x + 8, y + 6, Math.min(180, w - 52), 16);
  ctx.fillStyle = th.accent;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillText(room.name.toUpperCase(), x + 12, y + 18);

  // Status LED + level pip
  const ledX = x + w - 16;
  const ledY = y + 14;
  ctx.fillStyle = room.online ? "#7dffa1" : "#ff6b8a";
  ctx.beginPath();
  ctx.arc(ledX, ledY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(5,7,15,0.75)";
  ctx.fillRect(x + w - 50, y + 6, 28, 16);
  ctx.fillStyle = "#ffb86b";
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.fillText(`L${room.level}`, x + w - 46, y + 18);

  // Agent name bottom-left
  if (agent) {
    ctx.fillStyle = "rgba(5,7,15,0.75)";
    ctx.fillRect(x + 8, y + h - 20, Math.min(170, w - 16), 14);
    ctx.fillStyle = "#e6ecff";
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillText(agent.name, x + 12, y + h - 9);
  }

  ctx.restore();

  // Outer border (outside clip)
  ctx.lineWidth = hovered ? 2.5 : 1.5;
  ctx.strokeStyle = hovered ? th.accent : "#22305c";
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  // Offline overlay
  if (!room.online) {
    ctx.fillStyle = "rgba(2,4,10,0.55)";
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ff6b8a";
    ctx.font = "bold 14px 'JetBrains Mono', monospace";
    ctx.fillText("OFFLINE", x + w / 2 - 28, y + h / 2);
    ctx.restore();
  }
}

function drawProps(ctx, room) {
  const { x, y, w, h } = room.rect;
  const th = room.theme;
  const wallH = 22;

  // Layout props across the floor zone (below wall strip)
  const floorY = y + wallH + 6;
  const floorH = h - wallH - 28;
  const props = room.props || [];
  const perCol = Math.max(1, Math.min(4, props.length));
  const step = (w - 32) / perCol;

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const px = x + 16 + step * i + step / 2;
    const py = floorY + floorH / 2;
    drawProp(ctx, px, py, p, th);
  }
}

function drawProp(ctx, cx, cy, kind, th) {
  const { accent, wall } = th;
  ctx.save();
  ctx.translate(cx, cy);
  switch (kind) {
    case "chair":
      ctx.fillStyle = wall;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = accent;
      ctx.fillRect(-8, -10, 16, 3);
      break;
    case "holo":
      ctx.fillStyle = hexWithAlpha(accent, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "desk":
      ctx.fillStyle = wall;
      ctx.fillRect(-14, -5, 28, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(-12, -4, 10, 3);
      break;
    case "chart":
      ctx.fillStyle = "#0a1024";
      ctx.fillRect(-14, -10, 28, 20);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(2, 2);
      ctx.lineTo(10, -6);
      ctx.stroke();
      break;
    case "billboard":
      ctx.fillStyle = accent;
      ctx.fillRect(-16, -10, 32, 18);
      ctx.fillStyle = "#0a1024";
      ctx.fillRect(-14, -8, 28, 14);
      ctx.fillStyle = accent;
      ctx.fillRect(-10, -4, 20, 3);
      break;
    case "tank":
      ctx.fillStyle = hexWithAlpha(accent, 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "console":
      ctx.fillStyle = wall;
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = accent;
      ctx.fillRect(-10, -4, 8, 8);
      ctx.fillStyle = "#e6ecff";
      ctx.fillRect(2, -3, 6, 6);
      break;
    case "conveyor":
      ctx.fillStyle = wall;
      ctx.fillRect(-18, -4, 36, 8);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      for (let i = -16; i < 16; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, -4);
        ctx.lineTo(i, 4);
        ctx.stroke();
      }
      break;
    case "machine":
      ctx.fillStyle = wall;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = accent;
      ctx.fillRect(-8, -8, 16, 4);
      ctx.fillStyle = "#0a1024";
      ctx.fillRect(-6, 0, 12, 6);
      break;
    case "reactor":
      ctx.fillStyle = wall;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "crate":
      ctx.fillStyle = wall;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = accent;
      ctx.strokeRect(-8, -8, 16, 16);
      break;
    case "server":
      ctx.fillStyle = wall;
      ctx.fillRect(-6, -12, 12, 24);
      ctx.fillStyle = accent;
      for (let i = -10; i < 10; i += 4) ctx.fillRect(-4, i, 8, 2);
      break;
    case "turret":
      ctx.fillStyle = wall;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(-2, -12, 4, 12);
      break;
    case "bed":
      ctx.fillStyle = wall;
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = accent;
      ctx.fillRect(-10, -6, 6, 12);
      break;
    case "plant":
      ctx.fillStyle = wall;
      ctx.fillRect(-4, 2, 8, 6);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -2, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "pod":
      ctx.fillStyle = wall;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    case "camera":
      ctx.fillStyle = wall;
      ctx.fillRect(-10, -5, 16, 10);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(8, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "monitor":
      ctx.fillStyle = wall;
      ctx.fillRect(-10, -8, 20, 16);
      ctx.fillStyle = accent;
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = "#0a1024";
      ctx.fillRect(-6, -4, 12, 8);
      break;
    default:
      ctx.fillStyle = accent;
      ctx.fillRect(-5, -5, 10, 10);
  }
  ctx.restore();
}

function drawAgentTopDown(ctx, room, agent) {
  if (!agent) return;
  const { x, y, w, h } = room.rect;
  // Agent drifts slightly within the room for a living feel.
  const t = performance.now() / 1200;
  const seed = (room.col + room.row * 4) * 0.7;
  const cx = x + w - 30 + Math.sin(t + seed) * 6;
  const cy = y + h - 32 + Math.cos(t + seed) * 3;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (top-down: circle for head, shoulders behind)
  ctx.fillStyle = agent.accent;
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 6, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = "#e6ecff";
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Visor
  ctx.fillStyle = agent.accent;
  ctx.fillRect(cx - 3.5, cy - 1, 7, 1.5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function hexWithAlpha(hex, alpha) {
  // hex like #rrggbb
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawStars(ctx, cw, ch) {
  if (!STARS) {
    STARS = [];
    for (let i = 0; i < 160; i++) {
      STARS.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.2,
        t: Math.random(),
      });
    }
  }
  ctx.fillStyle = "#ffffff";
  const now = performance.now() / 900;
  for (const s of STARS) {
    const a = 0.35 + 0.5 * Math.sin(now + s.t * 7);
    ctx.globalAlpha = a * 0.7;
    ctx.fillRect(s.x * cw, s.y * ch, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

// Hit test: return the room id under point (px, py), or null.
export function roomAtPoint(station, px, py) {
  for (const room of Object.values(station.rooms)) {
    const r = room.rect;
    if (r.w === 0) continue;
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return room.id;
  }
  return null;
}

// Compute grid layout given canvas size. Keeps the grid centered and sized
// to fit nicely in the canvas.
export function computeLayout(cw, ch) {
  const pad = 48;
  const availW = cw - pad * 2;
  const availH = ch - pad * 2;
  const gap = 10;
  const tileW = Math.floor((availW - gap * (GRID_COLS - 1)) / GRID_COLS);
  const tileH = Math.floor((availH - gap * (GRID_ROWS - 1)) / GRID_ROWS);
  const totalW = tileW * GRID_COLS + gap * (GRID_COLS - 1);
  const totalH = tileH * GRID_ROWS + gap * (GRID_ROWS - 1);
  const gridX = Math.floor((cw - totalW) / 2);
  const gridY = Math.floor((ch - totalH) / 2);
  return { cw, ch, grid: { tileW, tileH, gridX, gridY, gap } };
}
