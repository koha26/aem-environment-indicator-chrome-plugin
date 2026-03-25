import {
  MESSAGE_TYPES,
  ENV_COLORS,
  ENV_BADGE_LETTERS,
  OVERRIDE_CYCLE_ORDER,
} from '../shared/constants.js';
import {
  getPrograms,
  getFallbackPatterns,
  getFeatures,
  getOverrides,
  setFeatures,
  setOverrides,
} from '../shared/storage.js';
import { matchEnvironment } from '../shared/matcher.js';

// ─── In-memory tab state ──────────────────────────────────────────────────────
// Map<tabId, { envType, programName, programId, mode, hostname, enabled }>
// Ephemeral per-tab state — lost when the service worker is terminated.
// Repopulated automatically when content scripts send REPORT_ENV on navigation.
const tabState = new Map();

// ─── Message Router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE_TYPES.REPORT_ENV:
      handleReportEnv(message, sender).then(sendResponse);
      return true; // keep channel open for async response

    case MESSAGE_TYPES.GET_TAB_STATE:
      handleGetTabState(message.tabId ?? sender.tab?.id).then(sendResponse);
      return true;

    case MESSAGE_TYPES.SET_OVERRIDE:
      handleSetOverride(message).then(sendResponse);
      return true;

    case MESSAGE_TYPES.SET_FEATURES:
      handleSetFeatures(message).then(sendResponse);
      return true;
  }
  // Return false / undefined for unrecognised messages
});

// ─── REPORT_ENV ───────────────────────────────────────────────────────────────
async function handleReportEnv({ hostname, envType: domEnvType, mode }, sender) {
  const tabId = sender.tab?.id;
  if (!tabId || !hostname) return { envType: null, enabled: false, features: {} };

  const [programs, fallbackPatterns, features, overrides] = await Promise.all([
    getPrograms(),
    getFallbackPatterns(),
    getFeatures(),
    getOverrides(),
  ]);

  // Resolve env type: DOM detection → hostname matcher
  let envType = domEnvType;
  let programId = null;
  let programName = null;

  if (!envType) {
    const match = matchEnvironment(hostname, programs, fallbackPatterns);
    envType     = match.envType;
    programId   = match.programId;
    programName = match.programName;
  } else {
    // DOM detected — still try to find the program name via matcher
    const match = matchEnvironment(hostname, programs, fallbackPatterns);
    programId   = match.programId;
    programName = match.programName;
  }

  // Apply override if present
  const override = overrides[hostname];
  if (override?.envType) {
    envType = override.envType;
  }

  const enabled = !!envType;

  tabState.set(tabId, { envType, programName, programId, mode, hostname, enabled });

  // Update badge
  updateBadge(tabId, envType, features, enabled);

  // Respond to content script with visuals config
  return { envType, enabled, features };
}

// ─── GET_TAB_STATE ────────────────────────────────────────────────────────────
async function handleGetTabState(tabId) {
  if (!tabId) return {};
  const state    = tabState.get(tabId) ?? {};
  const [features, overrides] = await Promise.all([getFeatures(), getOverrides()]);
  return { ...state, features, overrides };
}

// ─── SET_OVERRIDE ─────────────────────────────────────────────────────────────
async function handleSetOverride({ hostname, envType }) {
  if (!hostname) return { success: false };

  const overrides = await getOverrides();

  if (envType === null || envType === undefined || envType === '') {
    delete overrides[hostname];
  } else {
    overrides[hostname] = { envType };
  }

  await setOverrides(overrides);

  // Reload all tabs currently showing this hostname
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      const url = new URL(tab.url ?? '');
      if (url.hostname === hostname && tab.id) {
        chrome.tabs.reload(tab.id);
      }
    } catch {
      // Non-URL tabs (chrome://, about:, etc.) — ignore
    }
  }

  return { success: true };
}

// ─── SET_FEATURES ─────────────────────────────────────────────────────────────
async function handleSetFeatures({ features }) {
  if (!features || typeof features !== 'object') return { success: false };
  await setFeatures(features);

  // Re-apply badge to all tracked tabs
  const updatedFeatures = await getFeatures();
  for (const [tabId, state] of tabState.entries()) {
    updateBadge(tabId, state.envType, updatedFeatures, state.enabled);
  }

  return { success: true };
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function updateBadge(tabId, envType, features, enabled) {
  if (!features?.badge || !enabled || !envType) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    return;
  }

  const letter = ENV_BADGE_LETTERS[envType] ?? '?';
  const color  = ENV_COLORS[envType]        ?? '#666666';

  chrome.action.setBadgeText({ tabId, text: letter }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Page is navigating — clear stale state; content script will REPORT_ENV again
    tabState.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
});

// ─── Keyboard Shortcut ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-override') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  const state = tabState.get(activeTab.id);
  if (!state?.hostname) return;

  const overrides = await getOverrides();
  const current   = overrides[state.hostname]?.envType ?? null;

  // indexOf returns -1 if current value is not in the cycle (e.g. stale storage value).
  // (-1 + 1) % length = 0, which maps to null (clear override). This is intentional.
  const idx  = OVERRIDE_CYCLE_ORDER.indexOf(current);
  const next = OVERRIDE_CYCLE_ORDER[(idx + 1) % OVERRIDE_CYCLE_ORDER.length];

  await handleSetOverride({ hostname: state.hostname, envType: next });
});
