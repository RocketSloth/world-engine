# world-engine

A lightweight browser prototype for an evolving world-building game with:

- **Sims vibe**: life-sim status panel and AI Game Master narration.
- **Minecraft vibe**: blocky/isometric tiles, gathering resources, and placing builds.
- **Zelda/Farm-style progression**: action-driven time flow and narrative events.

## Run locally

No build step required.

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Using your own API key

1. Enter your key in the **OpenAI API Key** field (`sk-...`).
2. Choose a model (default: `gpt-4.1-mini`).
3. Type an action and click **Send Action**.

The app makes client-side requests to:

- `POST https://api.openai.com/v1/responses`

> Note: For production use, proxy requests through your backend so keys are never exposed in the browser.

## Controls

- `W/A/S/D` move camera
- `Q/E` rotate camera
- Click tree/rock tiles to gather resources
- Click grass tiles to place a farm plot (costs wood)

## Current scope

This is a visual prototype focused on core loop + AI narration. Next steps could include NPC schedules, quests, save/load, and richer 3D visuals.
