import { ENV_TYPES } from '../shared/constants.js';

/**
 * Maps text content of #env-labels to ENV_TYPES.
 * AEM typically shows tier labels like "dev", "stage", "prod" in this element.
 * Longer/more-specific keys must come before shorter ones (substring matching)
 */
const LABEL_MAP = {
  'production': ENV_TYPES.PROD,
  'develop':    ENV_TYPES.DEV,
  'staging':    ENV_TYPES.STAGE,
  'release':    ENV_TYPES.RELEASE,
  'stage':      ENV_TYPES.STAGE,
  'prod':       ENV_TYPES.PROD,
  'dev':        ENV_TYPES.DEV,
  'qa':         ENV_TYPES.QA,
  'uat':        ENV_TYPES.UAT,
};

/**
 * Exact-match lookup for structured env strings from AEM APIs.
 * Input is normalised to lowercase before lookup.
 *
 * Confirmed AEM Cloud Manager values: dev, stage, prod.
 * Extended values (qa, uat, release, staging, etc.) included for robustness
 * but not observed in real AEM Cloud Manager API responses.
 */
const ENV_STRING_MAP = {
  dev:         ENV_TYPES.DEV,
  develop:     ENV_TYPES.DEV,
  development: ENV_TYPES.DEV,
  stage:       ENV_TYPES.STAGE,
  staging:     ENV_TYPES.STAGE,
  prod:        ENV_TYPES.PROD,
  production:  ENV_TYPES.PROD,
  qa:          ENV_TYPES.QA,
  uat:         ENV_TYPES.UAT,
  release:     ENV_TYPES.RELEASE,
};

function mapEnvString(str) {
  if (!str) return null;
  return ENV_STRING_MAP[String(str).trim().toLowerCase()] ?? null;
}

/**
 * Reads window.parent.AEMRepoEnv set by AEM's editor frame.
 * In a top-level frame window.parent === window, so this reads window.AEMRepoEnv.
 * The try/catch handles cross-origin access (silent no-op).
 */
export function detectFromParentVar() {
  try {
    return mapEnvString(window.parent?.AEMRepoEnv);
  } catch {
    return null;
  }
}

/**
 * Reads localStorage key 'aemInstances' (direct top-level key set by AEM Unified Shell).
 * Scans all org arrays for an entry whose domain exactly matches the hostname parameter.
 * Returns the mapped ENV_TYPE or null.
 *
 * @param {string} hostname - window.location.hostname of the current page
 */
export function detectFromLocalStorage(hostname) {
  try {
    const raw = localStorage.getItem('aemInstances');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const instances = data?.instances;
    if (!instances || typeof instances !== 'object') return null;
    for (const list of Object.values(instances)) {
      if (!Array.isArray(list)) continue;
      const match = list.find(i => i.domain === hostname);
      if (match) return mapEnvString(match.environment);
    }
  } catch {
    // localStorage unavailable or JSON malformed — silent no-op
  }
  return null;
}

/**
 * Returns the envType from #env-labels DOM element, or null if not found/unrecognised.
 */
export function detectFromDom() {
  const el = document.querySelector('#env-labels');
  if (!el) return null;

  const text = el.textContent.trim().toLowerCase();
  for (const [key, type] of Object.entries(LABEL_MAP)) {
    if (text.includes(key)) return type;
  }
  return null;
}

/**
 * Detects whether the current page is AEM Author or Publish mode.
 * Returns 'author', 'publish', or 'unknown'.
 */
export function detectMode() {
  const { pathname, hostname, port } = window.location;

  const isAuthor =
    pathname.includes('/editor.html') ||
    pathname.includes('/cf#') ||
    pathname.includes('/libs/wcm/') ||
    hostname.includes('author');

  if (isAuthor) return 'author';

  const isPublish =
    hostname.includes('publish') ||
    port === '4503';

  if (isPublish) return 'publish';

  return 'unknown';
}
