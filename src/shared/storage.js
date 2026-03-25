import { DEFAULT_FEATURES } from './constants.js';

const KEYS = {
  PROGRAMS:          'programs',
  FALLBACK_PATTERNS: 'fallbackPatterns',
  FEATURES:          'features',
  OVERRIDES:         'overrides',
};

export async function getPrograms() {
  const result = await chrome.storage.sync.get(KEYS.PROGRAMS);
  return result[KEYS.PROGRAMS] ?? [];
}

export async function setPrograms(programs) {
  return chrome.storage.sync.set({ [KEYS.PROGRAMS]: programs });
}

export async function getFallbackPatterns() {
  const result = await chrome.storage.sync.get(KEYS.FALLBACK_PATTERNS);
  // Built-in fallback patterns: match common AEM hostname segments
  // e.g. author-p123-e456.dev.adobeaemcloud.com → DEV
  return result[KEYS.FALLBACK_PATTERNS] ?? [
    { pattern: '\\.dev\\.', type: 'DEV' },
    { pattern: '\\.stage\\.', type: 'STAGE' },
    { pattern: '\\.prod\\.', type: 'PROD' },
  ];
}

export async function setFallbackPatterns(patterns) {
  return chrome.storage.sync.set({ [KEYS.FALLBACK_PATTERNS]: patterns });
}

export async function getFeatures() {
  const result = await chrome.storage.sync.get(KEYS.FEATURES);
  return { ...DEFAULT_FEATURES, ...(result[KEYS.FEATURES] ?? {}) };
}

export async function setFeatures(features) {
  return chrome.storage.sync.set({ [KEYS.FEATURES]: features });
}

export async function getOverrides() {
  const result = await chrome.storage.sync.get(KEYS.OVERRIDES);
  return result[KEYS.OVERRIDES] ?? {};
}

export async function setOverrides(overrides) {
  return chrome.storage.sync.set({ [KEYS.OVERRIDES]: overrides });
}

export async function getFullConfig() {
  const [programs, fallbackPatterns, features, overrides] = await Promise.all([
    getPrograms(),
    getFallbackPatterns(),
    getFeatures(),
    getOverrides(),
  ]);
  return { programs, fallbackPatterns, features, overrides };
}

export async function setFullConfig(config) {
  return chrome.storage.sync.set({
    [KEYS.PROGRAMS]:          config.programs          ?? [],
    [KEYS.FALLBACK_PATTERNS]: config.fallbackPatterns  ?? [],
    [KEYS.FEATURES]:          config.features          ?? DEFAULT_FEATURES,
    [KEYS.OVERRIDES]:         config.overrides         ?? {},
  });
}
