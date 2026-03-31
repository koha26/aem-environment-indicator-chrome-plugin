import './popup.css';
import { MESSAGE_TYPES } from '../shared/constants.js';
import { syncChips } from '../shared/ui-utils.js';

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const state = await chrome.runtime.sendMessage({
    type:  MESSAGE_TYPES.GET_TAB_STATE,
    tabId: tab.id,
  });

  renderState(state ?? {});
  bindEvents(state ?? {}, tab.id);
}

function renderState(state) {
  const { envType, programName, mode, overrides, hostname, features } = state;

  // Global toggle reflects badge feature state
  const toggle = document.getElementById('global-toggle');
  toggle.checked = features?.badge !== false;

  if (envType) {
    document.getElementById('no-env-display').classList.add('hidden');
    const display = document.getElementById('env-display');
    display.classList.remove('hidden');

    const cssKey = envType.toLowerCase().replace('stage', 'stg');
    display.className = 'env-display env-' + cssKey;

    const pill = document.getElementById('env-pill');
    pill.textContent = envType;
    pill.className = 'env-pill ' + cssKey;

    const modeText = (mode && mode !== 'unknown') ? ` (${mode})` : '';
    document.getElementById('env-label').textContent = `${hostname}${modeText}`;
  }

  document.getElementById('program-name').textContent = programName || '—';

  // Set override dropdown value
  const currentOverride = (hostname && overrides?.[hostname]?.envType) ?? '';
  document.getElementById('override-select').value = currentOverride;
  syncChips(document.getElementById('override-chips'), currentOverride);
}

function bindEvents(state, tabId) {
  document.getElementById('override-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.getElementById('override-select').value = chip.dataset.value;
    // Triggers existing persistence handler (sends SET_OVERRIDE to SW, closes popup)
    document.getElementById('override-select').dispatchEvent(new Event('change'));
    syncChips(document.getElementById('override-chips'), chip.dataset.value);
  });

  // Override select — when changed, send SET_OVERRIDE to SW
  document.getElementById('override-select').addEventListener('change', async (e) => {
    const envType  = e.target.value || null;
    const hostname = state.hostname;
    if (!hostname) return;

    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SET_OVERRIDE,
      hostname,
      envType,
    });
    // SW reloads the tab — close popup
    window.close();
  });

  // Global toggle — toggles badge feature (and by extension the visual indicator)
  document.getElementById('global-toggle').addEventListener('change', async (e) => {
    const features = { ...(state.features ?? {}), badge: e.target.checked };
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SET_FEATURES,
      features,
    });
  });

  // Settings link
  document.getElementById('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

init();
