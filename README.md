# VTT_DM

VTT DM Copilot is the starting point for a Chrome-extension-first virtual tabletop layered on top of D&D Beyond. The project is aimed at two parallel experiences:

- a lightweight AboveVTT-style interface for maps, NPC portraits, and session tooling;
- an AI-powered Dungeon Master that keeps campaign continuity in structured state and reacts to player choices.

## Current project status

This repository now contains the first implementation foundation:

- a Manifest V3 Chrome extension scaffold;
- a D&D Beyond content script that injects a prototype AI DM side panel;
- a background service worker with local campaign/session storage helpers;
- a session-memory feed that shows recently recorded player actions and scene snapshots;
- scene capture hooks that inspect visible map/token elements so the DM context can include players/monsters;
- input isolation to prevent keystrokes in the DM panel from leaking into D&D Beyond VTT controls.

## Repository structure

```text
manifest.json                       Chrome extension entrypoint
src/background/service-worker.js    background orchestration and message routing
src/content/content.js              D&D Beyond page detection, scene capture, and panel injection
src/lib/storage.js                  local JSON-like campaign state helpers
src/ui/panel.css                    prototype UI styling
src/ui/panel.html                   panel shell
docs/architecture.md                product architecture and roadmap
```

## How to load the prototype in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Visit a D&D Beyond page and look for the VTT DM Copilot panel in the top-right corner.

## What works now

- **Save turn note** records player actions and stores them in extension session memory.
- **Capture current scene** scans the current page for map/token indicators and writes a scene snapshot.
- **Recent memory** in the panel displays the latest entries so recording is visibly confirmed.

> Note: D&D Beyond VTT internals are not publicly documented and may change. Scene capture currently uses resilient DOM heuristics that should be improved with dedicated adapters per page type.

## Near-term roadmap

1. Parse real D&D Beyond campaign and character sheet data instead of only inferring page context.
2. Add upload flows for maps and NPC portraits.
3. Create an options page for API keys, model settings, and DM persona tuning.
4. Add a deterministic AI DM loop that emits both narration and state patches.
5. Render a shared battle map with token placement and encounter controls.

## Product direction for the AI DM

The core product differentiator is persistent campaign memory. Each player action should become a structured event that can be summarized for the model and saved back into campaign state. The long-term architecture should let the AI DM:

- read the current campaign state;
- narrate outcomes in the DM's configured tone;
- update quests, NPC dispositions, and map state;
- keep a session log that can be reviewed or exported later.
