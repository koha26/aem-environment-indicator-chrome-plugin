import { ENV_EMOJIS } from '../shared/constants.js';

const ORIGINAL_TITLE_ATTR = 'data-aem-original-title';

/**
 * Prepends environment label to document.title.
 * Stores the original title on <html> element to prevent double-prefixing.
 *
 * @param {string}  envType
 * @param {boolean} useEmoji - use emoji prefix (🔵) instead of [DEV]
 */
export function applyTitlePrefix(envType, useEmoji) {
  // Store original title once (first call only)
  if (!document.documentElement.hasAttribute(ORIGINAL_TITLE_ATTR)) {
    document.documentElement.setAttribute(ORIGINAL_TITLE_ATTR, document.title);
  }

  const original = document.documentElement.getAttribute(ORIGINAL_TITLE_ATTR);
  const prefix = buildPrefix(envType, useEmoji);
  document.title = `${prefix}${original}`;
}

/**
 * Removes the title prefix and restores the original title.
 */
export function restoreTitle() {
  const original = document.documentElement.getAttribute(ORIGINAL_TITLE_ATTR);
  if (original !== null) {
    document.title = original;
    document.documentElement.removeAttribute(ORIGINAL_TITLE_ATTR);
  }
}

/**
 * Watches for SPA title changes and re-applies the prefix automatically.
 * Call after applyTitlePrefix. Returns a disconnect function.
 *
 * @param {string}  envType
 * @param {boolean} useEmoji
 * @returns {function} disconnect - call to stop watching
 */
export function startTitleGuard(envType, useEmoji) {
  const observer = new MutationObserver(() => {
    const prefix = buildPrefix(envType, useEmoji);
    if (!document.title.startsWith(prefix)) {
      // SPA changed the title — update stored original and re-prefix
      // Store the SPA-updated title as the new base (intentional: attribute tracks current non-prefixed title)
      document.documentElement.setAttribute(ORIGINAL_TITLE_ATTR, document.title);
      document.title = `${prefix}${document.title}`;
    }
  });

  const titleEl = document.querySelector('title');
  if (titleEl) {
    observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
  }

  return () => observer.disconnect();
}

function buildPrefix(envType, useEmoji) {
  if (useEmoji) {
    const emoji = ENV_EMOJIS[envType] ?? '';
    return `${emoji} `;
  }
  return `[${envType}] `;
}
