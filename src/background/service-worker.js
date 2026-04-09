import {
  appendSceneSnapshot,
  appendSessionEvent,
  defaultDmPersona,
  getState,
  patchCampaignState
} from '../lib/storage.js';

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();

  await chrome.storage.local.set({
    dmPersona: state.dmPersona ?? defaultDmPersona
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => {
      console.error('VTT DM Copilot error', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'DDB_CONTEXT_DISCOVERED':
      return patchCampaignState(message.payload);
    case 'PLAYER_ACTION_RECORDED':
      return appendSessionEvent({
        type: 'player_action',
        summary: message.payload.summary,
        rawInput: message.payload.rawInput,
        context: message.payload.context ?? null
      });
    case 'SCENE_SNAPSHOT_RECORDED': {
      await appendSessionEvent({
        type: 'scene_snapshot',
        summary: message.payload.summary,
        sceneData: message.payload.sceneData
      });
      return appendSceneSnapshot(message.payload);
    }
    case 'GENERATE_DM_FEEDBACK':
      return generateDmFeedback(message.payload);
    case 'GET_EXTENSION_STATE':
      return getState();
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}

async function generateDmFeedback(payload) {
  const state = await getState();
  const dmPersona = state.dmPersona ?? defaultDmPersona;
  const sceneData = payload.context?.sceneData ?? {};
  const activityLog = payload.context?.activityLog ?? [];

  const creatureRolls = (sceneData.monsters || [])
    .slice(0, 3)
    .map((monster) => buildCreatureRoll(monster));

  const latestRolls = activityLog
    .filter((entry) => /\b\d+d\d+\b|rolled|roll/i.test(entry.raw || entry.text))
    .slice(0, 4)
    .map((entry) => entry.text);

  const responseText = [
    `**DM (${dmPersona.tone})**`,
    sceneData.hasMap
      ? `I can see a battlemap with ${sceneData.players.length || 0} player tokens and ${sceneData.monsters.length || 0} creature tokens.`
      : 'I do not detect an explicit map canvas yet, but I can still narrate from the current page context.',
    payload.playerInput ? `You said: "${payload.playerInput}".` : 'No player narration was provided for this turn.',
    latestRolls.length > 0
      ? `Recent dice activity: ${latestRolls.join(' | ')}.`
      : 'No recent dice-roll log entries were detected in the visible DOM.',
    creatureRolls.length > 0
      ? `Creature rolls: ${creatureRolls.map((roll) => `${roll.name} ${roll.formula} = ${roll.total}`).join('; ')}.`
      : 'No creatures were detected to roll for in this scene.',
    'Narration: The situation evolves as both sides react, and the enemies commit to their next tactical move.'
  ].join('\n\n');

  const dmEvent = {
    type: 'dm_feedback',
    summary: `DM responded with ${creatureRolls.length} creature roll(s).`,
    responseText,
    creatureRolls,
    referencedDiceLog: latestRolls,
    contextSummary: {
      players: sceneData.players?.length ?? 0,
      monsters: sceneData.monsters?.length ?? 0,
      mapDetected: Boolean(sceneData.hasMap)
    }
  };

  await appendSessionEvent(dmEvent);
  return dmEvent;
}

function buildCreatureRoll(monsterName) {
  const safeName = String(monsterName || 'Creature').slice(0, 50);
  const d20 = rollDie(20);
  const modifier = rollDie(4) + 1;
  return {
    name: safeName,
    formula: `1d20+${modifier}`,
    total: d20 + modifier,
    breakdown: [d20, modifier]
  };
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
