-- JoyDM initial schema (PRD §49–§55, §88)

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT
);

CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT    NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE artists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  normalized_name TEXT    NOT NULL UNIQUE,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_artists_name ON artists(name);

CREATE TABLE albums (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  artist_id    INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  year         INTEGER,
  artwork_path TEXT,
  artwork_hash TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (title, artist_id)
);
CREATE INDEX idx_albums_title ON albums(title);
CREATE INDEX idx_albums_artist ON albums(artist_id);

CREATE TABLE genres (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  normalized_name TEXT    NOT NULL UNIQUE
);

CREATE TABLE tracks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT    NOT NULL,
  artist_id        INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  album_id         INTEGER REFERENCES albums(id) ON DELETE SET NULL,
  genre_id         INTEGER REFERENCES genres(id) ON DELETE SET NULL,
  album_artist     TEXT,
  track_number     INTEGER,
  disc_number      INTEGER,
  year             INTEGER,
  duration         REAL    NOT NULL DEFAULT 0,
  file_path        TEXT    NOT NULL UNIQUE,
  file_size        INTEGER NOT NULL DEFAULT 0,
  mime_type        TEXT    NOT NULL DEFAULT 'application/octet-stream',
  file_modified_at TEXT,
  missing          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_tracks_title ON tracks(title);
CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_genre ON tracks(genre_id);
CREATE INDEX idx_tracks_created ON tracks(created_at);

CREATE TABLE playlists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_playlists_user ON playlists(user_id);

CREATE TABLE playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (playlist_id, track_id)
);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);

CREATE TABLE favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX idx_favorites_user ON favorites(user_id, created_at);

CREATE TABLE playback_history (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  position  REAL    NOT NULL DEFAULT 0,
  UNIQUE (user_id, track_id)
);
CREATE INDEX idx_history_user ON playback_history(user_id, played_at);

CREATE TABLE user_settings (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme         TEXT    NOT NULL DEFAULT 'dark',
  volume        REAL    NOT NULL DEFAULT 0.8,
  shuffle       INTEGER NOT NULL DEFAULT 0,
  repeat_mode   TEXT    NOT NULL DEFAULT 'off',
  autoplay      INTEGER NOT NULL DEFAULT 1,
  last_track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  last_position REAL    NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE scan_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  status      TEXT    NOT NULL DEFAULT 'idle',
  started_at  TEXT,
  finished_at TEXT,
  scanned     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  indexed     INTEGER NOT NULL DEFAULT 0,
  removed     INTEGER NOT NULL DEFAULT 0,
  errors      INTEGER NOT NULL DEFAULT 0,
  message     TEXT
);
