import './options.css';
import {
  getFullConfig,
  getPrograms,
  setPrograms,
  getFallbackPatterns,
  setFallbackPatterns,
  setFeatures,
  setFullConfig,
} from '../shared/storage.js';
import { ENV_TYPES, MESSAGE_TYPES } from '../shared/constants.js';
import { updateEnvTypeBadge } from '../shared/ui-utils.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

let statusTimer = null;

function showStatus(msg, isError = false) {
  clearTimeout(statusTimer);
  const el = document.getElementById('status-message');
  el.textContent = msg;
  el.className = `status-message ${isError ? 'error' : 'success'}`;
  statusTimer = setTimeout(() => {
    el.className = 'status-message hidden';
  }, 3000);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Accordions ───────────────────────────────────────────────────────────────

function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded  = btn.getAttribute('aria-expanded') === 'true';
      const targetId  = btn.dataset.target;
      const bodyEl    = document.getElementById(targetId);
      const arrowEl   = btn.querySelector('.accordion-arrow');

      btn.setAttribute('aria-expanded', String(!expanded));
      bodyEl.classList.toggle('collapsed', expanded);
      if (arrowEl) arrowEl.textContent = expanded ? '▸' : '▾';
    });
  });
}

// ─── Features ─────────────────────────────────────────────────────────────────

function loadFeatures(features) {
  document.getElementById('feat-badge').checked   = features.badge;
  document.getElementById('feat-favicon').checked = features.favicon;
  document.getElementById('feat-title').checked   = features.titlePrefix;
  document.getElementById('feat-emoji').checked   = features.emojiInTitle;
}

function bindFeatureEvents() {
  const inputs = ['feat-badge', 'feat-favicon', 'feat-title', 'feat-emoji'];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      const updated = {
        badge:        document.getElementById('feat-badge').checked,
        favicon:      document.getElementById('feat-favicon').checked,
        titlePrefix:  document.getElementById('feat-title').checked,
        emojiInTitle: document.getElementById('feat-emoji').checked,
      };
      await setFeatures(updated);
      // Notify SW to re-apply badges
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_FEATURES, features: updated })
        .catch(() => {}); // SW may not be active during options edit
      showStatus('Features saved');
    });
  });
}

// ─── Programs ─────────────────────────────────────────────────────────────────

function renderPrograms(programs) {
  const container = document.getElementById('programs-list');
  container.innerHTML = '';

  programs.forEach((program, pIdx) => {
    const card = document.createElement('div');
    card.className = 'program-card';
    card.dataset.pid = program.id;

    card.innerHTML = `
      <div class="program-card-header">
        <input class="program-name-input" type="text"
          placeholder="Program name"
          value="${escHtml(program.name ?? '')}"
          data-pidx="${pIdx}" aria-label="Program name">
        <button class="btn-danger btn-sm delete-program" data-pidx="${pIdx}">Remove</button>
      </div>
      <div class="env-table">
        <div class="env-table-header">
          <span>Type</span><span>URL / Domain Pattern</span><span></span>
        </div>
        <div class="env-rows" id="env-rows-${pIdx}"></div>
      </div>
      <button class="btn-secondary btn-sm add-env" data-pidx="${pIdx}">+ Add Environment</button>
    `;

    container.appendChild(card);

    const envRowsEl = card.querySelector(`#env-rows-${pIdx}`);
    (program.environments ?? []).forEach((env, eIdx) => {
      envRowsEl.appendChild(renderEnvRow(env, pIdx, eIdx));
    });
  });

  bindProgramEvents(container, programs);
}

function renderEnvRow(env, pIdx, eIdx) {
  const row = document.createElement('div');
  row.className = 'env-row';
  row.dataset.eid = env.id;

  const selected = (type) => env.type === type ? 'selected' : '';
  const typeOptions = Object.keys(ENV_TYPES)
    .map(t => `<option value="${t}" ${selected(t)}>${t}</option>`)
    .join('');

  row.innerHTML = `
    <select class="env-type-select" data-pidx="${pIdx}" data-eidx="${eIdx}" aria-label="Environment type">
      ${typeOptions}
    </select>
    <input class="env-pattern-input" type="text"
      placeholder="author-p123-e456.adobeaemcloud.com"
      value="${escHtml(env.urlPattern ?? '')}"
      data-pidx="${pIdx}" data-eidx="${eIdx}" aria-label="URL pattern">
    <button class="btn-danger btn-xs delete-env" data-pidx="${pIdx}" data-eidx="${eIdx}" title="Remove">×</button>
  `;

  const typeSelect = row.querySelector('.env-type-select');
  updateEnvTypeBadge(typeSelect);
  typeSelect.addEventListener('change', () => updateEnvTypeBadge(typeSelect));

  return row;
}

function readProgramsFromForm() {
  const cards = document.querySelectorAll('.program-card');
  return Array.from(cards).map(card => {
    const nameInput = card.querySelector('.program-name-input');
    const envRows   = card.querySelectorAll('.env-row');
    return {
      id:           card.dataset.pid ?? uuid(),
      name:         nameInput?.value ?? '',
      environments: Array.from(envRows).map(row => ({
        id:         row.dataset.eid ?? uuid(),
        type:       row.querySelector('.env-type-select')?.value ?? 'DEV',
        urlPattern: row.querySelector('.env-pattern-input')?.value.trim() ?? '',
      })),
    };
  });
}

const debouncedSavePrograms = debounce(async () => {
  const programs = readProgramsFromForm();
  await setPrograms(programs);
  showStatus('Saved');
}, 600);

function bindProgramEvents(container, programs) {
  // Auto-save on any input change (debounced)
  container.addEventListener('input', debouncedSavePrograms);
  container.addEventListener('change', debouncedSavePrograms);

  // Delete program
  container.querySelectorAll('.delete-program').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pIdx = Number(btn.dataset.pidx);
      programs.splice(pIdx, 1);
      await setPrograms(programs);
      renderPrograms(programs);
      showStatus('Program removed');
    });
  });

  // Add environment to a program
  container.querySelectorAll('.add-env').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pIdx = Number(btn.dataset.pidx);
      // Flush any pending debounced save first to avoid race
      const latestPrograms = readProgramsFromForm();
      latestPrograms[pIdx].environments.push({ id: uuid(), type: 'DEV', urlPattern: '' });
      await setPrograms(latestPrograms);
      renderPrograms(latestPrograms);
    });
  });

  // Delete environment row
  container.querySelectorAll('.delete-env').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pIdx = Number(btn.dataset.pidx);
      const eIdx = Number(btn.dataset.eidx);
      const latestPrograms = readProgramsFromForm();
      latestPrograms[pIdx].environments.splice(eIdx, 1);
      await setPrograms(latestPrograms);
      renderPrograms(latestPrograms);
      showStatus('Environment removed');
    });
  });
}

// ─── Fallback Patterns ────────────────────────────────────────────────────────

function renderFallbackPatterns(patterns) {
  const container = document.getElementById('fallback-list');
  container.innerHTML = '';

  patterns.forEach((fb, idx) => {
    const row = document.createElement('div');
    row.className = 'fallback-row';

    const typeOptions = Object.keys(ENV_TYPES)
      .map(t => `<option value="${t}" ${fb.type === t ? 'selected' : ''}>${t}</option>`)
      .join('');

    row.innerHTML = `
      <input class="fallback-pattern-input" type="text"
        placeholder="\\.dev\\."
        value="${escHtml(fb.pattern ?? '')}"
        data-idx="${idx}" aria-label="Regex pattern">
      <select class="fallback-type-select" data-idx="${idx}" aria-label="Environment type">
        ${typeOptions}
      </select>
      <button class="btn-danger btn-xs delete-fallback" data-idx="${idx}" title="Remove">×</button>
    `;

    container.appendChild(row);

    const typeSelect = row.querySelector('.fallback-type-select');
    updateEnvTypeBadge(typeSelect);
    typeSelect.addEventListener('change', () => updateEnvTypeBadge(typeSelect));
  });

  bindFallbackEvents(container, patterns);
}

const debouncedSaveFallbacks = debounce(async () => {
  const rows = document.querySelectorAll('.fallback-row');
  const patterns = Array.from(rows).map(row => ({
    pattern: row.querySelector('.fallback-pattern-input')?.value ?? '',
    type:    row.querySelector('.fallback-type-select')?.value ?? 'DEV',
  }));
  await setFallbackPatterns(patterns);
  showStatus('Saved');
}, 600);

function bindFallbackEvents(container, patterns) {
  container.addEventListener('input', debouncedSaveFallbacks);
  container.addEventListener('change', debouncedSaveFallbacks);

  container.querySelectorAll('.delete-fallback').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      patterns.splice(idx, 1);
      await setFallbackPatterns(patterns);
      renderFallbackPatterns(patterns);
      showStatus('Pattern removed');
    });
  });
}

// ─── Export / Import ──────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', async () => {
  const config = await getFullConfig();
  const json   = JSON.stringify(config, null, 2);
  const blob   = new Blob([json], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = Object.assign(document.createElement('a'), {
    href:     url,
    download: 'aem-env-config.json',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('Config exported');
});

document.getElementById('btn-import').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const config = JSON.parse(evt.target.result);

      // Basic validation
      if (!config || typeof config !== 'object') throw new Error('Invalid config: not an object');
      if (!Array.isArray(config.programs)) throw new Error('Invalid config: programs must be an array');

      await setFullConfig(config);
      showStatus('Config imported — reloading…');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      showStatus(`Import failed: ${err.message}`, true);
    }
  };
  reader.readAsText(file);

  // Reset input so the same file can be re-imported
  e.target.value = '';
});

// ─── Add buttons ──────────────────────────────────────────────────────────────

document.getElementById('add-program').addEventListener('click', async () => {
  const programs = readProgramsFromForm();
  programs.push({ id: uuid(), name: 'New Program', environments: [] });
  await setPrograms(programs);
  renderPrograms(programs);
  // Focus the new program's name input
  const lastCard = document.querySelector('.program-card:last-child .program-name-input');
  if (lastCard) {
    lastCard.focus();
    lastCard.select();
  }
});

document.getElementById('add-fallback').addEventListener('click', async () => {
  const patterns = Array.from(document.querySelectorAll('.fallback-row')).map(row => ({
    pattern: row.querySelector('.fallback-pattern-input')?.value ?? '',
    type:    row.querySelector('.fallback-type-select')?.value ?? 'DEV',
  }));
  patterns.push({ pattern: '', type: 'DEV' });
  await setFallbackPatterns(patterns);
  renderFallbackPatterns(patterns);
});

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  initAccordions();

  const config = await getFullConfig();
  loadFeatures(config.features);
  bindFeatureEvents();
  renderPrograms(config.programs);
  renderFallbackPatterns(config.fallbackPatterns);
}

init();
