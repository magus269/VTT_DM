# VTT_DM

VTT DM Copilot is the starting point for a Chrome-extension-first virtual tabletop layered on top of D&D Beyond. The project is aimed at two parallel experiences:

- a lightweight AboveVTT-style interface for maps, NPC portraits, and session tooling;
- an AI-powered Dungeon Master that keeps campaign continuity in structured state and reacts to player choices.

## Current project status

This repository now contains a working prototype that can:

- inject a DM panel on D&D Beyond pages;
- detect map/token/chat-log signals from the live DOM;
- capture player + monster hints from VTT-like elements;
- summarize recent dice-log activity;
- record player turns into session memory;
- generate DM feedback for each turn;
- roll basic creature checks/attacks for detected monsters;
- keep all events in extension storage for continuity.

## Repository structure

```text
manifest.json                       Chrome extension entrypoint
src/background/service-worker.js    message routing + DM feedback generation
src/content/content.js              D&D Beyond DOM ingestion + panel interactions
src/lib/storage.js                  local JSON-like campaign state/session memory helpers
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

- **Sync scene + logs** snapshots visible map/player/monster hints and dice/chat activity.
- **Run DM turn** records the player action, then immediately generates DM feedback.
- DM feedback references detected context and recent roll logs, then adds generated creature rolls.
- **Recent memory** stores player turns, scene snapshots, and DM output events.

> Important: D&D Beyond VTT internals are not publicly documented and can change. Selectors are currently heuristic and should be replaced with page-specific adapters as we validate real gameplay pages.

## Near-term roadmap

1. Build robust adapters for campaign pages, character sheets, encounter tracker, and the VTT log.
2. Add upload flows for maps and NPC portraits.
3. Create an options page for API keys, model settings, and DM persona tuning.
4. Replace heuristic DM feedback with OpenAI API orchestration and structured patch outputs.
5. Render a shared battle map with token placement and encounter controls.
