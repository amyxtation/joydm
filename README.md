# JoyDM

A lightweight, self-hosted **web music streaming player**. Play your own music
library from any browser — no ads, no tracking, no third-party services.

Implements the MVP described in [`music-player-streaming-prd.md`](./music-player-streaming-prd.md):
Node.js + Fastify API, SQLite (via the built-in `node:sqlite`), a library
scanner with real tag reading, and HTTP Range streaming. Frontend is vanilla
JS + Vite — no UI framework.

---

## Quick start

```bash
npm install
npm run dev
```

That starts both processes:

| Process | URL | Purpose |
| --- | --- | --- |
| Vite | <http://localhost:5173> | Frontend dev server (proxies `/api` to the backend) |
| Fastify | <http://localhost:8080> | REST API + audio streaming |

### 1. Create your admin account

On first run no users exist, so the login screen becomes a **setup screen**.
Pick a username and a password (8+ characters). The password is hashed with
scrypt — nothing is hardcoded and nothing is stored in plain text.

### 2. Add music and scan

Drop your files into `music-library/` (artist/album folders are conventional but
not required — tags are the source of truth):

```text
music-library/
├── Neon Tide/
│   └── Midnight Arcade/
│       ├── 01 - Neon Overdrive.mp3
│       └── 02 - Arcade Hearts.flac
└── ...
```

Then either click **Scan Library** on the Home/Admin page, or run:

```bash
npm run scan          # one-off CLI scan
npm run scan -- --force   # re-read all metadata, ignoring file mtimes
```

Supported formats: MP3, AAC/M4A, OGG/Opus, WAV, FLAC. Files are streamed in
their original format — no transcoding.

### Production (single process)

```bash
npm run build     # builds the frontend into dist/
npm start         # Fastify serves the API *and* the built SPA on :8080
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | API (`--watch`) + Vite dev server together |
| `npm run dev:server` | API only |
| `npm run dev:web` | Vite only |
| `npm run build` | Production frontend build |
| `npm start` | Production server (API + SPA on one port) |
| `npm run scan` | One-off library scan from the CLI |
| `npm test` | Test suite (`node --test`) |

> **Note:** `APP_ENV` is authoritative for production/development and is *not*
> inherited from `NODE_ENV` (many hosts set `NODE_ENV=production` globally,
> which would otherwise force production requirements onto local dev). The
> project-local `.npmrc` keeps dev tooling installing in that situation; nothing
> global is modified.

---

## Running on your own server

JoyDM needs a **long-running process**, a **writable disk** for SQLite, and
**access to your music files**. That rules out static/serverless hosting
(Vercel, Netlify, GitHub Pages, Cloudflare Pages): those can serve the frontend,
but no backend exists there, so every `/api/*` call returns 404. A normal
machine — a home PC, a mini PC, a Raspberry Pi or a VPS — is the right home for
it.

### Setup on the server

```bash
# 1. Get the code
git clone https://github.com/amyxtation/joydm.git
cd joydm

# 2. Check Node (22.5+ required — JoyDM uses the built-in node:sqlite)
node --version
npm install

# 3. Configure: create .env and set a fixed SESSION_SECRET
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Build the frontend once, then start
npm run build
npm start
```

Then open `http://<server-ip>:8080` from any device on the network, create your
admin account on the first-run screen, and scan your library.

To update later: `git pull && npm install && npm run build`, then restart.

### Keeping it running

`npm start` in an SSH session dies the moment you close the terminal (the
process receives SIGHUP). JoyDM *is* the server, so it has to keep running.

**Proper way — systemd (Linux).** A unit file is included:

```bash
# edit User / WorkingDirectory / ExecStart in the file first
# (check the node path with: which node)
sudo cp deploy/joydm.service /etc/systemd/system/joydm.service
sudo systemctl daemon-reload
sudo systemctl enable --now joydm

systemctl status joydm          # is it up?
journalctl -u joydm -f          # follow the logs
```

It starts on boot and restarts automatically if it crashes. After changing
code: `git pull && npm install && npm run build && sudo systemctl restart joydm`.

> If you installed Node with **nvm**, systemd cannot see it. Use the full path
> from `which node` in `ExecStart`, or install Node system-wide so it lives in
> `/usr/bin/node`.

**Quick way — a detachable terminal.** Fine for testing, not for production:

```bash
tmux new -s joydm      # then run: npm start    (detach with Ctrl-b, then d)
tmux attach -t joydm   # come back later
```

**Other options:** `docker compose up -d` (uses the bundled compose file and
`restart: unless-stopped`), `pm2 start src/server.js`, or on Windows a service
wrapper such as NSSM or Task Scheduler.

### Getting your music onto the server

The library is deliberately **not** in the repository — audio is gitignored, so
you will not find your tracks after cloning. The repo ships an empty
`music-library/` folder; copy your files into it yourself:

```bash
# from your PC (Linux/macOS)
scp -r ~/Music/* user@server:/path/to/joydm/music-library/

# from Windows (mirrors a folder, including subfolders)
robocopy "C:\Users\you\Music" "\\server\share\joydm\music-library" /E
```

SMB/NFS shares and mounted NAS folders work too — point `MUSIC_LIBRARY_PATH` at
whatever path you mount. Then press **Scan Library** in the UI.

### Notes for a LAN deployment

- **Firewall:** open the port (8080 by default) on the server so other devices
  can reach it.
- **`APP_ENV=production` is optional.** If you use it, you must also set a fixed
  `SESSION_SECRET`, otherwise the server refuses to start. Leaving it as
  `development` is perfectly fine on a trusted LAN.
- **Plain HTTP works.** The session cookie's `Secure` flag follows the request
  scheme, so `http://server:8080` logs in normally, while a deployment behind
  HTTPS gets `Secure` cookies automatically. Override with `COOKIE_SECURE` only
  if TLS terminates somewhere the app cannot see.
- **Want access from outside your network?** Put a reverse proxy or tunnel in
  front of it — the bundled `Caddyfile` gives you automatic HTTPS on a VPS, and
  a Cloudflare Tunnel or Tailscale does the same for a machine at home without
  opening any ports.

---

## Playback

**Repeat** has three explicit modes, shown on the repeat button in the player
(and available in the fullscreen player and in Settings → Playback):

| Mode | Behaviour |
| --- | --- |
| **No repeat** | Plays the queue once, then stops |
| **Repeat all (loop)** | Loops the whole queue |
| **Repeat one track** | Loops the current track |

**Keep playing** (Settings → Playback, on by default) controls whether finishing
a track automatically advances to the next one. Turn it off to stop at the end
of every track.

Other player behaviour worth knowing:

- The queue button shows how many tracks are queued, so it is obvious whether
  you are playing a single track or a whole list.
- If a file is missing or the browser cannot decode it, the track is reported
  and **skipped** rather than silently ending the queue. A notice appears when a
  queue finishes.
- Playback is never interrupted by in-app navigation.

---

## Configuration

Copy `.env.example` to `.env`. All values are optional in development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` enables secure cookies and requires `SESSION_SECRET` |
| `APP_PORT` | `8080` | API port |
| `DATABASE_PATH` | `./data/music.db` | SQLite file (created automatically) |
| `MUSIC_LIBRARY_PATH` | `./music-library` | Root of your music |
| `LOG_PATH` | `./logs` | Log directory |
| `SESSION_SECRET` | — | **Required in production** |
| `PRIVATE_MODE` | `true` | Require sign-in for library + streaming |
| `SCAN_CONCURRENCY` | `3` | Metadata workers during a scan (2–4 recommended) |
| `SCAN_ON_STARTUP` | `false` | Scan automatically a couple of seconds after boot |
| `LOGIN_ATTEMPTS_PER_MINUTE` | `5` | Failed logins allowed per IP per minute |

---

## Architecture

```
src/
├── server.js              Bootstrap, graceful shutdown (SIGTERM/SIGINT)
├── app.js                 Fastify instance, hooks, security headers, static SPA
├── config.js              Env config (APP_ENV authoritative), path setup
├── logger.js              Structured JSON logs, secret redaction
├── database/index.js      node:sqlite connection, versioned migrations, helpers
├── middleware/
│   ├── auth.js            Session → request.user, requireAuth / requireAdmin
│   ├── csrf.js            Origin check for state-changing requests
│   └── rateLimit.js       In-memory fixed-window limiter
├── auth/                  scrypt hashing, sessions, /api/auth routes
├── library/
│   ├── repository.js      All SQL + row serialisation
│   └── routes.js          /api/library, tracks, artists, albums, genres, search
├── indexer/
│   ├── metadata.js        music-metadata wrapper with filename fallbacks
│   ├── artwork.js         Embedded → folder artwork → cache
│   └── scanner.js         Incremental scan, concurrency, progress
├── streaming/routes.js    /api/stream/:id (Range/HEAD) + /api/artwork/albums/:id
├── user/                  Playlists, favourites, history, settings
└── admin/routes.js        Scan control, system status, user management
migrations/                001_initial.sql (see PRD §49–§55)
web/                       Frontend (see below)
```

The frontend keeps its clean separation: `web/js/core/api.js` mirrors the REST
surface, `core/player.js` owns playback, `views/` holds one module per route.

### API

All responses use the PRD envelope `{ success, data, error }`.

| Endpoint | Notes |
| --- | --- |
| `GET /health`, `GET /ready` | Public health checks |
| `POST /api/auth/setup`, `/login`, `/logout`, `GET /api/auth/me`, `/status` | Session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production) |
| `GET /api/library`, `/tracks`, `/tracks/:id`, `/artists`, `/artists/:id`, `/albums`, `/albums/:id`, `/genres`, `/search` | Library reads (paginated: `page`, `limit`, `sort`, `order`) |
| `GET|HEAD /api/stream/:id` | Audio with `Accept-Ranges: bytes` → `206 Partial Content` |
| `GET /api/artwork/albums/:id` | Cached cover art |
| `/api/playlists` (+ `/tracks`, `/reorder`), `/api/favorites/:trackId`, `/api/history`, `/api/settings` | Per-user data |
| `/api/admin/library/scan`, `/scan/status`, `/library/cleanup-missing`, `/cache/clear`, `/system/status`, `/users` | Admin only |

### Security

- Passwords hashed with **scrypt** (memory-hard, `node:crypto`) and verified in
  constant time; login attempts rate-limited per IP (5/min) with `Retry-After`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, with
  server-side expiry and IDs from `crypto.randomBytes(32)`.
- CSRF: cookie auth relies on `SameSite=Lax` plus an `Origin` vs `Host` check on
  every state-changing request.
- Path traversal: track paths are stored relative to the library root and
  resolved with a symlink-aware containment check before any read (§25).
- SQL is always parameterised; no string interpolation.
- Security headers (`CSP`, `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) are set on every response.
- Audio is streamed from the filesystem — files are never read into memory
  (§24/§86), so concurrent listeners don't multiply RAM usage.

### Deployment

`Dockerfile` (multi-stage), `docker-compose.yml` (app + Caddy, 1 CPU / 512 MB
limits, healthcheck) and `Caddyfile` (automatic HTTPS, unbuffered streaming).

```bash
# create .env with SESSION_SECRET (+ optionally JOYDM_HOST / ACME_EMAIL)
docker compose up -d --build
```

Mount your library read-only (already configured) so the application can never
modify your files. Ensure `./data` and `./logs` are writable by the container
user (uid 1000) — `sudo chown -R 1000:1000 data logs` if needed.

---

## Testing

```bash
npm test
```

28 tests covering the Range parser, password hashing/policy, the path-traversal
guard, and the repository/DB layer (migrations, pagination, filters, playlists,
favourites, history, settings).

Streaming was verified against real files: full `GET` returns `200` with
`Content-Length`; `Range: bytes=0-1023`, `bytes=500-` and suffix `bytes=-100`
return `206` with correct `Content-Range`; `HEAD` returns headers only; an
unsatisfiable range returns `416`; unauthenticated requests `401`; cross-site
`POST` `403`.

---

## Notes and deliberate deviations from the PRD

| PRD | Implementation |
| --- | --- |
| §26 recommends Argon2id | **scrypt** from `node:crypto` — equally safe here and avoids a native dependency, keeping the image small (§110) |
| §61 artwork thumbnails (128/256/512) | Cover art is cached and served at original size with long-lived cache headers + lazy loading; multi-size thumbnails need an image library (e.g. `sharp`) and were left out |
| §75 multi-step setup wizard | Single first-run form that creates the admin account (same outcome) |
| §131 "File unavailable" rows | Missing files are marked `missing`, excluded from listings, counted in Admin, and removable via *Cleanup missing tracks* |
| §133 Prometheus metrics | Not implemented (optional in the PRD) |
| Transcoding, download, PWA, Media Session beyond basics | Out of MVP scope (§144–§152) |
