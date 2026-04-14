// Economy: simulated department metrics, per-tick revenue, upgrades, XP.
// v1 is fully mocked — clean hooks are left for wiring to a real CRM later.

import { AGENTS } from "./agents.js";

export function defaultState() {
  return {
    stardate: 2742.01,
    credits: 500,
    power: 100,
    powerMax: 100,
    morale: 80,
    research: 0,
    xp: 0,
    level: 1,
    xpToNext: 100,
    lastTick: 0,
  };
}

// Per-department mocked metrics. Drift each tick for a living feel.
export function defaultDeptMetrics() {
  return {
    commander: { level: 1, credits: 500, morale: 80, power: 100 },
    sales: {
      deals_open: 4,
      deals_closed_wk: 1,
      pipeline_value: 1800,
      revenue_wk: 420,
    },
    ops: {
      active_tasks: 2,
      queue: 5,
      uptime_pct: 98,
      credits_per_hour: 12,
    },
    research: {
      active_projects: 1,
      research_points: 0,
      breakthroughs: 0,
      backlog: 3,
    },
    engineering: {
      hull_integrity: 94,
      power_output: 120,
      open_repairs: 1,
      upgrade_queue: 0,
    },
    comms: {
      reach: 2400,
      reputation: 52,
      open_leads: 7,
      broadcasts_wk: 2,
    },
    airlock: {
      docking_queue: 2,
      threat_level: "LOW",
      inspections_wk: 11,
      contraband_flags: 0,
    },
    habitation: {
      crew_size: 14,
      morale: 80,
      vacancies: 2,
      grievances: 1,
    },
    medbay: {
      patients: 1,
      meds_stock: 84,
      injuries_wk: 3,
      health_index: 88,
    },
  };
}

// XP progression table: next threshold grows quadratically
function xpToNextFor(level) {
  return 100 * level * level;
}

export function awardXp(station, amount, log) {
  const s = station.state;
  s.xp += amount;
  while (s.xp >= s.xpToNext) {
    s.xp -= s.xpToNext;
    s.level += 1;
    s.xpToNext = xpToNextFor(s.level);
    s.credits += 250 * s.level;
    log?.("sys", `Commander level up! You are now Level ${s.level}. +${250 * s.level} credits.`);
  }
}

// Every tick, each online room contributes credits + updates its metrics.
export function tickEconomy(station, log) {
  const s = station.state;
  s.stardate += 0.01;

  let creditsGain = 0;
  let powerDraw = 0;

  for (const room of Object.values(station.rooms)) {
    if (!room.online) continue;
    // each room consumes 2+ level power, produces based on role
    powerDraw += 2 + room.level;

    const metrics = station.deptMetrics[room.agentId];
    const moraleMod = s.morale / 100;

    switch (room.agentId) {
      case "sales": {
        // revenue per tick scales with level + morale
        const gain = Math.round((3 + room.level * 4) * moraleMod);
        creditsGain += gain;
        metrics.revenue_wk = (metrics.revenue_wk || 0) + gain;
        if (Math.random() < 0.05 * room.level) {
          metrics.deals_closed_wk += 1;
          metrics.deals_open = Math.max(0, metrics.deals_open - 1 + (Math.random() < 0.6 ? 1 : 0));
          creditsGain += 40 + room.level * 20;
          log?.("gm", `Sales Bay closed a deal. +${40 + room.level * 20} credits.`);
        }
        break;
      }
      case "ops": {
        const gain = Math.round((1 + room.level) * moraleMod);
        creditsGain += gain;
        metrics.credits_per_hour = 10 + room.level * 3;
        metrics.queue = Math.max(0, metrics.queue - (Math.random() < 0.25 ? 1 : 0));
        break;
      }
      case "research": {
        if (Math.random() < 0.35) {
          const rp = Math.round(room.level * (0.8 + Math.random() * 0.8));
          metrics.research_points += rp;
          s.research += rp;
          if (Math.random() < 0.04 * room.level) {
            metrics.breakthroughs += 1;
            log?.("gm", "Research breakthrough! +20 credits, +5 research.");
            s.research += 5;
            creditsGain += 20;
          }
        }
        break;
      }
      case "engineering": {
        // maintains hull, adds power headroom
        metrics.hull_integrity = Math.min(100, metrics.hull_integrity + (Math.random() < 0.3 ? 1 : 0));
        metrics.power_output = 110 + room.level * 10;
        s.powerMax = Math.max(100, 100 + (room.level - 1) * 20);
        break;
      }
      case "comms": {
        metrics.reach += Math.round(20 + room.level * 12 * moraleMod);
        metrics.reputation = Math.min(100, metrics.reputation + (Math.random() < 0.2 ? 1 : 0));
        if (Math.random() < 0.06 * room.level) {
          metrics.open_leads += 1;
          log?.("gm", "Comms surfaced a new inbound lead.");
        }
        break;
      }
      case "airlock": {
        metrics.inspections_wk += Math.random() < 0.3 ? 1 : 0;
        if (Math.random() < 0.02) {
          metrics.contraband_flags += 1;
          log?.("sys", "Airlock flagged suspicious cargo.");
        }
        break;
      }
      case "habitation": {
        // stabilizes morale
        const target = 60 + room.level * 6;
        s.morale = Math.round(s.morale + (target - s.morale) * 0.03);
        metrics.morale = s.morale;
        break;
      }
      case "medbay": {
        metrics.health_index = Math.min(100, metrics.health_index + (Math.random() < 0.2 ? 1 : 0));
        if (Math.random() < 0.04) {
          metrics.injuries_wk += 1;
          log?.("sys", "Minor injury logged in Medbay.");
        }
        break;
      }
      case "commander":
      default:
        break;
    }
  }

  s.credits += creditsGain;
  s.power = Math.max(0, s.powerMax - powerDraw);
  if (s.power < 10) {
    s.morale = Math.max(0, s.morale - 1);
    log?.("sys", "Low power is hurting crew morale.");
  }

  // slow natural morale drift toward 60 if neglected
  s.morale = Math.round(s.morale + (60 - s.morale) * 0.005);

  // sync commander metrics panel
  station.deptMetrics.commander = {
    level: s.level,
    credits: s.credits,
    morale: s.morale,
    power: `${s.power}/${s.powerMax}`,
  };

  awardXp(station, Math.max(0, Math.round(creditsGain * 0.1)));
}

export function upgradeCost(room) {
  return 200 * room.level * room.level;
}

export function tryUpgrade(station, roomId, log) {
  const room = station.rooms[roomId];
  if (!room) return { ok: false, reason: "Room not found." };
  const cost = upgradeCost(room);
  if (station.state.credits < cost) {
    return { ok: false, reason: `Need ${cost} credits (have ${station.state.credits}).` };
  }
  if (!room.online) return { ok: false, reason: "Room is offline." };
  station.state.credits -= cost;
  room.level += 1;
  awardXp(station, 25, log);
  log?.("gm", `${room.name} upgraded to level ${room.level} (-${cost} credits, +25 XP).`);
  return { ok: true };
}

export function getAgentMetrics(station, agentId) {
  return station.deptMetrics[agentId] || {};
}

export function formatMetric(key, value) {
  const label = key.replace(/_/g, " ");
  return { label, value: String(value) };
}
