import { app } from '../app.js';
import { api, USE_MOCK } from '../core/api.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { icon } from '../core/icons.js';

const CIRC = 2 * Math.PI * 20;

/**
 * Runs a library scan and streams progress into a modal (PRD §29–§30).
 * In mock mode the progress is simulated; against the real backend it polls
 * `GET /api/admin/library/scan/status`.
 */
export async function scanLibraryFlow({ force = false } = {}) {
  const total = app.store.get().stats?.tracks || 420;

  const sheet = openSheet({
    title: 'Scanning library',
    body: `
      <div class="scan-status">
        <svg class="scan-status__ring" viewBox="0 0 46 46" aria-hidden="true">
          <circle class="bg" cx="23" cy="23" r="20"></circle>
          <circle class="fg" cx="23" cy="23" r="20" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"></circle>
        </svg>
        <div class="grow">
          <div style="font-weight:600" data-slot="phase">Reading file system…</div>
          <div class="muted" style="font-size:13px" data-slot="count">0 / ${total} files</div>
        </div>
        <span class="mono" data-slot="pct">0%</span>
      </div>
      <p class="dim" style="font-size:13px">Scanning runs in the background — playback is never interrupted.</p>`,
    footer: `<button class="btn" type="button" data-close>Close</button>`,
  });

  const ring = sheet.panel.querySelector('.fg');
  const phase = sheet.panel.querySelector('[data-slot="phase"]');
  const count = sheet.panel.querySelector('[data-slot="count"]');
  const pct = sheet.panel.querySelector('[data-slot="pct"]');
  let cancelled = false;
  sheet.panel.querySelector('[data-close]').addEventListener('click', () => {
    cancelled = true;
    sheet.close();
  });

  const setProgress = (value, scanned, extras = {}) => {
    const clamped = Math.max(0, Math.min(1, value));
    ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - clamped)));
    pct.textContent = `${Math.round(clamped * 100)}%`;
    count.textContent = `${scanned} / ${total} files${extras.errors ? ` · ${extras.errors} skipped` : ''}`;
  };

  try {
    if (USE_MOCK) {
      phase.textContent = 'Scanning audio files…';
      const step = Math.max(1, Math.round(total / 40));
      for (let scanned = 0; scanned <= total; scanned += step) {
        if (cancelled) return;
        setProgress(scanned / total, Math.min(scanned, total));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      setProgress(1, total);
      await new Promise((resolve) => setTimeout(resolve, 250));
    } else {
      phase.textContent = 'Queued scan job…';
      await api.admin.scan({ force });
      phase.textContent = 'Scanning audio files…';
      // Poll until the job reports completion.
      for (;;) {
        if (cancelled) return;
        const status = await api.admin.scanStatus();
        setProgress((status.scanned || 0) / (status.total || total), status.scanned || 0, status);
        if (status.status === 'idle' || status.status === 'complete') break;
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    await app.loadShared();
    phase.textContent = 'Scan complete';
    toast('Library scan finished.', { type: 'success' });
    if (!cancelled) {
      sheet.panel.querySelector('.sheet__foot').innerHTML = `<button class="btn btn--primary" type="button" data-close>Done</button>`;
      sheet.panel.querySelector('.sheet__foot [data-close]').addEventListener('click', () => sheet.close());
    }
    document.dispatchEvent(new CustomEvent('joydm:library-updated'));
  } catch (error) {
    phase.textContent = 'Scan failed';
    toast(error.message || 'Library scan failed.', { type: 'error' });
  }
}
