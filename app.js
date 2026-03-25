const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const ui = {
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  actionInput: document.getElementById('actionInput'),
  sendBtn: document.getElementById('sendBtn'),
  log: document.getElementById('log'),
  modeLabel: document.getElementById('modeLabel'),
  questTitle: document.getElementById('questTitle'),
  questDesc: document.getElementById('questDesc'),
  questProgress: document.getElementById('questProgress'),
  stats: {
    time: document.getElementById('timeLabel'),
    season: document.getElementById('seasonLabel'),
    energy: document.getElementById('energyLabel'),
    coins: document.getElementById('coinsLabel'),
    wood: document.getElementById('woodLabel'),
    stone: document.getElementById('stoneLabel'),
    food: document.getElementById('foodLabel')
  }
};

const TILE = 34;
const GRID = 22;
const MODES = ['gather', 'build', 'talk'];

const game = {
  world: [],
  camera: { x: 0, y: 0, angle: 0.2 },
  mode: 'gather',
  state: {
    day: 1,
    phase: 'Morning',
    season: 'Spring',
    energy: 12,
    maxEnergy: 12,
    coins: 14,
    wood: 6,
    stone: 4,
    food: 2,
    seeds: 2,
    reputation: 0
  },
  npcs: [
    { name: 'Pip', x: 8, y: 9, mood: 'curious', goal: 'repair pump', color: '#fca5a5', home: [8, 9], pathTick: 0 },
    { name: 'Mara', x: 12, y: 11, mood: 'calm', goal: 'tend fields', color: '#c4b5fd', home: [12, 11], pathTick: 0 }
  ],
  quest: {
    title: 'Village Kickoff',
    desc: 'Gather 8 wood and build 1 cottage.',
    targetWood: 8,
    targetCottages: 1,
    complete: false
  }
};

function tile(x, y) {
  return game.world.find((t) => t.x === x && t.y === y);
}

function seedWorld() {
  game.world.length = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const edge = x < 2 || y < 2 || x > GRID - 3 || y > GRID - 3;
      let type = edge ? 'water' : 'grass';
      const r = Math.random();
      if (!edge && r > 0.84) type = 'tree';
      if (!edge && r > 0.92) type = 'rock';
      game.world.push({ x, y, type, build: null, crop: null });
    }
  }

  // village center
  tile(9, 10).build = 'well';
  tile(10, 10).build = 'path';
  tile(11, 10).build = 'path';
  tile(10, 11).build = 'path';
  tile(11, 11).build = 'path';
}

function iso(x, y) {
  const cx = x - game.camera.x;
  const cy = y - game.camera.y;
  const a = game.camera.angle;
  const rx = cx * Math.cos(a) - cy * Math.sin(a);
  const ry = cx * Math.sin(a) + cy * Math.cos(a);
  return {
    x: (rx - ry) * (TILE / 2) + canvas.clientWidth / 2,
    y: (rx + ry) * (TILE / 4) + 90
  };
}

function drawDiamond(p, fill) {
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE / 4);
  ctx.lineTo(p.x + TILE / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE / 4);
  ctx.lineTo(p.x - TILE / 2, p.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.stroke();
}

function phaseTint() {
  const tint = {
    Morning: 'rgba(255, 230, 175, 0.08)',
    Noon: 'rgba(180, 220, 255, 0.03)',
    Evening: 'rgba(255, 170, 120, 0.12)',
    Night: 'rgba(30, 50, 90, 0.26)'
  };
  return tint[game.state.phase] || 'transparent';
}

function drawWorld() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (const t of game.world) {
    const p = iso(t.x, t.y);
    let color = '#4ade80';
    if (t.type === 'water') color = '#38bdf8';
    if (t.type === 'tree') color = '#65a30d';
    if (t.type === 'rock') color = '#94a3b8';
    drawDiamond(p, color);

    if (t.type === 'tree') {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(p.x - 3, p.y - 16, 6, 12);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 19, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    }

    if (t.type === 'rock') {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 8, 9, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
    }

    if (t.build === 'farm') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(p.x - 8, p.y - 12, 16, 8);
      if (t.crop === 'sprout') {
        ctx.fillStyle = '#84cc16';
        ctx.fillRect(p.x - 1, p.y - 15, 2, 4);
      }
      if (t.crop === 'ripe') {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(p.x - 3, p.y - 16, 6, 6);
      }
    }

    if (t.build === 'cottage') {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(p.x - 11, p.y - 22, 22, 15);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(p.x - 8, p.y - 7, 16, 6);
    }

    if (t.build === 'well') {
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(p.x - 7, p.y - 14, 14, 8);
      ctx.fillStyle = '#475569';
      ctx.fillRect(p.x - 5, p.y - 19, 10, 5);
    }
  }

  // NPCs
  for (const npc of game.npcs) {
    const p = iso(npc.x, npc.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y - 11, 6, 0, Math.PI * 2);
    ctx.fillStyle = npc.color;
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillRect(p.x - 4, p.y - 8, 8, 14);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(p.x - 18, p.y - 34, 36, 12);
    ctx.fillStyle = '#dbeafe';
    ctx.font = '10px sans-serif';
    ctx.fillText(npc.name, p.x - 14, p.y - 25);
  }

  // day/night overlay
  ctx.fillStyle = phaseTint();
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function nearestTile(px, py) {
  let best = null;
  let dist = Infinity;
  for (const t of game.world) {
    const p = iso(t.x, t.y);
    const d = Math.hypot(px - p.x, py - p.y);
    if (d < dist) {
      best = t;
      dist = d;
    }
  }
  return dist < TILE ? best : null;
}

function addLog(type, msg) {
  const p = document.createElement('p');
  p.className = type;
  const prefix = type === 'you' ? 'You' : type === 'sys' ? 'System' : 'GM';
  p.textContent = `${prefix}: ${msg}`;
  ui.log.prepend(p);
}

function updateQuestUI() {
  const cottages = game.world.filter((t) => t.build === 'cottage').length;
  const woodPart = Math.min(1, game.state.wood / game.quest.targetWood);
  const cottagePart = Math.min(1, cottages / game.quest.targetCottages);
  const progress = Math.round((woodPart * 0.45 + cottagePart * 0.55) * 100);

  ui.questTitle.textContent = game.quest.title;
  ui.questDesc.textContent = game.quest.desc;
  ui.questProgress.style.width = `${progress}%`;

  if (progress === 100 && !game.quest.complete) {
    game.quest.complete = true;
    game.state.coins += 20;
    game.state.reputation += 1;
    addLog('sys', 'Quest complete! +20 coins. New villager paths open in the east grove.');
  }
}

function updateHUD() {
  ui.stats.time.textContent = `Day ${game.state.day} · ${game.state.phase}`;
  ui.stats.season.textContent = game.state.season;
  ui.stats.energy.textContent = `${game.state.energy} / ${game.state.maxEnergy}`;
  ui.stats.coins.textContent = game.state.coins;
  ui.stats.wood.textContent = game.state.wood;
  ui.stats.stone.textContent = game.state.stone;
  ui.stats.food.textContent = game.state.food;
  ui.modeLabel.textContent = game.mode[0].toUpperCase() + game.mode.slice(1);
  updateQuestUI();
}

function advanceTime() {
  const phases = ['Morning', 'Noon', 'Evening', 'Night'];
  const idx = phases.indexOf(game.state.phase);
  game.state.phase = phases[(idx + 1) % phases.length];
  if (game.state.phase === 'Morning') {
    game.state.day += 1;
    game.state.energy = game.state.maxEnergy;
    growCrops();
    runDailyNPCChoices();
    if (game.state.day % 8 === 0) {
      const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
      const si = seasons.indexOf(game.state.season);
      game.state.season = seasons[(si + 1) % seasons.length];
      addLog('sys', `Season changed to ${game.state.season}.`);
    }
  }
}

function spendEnergy(n = 1) {
  if (game.state.energy < n) {
    addLog('sys', 'Too tired. Rest or sleep to recover energy.');
    return false;
  }
  game.state.energy -= n;
  return true;
}

function interactTile(t) {
  if (!t || t.type === 'water') return;

  if (game.mode === 'gather') {
    if (!spendEnergy(1)) return;
    if (t.type === 'tree') {
      t.type = 'grass';
      game.state.wood += 2;
      addLog('gm', 'You chop a tree and collect +2 wood.');
    } else if (t.type === 'rock') {
      t.type = 'grass';
      game.state.stone += 2;
      addLog('gm', 'You mine stone from a boulder (+2).');
    } else if (t.build === 'farm' && t.crop === 'ripe') {
      t.crop = null;
      game.state.food += 2;
      game.state.coins += 3;
      addLog('gm', 'Harvested ripe crops (+2 food, +3 coins).');
    }
  }

  if (game.mode === 'build') {
    if (!spendEnergy(2)) return;
    if (!t.build && t.type === 'grass' && game.state.wood >= 2) {
      t.build = 'farm';
      game.state.wood -= 2;
      addLog('gm', 'You place a new farm plot.');
    } else if (!t.build && t.type === 'grass' && game.state.wood >= 6 && game.state.stone >= 4) {
      t.build = 'cottage';
      game.state.wood -= 6;
      game.state.stone -= 4;
      addLog('gm', 'A cozy cottage rises from your plans.');
    } else {
      addLog('sys', 'Not enough resources or invalid tile for building.');
    }
  }

  if (game.mode === 'talk') {
    const near = game.npcs.find((n) => Math.hypot(n.x - t.x, n.y - t.y) <= 1.5);
    if (near) {
      const lines = {
        Pip: ['Need gears? Bring me stone and I can help.', 'The pump sings when the moon is high.'],
        Mara: ['Soil is happy today. Want to help me plant?', 'If crops glow gold, harvest before night!']
      };
      const bank = lines[near.name] || ['Hello there, builder.'];
      addLog('gm', `${near.name}: ${bank[Math.floor(Math.random() * bank.length)]}`);
      game.state.reputation += 0.1;
    } else {
      addLog('sys', 'No villager close enough to chat.');
    }
  }

  advanceTime();
  updateHUD();
}

function growCrops() {
  for (const t of game.world) {
    if (t.build === 'farm') {
      if (!t.crop && Math.random() > 0.75) t.crop = 'sprout';
      else if (t.crop === 'sprout') t.crop = 'ripe';
    }
  }
}

function runDailyNPCChoices() {
  for (const npc of game.npcs) {
    npc.mood = ['curious', 'busy', 'cheerful'][Math.floor(Math.random() * 3)];
    const steps = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    const move = steps[Math.floor(Math.random() * steps.length)];
    const nx = Math.max(2, Math.min(GRID - 3, npc.x + move[0]));
    const ny = Math.max(2, Math.min(GRID - 3, npc.y + move[1]));
    if (tile(nx, ny)?.type !== 'water') {
      npc.x = nx;
      npc.y = ny;
    }
  }
}

function quickAction(action) {
  if (action === 'rest') {
    game.state.energy = Math.min(game.state.maxEnergy, game.state.energy + 4);
    addLog('gm', 'You rest by the well. Energy restored.');
  }
  if (action === 'plant') {
    const farm = game.world.find((t) => t.build === 'farm' && !t.crop);
    if (farm && game.state.seeds > 0) {
      farm.crop = 'sprout';
      game.state.seeds -= 1;
      addLog('gm', 'You plant moonbean seeds in a farm plot.');
    } else {
      addLog('sys', 'You need an empty farm and seeds to plant.');
    }
  }
  if (action === 'craft') {
    if (game.state.wood >= 4 && game.state.stone >= 2) {
      game.state.wood -= 4;
      game.state.stone -= 2;
      game.state.coins += 6;
      addLog('gm', 'You craft furniture and sell it at the market (+6 coins).');
    } else {
      addLog('sys', 'Need 4 wood + 2 stone to craft furniture.');
    }
  }
  if (action === 'save') {
    localStorage.setItem('worldEngineSave', JSON.stringify(game));
    addLog('sys', 'Game saved to local storage.');
  }
  if (action === 'load') {
    const raw = localStorage.getItem('worldEngineSave');
    if (!raw) {
      addLog('sys', 'No save found yet.');
    } else {
      const saved = JSON.parse(raw);
      Object.assign(game, saved);
      addLog('sys', 'Save loaded. Welcome back.');
    }
  }
  advanceTime();
  updateHUD();
}

async function requestNarration(action) {
  const key = ui.apiKey.value.trim();
  if (!key) {
    addLog('sys', 'Add your API key for dynamic narration.');
    return;
  }

  try {
    const payload = {
      model: ui.model.value.trim() || 'gpt-4.1-mini',
      input: `You are a whimsical game master for a cozy life sim + block world. Current state: day ${game.state.day}, ${game.state.phase}, season ${game.state.season}, resources wood=${game.state.wood}, stone=${game.state.stone}, coins=${game.state.coins}, food=${game.state.food}, energy=${game.state.energy}. NPCs: ${game.npcs.map((n) => `${n.name}(${n.mood})`).join(', ')}. Active quest: ${game.quest.title}. Player action: ${action}. Reply in 110-170 words with vivid scene + 3 suggested actions.`
    };

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      addLog('sys', `API error (${res.status}). Check key/model and try again.`);
      return;
    }

    const data = await res.json();
    addLog('gm', data.output_text || 'The village waits for your next move.');
  } catch (err) {
    addLog('sys', `Request failed: ${err.message}`);
  }
}

function handleChatAction() {
  const action = ui.actionInput.value.trim();
  if (!action) return;
  ui.actionInput.value = '';
  addLog('you', action);

  if (/status|inventory/i.test(action)) {
    addLog('sys', `Inventory: ${game.state.wood} wood, ${game.state.stone} stone, ${game.state.food} food, ${game.state.coins} coins.`);
  }

  if (/sell/i.test(action) && game.state.food > 0) {
    const sold = game.state.food;
    game.state.food = 0;
    game.state.coins += sold * 3;
    addLog('gm', `You sell ${sold} food at market and earn ${sold * 3} coins.`);
    advanceTime();
  }

  updateHUD();
  requestNarration(action);
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'a') game.camera.x -= 0.45;
    if (k === 'd') game.camera.x += 0.45;
    if (k === 'w') game.camera.y -= 0.45;
    if (k === 's') game.camera.y += 0.45;
    if (k === 'q') game.camera.angle -= 0.08;
    if (k === 'e') game.camera.angle += 0.08;
    if (k === '1') game.mode = MODES[0];
    if (k === '2') game.mode = MODES[1];
    if (k === '3') game.mode = MODES[2];
    updateHUD();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = nearestTile(e.clientX - rect.left, e.clientY - rect.top);
    interactTile(t);
  });

  ui.sendBtn.addEventListener('click', handleChatAction);

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => quickAction(button.dataset.action));
  });
}

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function loop() {
  drawWorld();
  requestAnimationFrame(loop);
}

seedWorld();
setupInput();
resize();
updateHUD();
addLog('gm', 'Welcome back. This world now has quests, villagers, saves, crops, and multiple play modes.');
requestAnimationFrame(loop);
window.addEventListener('resize', resize);
