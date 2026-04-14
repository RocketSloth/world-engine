# Orbital One — AI Space Station Tycoon

A Fallout-Shelter-style tycoon game where **every NPC is a real AI agent**.
You are the commander of Orbital One, an independent space station. Walk your
character through the decks, press `E` at any terminal, and actually chat with
that department's AI head of staff (Claude-powered). Upgrade rooms, run
missions, grow the station, grow your pockets.

This repo is v1. Business integrations (CRM, revenue) are currently simulated
behind clean seams so we can wire them to real systems next.

## Run locally

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

## Controls

- `A` / `D` (or arrows) — walk
- `W` / `S` (or arrows) — elevator up / down (when standing in the central shaft)
- `E` — use the terminal you're standing next to
- `Esc` — close the open terminal
- Left panel — save / load / reset, Anthropic API key, and station status

## Station layout

Three decks, four zones per deck (elevator shaft + three rooms):

| Deck | Rooms                                                    |
|-----:|----------------------------------------------------------|
| Top  | Airlock · Command Bridge · Comms Array                   |
| Mid  | Operations · Sales Bay · Research Lab                    |
| Low  | Engineering · Habitation · Medbay                        |

Each room has a terminal and one AI agent on duty:

| Room           | Agent                | Role                         |
|----------------|----------------------|------------------------------|
| Airlock        | Sentinel-7           | Security & docking           |
| Command Bridge | Cmdr. Rhea Voss      | Station commander (you+)     |
| Comms Array    | Juno Park            | Comms & outreach             |
| Operations     | Chief Kora Mina      | Operations & logistics       |
| Sales Bay      | Dir. Vex Calder      | Sales & partnerships         |
| Research Lab   | Dr. Nyx Orion        | Research & development       |
| Engineering    | Engineer Tal Okoye   | Engineering & power          |
| Habitation     | Ensign Finn Aris     | Crew & habitation            |
| Medbay         | Medic Sana Reeve     | Medbay & wellness            |

## How agents work

- Each agent has a unique persona encoded as a system prompt in `agents.js`.
- When you open a terminal and chat, the browser calls
  `POST https://api.anthropic.com/v1/messages` with:
  - the agent's system prompt
  - a live snapshot of station metrics (credits, morale, levels, …)
  - the running chat history for that agent (per session)
- The agent answers in-character, grounded in your real station state.

To enable live replies, paste an Anthropic API key in the left panel and
(optionally) tick "Remember key in this browser" to stash it in `localStorage`.

> ⚠ **Security note.** The key is sent directly from the browser to
> `api.anthropic.com` (using the `anthropic-dangerous-direct-browser-access`
> header). This is fine for local play. For a public deploy, proxy the call
> through a backend so keys never ship to clients.

## Game loop

Every 4 seconds the station "ticks":

- Each online room produces credits based on its level, modulated by crew morale.
- Sales Bay occasionally closes deals for lump-sum credits.
- Research Lab accumulates research points and may land breakthroughs.
- Engineering raises your power ceiling as it levels up.
- Habitation nudges morale toward its level-based target.

You earn XP by talking to agents, visiting new terminals for the first time,
and from revenue-generating ticks. Leveling up gives a credits bonus.

Spend credits to upgrade a room (from that room's terminal, "Upgrade Room"
button). Higher level = more output, more power draw.

## File map

- `index.html` — shell UI (canvas + left panel + terminal modal)
- `styles.css` — sci-fi theming
- `app.js` — entry: input, movement, save/load, main loop
- `station.js` — station geometry + rendering (rooms, terminals, player)
- `agents.js` — agent personas + Anthropic Messages API client
- `economy.js` — ticks, XP, upgrades, mocked department metrics
- `terminal.js` — terminal modal UI (chat + metrics + upgrade)

## Roadmap (v2+)

Clean seams are in place to wire the game to real systems:

- `economy.js` currently mocks department metrics. Swap the `sales` branch to
  call `rocket-sloth-consulting`'s `/api/crm/*` endpoints so Sales Bay
  reflects real pipeline state.
- `agents.js#sendToAgent` is a single function — it can be extended to
  Anthropic tool use so agents actually *do* things (create a CRM contact,
  draft an email, run a search).
- Revenue can be wired to a Stripe feed; each MRR tick becomes in-game credits.
- Station-wide events, hiring screen, more rooms (hangar, manufacturing).
