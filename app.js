const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const actionInput = document.getElementById('actionInput');
const sendBtn = document.getElementById('sendBtn');
const log = document.getElementById('log');

const labels = {
  time: document.getElementById('timeLabel'),
  season: document.getElementById('seasonLabel'),
  coins: document.getElementById('coinsLabel'),
  wood: document.getElementById('woodLabel'),
  stone: document.getElementById('stoneLabel')
};

const TILE = 36;
const GRID = 16;
const world = [];
const player = { x: 7, y: 7 };
const camera = { x: 0, y: 0, angle: 0 };
const state = {
  day: 1,
  phase: 'Morning',
  season: 'Spring',
  coins: 12,
  wood: 8,
  stone: 5
};

function seedWorld() {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const roll = Math.random();
      let type = 'grass';
      if (roll > 0.84) type = 'tree';
      if (roll > 0.93) type = 'rock';
      if ((x > 10 && y < 4) || (x < 3 && y > 10)) type = 'water';
      world.push({ x, y, type, build: null });
    }
  }
}

function tileAt(x, y) {
  return world.find((t) => t.x === x && t.y === y);
}

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function iso(x, y) {
  const cx = x - camera.x;
  const cy = y - camera.y;
  const a = camera.angle;
  const rx = cx * Math.cos(a) - cy * Math.sin(a);
  const ry = cx * Math.sin(a) + cy * Math.cos(a);
  return {
    x: (rx - ry) * (TILE / 2) + canvas.clientWidth / 2,
    y: (rx + ry) * (TILE / 4) + 90
  };
}

function drawTile(x, y, fill) {
  const p = iso(x, y);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE / 4);
  ctx.lineTo(p.x + TILE / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE / 4);
  ctx.lineTo(p.x - TILE / 2, p.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  for (const t of world) {
    let fill = '#4ade80';
    if (t.type === 'water') fill = '#38bdf8';
    if (t.type === 'tree') fill = '#65a30d';
    if (t.type === 'rock') fill = '#94a3b8';
    drawTile(t.x, t.y, fill);

    const p = iso(t.x, t.y);
    if (t.type === 'tree') {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(p.x - 3, p.y - 18, 6, 14);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    }
    if (t.type === 'rock') {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 9, 9, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
    }
    if (t.build === 'farm') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(p.x - 8, p.y - 12, 16, 8);
    }
    if (t.build === 'cottage') {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(p.x - 10, p.y - 20, 20, 14);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(p.x - 6, p.y - 6, 12, 5);
    }
  }

  const pp = iso(player.x, player.y);
  ctx.beginPath();
  ctx.arc(pp.x, pp.y - 10, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fca5a5';
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.fillRect(pp.x - 4, pp.y - 8, 8, 14);
}

function gameTick() {
  draw();
  requestAnimationFrame(gameTick);
}

function addLog(kind, message) {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = `${kind === 'you' ? 'You' : 'GM'}: ${message}`;
  log.prepend(p);
}

function advanceTime() {
  const phases = ['Morning', 'Noon', 'Evening', 'Night'];
  const i = phases.indexOf(state.phase);
  state.phase = phases[(i + 1) % phases.length];
  if (state.phase === 'Morning') state.day += 1;

  labels.time.textContent = `Day ${state.day} · ${state.phase}`;
}

function updateHUD() {
  labels.season.textContent = state.season;
  labels.coins.textContent = state.coins;
  labels.wood.textContent = state.wood;
  labels.stone.textContent = state.stone;
}

function nearestTile(px, py) {
  let best = null;
  let dist = Infinity;
  for (const t of world) {
    const p = iso(t.x, t.y);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < dist) {
      dist = d;
      best = t;
    }
  }
  return dist < TILE ? best : null;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const t = nearestTile(e.clientX - rect.left, e.clientY - rect.top);
  if (!t || t.type === 'water') return;

  if (t.type === 'tree') {
    t.type = 'grass';
    state.wood += 2;
    addLog('gm', 'You gathered wood from a tree.');
  } else if (t.type === 'rock') {
    t.type = 'grass';
    state.stone += 2;
    addLog('gm', 'You mined stone from a boulder.');
  } else if (!t.build && state.wood >= 2) {
    t.build = 'farm';
    state.wood -= 2;
    state.coins += 1;
    addLog('gm', 'You placed a small farm plot.');
  }
  updateHUD();
  advanceTime();
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'a') camera.x -= 0.4;
  if (k === 'd') camera.x += 0.4;
  if (k === 'w') camera.y -= 0.4;
  if (k === 's') camera.y += 0.4;
  if (k === 'q') camera.angle -= 0.07;
  if (k === 'e') camera.angle += 0.07;
});

sendBtn.addEventListener('click', async () => {
  const action = actionInput.value.trim();
  if (!action) return;
  addLog('you', action);
  actionInput.value = '';

  const key = apiKeyInput.value.trim();
  if (!key) {
    addLog('gm', 'Add your API key to get AI narration.');
    return;
  }

  try {
    const prompt = `You are AI game master. State: day ${state.day}, ${state.phase}, resources wood ${state.wood}, stone ${state.stone}, coins ${state.coins}. User action: ${action}. Reply with 2 short paragraphs plus 3 next actions.`;
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelInput.value.trim() || 'gpt-4.1-mini',
        input: prompt
      })
    });

    if (!res.ok) {
      const err = await res.text();
      addLog('gm', `API error: ${res.status} ${err.slice(0, 120)}`);
      return;
    }

    const data = await res.json();
    const text = data.output_text || 'The wind hums through the village...';
    addLog('gm', text);
    advanceTime();
  } catch (err) {
    addLog('gm', `Request failed: ${err.message}`);
  }
});

seedWorld();
resize();
updateHUD();
addLog('gm', 'Welcome to Mossbell Hollow. Build, gather, and shape the town.');
requestAnimationFrame(gameTick);
window.addEventListener('resize', resize);
