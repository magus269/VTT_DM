# Product architecture

## Product goals
- Overlay a virtual tabletop workflow on top of D&D Beyond pages as a Chrome extension.
- Synchronize campaign, character, NPC, and map context from D&D Beyond into local extension storage.
- Add an AI Dungeon Master loop that reads the current campaign state, narrates scenes, reacts to player actions, and writes the new world state back to structured files.

## MVP slices
1. **D&D Beyond context ingestion**
   - Detect active character, encounter, and campaign pages.
   - Normalize campaign metadata into a canonical state object.
   - Capture scene snapshots (map visibility + token hints) so the AI DM can narrate what the players currently see.
2. **Local campaign memory**
   - Maintain JSON-compatible records for campaign state, session log, maps, NPCs, and DM persona.
   - Version state updates so the AI can reason about continuity.
3. **AI DM orchestration**
   - Build a prompt pipeline that combines player input, world state, and DM persona.
   - Return structured outputs: narration, encounter changes, quest updates, and persistence patches.
   - Feed the model recent player actions plus scene snapshots from extension memory for continuity.
4. **VTT interactions**
   - Upload maps and portraits.
   - Track tokens, fog-of-war, notes, and initiative over time.

## Suggested storage model
```yaml
campaign-state:
  campaignId: ddb-campaign-id
  activeSceneId: scene-crossroads
  locationSummary: The party is camped outside the ruined watchtower.
  questThreads:
    - id: black-banner
      status: active
  partyMembers:
    - ddbCharacterId: 123456
      hp: 27
session-log:
  - id: uuid
    timestamp: 2026-03-21T10:00:00.000Z
    type: player_action
    summary: The rogue convinced the gate guard to stand down.
dm-persona:
  tone: Tense but playful
  goals:
    - Reward creative plans
    - Preserve setting continuity
```

## Recommended next milestones
- Build a dedicated parser for D&D Beyond campaign and character pages.
- Add an options page for OpenAI API configuration and DM persona editing.
- Introduce a state patch format so model responses can update campaign JSON deterministically.
- Decide whether persistent files live in `chrome.storage`, IndexedDB, or a synced backend.
