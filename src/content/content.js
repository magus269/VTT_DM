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

  host.querySelector('[data-action="sync-context"]')?.addEventListener('click', async () => {
    const context = collectDdbContext();
    await sendMessage('SCENE_SNAPSHOT_RECORDED', {
      summary: buildSceneSummary(context.sceneData),
      sceneData: context.sceneData
    });

    renderContextSummary(host, context);
    host.querySelector('[data-role="status"]').textContent = 'Scene + dice log context synced.';
    await renderSessionMemory(host);
  });

  host.querySelector('[data-action="log-turn"]')?.addEventListener('click', async () => {
    const rawInput = turnInput.value.trim();

    if (!rawInput) {
      return;
    }

    const context = collectDdbContext();
    await sendMessage('PLAYER_ACTION_RECORDED', {
      summary: rawInput.slice(0, 180),
      rawInput,
      context
    });

    const dmFeedback = await sendMessage('GENERATE_DM_FEEDBACK', {
      playerInput: rawInput,
      context
    });

    turnInput.value = '';
    renderContextSummary(host, context);
    renderDmOutput(host, dmFeedback);
    host.querySelector('[data-role="status"]').textContent = 'Turn recorded. DM response generated.';
    await renderSessionMemory(host);
  });

  const initialContext = collectDdbContext();
  renderContextSummary(host, initialContext);
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

function collectDdbContext() {
  const sceneData = collectSceneData();
  const activityLog = collectActivityLog();

  return {
    sceneData,
    activityLog,
    capturedAt: new Date().toISOString()
  };
}

function collectSceneData() {
  const mapCandidates = [
    '[data-testid*="map"]',
    '[class*="map"] canvas',
    '[class*="scene"] canvas',
    '[class*="vtt"] canvas',
    'canvas'
  ];

  const tokenCandidates = [
    '[data-testid*="token"]',
    '[class*="token"]',
    '[aria-label*="token" i]',
    '[data-testid*="creature"]',
    '[data-testid*="player"]'
  ];

  const playerSelectors = [
    '[data-testid*="player"]',
    '[data-testid*="character"]',
    '[class*="player"]',
    '[class*="party"]'
  ];

  const monsterSelectors = [
    '[data-testid*="monster"]',
    '[data-testid*="enemy"]',
    '[class*="monster"]',
    '[class*="enemy"]',
    '[class*="creature"]'
  ];

  const mapElements = dedupeElements(mapCandidates);
  const tokenElements = dedupeElements(tokenCandidates);

  const playerLabels = dedupeStrings([
    ...extractLabelsFromElements(dedupeElements(playerSelectors)),
    ...tokenElements
      .filter((token) => /(player|pc|party|hero|ally)/i.test(getElementLabel(token)))
      .map((token) => sanitizeLabel(getElementLabel(token)))
  ]);

  const monsterLabels = dedupeStrings([
    ...extractLabelsFromElements(dedupeElements(monsterSelectors)),
    ...tokenElements
      .filter((token) => /(monster|enemy|npc|creature|foe|villain)/i.test(getElementLabel(token)))
      .map((token) => sanitizeLabel(getElementLabel(token)))
  ]);

  return {
    pageTitle: document.title,
    url: window.location.href,
    hasMap: mapElements.length > 0,
    mapCount: mapElements.length,
    tokenCount: tokenElements.length,
    players: playerLabels,
    monsters: monsterLabels
  };
}

function collectActivityLog() {
  const selectors = [
    '[data-testid*="log"] [data-testid*="entry"]',
    '[data-testid*="combat-log"] *',
    '[class*="log"] [class*="entry"]',
    '[class*="chat"] [class*="message"]',
    '[class*="dice"] [class*="result"]',
    '[aria-live]'
  ];

  const entries = dedupeElements(selectors)
    .map((node) => sanitizeLabel(node.textContent || ''))
    .filter((text) => text.length > 0)
    .filter((text) => /(roll|rolled|initiative|attack|damage|save|check|\bd\d+\b)/i.test(text))
    .slice(-12)
    .map((text) => ({
      timestamp: new Date().toISOString(),
      text,
      raw: text
    }));

  return entries;
}

function renderContextSummary(host, context) {
  const output = host.querySelector('[data-role="context-summary"]');

  if (!output) {
    return;
  }

  const { sceneData, activityLog } = context;
  output.innerHTML = [
    `<li>Map detected: <strong>${sceneData.hasMap ? 'yes' : 'no'}</strong> (${sceneData.mapCount})</li>`,
    `<li>Players detected: <strong>${sceneData.players.length}</strong></li>`,
    `<li>Monsters detected: <strong>${sceneData.monsters.length}</strong></li>`,
    `<li>Dice/chat log entries found: <strong>${activityLog.length}</strong></li>`
  ].join('');
}

function renderDmOutput(host, dmFeedback) {
  host.querySelector('[data-role="dm-output"]').textContent = dmFeedback.responseText || 'No DM response generated.';

  const creatureRollsNode = host.querySelector('[data-role="creature-rolls"]');
  const rolls = dmFeedback.creatureRolls || [];

  if (rolls.length === 0) {
    creatureRollsNode.innerHTML = '<li>No creature rolls this turn.</li>';
    return;
  }

  creatureRollsNode.innerHTML = rolls
    .map((roll) => `<li>${escapeHtml(roll.name)}: ${escapeHtml(roll.formula)} = <strong>${roll.total}</strong></li>`)
    .join('');
}

function buildSceneSummary(sceneData) {
  if (!sceneData.hasMap) {
    return `No map detected. Captured ${sceneData.players.length} players and ${sceneData.monsters.length} creatures from ${sceneData.pageTitle}.`;
  }

  return `Map detected (${sceneData.mapCount}). Captured ${sceneData.players.length} players and ${sceneData.monsters.length} creatures from ${sceneData.pageTitle}.`;
}

async function renderSessionMemory(host) {
  const state = await sendMessage('GET_EXTENSION_STATE');
  const list = host.querySelector('[data-role="memory-list"]');

  if (!list) {
    return;
  }

  const lastEvents = state.sessionLog.slice(-8).reverse();

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

function extractLabelsFromElements(elements) {
  return elements.map((element) => sanitizeLabel(getElementLabel(element))).filter(Boolean);
}

function getElementLabel(element) {
  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('data-name') ||
    element.getAttribute('title') ||
    element.textContent ||
    element.className
  );
}

function dedupeElements(selectors) {
  const elements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
  return [...new Set(elements)];
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
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
      <h3>Detected D&D Beyond context</h3>
      <ul class="vtt-dm-panel__memory" data-role="context-summary"></ul>
      <button data-action="sync-context">Sync scene + logs</button>
    </div>

    <div class="vtt-dm-panel__section">
      <label for="vtt-dm-turn-input">Player action / question</label>
      <textarea id="vtt-dm-turn-input" rows="4" placeholder="The ranger moves to flank the ogre. What do the enemies do?"></textarea>
      <button data-action="log-turn">Run DM turn</button>
      <p class="vtt-dm-panel__status" data-role="status">Waiting for input.</p>
    </div>

    <div class="vtt-dm-panel__section">
      <h3>DM response</h3>
      <pre class="vtt-dm-panel__dm-output" data-role="dm-output">No DM response yet.</pre>
      <h4>Creature rolls</h4>
      <ul class="vtt-dm-panel__memory" data-role="creature-rolls"><li>No creature rolls this turn.</li></ul>
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
