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
  getFullConfig,
  setPrograms,
  setFeatures,
  setOverrides,
} from '../shared/storage.js';
import { matchEnvironment } from '../shared/matcher.js';

// ─── Pure env resolver ────────────────────────────────────────────────────────
/**
 * Resolves the environment type for a hostname purely from stored config.
 * No side effects — takes all dependencies as parameters.
 *
 * Priority: user override → program/pattern matcher
 * Auto-detected hostnames are stored as program entries, so the matcher finds them.
 *
 * @param {string} hostname
 * @param {{ overrides: object, programs: Array, fallbackPatterns: Array }} config
 * @returns {{ envType: string|null, programName: string|null, programId: string|null }}
 */
function resolveEnvForHostname(hostname, { overrides, programs, fallbackPatterns }) {
  const match   = matchEnvironment(hostname, programs, fallbackPatterns);
  const envType = overrides[hostname]?.envType ?? match.envType;
  return { envType, programName: match.programName, programId: match.programId };
}

// ─── In-memory tab state ──────────────────────────────────────────────────────
// Map<tabId, { envType, programName, programId, mode, hostname, enabled }>
// Ephemeral per-tab state — lost when the service worker is terminated.
// Repopulated automatically when content scripts send REPORT_ENV on navigation.
const tabState = new Map();

const ACTION_ICON_PATHS = {
  enabled: {
    16:  'assets/icon16.png',
    48:  'assets/icon48.png',
    128: 'assets/icon128.png',
  },
  disabled: {
    16:  'assets/icon-disabled16.png',
    48:  'assets/icon-disabled48.png',
    128: 'assets/icon-disabled128.png',
  },
};

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

  let matchResult = matchEnvironment(hostname, programs, fallbackPatterns);
  const override  = overrides[hostname];
  const envType   = override?.envType ?? domEnvType ?? matchResult.envType;

  // Auto-create a program when the content script detects an env for a hostname
  // that isn't covered by any existing program or fallback pattern.
  // The new program entry persists the detection in chrome.storage.sync so the
  // matcher resolves it on all future loads — and it appears in Settings → Programs.
  if (domEnvType && !matchResult.envType && !override) {
    const newProgram = {
      id:           crypto.randomUUID(),
      name:         hostname,
      autoDetected: true,
      environments: [{ id: crypto.randomUUID(), type: domEnvType, urlPattern: hostname }],
    };
    const updatedPrograms = [...programs, newProgram];
    await setPrograms(updatedPrograms);
    // Re-match with the saved program to get correct programId/programName for tabState
    matchResult = matchEnvironment(hostname, updatedPrograms, fallbackPatterns);
  }

  // Fan-out: push badge + visuals to every other open tab on the same hostname
  // so they light up immediately without a reload.
  if (domEnvType && envType) {
    const allTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of allTabs) {
      if (tab.id === tabId) continue;
      try {
        if (new URL(tab.url ?? '').hostname !== hostname) continue;
        const existing = tabState.get(tab.id) ?? {};
        tabState.set(tab.id, { ...existing, envType, hostname, enabled: true });
        updateBadge(tab.id, envType, features, true);
        chrome.tabs.sendMessage(tab.id, {
          type:    MESSAGE_TYPES.APPLY_VISUALS,
          envType,
          enabled: true,
          features,
        }).catch(() => {});
      } catch {
        // Non-URL tab — skip
      }
    }
  }

  const { programId, programName } = matchResult;
  const enabled = !!envType;

  tabState.set(tabId, { envType, programName, programId, mode, hostname, enabled });
  updateBadge(tabId, envType, features, enabled);
  return { envType, enabled, features };
}

// ─── GET_TAB_STATE ────────────────────────────────────────────────────────────
async function handleGetTabState(tabId) {
  if (!tabId) return {};

  let state = tabState.get(tabId) ?? null;

  // Load full config once — used for both the fallback resolution and the response.
  const { overrides, programs, fallbackPatterns, features } = await getFullConfig();

  if (!state) {
    // tabState is empty for this tab: either the SW was restarted (ephemeral map
    // cleared) or the content script hasn't fired REPORT_ENV yet (e.g. popup
    // opened immediately after switching to a background tab).
    // Eagerly resolve from stored config using the tab's current URL so the
    // popup always shows meaningful information without needing a page reload.
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab?.url ?? '';
      if (url && !url.startsWith('chrome') && !url.startsWith('about')) {
        const hostname = new URL(url).hostname;
        const { envType, programName, programId } = resolveEnvForHostname(
          hostname, { overrides, programs, fallbackPatterns }
        );
        state = { hostname, envType, programName, programId, enabled: !!envType };
        // Repopulate the in-memory cache and re-apply action visuals so popup
        // and toolbar icon are in sync immediately.
        tabState.set(tabId, state);
        updateBadge(tabId, envType, features, !!envType);
      }
    } catch {
      // Tab not found or non-parseable URL — leave state as null
    }
  }

  return { ...(state ?? {}), features, overrides };
}

// ─── SET_OVERRIDE ─────────────────────────────────────────────────────────────
async function handleSetOverride({ hostname, envType }) {
  if (!hostname) return { success: false };

  const [overrides, programs, fallbackPatterns] = await Promise.all([
    getOverrides(),
    getPrograms(),
    getFallbackPatterns(),
  ]);

  if (envType === null || envType === undefined || envType === '') {
    delete overrides[hostname];
  } else {
    overrides[hostname] = { envType };

    // If no specific program entry exists for this hostname, auto-create one so
    // it appears in Settings → Programs and can be managed there.
    // Fallback-pattern matches have programId === null, so they trigger creation too.
    const match = matchEnvironment(hostname, programs, fallbackPatterns);
    if (!match.programId) {
      const newProgram = {
        id:           crypto.randomUUID(),
        name:         hostname,
        autoDetected: true,
        environments: [{ id: crypto.randomUUID(), type: envType, urlPattern: hostname }],
      };
      await setPrograms([...programs, newProgram]);
    }
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
  const actionEnabled = Boolean(features?.badge && enabled && envType);

  chrome.action.setIcon({
    tabId,
    path: actionEnabled ? ACTION_ICON_PATHS.enabled : ACTION_ICON_PATHS.disabled,
  }).catch(() => {});

  if (!actionEnabled) {
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;

  // Clear stale in-memory state — content script will REPORT_ENV with fresh data
  tabState.delete(tabId);

  // Eagerly restore badge from stored config so it appears immediately on navigation,
  // without waiting for the content script's full load → REPORT_ENV cycle.
  try {
    const url = tab.url ?? '';
    if (!url || url.startsWith('chrome') || url.startsWith('about')) {
      chrome.action.setIcon({ tabId, path: ACTION_ICON_PATHS.disabled }).catch(() => {});
      chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
      return;
    }

    const hostname = new URL(url).hostname;
    const { overrides, programs, fallbackPatterns, features } = await getFullConfig();
    const { envType } = resolveEnvForHostname(hostname, { overrides, programs, fallbackPatterns });
    updateBadge(tabId, envType, features, !!envType);
  } catch {
    chrome.action.setIcon({ tabId, path: ACTION_ICON_PATHS.disabled }).catch(() => {});
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
});

// ─── SW Startup: restore badges for all open tabs ────────────────────────────
// Runs once per SW lifecycle. When Chrome terminates an idle SW and then restarts
// it (e.g., on tab navigation or popup open), tabState is empty. Re-apply badges
// to every open tab that can be resolved from stored config.
(async () => {
  try {
    const { overrides, programs, fallbackPatterns, features } = await getFullConfig();
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });

    for (const tab of tabs) {
      try {
        const hostname = new URL(tab.url).hostname;
        const { envType } = resolveEnvForHostname(hostname, { overrides, programs, fallbackPatterns });
        updateBadge(tab.id, envType, features, !!envType);
      } catch {
        // Non-parseable URL — skip
      }
    }
  } catch {
    // Storage unavailable on first install — no-op
  }
})();

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
