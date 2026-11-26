// Shared UI helpers for the tool pages.
import { escapeHtml } from './skill-rules.js';

export const renderChecks = (el, results, okText = 'Valid') => {
  const icon = { error: '❌', warn: '⚠️', ok: '✅', info: 'ℹ️' };
  const errors = results.filter((r) => r.level === 'error').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  const summary = errors ? `${errors} error${errors > 1 ? 's' : ''}` : warns ? `${okText}, ${warns} suggestion${warns > 1 ? 's' : ''}` : okText;
  el.innerHTML =
    `<p class="check-sum ${errors ? 'bad' : warns ? 'meh' : 'good'}">${summary}</p><ul class="checks">` +
    results.map((r) => `<li class="${r.level}"><span>${icon[r.level]}</span><span>${r.level === 'info' ? r.text : escapeHtml(r.text)}</span></li>`).join('') +
    '</ul>';
};

export const copyText = async (btn, text) => {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied ✓';
  } catch {
    btn.textContent = 'Select & copy';
  }
  setTimeout(() => (btn.textContent = btn.dataset.label), 1500);
};

export const download = (name, text) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/**
 * Tabs for the simple tool layout. Each [role=tab] controls a panel via aria-controls.
 * hashes maps a tab id to the URL hash that opens it (the first tab clears the hash).
 * Returns show(id) so pages can switch tabs themselves.
 */
export const setupTabs = (hashes = {}) => {
  const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
  const show = (id, focus) => {
    for (const t of tabs) {
      const on = t.id === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    }
  };
  for (const t of tabs) {
    t.addEventListener('click', () => {
      show(t.id);
      history.replaceState(null, '', hashes[t.id] ? '#' + hashes[t.id] : location.pathname + location.search);
    });
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const step = e.key === 'ArrowRight' ? 1 : tabs.length - 1;
      show(tabs[(tabs.indexOf(t) + step) % tabs.length].id, true);
    });
  }
  return show;
};

/** One short status box for a result: green when clean, otherwise the problems only. */
export const statusCallout = (results, okText) => {
  const errors = results.filter((r) => r.level === 'error');
  const warns = results.filter((r) => r.level === 'warn');
  if (!errors.length && !warns.length) {
    const passed = results.filter((r) => r.level === 'ok').length;
    return `<div class="callout good"><strong>✅ ${okText}</strong>${passed ? ` <small>${passed} check${passed > 1 ? 's' : ''} passed</small>` : ''}</div>`;
  }
  const sugg = warns.length ? `${warns.length} suggestion${warns.length > 1 ? 's' : ''}` : '';
  const head = errors.length ? `❌ ${errors.length} problem${errors.length > 1 ? 's' : ''} to fix${sugg ? `, ${sugg}` : ''}` : `⚠️ ${sugg[0].toUpperCase()}${sugg.slice(1)}`;
  return `<div class="callout ${errors.length ? 'bad' : 'meh'}"><strong>${head}</strong><ul>${[...errors, ...warns].map((r) => `<li>${escapeHtml(r.text)}</li>`).join('')}</ul></div>`;
};
