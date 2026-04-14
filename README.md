# Orbital One — AI Space Station Tycoon

A tycoon game where **every NPC is a real AI agent**. The station runs on 12
AI department heads (CEO, Sales, Marketing, Research, Factory, Engineering,
Ops, Data, Security, People, Wellness, Studio). You click a room to open its
terminal and chat with that agent, who reports on their department in-character.

The main view is a top-down 4×3 grid of room tiles (inspired by the reference
screenshot), with a business HUD across the top (Day · Revenue · Orders ·
Products Live · Agents Active) and speed controls (1x / 2x / 5x / 10x / pause).

v1 is self-contained in a single static site. Real business integrations
(CRM, revenue, openclaw agent runtime) are parked behind clean seams.

## Run locally

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

## Controls

- **Click a room tile** — open that room's terminal and chat with the agent.
- **Top-right speed bar** — ⏸ / 1x / 2x / 5x / 10x
- **Space** — toggle pause. **1 / 2 / 3 / 4** — set speed to 1 / 2 / 5 / 10x.
- **Esc** — close an open terminal.

## The station

Grid (top to bottom, left to right):

| Row        | Rooms                                                   |
|------------|---------------------------------------------------------|
| Executive  | Command Bridge · Sales Floor · Marketing · Research Lab |
| Delivery   | Factory · Engineering · Operations · Data Core          |
| Support    | Security · Habitation · Medbay · Studio                 |

Every room has one AI agent:

| Room           | Agent               | Role                   |
|----------------|---------------------|------------------------|
| Command Bridge | Cmdr. Rhea Voss     | CEO / Station Commander |
| Sales Floor    | Dir. Vex Calder     | Head of Sales          |
| Marketing      | Juno Park           | Head of Marketing      |
| Research Lab   | Dr. Nyx Orion       | Head of Research       |
| Factory        | Forge-9             | Head of Manufacturing  |
| Engineering    | Engineer Tal Okoye  | Head of Engineering    |
| Operations     | Chief Kora Mina     | Head of Operations     |
| Data Core      | Archivist Solen     | Head of Data           |
| Security       | Sentinel-7          | Head of Security       |
| Habitation     | Ensign Finn Aris    | Head of People         |
| Medbay         | Medic Sana Reeve    | Head of Wellness       |
| Studio         | Muse Lark           | Head of Studio         |

## How agents work

Each agent has a unique persona + system prompt in `agents.js`. When you send
a message, the browser calls `POST https://api.anthropic.com/v1/messages` with:

- the agent's system prompt (role + personality + tone guide)
- a live snapshot of station metrics injected into system context
- the running chat history for that agent in this session

To enable live replies, paste an Anthropic API key in the left panel
(optionally tick "Remember key in this browser" to stash it in `localStorage`).

> ⚠ The key is sent directly from the browser to `api.anthropic.com` (using
> the `anthropic-dangerous-direct-browser-access` header). Fine for local play;
> for a public deploy, proxy through a backend so keys never ship to clients.

## Game loop

Every tick (default ~2.5s per "hour", speed-multiplied), each online room
updates its metrics:

- **Sales** closes orders (orders × average price = revenue)
- **Marketing** boosts reach, occasionally surfaces leads
- **Factory** occasionally adds a new SKU to Products Live
- **Research** accrues research points and rare breakthroughs
- **Engineering** raises power output
- **Ops** improves uptime / SLA hit rate
- **Data** logs queries and forecast confidence
- **Security** inspects dockings, may flag contraband
- **Habitation** drives morale
- **Medbay** raises health index
- **Studio** raises engagement, ships content

24 ticks make a day, then a daily summary lands in the station log.

Average order price scales with Factory level + Research level. Demand scales
with Marketing level + Ops level + morale. Revenue also drips a small % into
a "credits" budget you spend on room upgrades (from each room's terminal).

## File map

- `index.html` — shell: top business HUD, canvas, left panel, terminal modal
- `styles.css` — sci-fi styling
- `app.js` — entry: HUD updates, input, click-to-open, speed, tick loop
- `station.js` — top-down grid rendering, per-room scenes, hit-testing
- `agents.js` — agent personas + Anthropic Messages API client
- `economy.js` — simulated business economy (Revenue / Orders / Products /
  Agents Active), XP, upgrades, day/clock
- `terminal.js` — terminal modal UI (chat + dept metrics + upgrade/assign)

## Roadmap

Clean seams left for the next pass:

- **CRM integration.** Swap the `sales` branch in `economy.js` for calls to
  `rocket-sloth-consulting`'s `/api/crm/*` so Orders/Pipeline reflect real
  deals.
- **Openclaw runtime.** Move `sendToAgent` in `agents.js` from direct
  Anthropic to an openclaw-hosted agent endpoint — each room becomes a real
  persistent agent with its own tools.
- **Agent tool use.** Give Sales the ability to actually draft + send
  outreach, Factory to adjust a real production plan, Data to query Supabase,
  etc. (Anthropic tool-use under the hood.)
- **Revenue feed.** Replace mocked prices with a Stripe MRR feed; in-game
  revenue becomes the real number.
- **More rooms / upgrades / events.** Launch campaigns, hire new agents,
  unlock additional decks.
