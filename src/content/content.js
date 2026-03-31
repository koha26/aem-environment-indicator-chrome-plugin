import {
  detectFromLocalStorage,
  detectFromParentVar,
  detectFromDom,
  detectMode,
  extractEnvFromShellMessage,
} from './detector.js';
import { applyFaviconOverlay } from './favicon.js';
import { applyTitlePrefix, startTitleGuard } from './title.js';
import { MESSAGE_TYPES, ENV_COLORS } from '../shared/constants.js';

if (window.self !== window.top) {
  // ── Child iframe ────────────────────────────────────────────────────────────
  // Relay localStorage-detected env to the top frame.
  // Native AEM Unified Shell messages go directly to window.parent — no relay
  // needed for those; the top-frame content script receives them automatically.
  window.addEventListener('load', () => {
    const hostname = window.location.hostname;
    const envType  = detectFromLocalStorage(hostname);
    if (envType) {
      window.parent.postMessage(
        { type: 'AEM_ENV_FROM_IFRAME', envType, frameUrl: window.location.href },
        '*'
      );
    }
  });

} else {
  // ── Top frame ───────────────────────────────────────────────────────────────
  let titleGuardDisconnect = null;

  // Holds a cleanup fn to remove the detection message listener once detection
  // is no longer needed (resolved by SW push or successful detection).
  let detectionCleanup = null;

  // ── Visuals ─────────────────────────────────────────────────────────────────
  function applyVisuals({ envType, enabled, features }) {
    if (!enabled || !envType) return;

    if (features.favicon) {
      const color = ENV_COLORS[envType] ?? '#666';
      applyFaviconOverlay(color);
    }

    if (features.titlePrefix) {
      if (titleGuardDisconnect) {
        titleGuardDisconnect();
        titleGuardDisconnect = null;
      }
      applyTitlePrefix(envType, features.emojiInTitle);
      titleGuardDisconnect = startTitleGuard(envType, features.emojiInTitle);
    }
  }

  // ── SW communication ────────────────────────────────────────────────────────
  function reportToSW(hostname, envType, mode) {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.REPORT_ENV, hostname, envType, mode },
      (response) => {
        if (chrome.runtime.lastError) return; // SW not available — ignore
        if (!response) return;
        applyVisuals(response);
      }
    );
  }

  // ── Phase 2: active detection ───────────────────────────────────────────────
  /**
   * Runs only when the SW has no cached/configured answer for this hostname.
   *
   * 1. localStorage   — sync; scans aemInstances key for this hostname.
   * 2. window global  — sync; reads window.AEMRepoEnv set by AEM editor frame.
   * 3. DOM element    — sync; reads #env-labels text content.
   * 4. Message listener — one-shot, armed for:
   *    a. Native AEM Unified Shell broadcasts (appId=aemshell, type=QUEUE) — primary
   *    b. Iframe localStorage relay (type=AEM_ENV_FROM_IFRAME) — fallback
   *    Deactivates itself the moment any envType is found.
   */
  function startDetection(hostname, mode) {
    // Quick sync attempts — exit early if any source resolves the env
    const fromLocalStorage = detectFromLocalStorage(hostname);
    if (fromLocalStorage) {
      reportToSW(hostname, fromLocalStorage, mode);
      return;
    }

    const fromParentVar = detectFromParentVar();
    if (fromParentVar) {
      reportToSW(hostname, fromParentVar, mode);
      return;
    }

    const fromDom = detectFromDom();
    if (fromDom) {
      reportToSW(hostname, fromDom, mode);
      return;
    }

    // Async: arm one-shot listener
    function onEnvMessage(e) {
      let envType = null;

      if (e.data?.appId === 'aemshell' && e.data?.type === 'QUEUE') {
        // Native AEM Unified Shell message — primary async source
        envType = extractEnvFromShellMessage(e.data);
      } else if (e.data?.type === 'AEM_ENV_FROM_IFRAME') {
        // Iframe relay — fallback for non-shell AEM setups
        envType = e.data.envType ?? null;
      }

      if (envType) {
        window.removeEventListener('message', onEnvMessage);
        detectionCleanup = null;
        reportToSW(hostname, envType, mode);
      }
    }

    window.addEventListener('message', onEnvMessage);
    detectionCleanup = () => window.removeEventListener('message', onEnvMessage);
  }

  // ── SW push: another tab on this hostname already detected the env ──────────
  // SW sends APPLY_VISUALS when auto-detection succeeds on a sibling tab.
  // Disarm any pending detection listener and apply visuals immediately.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== MESSAGE_TYPES.APPLY_VISUALS) return;
    if (detectionCleanup) {
      detectionCleanup();
      detectionCleanup = null;
    }
    applyVisuals(message);
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  /**
   * Two-phase startup:
   *
   * Phase 1 (fast path) — send REPORT_ENV with no domEnvType.
   *   SW resolves from: user override → program/pattern matcher.
   *   If SW returns an envType, apply visuals immediately — no detection needed.
   *
   * Phase 2 (detection) — only reached when SW has no answer.
   *   Runs active detection and reports the found envType back to SW,
   *   which persists it as a program entry in chrome.storage.sync for future loads.
   */
  function init() {
    const hostname = window.location.hostname;
    const mode     = detectMode();

    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.REPORT_ENV, hostname, envType: null, mode },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (!response) return;
        applyVisuals(response);

        if (!response.envType) {
          startDetection(hostname, mode);
        }
      }
    );
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
}
