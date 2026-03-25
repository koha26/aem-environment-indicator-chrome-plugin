import { detectFromDom, detectFromParentVar, detectFromLocalStorage, detectMode } from './detector.js';
import { applyFaviconOverlay } from './favicon.js';
import { applyTitlePrefix, startTitleGuard } from './title.js';
import { MESSAGE_TYPES, ENV_COLORS, ENV_BADGE_LETTERS } from '../shared/constants.js';

// Guard: only run in top-level frame, not in iframes
if (window.self !== window.top) {
  // Silently exit — do nothing in iframes
} else {
  let titleGuardDisconnect = null;

  function init() {
    const hostname = window.location.hostname;
    const envType  = detectFromParentVar()
                  ?? detectFromLocalStorage(hostname)
                  ?? detectFromDom();
    const mode     = detectMode();

    chrome.runtime.sendMessage(
      {
        type:     MESSAGE_TYPES.REPORT_ENV,
        hostname,
        envType,  // may be null — SW will run matcher.js fallback
        mode,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // Extension reloaded / SW not available — ignore
          return;
        }
        if (!response) return;
        applyVisuals(response);
      }
    );
  }

  function applyVisuals({ envType, enabled, features }) {
    if (!enabled || !envType) return;

    if (features.favicon) {
      const color  = ENV_COLORS[envType]        ?? '#666';
      const letter = ENV_BADGE_LETTERS[envType] ?? '?';
      applyFaviconOverlay(color, letter);
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

  // Run after DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
