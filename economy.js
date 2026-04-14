// Simulated business economy. Tracks Revenue, Orders, Products Live,
// Agents Active, Day counter. All hooks are structured so individual
// department branches can be swapped for real API calls later
// (e.g., sales -> rocket-sloth CRM, factory -> openclaw runtime).

import { AGENTS } from "./agents.js";

export const SPEEDS = [1, 2, 5, 10];
export const TICK_BASE_MS = 2500;
export const TICKS_PER_DAY = 24;

export function defaultState() {
  return {
    day: 1,
    tickInDay: 0,
    speed: 1,
    paused: false,

    // HUD numbers
    revenue: 0, // all time, in $
    revenueToday: 0,
    orders: 0, // all time order count
    ordersToday: 0,
    productsLive: 4, // small starter catalog
    agentsActiveCount: 12,
    agentsTotal: 12,

    // Secondary / progression (used by terminals, not top HUD)
    credits: 500, // spend currency for upgrades
    morale: 80,
    research: 0,
    xp: 0,
    level: 1,
    xpToNext: 100,
  };
}

export function defaultDeptMetrics() {
  return {
    commander: {
      products_live: 4,
      orders_today: 0,
      revenue_today: 0,
      agents_active: "12/12",
    },
    sales: {
      orders_today: 0,
      pipeline_value: 2400,
      win_rate_pct: 32,
      revenue_wk: 0,
    },
    marketing: {
      reach: 2400,
      leads_wk: 7,
      reputation: 52,
      campaigns_live: 1,
    },
    research: {
      active_projects: 1,
      research_points: 0,
      breakthroughs: 0,
      backlog: 3,
    },
    factory: {
      products_live: 4,
      throughput: 10,
      defect_rate: 2,
      backlog: 2,
    },
    engineering: {
      hull_integrity: 94,
      power_output: 120,
      open_repairs: 1,
      upgrade_queue: 0,
    },
    ops: {
      uptime_pct: 98,
      active_tasks: 2,
      queue: 5,
      sla_hits_pct: 96,
    },
    data: {
      dashboards: 6,
      anomalies_wk: 1,
      forecast_conf_pct: 74,
      queries_day: 142,
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
    studio: {
      posts_wk: 3,
      engagement_pct: 6,
      content_live: 4,
      collabs_open: 1,
    },
  };
}

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

// Pricing model: simulated. Average price per unit grows slowly with level
// of the Factory and Research.
function averagePrice(station) {
  const factory = station.rooms.factory?.level || 1;
  const research = station.rooms.research?.level || 1;
  return 18 + factory * 6 + research * 3;
}

export function tickEconomy(station, log) {
  const s = station.state;
  s.tickInDay += 1;

  let revenueGain = 0;
  let ordersGain = 0;

  // Count active agents (online rooms)
  s.agentsActiveCount = Object.values(station.rooms).filter((r) => r.online).length;
  s.agentsTotal = Object.values(station.rooms).length;

  const moraleMod = Math.max(0.2, s.morale / 100);
  const price = averagePrice(station);
  const marketing = station.rooms.marketing?.level || 1;
  const ops = station.rooms.ops?.level || 1;
  const demandMultiplier = 0.6 + 0.2 * marketing + 0.05 * ops;

  for (const room of Object.values(station.rooms)) {
    if (!room.online) continue;
    const metrics = station.deptMetrics[room.agentId];

    switch (room.agentId) {
      case "sales": {
        // Orders this tick scale with level x demand x morale
        const base = 0.4 + room.level * 0.5;
        const expected = base * demandMultiplier * moraleMod;
        const orders = Math.max(0, Math.round(expected + (Math.random() - 0.5) * 0.6));
        ordersGain += orders;
        metrics.orders_today = (metrics.orders_today || 0) + orders;
        metrics.revenue_wk = (metrics.revenue_wk || 0) + orders * price;
        metrics.pipeline_value = 1500 + room.level * 400 + Math.round(Math.random() * 200);
        metrics.win_rate_pct = Math.min(72, 28 + room.level * 4);
        break;
      }
      case "marketing": {
        metrics.reach += Math.round(30 + room.level * 18 * moraleMod);
        metrics.reputation = Math.min(100, metrics.reputation + (Math.random() < 0.15 ? 1 : 0));
        if (Math.random() < 0.05 * room.level) {
          metrics.leads_wk += 1;
          log?.("gm", "Marketing surfaced a new inbound lead.");
        }
        break;
      }
      case "factory": {
        // Adds to products_live occasionally (new SKUs manufactured)
        metrics.throughput = 8 + room.level * 4;
        metrics.defect_rate = Math.max(0, 3 - Math.floor(room.level / 2));
        if (Math.random() < 0.04 * room.level) {
          metrics.products_live += 1;
          s.productsLive = metrics.products_live;
          log?.("gm", `Factory shipped a new SKU. Products live: ${s.productsLive}.`);
        }
        break;
      }
      case "research": {
        if (Math.random() < 0.35) {
          const rp = Math.round(room.level * (0.8 + Math.random() * 0.8));
          metrics.research_points = (metrics.research_points || 0) + rp;
          s.research += rp;
          if (Math.random() < 0.04 * room.level) {
            metrics.breakthroughs += 1;
            log?.("gm", "Research breakthrough! +5 research, +100 credits.");
            s.research += 5;
            s.credits += 100;
          }
        }
        break;
      }
      case "engineering": {
        metrics.hull_integrity = Math.min(100, metrics.hull_integrity + (Math.random() < 0.3 ? 1 : 0));
        metrics.power_output = 110 + room.level * 10;
        break;
      }
      case "ops": {
        metrics.uptime_pct = Math.min(99, 95 + room.level);
        metrics.sla_hits_pct = Math.min(99, 92 + room.level * 2);
        metrics.queue = Math.max(0, metrics.queue - (Math.random() < 0.3 ? 1 : 0));
        break;
      }
      case "data": {
        metrics.queries_day += Math.round(6 + room.level * 4);
        metrics.forecast_conf_pct = Math.min(95, 68 + room.level * 3);
        if (Math.random() < 0.03 * room.level) {
          metrics.anomalies_wk += 1;
          log?.("sys", "Data Core flagged an anomaly in last shift.");
        }
        break;
      }
      case "airlock": {
        metrics.inspections_wk += Math.random() < 0.3 ? 1 : 0;
        if (Math.random() < 0.02) {
          metrics.contraband_flags += 1;
          log?.("sys", "Security flagged suspicious cargo.");
        }
        break;
      }
      case "habitation": {
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
      case "studio": {
        metrics.engagement_pct = Math.min(24, 4 + room.level * 1.6);
        if (Math.random() < 0.05 * room.level) {
          metrics.content_live += 1;
          log?.("gm", "Studio shipped new content.");
        }
        break;
      }
      case "commander":
      default:
        break;
    }
  }

  revenueGain = ordersGain * price;
  s.revenue += revenueGain;
  s.revenueToday += revenueGain;
  s.orders += ordersGain;
  s.ordersToday += ordersGain;
  s.credits += Math.round(revenueGain * 0.02); // small spend budget from revenue

  // Sync commander metrics panel
  station.deptMetrics.commander = {
    products_live: s.productsLive,
    orders_today: s.ordersToday,
    revenue_today: `$${Math.round(s.revenueToday)}`,
    agents_active: `${s.agentsActiveCount}/${s.agentsTotal}`,
  };

  awardXp(station, Math.max(0, Math.round(revenueGain * 0.02)));

  // End-of-day rollover
  if (s.tickInDay >= TICKS_PER_DAY) {
    s.tickInDay = 0;
    s.day += 1;
    log?.("gm", `Day ${s.day} begins. Yesterday: ${s.ordersToday} orders, $${Math.round(s.revenueToday)}.`);
    s.ordersToday = 0;
    s.revenueToday = 0;
  }

  // slow morale drift
  s.morale = Math.round(s.morale + (60 - s.morale) * 0.004);
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

export function formatCurrency(n) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function formatClock(tickInDay) {
  // 24 ticks per day -> each tick is 1 "hour"
  const h = tickInDay;
  return `${String(h).padStart(2, "0")}:00`;
}
