export const ENV_TYPES = {
  DEV:     'DEV',
  STAGE:   'STAGE',
  PROD:    'PROD',
  QA:      'QA',
  UAT:     'UAT',
  RELEASE: 'RELEASE',
};

export const ENV_COLORS = {
  DEV:     '#1976d2',
  STAGE:   '#f57c00',
  PROD:    '#d32f2f',
  QA:      '#7b1fa2',
  UAT:     '#388e3c',
  RELEASE: '#455a64',
};

export const ENV_BADGE_LETTERS = {
  DEV:     'D',
  STAGE:   'S',
  PROD:    'P',
  QA:      'Q',
  UAT:     'U',
  RELEASE: 'R',
};

export const ENV_EMOJIS = {
  DEV:     '🔵',
  STAGE:   '🟠',
  PROD:    '🔴',
  QA:      '🟣',
  UAT:     '🟢',
  RELEASE: '⚫',
};

export const MESSAGE_TYPES = {
  REPORT_ENV:    'REPORT_ENV',
  APPLY_VISUALS: 'APPLY_VISUALS',
  GET_TAB_STATE: 'GET_TAB_STATE',
  SET_OVERRIDE:  'SET_OVERRIDE',
  SET_FEATURES:  'SET_FEATURES',
};

export const DEFAULT_FEATURES = {
  badge:        true,
  favicon:      true,
  titlePrefix:  true,
  emojiInTitle: false,
};

export const OVERRIDE_CYCLE_ORDER = [
  null,
  ENV_TYPES.DEV,
  ENV_TYPES.STAGE,
  ENV_TYPES.PROD,
  ENV_TYPES.QA,
  ENV_TYPES.UAT,
  ENV_TYPES.RELEASE,
];
