import {
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
        rawInput: message.payload.rawInput
      });
    case 'GET_EXTENSION_STATE':
      return getState();
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}
