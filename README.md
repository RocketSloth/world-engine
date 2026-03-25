# world-engine

A playable browser game prototype for an evolving world-building experience inspired by:

- **The Sims** → NPC personalities, relationships, daily life status, energy/time management.
- **Minecraft** → blocky gathering/building loop and open-ended tile interactions.
- **Zelda + Farm games** → light questing, exploration tone, crop growth, and progression.

## Run locally

```bash
python3 -m http.server 4173
```

Open: <http://localhost:4173>

## Bring your own API key

The UI includes an API key field so each player can use their own credentials.

- Enter key in **OpenAI API Key**.
- Choose a model (default `gpt-4.1-mini`).
- Press **Send Action** to get AI narration.

The app sends requests to:

- `POST https://api.openai.com/v1/responses`

> For production, move API calls behind your own backend so keys are never exposed in client code.

## Controls

### Camera / mode

- `W/A/S/D` pan
- `Q/E` rotate
- `1` Gather mode
- `2` Build mode
- `3` Talk mode

### Interactions

- Click **trees** and **rocks** in Gather mode to collect resources.
- Click **grass** in Build mode to place farms / cottages (if resources allow).
- Click near NPCs in Talk mode to chat and increase reputation.

### Quick actions

- Rest (restore energy)
- Craft furniture (resource-to-coins)
- Plant seeds
- Save / Load game (localStorage)

## What makes this version more playable

- Persistent-feeling village loop (time, seasons, crops, villagers).
- Clear quest objective with progress and reward.
- Multiple interaction modes and a meaningful resource economy.
- Save/load support and richer feedback via chat + system log.
