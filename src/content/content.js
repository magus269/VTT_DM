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

  host.querySelector('[data-action="log-turn"]')?.addEventListener('click', async () => {
    const textarea = host.querySelector('textarea');
    const rawInput = textarea.value.trim();

    if (!rawInput) {
      return;
    }

    await sendMessage('PLAYER_ACTION_RECORDED', {
      summary: rawInput.slice(0, 180),
      rawInput
    });

    textarea.value = '';
    host.querySelector('[data-role="status"]').textContent = 'Turn recorded locally. AI DM hook comes next.';
  });
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
      <h3>Session memory</h3>
      <p>Track campaign state, maps, NPCs, and player choices directly from D&D Beyond pages.</p>
    </div>
    <div class="vtt-dm-panel__section">
      <label for="vtt-dm-turn-input">Record a player action</label>
      <textarea id="vtt-dm-turn-input" rows="5" placeholder="The party negotiates with the mayor, then heads toward the ruined tower."></textarea>
      <button data-action="log-turn">Save turn note</button>
      <p class="vtt-dm-panel__status" data-role="status">Waiting for session notes.</p>
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
