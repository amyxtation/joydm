/**
 * Mock library data used while the backend API is not yet wired up.
 * The shape mirrors the planned SQLite schema so swapping in real
 * `GET /api/*` responses later is a drop-in change.
 */

const GENRES = [
  { id: 'g-synthwave', name: 'Synthwave' },
  { id: 'g-dream-pop', name: 'Dream Pop' },
  { id: 'g-indie-rock', name: 'Indie Rock' },
  { id: 'g-jazz', name: 'Jazz' },
  { id: 'g-folk', name: 'Folk' },
  { id: 'g-lofi', name: 'Lo-Fi' },
  { id: 'g-electronic', name: 'Electronic' },
  { id: 'g-ambient', name: 'Ambient' },
];

const ARTISTS = [
  { id: 'ar-neon-tide', name: 'Neon Tide' },
  { id: 'ar-mira-sol', name: 'Mira Sol' },
  { id: 'ar-kestrel', name: 'Kestrel & the Static' },
  { id: 'ar-dahlia', name: 'Dahlia Moon' },
  { id: 'ar-ronin', name: 'Ronin Circuit' },
  { id: 'ar-elm-ash', name: 'Elm & Ash' },
  { id: 'ar-velvet', name: 'Velvet Hours' },
];

const ALBUMS = [
  { id: 'al-midnight-arcade', title: 'Midnight Arcade', artistId: 'ar-neon-tide', genreId: 'g-synthwave', year: 2023 },
  { id: 'al-chrome-horizon', title: 'Chrome Horizon', artistId: 'ar-neon-tide', genreId: 'g-electronic', year: 2021 },
  { id: 'al-paper-lanterns', title: 'Paper Lanterns', artistId: 'ar-mira-sol', genreId: 'g-dream-pop', year: 2022 },
  { id: 'al-static-bloom', title: 'Static Bloom', artistId: 'ar-kestrel', genreId: 'g-indie-rock', year: 2020 },
  { id: 'al-blue-hour', title: 'Blue Hour', artistId: 'ar-dahlia', genreId: 'g-jazz', year: 2021 },
  { id: 'al-signal-drift', title: 'Signal Drift', artistId: 'ar-ronin', genreId: 'g-electronic', year: 2024 },
  { id: 'al-hollow-pines', title: 'Hollow Pines', artistId: 'ar-elm-ash', genreId: 'g-folk', year: 2018 },
  { id: 'al-late-night-study', title: 'Late Night Study', artistId: 'ar-velvet', genreId: 'g-lofi', year: 2023 },
  { id: 'al-fog-machine', title: 'Fog Machine', artistId: 'ar-ronin', genreId: 'g-ambient', year: 2022 },
];

const TRACKS_BY_ALBUM = {
  'al-midnight-arcade': [
    ['Neon Overdrive', 224], ['Arcade Hearts', 198], ['Chrome Sunset', 256],
    ['Coin Slot Dreams', 187], ['Turbo Bloom', 241], ['Midnight Arcade', 312],
    ['Pixel Rain', 205], ['Last Token', 233],
  ],
  'al-chrome-horizon': [
    ['Chrome Horizon', 268], ['Glass Highway', 224], ['Electric Terrace', 199],
    ['Nylon Sky', 246], ['Retrograde', 231], ['Silver Lining Drive', 289],
  ],
  'al-paper-lanterns': [
    ['Paper Lanterns', 254], ['Soft Focus', 218], ['Honeyed Light', 233],
    ['Saltwater Hymn', 276], ['Everything Glows', 241], ['Slow Tide', 302],
    ['Cinder & Silk', 210],
  ],
  'al-static-bloom': [
    ['Static Bloom', 236], ['Loud Quiet Loud', 201], ['Borrowed Weather', 248],
    ['Concrete Garden', 219], ['Half a Ghost', 262], ['Static Bloom (Reprise)', 154],
  ],
  'al-blue-hour': [
    ['Blue Hour', 341], ['Velvet Underground Blues', 288], ['Smoke & Satin', 265],
    ['After Hours Waltz', 312], ['Nocturne for Two', 356], ['Last Call', 274],
  ],
  'al-signal-drift': [
    ['Signal Drift', 292], ['Ionosphere', 245], ['Low Earth Orbit', 268],
    ['Telemetry', 221], ['Re-entry', 307], ['Quiet Machines', 199],
  ],
  'al-hollow-pines': [
    ['Hollow Pines', 268], ['River Stone', 233], ['Old Growth', 291],
    ['Winter Fields', 254], ['Cartographer', 226], ['Homeward', 318],
  ],
  'al-late-night-study': [
    ['Desk Lamp', 184], ['Rainy Window', 205], ['Margin Notes', 176],
    ['Fourth Coffee', 192], ['Dust in the Beam', 218], ['3AM Focus', 231],
    ['Soft Static', 199], ['Closing Time', 244],
  ],
  'al-fog-machine': [
    ['Fog Machine', 402], ['Slow Burn Signal', 356], ['Distant Cities', 421],
    ['Weightless', 388], ['Haze', 334],
  ],
};

const MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
};

const EXT_SEQUENCE = ['mp3', 'mp3', 'flac', 'mp3', 'ogg', 'm4a'];

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildTracks() {
  const tracks = [];
  const artistsById = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));
  const albumsById = Object.fromEntries(ALBUMS.map((a) => [a.id, a]));
  let n = 0;

  for (const album of ALBUMS) {
    const artist = artistsById[album.artistId];
    const list = TRACKS_BY_ALBUM[album.id] || [];
    list.forEach(([title, duration], i) => {
      const ext = EXT_SEQUENCE[n % EXT_SEQUENCE.length];
      const size = Math.round((duration * 16000 * (ext === 'flac' ? 3.4 : ext === 'wav' ? 9 : 1)) / 1);
      const addedAt = new Date(Date.UTC(album.year, (i * 3) % 12, ((i * 7) % 27) + 1, 9, 0, 0));
      tracks.push({
        id: `tr-${String(n + 1).padStart(3, '0')}`,
        title,
        artistId: album.artistId,
        artist: artist.name,
        albumId: album.id,
        album: album.title,
        genreId: album.genreId,
        trackNumber: i + 1,
        discNumber: 1,
        year: album.year,
        duration,
        mimeType: MIME_BY_EXT[ext],
        format: ext.toUpperCase(),
        fileSize: size,
        filePath: `/${artist.name}/${album.title}/${String(i + 1).padStart(2, '0')} - ${title}.${ext}`,
        addedAt: addedAt.toISOString(),
        modifiedAt: addedAt.toISOString(),
        available: true,
        artworkSeed: album.id,
      });
      n++;
    });
  }
  return tracks;
}

export const mockTracks = buildTracks();

export const mockArtists = ARTISTS.map((a) => {
  const albums = ALBUMS.filter((al) => al.artistId === a.id);
  const tracks = mockTracks.filter((t) => t.artistId === a.id);
  return {
    ...a,
    albumCount: albums.length,
    trackCount: tracks.length,
    duration: tracks.reduce((sum, t) => sum + t.duration, 0),
    albums,
  };
});

export const mockAlbums = ALBUMS.map((al) => {
  const tracks = mockTracks.filter((t) => t.albumId === al.id);
  return {
    ...al,
    artist: ARTISTS.find((a) => a.id === al.artistId)?.name || 'Unknown Artist',
    trackCount: tracks.length,
    duration: tracks.reduce((sum, t) => sum + t.duration, 0),
    artworkSeed: al.id,
  };
});

export const mockGenres = GENRES.map((g) => {
  const tracks = mockTracks.filter((t) => t.genreId === g.id);
  return {
    ...g,
    trackCount: tracks.length,
    albumCount: new Set(tracks.map((t) => t.albumId)).size,
  };
});

export const mockPlaylists = [
  {
    id: 'pl-focus',
    name: 'Deep Focus',
    description: 'Low-key instrumentals for getting things done.',
    trackIds: mockTracks.filter((t) => ['g-lofi', 'g-ambient'].includes(t.genreId)).map((t) => t.id),
    createdAt: '2024-11-02T08:00:00.000Z',
    updatedAt: '2025-01-14T10:30:00.000Z',
  },
  {
    id: 'pl-late-night',
    name: 'Late Night Drive',
    description: 'Synths, neon and long empty highways.',
    trackIds: mockTracks.filter((t) => t.genreId === 'g-synthwave').map((t) => t.id),
    createdAt: '2024-09-19T21:10:00.000Z',
    updatedAt: '2025-02-01T23:05:00.000Z',
  },
  {
    id: 'pl-sunday',
    name: 'Sunday Morning',
    description: 'Folk and jazz to start slow.',
    trackIds: mockTracks.filter((t) => ['g-folk', 'g-jazz'].includes(t.genreId)).slice(0, 9).map((t) => t.id),
    createdAt: '2025-01-05T07:45:00.000Z',
    updatedAt: '2025-01-05T07:45:00.000Z',
  },
];

// One track from each album, most recent first — keeps Home's "Recently played"
// shelf visually varied.
const firstTrackByAlbum = [];
const seenAlbums = new Set();
for (const track of mockTracks) {
  if (seenAlbums.has(track.albumId)) continue;
  seenAlbums.add(track.albumId);
  firstTrackByAlbum.push(track);
}

export const mockHistory = firstTrackByAlbum.slice(0, 7).map((t, i) => ({
  trackId: t.id,
  playedAt: new Date(Date.now() - i * 3600_000 * 5).toISOString(),
  position: Math.round(t.duration * (0.2 + i * 0.08)),
}));

export const mockUser = {
  id: 'u-admin',
  username: 'admin',
  role: 'admin',
  lastLoginAt: new Date(Date.now() - 3600_000 * 20).toISOString(),
};

export const mockUsers = [
  { id: 'u-admin', username: 'admin', role: 'admin', lastLoginAt: new Date(Date.now() - 3600_000 * 20).toISOString() },
  { id: 'u-family', username: 'family', role: 'user', lastLoginAt: new Date(Date.now() - 3600_000 * 72).toISOString() },
  { id: 'u-guest', username: 'guest', role: 'user', lastLoginAt: null },
];

export const mockSystem = {
  version: '0.1.0',
  uptimeSeconds: 1000 * 60 * 60 * 27 + 1000 * 60 * 12,
  cpuPercent: 4.2,
  memory: { usedBytes: 118 * 1024 * 1024, totalBytes: 1024 * 1024 * 1024 },
  disk: { usedBytes: 1.4 * 1024 ** 3, totalBytes: 6 * 1024 ** 3 },
};

export const LIBRARY_ROOT = '/music-library/';

export function tracksToIds(tracks) {
  return tracks.map((t) => (typeof t === 'string' ? t : t.id));
}

export function normalizeTitle(text) {
  return slug(text);
}
