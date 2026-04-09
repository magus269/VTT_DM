const PANEL_ID = 'vtt-dm-copilot-panel';

boot().catch((error) => console.error('Failed to boot VTT DM Copilot', error));

async function boot() {
  const pageContext = inferPageContext(window.location);
  await sendMessage('DDB_CONTEXT_DISCOVERED', pageContext);
  mountPanel(pageContext);
}

function inferPageContext(location) {
  const [, root, section, id] = location.pathname.split('/');

  return {
    siteRoot: root || '',
    section: section || '',
    entityId: id || null,
    pageTitle: document.title,
    pageUrl: location.href,
    campaignName: document.querySelector('h1')?.textContent?.trim() || '',
    locationSummary: `Viewing ${document.title}`
  };
}

function mountPanel(pageContext) {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const host = document.createElement('aside');
  host.id = PANEL_ID;
  host.className = 'vtt-dm-panel';
  host.innerHTML = buildPanelMarkup(pageContext);
  document.body.appendChild(host);

  const turnInput = host.querySelector('#vtt-dm-turn-input');
  setupInputIsolation(turnInput);

  host.querySelector('[data-action="log-turn"]')?.addEventListener('click', async () => {
    const rawInput = turnInput.value.trim();

    if (!rawInput) {
      return;
    }

    const sceneData = collectSceneData();
    await sendMessage('PLAYER_ACTION_RECORDED', {
      summary: rawInput.slice(0, 180),
      rawInput,
      sceneHints: {
        hasMap: sceneData.hasMap,
        playersVisible: sceneData.players.length,
        monstersVisible: sceneData.monsters.length
      }
    });

    turnInput.value = '';
    host.querySelector('[data-role="status"]').textContent = 'Turn recorded to local session memory.';
    await renderSessionMemory(host);
  });

  host.querySelector('[data-action="capture-scene"]')?.addEventListener('click', async () => {
    const sceneData = collectSceneData();
    const summary = buildSceneSummary(sceneData);

    await sendMessage('SCENE_SNAPSHOT_RECORDED', {
      summary,
      sceneData
    });

    host.querySelector('[data-role="status"]').textContent = 'Scene snapshot recorded.';
    await renderSessionMemory(host);
  });

  void renderSessionMemory(host);
}

function setupInputIsolation(input) {
  if (!input) {
    return;
  }

  ['keydown', 'keypress', 'keyup', 'input', 'paste'].forEach((eventName) => {
    input.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  });
}

function collectSceneData() {
  const mapCandidates = [
    '[data-testid*="map"]',
    '[class*="map"] canvas',
    '[class*="scene"] canvas',
    'canvas'
  ];

  const tokenCandidates = [
    '[data-testid*="token"]',
    '[class*="token"]',
    '[aria-label*="token" i]'
  ];

  const mapElements = dedupeElements(mapCandidates);
  const tokenElements = dedupeElements(tokenCandidates);

  const players = tokenElements
    .filter((token) => /(player|pc|party)/i.test(token.getAttribute('aria-label') || token.textContent || token.className))
    .map((token) => sanitizeLabel(token.getAttribute('aria-label') || token.textContent || token.className));

  const monsters = tokenElements
    .filter((token) => /(monster|enemy|npc|creature)/i.test(token.getAttribute('aria-label') || token.textContent || token.className))
    .map((token) => sanitizeLabel(token.getAttribute('aria-label') || token.textContent || token.className));

  return {
    pageTitle: document.title,
    url: window.location.href,
    hasMap: mapElements.length > 0,
    mapCount: mapElements.length,
    tokenCount: tokenElements.length,
    players,
    monsters
  };
}

function buildSceneSummary(sceneData) {
  if (!sceneData.hasMap) {
    return `No map detected. Captured ${sceneData.players.length} player-like tokens and ${sceneData.monsters.length} monster-like tokens from ${sceneData.pageTitle}.`;
  }

  return `Map detected (${sceneData.mapCount}). Captured ${sceneData.players.length} player-like tokens and ${sceneData.monsters.length} monster-like tokens from ${sceneData.pageTitle}.`;
}

async function renderSessionMemory(host) {
  const state = await sendMessage('GET_EXTENSION_STATE');
  const list = host.querySelector('[data-role="memory-list"]');

  if (!list) {
    return;
  }

  const lastEvents = state.sessionLog.slice(-5).reverse();

  if (lastEvents.length === 0) {
    list.innerHTML = '<li>No entries yet.</li>';
    return;
  }

  list.innerHTML = lastEvents
    .map(
      (event) =>
        `<li><strong>${event.type}</strong> · ${escapeHtml(event.summary || '(no summary)')}<br><span>${new Date(event.timestamp).toLocaleString()}</span></li>`
    )
    .join('');
}

function dedupeElements(selectors) {
  const elements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
  return [...new Set(elements)];
}

function sanitizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPanelMarkup(pageContext) {
  return `
    <div class="vtt-dm-panel__header">
      <div>
        <p class="vtt-dm-panel__eyebrow">AI Dungeon Master</p>
        <h2>VTT DM Copilot</h2>
      </div>
      <span class="vtt-dm-panel__badge">Prototype</span>
    </div>
    <p class="vtt-dm-panel__summary">${pageContext.locationSummary}</p>
    <div class="vtt-dm-panel__section">
      <h3>Scene tools</h3>
      <p>Capture map/token visibility from the current D&D Beyond view.</p>
      <button data-action="capture-scene">Capture current scene</button>
    </div>
    <div class="vtt-dm-panel__section">
      <label for="vtt-dm-turn-input">Record a player action</label>
      <textarea id="vtt-dm-turn-input" rows="4" placeholder="The party negotiates with the mayor, then heads toward the ruined tower."></textarea>
      <button data-action="log-turn">Save turn note</button>
      <p class="vtt-dm-panel__status" data-role="status">Waiting for session notes.</p>
    </div>
    <div class="vtt-dm-panel__section">
      <h3>Recent memory</h3>
      <ul class="vtt-dm-panel__memory" data-role="memory-list"></ul>
    </div>
  `;
}

function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || 'Unknown extension error'));
        return;
      }

      resolve(response.payload);
    });
  });
}
