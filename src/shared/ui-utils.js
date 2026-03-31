// src/shared/ui-utils.js

/**
 * Toggles the `active` class on chip buttons inside `container`
 * to match `value`. Matches by chip's `data-value` attribute.
 *
 * @param {HTMLElement} container  Element containing `.chip` buttons
 * @param {string}      value      The value to mark active ('' = auto)
 */
export function syncChips(container, value) {
  container.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === value);
  });
}

/**
 * Updates the CSS badge class on an env-type or fallback-type <select>
 * to reflect its current value.
 *
 * Each environment maps to its own CSS class so styles can use unique colors.
 *
 * @param {HTMLSelectElement} select
 */
export function updateEnvTypeBadge(select) {
  const typeMap = {
    DEV: 'type-dev',
    STAGE: 'type-stg',
    PROD: 'type-prod',
    QA: 'type-qa',
    UAT: 'type-uat',
    RELEASE: 'type-release',
  };
  const baseClass = select.classList.contains('env-type-select')
    ? 'env-type-select'
    : 'fallback-type-select';
  const typeClass = typeMap[select.value] || '';
  select.className = typeClass ? `${baseClass} ${typeClass}` : baseClass;
}
