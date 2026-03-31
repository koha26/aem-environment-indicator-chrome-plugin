// tests/shared/ui-utils.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { syncChips, updateEnvTypeBadge } from '../../src/shared/ui-utils.js';

// ── syncChips ──────────────────────────────────────────────────────────────────

describe('syncChips', () => {
  function setupChips(values) {
    const container = document.createElement('div');
    values.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.value = v;
      container.appendChild(btn);
    });
    document.body.appendChild(container);
    return container;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks matching chip active', () => {
    const c = setupChips(['', 'DEV', 'PROD']);
    syncChips(c, 'DEV');
    const chips = c.querySelectorAll('.chip');
    expect(chips[0].classList.contains('active')).toBe(false);
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[2].classList.contains('active')).toBe(false);
  });

  it('marks empty-string chip active for auto-detect', () => {
    const c = setupChips(['', 'DEV']);
    syncChips(c, '');
    const chips = c.querySelectorAll('.chip');
    expect(chips[0].classList.contains('active')).toBe(true);
    expect(chips[1].classList.contains('active')).toBe(false);
  });

  it('clears all active when value has no matching chip', () => {
    const c = setupChips(['DEV', 'PROD']);
    c.querySelector('.chip').classList.add('active');
    syncChips(c, 'STAGE');
    c.querySelectorAll('.chip').forEach(ch => {
      expect(ch.classList.contains('active')).toBe(false);
    });
  });
});

// ── updateEnvTypeBadge ─────────────────────────────────────────────────────────

describe('updateEnvTypeBadge', () => {
  function makeSelect(baseClass, value) {
    const sel = document.createElement('select');
    sel.className = baseClass;
    const opt = document.createElement('option');
    opt.value = value;
    sel.appendChild(opt);
    sel.value = value;
    return sel;
  }

  it('sets type-prod for PROD', () => {
    const sel = makeSelect('env-type-select', 'PROD');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-prod');
  });

  it('sets type-dev for DEV', () => {
    const sel = makeSelect('env-type-select', 'DEV');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-dev');
  });

  it('sets type-stg for STAGE', () => {
    const sel = makeSelect('env-type-select', 'STAGE');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-stg');
  });

  it('sets type-qa for QA', () => {
    const sel = makeSelect('env-type-select', 'QA');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-qa');
  });

  it('sets type-uat for UAT', () => {
    const sel = makeSelect('env-type-select', 'UAT');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-uat');
  });

  it('sets type-release for RELEASE', () => {
    const sel = makeSelect('env-type-select', 'RELEASE');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select type-release');
  });

  it('preserves fallback-type-select base class', () => {
    const sel = makeSelect('fallback-type-select', 'DEV');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('fallback-type-select type-dev');
  });

  it('sets no type class for unknown value', () => {
    const sel = makeSelect('env-type-select', '');
    updateEnvTypeBadge(sel);
    expect(sel.className).toBe('env-type-select');
  });
});
