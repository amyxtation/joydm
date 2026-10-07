/**
 * Icon set — inline SVG paths, stroke-based by default so they inherit
 * `currentColor`. Filled glyphs (transport controls) opt in via `fill: true`.
 */

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h3.5v-5.5h5V21H18a1 1 0 0 0 1-1V9.5"/>',
  songs: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  artist: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  album: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>',
  genre: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  playlist: '<path d="M4 7h11M4 12h11M4 17h7"/><circle cx="18" cy="16" r="3"/><path d="M21 16V6l-5 1"/>',
  heart: '<path d="M12 20s-7-4.4-9.3-8.8C1.2 8 3 4.6 6.4 4.2A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 5.6-2.8C21 4.6 22.8 8 21.3 11.2 19 15.6 12 20 12 20Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5Z"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/>',
  prev: '<path d="M18 6.5v11a1 1 0 0 1-1.5.87L8 13v4a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v4l8.5-5.37A1 1 0 0 1 18 6.5Z"/>',
  next: '<path d="M6 6.5v11a1 1 0 0 0 1.5.87L16 13v4a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v4L7.5 5.63A1 1 0 0 0 6 6.5Z"/>',
  shuffle: '<path d="M17 4h4v4"/><path d="M3 20 21 4"/><path d="M17 20h4v-4"/><path d="M3 4l5 4.5"/><path d="m14 14 7 6"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M20 6H8a5 5 0 0 0-5 5"/><path d="M7 21l-3-3 3-3"/><path d="M4 18h12a5 5 0 0 0 5-5"/>',
  repeatOne: '<path d="M17 3l3 3-3 3"/><path d="M20 6H8a5 5 0 0 0-5 5"/><path d="M7 21l-3-3 3-3"/><path d="M4 18h12a5 5 0 0 0 5-5"/><path d="M11 10.6 12.4 10v4.4"/>',
  volume: '<path d="M4 9v6h3.5L13 19V5L7.5 9H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  volumeLow: '<path d="M4 9v6h3.5L13 19V5L7.5 9H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9v6h3.5L13 19V5L7.5 9H4Z"/><path d="m17 9.5 4 5M21 9.5l-4 5"/>',
  queue: '<path d="M4 6h16M4 12h10M4 18h10"/><path d="M18 12v6.5"/><circle cx="20" cy="19" r="2.2"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 13 4.5 4.5L19 7"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-.7 4.4"/><path d="M20 5v6h-6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.3"/><circle cx="3.5" cy="12" r="1.3"/><circle cx="3.5" cy="18" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17 5 12l5-5"/><path d="M5 12h11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.4a6.5 6.5 0 0 1 3.5 5.6"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  memory: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 7v10M12 7v10M17 7v10"/>',
  disk: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  music: '<circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M9 18V6l11-2v12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  collapse: '<path d="M8 8H5V5M16 8h3V5M16 16h3v3M8 16H5v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
};

export function icon(name, { size, cls = '', fill = false } = {}) {
  const body = PATHS[name];
  if (!body) return '';
  const dims = size ? ` width="${size}" height="${size}"` : '';
  const fillClass = fill ? ' icon-fill' : '';
  return `<svg viewBox="0 0 24 24"${dims} class="${cls}${fillClass}" aria-hidden="true">${body}</svg>`;
}

export const ICONS = PATHS;
