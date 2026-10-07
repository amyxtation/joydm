import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatBytes, formatLongDuration, relativeDate } from '../core/utils.js';
import { confirmDialog, promptDialog } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { emptyState, skeletonGrid } from './shared.js';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function meter(pct, warn = false) {
  return `<div class="meter"><div class="meter__fill ${warn ? 'meter__fill--warn' : ''}" style="width:${Math.min(100, pct).toFixed(1)}%"></div></div>`;
}

export async function renderAdmin(root, ctx) {
  const user = app.store.get().user;
  if (user && user.role !== 'admin') {
    root.innerHTML = `<div class="page">${emptyState({
      iconName: 'shield',
      title: '403 — Forbidden',
      text: 'You need administrator rights to view this page.',
      action: `<a class="btn" data-link href="/">Back home</a>`,
    })}</div>`;
    return;
  }

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Admin</h1><p class="page-head__sub">Library, system health and users.</p></div>
        <div class="row wrap">
          <button class="btn" type="button" data-action="reindex">${icon('refresh')} Re-index</button>
          <button class="btn btn--primary" type="button" data-action="scan-library">${icon('scan')} Scan library</button>
        </div>
      </div>

      <section class="section">
        <div class="scan-status">
          <span class="state__icon" style="margin:0;width:46px;height:46px;background:var(--surface-2);color:var(--text-muted)">${icon('activity')}</span>
          <div class="grow">
            <div style="font-weight:600" data-slot="scan-title">Scanner idle</div>
            <div class="muted" style="font-size:13px" data-slot="scan-detail">Last scan completed successfully. No files pending.</div>
          </div>
          <span class="badge badge--success" data-slot="scan-badge">Idle</span>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">Library</h2></div>
        <div data-slot="stats">${skeletonGrid(5, 'sk-card')}</div>
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">System</h2></div>
        <div data-slot="system">${skeletonGrid(4, 'sk-card')}</div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Users</h2>
          <button class="btn btn--sm" type="button" data-action="add-user">${icon('plus')} Add user</button>
        </div>
        <div class="table-wrap" data-slot="users"></div>
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">Maintenance</h2></div>
        <div class="row wrap">
          <button class="btn" type="button" data-action="clear-cache">${icon('trash')} Clear artwork cache</button>
          <button class="btn" type="button" data-action="cleanup-missing">${icon('scan')} Clean up missing tracks</button>
        </div>
      </section>
    </div>`;

  const [stats, system, users, scan] = await Promise.all([
    api.library.stats(),
    api.admin.systemStatus().catch(() => null),
    api.admin.users().catch(() => []),
    api.admin.scanStatus().catch(() => null),
  ]);
  if (ctx.signal?.aborted) return;

  const scanTitle = root.querySelector('[data-slot="scan-title"]');
  const scanDetail = root.querySelector('[data-slot="scan-detail"]');
  const scanBadge = root.querySelector('[data-slot="scan-badge"]');

  const renderScan = (state) => {
    if (!state) return;
    const running = state.status === 'running';
    scanTitle.textContent = running ? 'Scanning library…' : state.status === 'error' ? 'Last scan failed' : 'Scanner idle';
    scanDetail.textContent = running
      ? `${state.scanned} / ${state.total} files · ${state.added + state.updated} indexed${state.errors ? ` · ${state.errors} skipped` : ''}`
      : state.finishedAt
        ? `Last scan finished ${relativeDate(state.finishedAt)} · ${state.added} added, ${state.updated} updated, ${state.removed} removed`
        : 'No scan has been run yet.';
    scanBadge.textContent = running ? 'Running' : state.status === 'error' ? 'Error' : 'Idle';
    scanBadge.className = `badge ${running ? 'badge--warning' : state.status === 'error' ? 'badge--danger' : 'badge--success'}`;
    return running;
  };

  let scanning = renderScan(scan);
  const poll = setInterval(async () => {
    if (!root.isConnected) return;
    try {
      const state = await api.admin.scanStatus();
      scanning = renderScan(state);
      if (!scanning) await app.loadShared();
    } catch {
      /* ignore transient polling errors */
    }
  }, 2000);
  ctx.onCleanup(() => clearInterval(poll));

  // Library stats
  const statCards = [
    { label: 'Songs', value: stats.tracks, foot: formatLongDuration(stats.duration) },
    { label: 'Artists', value: stats.artists, foot: `${stats.albums} albums` },
    { label: 'Albums', value: stats.albums, foot: `${stats.genres} genres` },
    { label: 'Genres', value: stats.genres, foot: `${stats.playlists} playlists` },
    { label: 'Storage used', value: formatBytes(stats.storageUsedBytes), foot: stats.libraryRoot },
  ];
  root.querySelector('[data-slot="stats"]').innerHTML = `<div class="stat-grid">${statCards
    .map(
      (c) => `<div class="stat"><div class="stat__label">${c.label}</div><div class="stat__value">${c.value}</div><div class="stat__foot truncate">${escapeHtml(
        c.foot,
      )}</div></div>`,
    )
    .join('')}</div>`;

  // System stats
  if (system) {
    const memPct = (system.memory.usedBytes / system.memory.totalBytes) * 100;
    const diskPct = (system.disk.usedBytes / system.disk.totalBytes) * 100;
    root.querySelector('[data-slot="system"]').innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__label">CPU</div>
          <div class="stat__value">${system.cpuPercent.toFixed(1)}%</div>
          ${meter(system.cpuPercent, system.cpuPercent > 80)}
        </div>
        <div class="stat">
          <div class="stat__label">Memory</div>
          <div class="stat__value">${formatBytes(system.memory.usedBytes)}</div>
          <div class="stat__foot">of ${formatBytes(system.memory.totalBytes)}</div>
          ${meter(memPct, memPct > 85)}
        </div>
        <div class="stat">
          <div class="stat__label">Disk</div>
          <div class="stat__value">${formatBytes(system.disk.usedBytes)}</div>
          <div class="stat__foot">of ${formatBytes(system.disk.totalBytes)}</div>
          ${meter(diskPct, diskPct > 85)}
        </div>
        <div class="stat">
          <div class="stat__label">Uptime</div>
          <div class="stat__value">${formatUptime(system.uptimeSeconds)}</div>
          <div class="stat__foot">JoyDM v${escapeHtml(system.version)}</div>
        </div>
      </div>`;
  }

  const renderUsers = (list) => {
    root.querySelector('[data-slot="users"]').innerHTML = `
      <table class="data">
        <thead><tr><th>Username</th><th>Role</th><th>Last login</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${list
            .map(
              (u) => `
            <tr>
              <td><span class="row" style="gap:8px"><span class="avatar" style="width:26px;height:26px;font-size:12px">${escapeHtml(
                u.username.slice(0, 1).toUpperCase(),
              )}</span>${escapeHtml(u.username)}</span></td>
              <td>
                <select class="select btn--sm" data-role-for="${u.id}" style="height:32px;min-width:110px" ${
                  u.username === 'admin' ? 'disabled' : ''
                }>
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </td>
              <td class="muted">${u.lastLoginAt ? relativeDate(u.lastLoginAt) : 'Never'}</td>
              <td style="text-align:right">
                <button class="icon-btn icon-btn--sm" type="button" data-action="delete-user" data-user-id="${u.id}" aria-label="Delete user" ${
                  u.username === 'admin' ? 'disabled style="opacity:.4"' : ''
                }>${icon('trash')}</button>
              </td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    root.querySelectorAll('[data-role-for]').forEach((select) => {
      select.addEventListener('change', async () => {
        await api.admin.updateUser(select.dataset.roleFor, { role: select.value });
        toast('Role updated.', { type: 'success' });
      });
    });
  };

  renderUsers(users);

  ctx.setActions({
    reindex: () => app.scanLibrary({ force: true }),
    'add-user': async () => {
      const username = await promptDialog({ title: 'Add user', label: 'Username', placeholder: 'newuser' });
      if (!username) return;
      const password = await promptDialog({ title: 'Set password', label: 'Password', placeholder: 'Min. 8 characters', hint: 'Passwords are hashed with scrypt — never stored in plain text.' });
      if (!password) return;
      try {
        const created = await api.admin.createUser({ username, password, role: 'user' });
        users.push(created);
        renderUsers(users);
        toast(`User “${created.username}” created.`, { type: 'success' });
      } catch (error) {
        toast(error.message || 'Could not create user.', { type: 'error' });
      }
    },
    'delete-user': async (trigger) => {
      const id = trigger.dataset.userId;
      const target = users.find((u) => u.id === id);
      const confirmed = await confirmDialog({
        title: 'Delete user?',
        message: `“${target?.username}” will lose access immediately.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!confirmed) return;
      await api.admin.deleteUser(id);
      const index = users.findIndex((u) => u.id === id);
      if (index >= 0) users.splice(index, 1);
      renderUsers(users);
      toast('User deleted.');
    },
    'clear-cache': async () => {
      const result = await api.admin.clearCache();
      toast(`Artwork cache cleared (${result.removed} file${result.removed === 1 ? '' : 's'}).`, { type: 'success' });
    },
    'cleanup-missing': async () => {
      const result = await api.admin.cleanupMissing();
      toast(
        result.removed ? `Removed ${result.removed} missing track${result.removed === 1 ? '' : 's'}.` : 'No missing tracks found.',
        { type: 'success' },
      );
    },
  });
}
