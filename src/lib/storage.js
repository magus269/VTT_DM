export const STORAGE_KEYS = {
  campaignState: 'campaignState',
  dmPersona: 'dmPersona',
  maps: 'maps',
  npcPortraits: 'npcPortraits',
  sessionLog: 'sessionLog',
  sceneSnapshots: 'sceneSnapshots'
};

export const defaultCampaignState = {
  campaignId: null,
  campaignName: '',
  activeSceneId: null,
  locationSummary: '',
  questThreads: [],
  partyMembers: [],
  discoveredNpcs: [],
  updatedAt: null
};

export const defaultDmPersona = {
  tone: 'Cinematic and fair',
  goals: [
    'Keep the story moving forward',
    'Honor player agency',
    'Track continuity between sessions'
  ],
  safetyRules: [
    'Never invent character sheet values when the extension can fetch them',
    'Ask clarifying questions before making permanent world changes',
    'Summarize the consequences of major player choices'
  ]
};

export async function getState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

  return {
    campaignState: stored.campaignState ?? defaultCampaignState,
    dmPersona: stored.dmPersona ?? defaultDmPersona,
    maps: stored.maps ?? [],
    npcPortraits: stored.npcPortraits ?? [],
    sessionLog: stored.sessionLog ?? [],
    sceneSnapshots: stored.sceneSnapshots ?? []
  };
}

export async function patchCampaignState(patch) {
  const { campaignState } = await getState();
  const nextState = {
    ...campaignState,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ campaignState: nextState });
  return nextState;
}

export async function appendSessionEvent(event) {
  const { sessionLog } = await getState();
  const nextLog = [
    ...sessionLog,
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event
    }
  ];

  await chrome.storage.local.set({ sessionLog: nextLog });
  return nextLog;
}

export async function appendSceneSnapshot(snapshot) {
  const { sceneSnapshots } = await getState();
  const nextSnapshots = [
    ...sceneSnapshots,
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...snapshot
    }
  ];

  await chrome.storage.local.set({ sceneSnapshots: nextSnapshots });
  return nextSnapshots;
}
