# PRD — JoyDM Web-Based Music Streaming Player

**Document Version:** 1.0  
**Status:** Draft / Ready for Development  
**Product Type:** Self-hosted Web Music Streaming Player  
**Primary Node.jsal:** Menyediakan aplikasi web JoyDM music player untuk memutar koleksi musik milik sendiri melalui browser dengan performa ringan, cepat, reliable, dan penggunaan resource server seminimal mungkin.

---

# 1. Product Overview

Aplikasi ini adalah **web-based music streaming player** yang memungkinkan pengguna mengakses dan memutar koleksi musik dari sebuah library musik yang tersimpan di server.

Sistem dirancang untuk penggunaan **self-hosted**, sehingga seluruh file musik berada di storage milik pengguna. Aplikasi tidak bergantung pada layanan streaming pihak ketiga untuk konten musik.

Library musik pada deployment awal harus disediakan sebagai **folder/library kosong** yang nantinya dapat diisi file musik secara manual.

Contoh struktur:

```text
/music-library/
├── Artist A/
│   ├── Album A/
│   │   ├── 01 - Song One.mp3
│   │   └── 02 - Song Two.mp3
│   └── Album B/
│       └── 01 - Song Three.mp3
│
├── Artist B/
│   └── Album C/
│       └── 01 - Song Four.flac
│
└── ...
```

Aplikasi harus dapat melakukan indexing terhadap library dan menampilkan koleksi musik secara terstruktur.

---

# 2. Product Node.jsals

## 2.1 Primary Node.jsals

1. Menyediakan JoyDM music player berbasis web.
2. Memutar file musik langsung dari server.
3. Mendukung streaming dengan HTTP Range Request agar seek/forward/backward dapat dilakukan tanpa harus mengunduh seluruh file.
4. Menyediakan library musik yang mudah dikelola.
5. Memiliki UI modern tetapi sederhana.
6. Memiliki waktu loading awal yang cepat.
7. Menggunakan resource server seminimal mungkin.
8. Tidak membutuhkan database besar.
9. Mudah di-install dan di-maintain.
10. Dapat berjalan pada VPS/server dengan resource rendah.
11. Tidak melakukan transcoding secara default.
12. Mempertahankan kualitas audio asli selama format browser didukung.
13. Dapat dikembangkan ke fitur lanjutan tanpa perlu mengganti arsitektur utama.

## 2.2 Non-Node.jsals

Versi awal tidak ditujukan untuk:

- Menjadi platform publik seperti Spotify.
- Menyediakan katalog musik komersial.
- Menyediakan social network.
- Live radio.
- Video streaming.
- Real-time audio transcoding.
- Sistem DRM.
- Marketplace musik.
- Integrasi layanan musik pihak ketiga.

---

# 3. Target Users

## Primary User

Pemilik library musik pribadi yang ingin:

- Mengakses musik dari browser.
- Mendengarkan musik dari PC/laptop.
- Mendengarkan musik dari smartphone.
- Tidak perlu meng-copy file musik ke perangkat.
- Memiliki satu library musik terpusat.
- Membuat playlist pribadi.
- Melanjutkan musik terakhir yang diputar.

## Secondary User

Pengguna lain yang diberikan akses oleh administrator.

Contoh:

- Keluarga.
- Teman.
- Tim internal.
- Pengguna jaringan lokal.

---

# 4. Recommended Technology Stack

Arsitektur harus memprioritaskan **low resource usage + reliability + speed**, sekaligus menyediakan workflow development lokal yang sederhana menggunakan npm.

## 4.1 Backend

**Node.js (LTS) + Fastify**

Alasan:

- Runtime mature dan widely supported.
- npm menjadi package manager dan workflow utama.
- Fastify ringan dan memiliki overhead rendah.
- Sangat cocok untuk REST API dan HTTP streaming.
- Development lokal mudah:
  ```bash
  npm install
  npm run dev
  ```
- Production public deployment dapat dikemas menggunakan Docker.
- Tidak membutuhkan database server terpisah.

Target:

```text
Node.js LTS
Fastify
npm
```

## 4.2 Package Management

Gunakan:

```text
npm
package-lock.json
```

Dependency harus dikunci menggunakan `package-lock.json` agar hasil deployment konsisten.

Development scripts minimal:

```json
{
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "build": "npm run build:frontend",
    "test": "node --test"
  }
}
```

Jika frontend menggunakan bundler, script dapat disesuaikan dengan tool yang dipilih.

# 5. Frontend Stack

Gunakan:

- HTML5
- CSS3
- Vanilla JavaScript
- HTML5 Audio API
- Fetch API
- Vite (development/build tooling)

Vite hanya digunakan sebagai tooling frontend, bukan sebagai requirement runtime production.

Framework frontend besar seperti React, Vue, Angular, atau Next.js **tidak diperlukan untuk MVP**.

Alasan:

- Bundle lebih kecil.
- UI lebih cepat.
- Tidak membutuhkan framework runtime besar.
- Maintenance lebih sederhana.
- Resource server lebih rendah.

Development lokal:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

# 6. Database

Gunakan:

**SQLite**

SQLite digunakan untuk menyimpan metadata aplikasi, bukan file audio.

Data yang disimpan antara lain:

- User.
- Artist.
- Album.
- Track metadata.
- Playlist.
- Playlist items.
- Favorite.
- Playback history.
- User settings.

Keuntungan:

- Tidak membutuhkan database server terpisah.
- Tidak membutuhkan MySQL/PostgreSQL untuk deployment kecil.
- File database mudah dibackup.
- Resource usage sangat rendah.
- Reliable untuk workload aplikasi personal/small-to-medium.

Database file:

```text
/data/music.db
```

Untuk Node.js, gunakan SQLite driver yang ringan dan mature. Hindari ORM besar jika tidak diperlukan.

# 7. Reverse Proxy

Untuk deployment public, recommended:

**Caddy**

Caddy digunakan sebagai:

- HTTPS termination.
- Reverse proxy.
- Static asset delivery.
- HTTP/2.
- HTTP/3 jika tersedia.
- Automatic TLS certificate.

Untuk development lokal, Caddy **tidak diperlukan**.

Local:

```text
Browser
   |
   v
npm run dev
   |
   v
Node.js + Vite
```

Public:

```text
Internet
   |
   v
Caddy
   |
   v
Docker container
   |
   v
Node.js + JoyDM
```

Alternatif production reverse proxy:

- Nginx.
- Traefik.

# 8. Deployment Architecture

JoyDM memiliki dua mode deployment.

## 8.1 Local Development

Tidak menggunakan Docker.

```text
                Browser
                   |
                   v
             npm run dev
                   |
          +--------+--------+
          |                 |
          v                 v
       Vite Dev        Node.js API
          |                 |
          +--------+--------+
                   |
                   v
               SQLite
                   |
                   v
             Music Library
```

Command utama:

```bash
npm install
npm run dev
```

Tujuan:

- Cepat setup.
- Mudah debugging.
- Tidak membutuhkan Docker Desktop.
- Tidak membutuhkan reverse proxy.
- Cocok untuk development dan testing lokal.

## 8.2 Public Deployment

Production public menggunakan Docker.

```text
                    Internet
                       |
                       v
                    Caddy
                  HTTPS/TLS
                       |
                       v
              +----------------+
              | Docker         |
              | JoyDM          |
              | Node.js        |
              +-------+--------+
                      |
              +-------+-------+
              |               |
              v               v
          SQLite DB      Music Library
```

Docker digunakan hanya untuk deployment public/production agar environment lebih konsisten dan mudah dipindahkan.

# 9. Storage Architecture

Pisahkan storage menjadi:

```text
/app
/data
/music-library
/logs
```

Recommended:

```text
/data/
├── music.db
├── cache/
└── playlists/

 /music-library/
├── Artist/
│   └── Album/
│       └── *.mp3
├── Artist/
│   └── Album/
│       └── *.flac
└── ...
```

Music library harus dapat di-mount dari:

- Local disk.
- NAS.
- NFS.
- SMB mount.
- Dedicated storage.

Aplikasi hanya perlu mengetahui path root library.

Environment variable:

```env
MUSIC_LIBRARY_PATH=/music-library
DATABASE_PATH=/data/music.db
```

---

# 10. Supported Audio Formats

## MVP

Prioritaskan:

- MP3
- AAC/M4A
- OGG
- WAV
- FLAC

Browser compatibility harus diperhatikan.

Jika browser tidak mendukung format tertentu secara native, aplikasi harus memberikan status bahwa format tersebut tidak dapat dimainkan oleh browser tersebut.

## Important Requirement

**Jangan melakukan transcoding pada MVP.**

File harus dikirim dalam format aslinya jika browser mendukung.

Contoh:

```text
MP3 -> MP3
FLAC -> FLAC
WAV -> WAV
```

Tidak:

```text
FLAC -> MP3 -> Browser
```

kecuali fitur transcoding ditambahkan pada fase berikutnya.

---

# 11. Music Library

JoyDM harus memiliki library kosong saat pertama kali dijalankan.

Contoh:

```text
/music-library/
```

Folder dapat kosong:

```text
/music-library/
└── .gitkeep
```

Setelah administrator memasukkan file musik, aplikasi dapat melakukan:

```text
Scan Library
      |
      v
Detect Files
      |
      v
Read Metadata
      |
      v
Normalize Metadata
      |
      v
Update SQLite
```

---

# 12. Library Indexing

Indexer harus mendeteksi:

- New files.
- Deleted files.
- Renamed files.
- Modified files.
- Metadata changes.

Metadata yang dibaca:

- Title.
- Artist.
- Album.
- Album Artist.
- Genre.
- Track number.
- Disc number.
- Year.
- Duration.
- MIME type.
- File size.
- Embedded artwork.
- File path.

Jika metadata tidak tersedia:

```text
Title = filename
Artist = Unknown Artist
Album = Unknown Album
```

---

# 13. File Identity

Jangan hanya menggunakan filename sebagai identifier.

Gunakan kombinasi:

```text
File Path
+
File Size
+
Modification Time
```

atau checksum jika diperlukan.

Untuk library besar, checksum penuh tidak harus dilakukan pada setiap scan karena dapat membebani disk.

Recommended approach:

1. Compare path.
2. Compare file size.
3. Compare modification time.
4. Hanya lakukan checksum jika diperlukan.

---

# 14. Music Library UI

Halaman utama harus menyediakan:

## Sections

- Home
- Songs
- Artists
- Albums
- Genres
- Playlists
- Favorites
- Recently Played

---

# 15. Home Page

Home harus menampilkan:

### Recently Played

Daftar musik terakhir yang dimainkan.

### Recently Added

Musik yang baru masuk ke library.

### Favorites

Musik yang ditandai favorite.

### Quick Access

- All Songs
- Artists
- Albums
- Playlists

---

# 16. Songs Page

Menampilkan seluruh lagu.

Kolom:

| Field | Description |
|---|---|
| Track | Judul |
| Artist | Artist |
| Album | Album |
| Duration | Durasi |
| Added | Tanggal masuk library |

Fungsi:

- Play.
- Add to queue.
- Add to playlist.
- Favorite.
- Search.
- Sort.

Sorting:

- Title.
- Artist.
- Album.
- Recently Added.
- Duration.

---

# 17. Artist Page

Menampilkan:

- Artist name.
- Album list.
- Song count.
- Total duration.

Klik artist:

```text
Artist
 ├── Album 1
 │   ├── Song 1
 │   └── Song 2
 │
 └── Album 2
     ├── Song 1
     └── Song 2
```

---

# 18. Album Page

Menampilkan:

- Album artwork.
- Album title.
- Artist.
- Release year.
- Track count.
- Total duration.
- Track list.

Actions:

- Play album.
- Shuffle album.
- Add album to playlist.

---

# 19. Search

Search harus tersedia secara global.

Search berdasarkan:

- Song title.
- Artist.
- Album.
- Genre.

Untuk MVP SQLite:

```sql
LIKE
```

dapat digunakan.

Jika library menjadi sangat besar, dapat ditingkatkan menggunakan:

```text
SQLite FTS5
```

---

# 20. JoyDM

Player harus menjadi komponen utama aplikasi.

Recommended layout:

```text
+----------------------------------------------------+
| Artwork | Song Title - Artist                      |
|         |                                          |
|         | Previous  Play/Pause  Next               |
|         |                                          |
|         | ─────────●────────────────               |
|         | 01:24 / 04:32                             |
|         |                                          |
|         | Volume    Queue    Repeat    Shuffle     |
+----------------------------------------------------+
```

---

# 21. Player Features

MVP:

- Play.
- Pause.
- Previous.
- Next.
- Seek.
- Volume.
- Mute.
- Shuffle.
- Repeat.
- Queue.
- Progress bar.
- Duration.
- Current time.
- Keyboard controls.

---

# 22. Queue

Queue harus bersifat client-side untuk meminimalkan server workload.

Fungsi:

- Add track.
- Remove track.
- Clear queue.
- Reorder queue.
- Play next.
- Play now.

Queue dapat disimpan sementara menggunakan:

```text
localStorage
```

---

# 23. Playback

Gunakan:

```html
<audio>
```

HTML5 Audio API.

Contoh endpoint:

```text
GET /api/stream/{track_id}
```

Server harus mendukung:

```text
Accept-Ranges: bytes
```

dan:

```text
Range: bytes=...
```

Response:

```text
206 Partial Content
```

untuk request range.

---

# 24. Streaming Requirements

Streaming endpoint harus:

1. Memvalidasi track ID.
2. Memastikan file berada di dalam music library.
3. Mencegah path traversal.
4. Memeriksa permission.
5. Mengirim MIME type yang benar.
6. Mendukung Range Request.
7. Mendukung seek.
8. Mengirim Content-Length.
9. Tidak membaca seluruh file ke RAM.
10. Menggunakan streaming dari filesystem.

**Critical requirement:**

Jangan melakukan:

```text
Read entire audio file into memory
```

Gunakan file streaming langsung.

---

# 25. Security — Path Traversal

User tidak boleh dapat mengakses:

```text
../../etc/passwd
```

atau file di luar:

```text
/music-library/
```

Semua request harus divalidasi.

Server harus memastikan resolved path tetap berada di bawah configured music library root.

---

# 26. Authentication

MVP menyediakan authentication sederhana.

Login:

```text
Username
Password
```

Session menggunakan secure HTTP cookie.

Cookie:

```text
HttpOnly
Secure
SameSite=Lax
```

Password harus disimpan menggunakan hashing yang aman.

Recommended:

```text
Argon2id
```

Jangan menyimpan plaintext password.

---

# 27. User Roles

MVP:

## Admin

Dapat:

- Scan library.
- Manage users.
- Manage playlists.
- View system status.
- Configure settings.

## User

Dapat:

- Play music.
- Search.
- Create playlist.
- Favorite.
- View history.
- Manage personal settings.

---

# 28. Admin Dashboard

Dashboard harus menyediakan:

### Library

- Total songs.
- Total artists.
- Total albums.
- Total genres.
- Total storage used.

### System

- CPU usage.
- Memory usage.
- Disk usage.
- Application uptime.

### Actions

- Scan library.
- Re-index library.
- Clear cache.
- Manage users.

---

# 29. Library Scanner

Scanner dapat dijalankan:

### Manual

Admin menekan:

```text
Scan Library
```

### Scheduled

Optional future feature.

Contoh:

```text
Every 1 hour
Every 6 hours
Every day
```

### Startup Scan

Optional.

Application startup tidak boleh melakukan full scan jika library sangat besar kecuali dikonfigurasi.

---

# 30. Background Indexing

Indexing harus dilakukan secara asynchronous.

Flow:

```text
Admin clicks Scan
        |
        v
Create Scan Job
        |
        v
Return immediately
        |
        v
Background Scanner
        |
        v
Update SQLite
        |
        v
Complete
```

UI dapat menampilkan:

```text
Scanning...
Progress: 3,421 / 12,000
```

---

# 31. Playlist

User dapat membuat playlist.

Playlist memiliki:

- ID.
- Name.
- Description.
- Owner.
- Created date.
- Updated date.

Playlist items:

```text
playlist_id
track_id
position
```

Fungsi:

- Create.
- Rename.
- Delete.
- Add track.
- Remove track.
- Reorder.
- Play playlist.
- Shuffle playlist.

---

# 32. Favorites

User dapat memberikan favorite pada track.

Database:

```text
favorites
```

Unique constraint:

```text
user_id + track_id
```

---

# 33. Recently Played

Sistem menyimpan:

- User.
- Track.
- Played at.
- Playback position.

Tidak perlu menyimpan setiap event setiap beberapa detik.

Update playback position secara throttled, misalnya:

```text
Every 10–15 seconds
```

atau saat:

- Pause.
- Song ended.
- Browser closed.

---

# 34. Resume Playback

Jika user meninggalkan lagu pada:

```text
02:31
```

saat lagu dibuka kembali:

```text
Resume from 02:31
```

User dapat memilih:

```text
Resume
Start from beginning
```

---

# 35. Playback History Optimization

History harus dibatasi agar database tidak tumbuh tanpa batas.

Default:

```text
Maximum 1,000 records/user
```

Record lama dapat dihapus otomatis.

---

# 36. Artwork

Prioritas artwork:

1. Embedded artwork.
2. Folder artwork.
3. Default artwork.

Nama file artwork yang dapat dideteksi:

```text
cover.jpg
cover.jpeg
cover.png
folder.jpg
folder.png
```

Artwork dapat di-cache.

Cache:

```text
/data/cache/artwork/
```

---

# 37. Performance Strategy

Performance adalah requirement utama.

## Server

Target deployment minimum:

```text
1 vCPU
512 MB RAM
```

Recommended:

```text
2 vCPU
1 GB RAM
```

Aplikasi harus tetap usable pada resource minimum.

---

# 38. No Heavy Runtime

Production server tidak membutuhkan:

- Node.js.
- Python.
- Java.
- Redis.
- Elasticsearch.
- PostgreSQL.

Target:

```text
Caddy
+
Node.js application
+
SQLite
+
Music files
```

---

# 39. Static Assets

Frontend assets harus diminimalkan.

Gunakan:

```text
HTML
CSS
Vanilla JS
SVG
```

Hindari dependency besar jika tidak dibutuhkan.

JS production dapat diminify.

---

# 40. API Architecture

Gunakan REST API sederhana.

Base:

```text
/api
```

---

# 41. Authentication API

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

---

# 42. Library API

```http
GET /api/library
GET /api/tracks
GET /api/tracks/{id}
GET /api/artists
GET /api/artists/{id}
GET /api/albums
GET /api/albums/{id}
GET /api/genres
```

---

# 43. Streaming API

```http
GET /api/stream/{track_id}
```

Must support:

```text
GET
HEAD
Range GET
```

---

# 44. Playlist API

```http
GET    /api/playlists
POST   /api/playlists
GET    /api/playlists/{id}
PUT    /api/playlists/{id}
DELETE /api/playlists/{id}

POST   /api/playlists/{id}/tracks
DELETE /api/playlists/{id}/tracks/{track_id}
PUT    /api/playlists/{id}/reorder
```

---

# 45. Favorite API

```http
GET    /api/favorites
POST   /api/favorites/{track_id}
DELETE /api/favorites/{track_id}
```

---

# 46. History API

```http
GET  /api/history
POST /api/history
```

---

# 47. Admin API

```http
POST /api/admin/library/scan
GET  /api/admin/library/scan/status
GET  /api/admin/system/status
GET  /api/admin/users
POST /api/admin/users
PUT  /api/admin/users/{id}
DELETE /api/admin/users/{id}
```

---

# 48. API Response Format

Standard JSON:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TRACK_NOT_FOUND",
    "message": "Track not found"
  }
}
```

---

# 49. Database Schema

Minimum tables:

```text
users
tracks
artists
albums
genres
playlists
playlist_tracks
favorites
playback_history
user_settings
```

---

# 50. Tracks Table

Conceptual schema:

```text
tracks
-------------------------
id
title
artist_id
album_id
genre_id
album_artist
track_number
disc_number
year
duration
file_path
file_size
mime_type
file_modified_at
created_at
updated_at
```

---

# 51. Artists Table

```text
artists
-------------------------
id
name
normalized_name
created_at
updated_at
```

---

# 52. Albums Table

```text
albums
-------------------------
id
title
artist_id
year
artwork_path
created_at
updated_at
```

---

# 53. Users Table

```text
users
-------------------------
id
username
password_hash
role
created_at
updated_at
last_login_at
```

---

# 54. Playlist Tables

```text
playlists
-------------------------
id
user_id
name
description
created_at
updated_at
```

```text
playlist_tracks
-------------------------
playlist_id
track_id
position
created_at
```

---

# 55. User Settings

Settings:

```text
theme
volume
shuffle
repeat_mode
autoplay
last_track_id
last_position
```

---

# 56. UI/UX Direction

Design target:

**Modern, clean, dark-first JoyDM music player.**

Recommended:

```text
Dark background
Large album artwork
Clear typography
Minimal navigation
Fixed bottom player
Responsive layout
```

Desktop:

```text
+------------------------------------------------------+
| Sidebar | Main Content                               |
|         |                                            |
| Home    | Albums                                     |
| Songs   | Artists                                    |
| Albums  |                                            |
| Artists |                                            |
| Playlist|                                            |
|         |                                            |
+------------------------------------------------------+
| Persistent JoyDM                              |
+------------------------------------------------------+
```

Mobile:

```text
+--------------------------+
| Header                   |
+--------------------------+
| Content                  |
|                          |
|                          |
+--------------------------+
| Mini Player              |
+--------------------------+
| Home Songs Albums Search |
+--------------------------+
```

---

# 57. Responsive Design

Required breakpoints:

```text
Mobile
Tablet
Desktop
Large Desktop
```

Minimum supported browser width:

```text
320px
```

---

# 58. Mobile Experience

Mobile player harus mendukung:

- Touch controls.
- Swipe-friendly UI.
- Large play/pause button.
- Seek.
- Volume.
- Queue.
- Fullscreen player.

Tidak boleh menggunakan hover sebagai satu-satunya cara mengakses fungsi penting.

---

# 59. Keyboard Shortcuts

Recommended:

```text
Space       Play/Pause
Arrow Left  Previous/Seek Back
Arrow Right Next/Seek Forward
M           Mute
F           Favorite
```

Shortcut tidak boleh mengganggu input text.

---

# 60. Loading Strategy

Initial page harus sangat ringan.

Load:

```text
HTML
CSS
Minimal JS
```

Setelah UI tampil:

```text
Fetch library data
Fetch recommendations/recent tracks
Fetch artwork
```

Gunakan lazy loading untuk artwork.

---

# 61. Artwork Optimization

Jangan mengirim artwork resolusi besar ke browser.

Generate/cache thumbnail:

```text
small
medium
large
```

Contoh:

```text
128x128
256x256
512x512
```

Jika artwork asli 3000x3000, browser tidak perlu menerima file original untuk thumbnail.

---

# 62. Caching

Gunakan HTTP caching untuk:

- CSS.
- JS.
- Artwork.
- Static assets.

Music streaming tidak boleh dicache secara agresif oleh browser/proxy kecuali konfigurasi aman.

---

# 63. Security Requirements

Minimum:

- HTTPS.
- Secure cookies.
- Password hashing.
- CSRF protection jika menggunakan cookie-authenticated state-changing requests.
- Rate limiting untuk login.
- Input validation.
- SQL parameterization.
- Path traversal protection.
- Permission checks.
- No directory traversal.
- No arbitrary file download.

---

# 64. Rate Limiting

Login endpoint:

```text
5 failed attempts / minute / IP
```

dengan mekanisme backoff yang wajar.

Streaming endpoint tidak perlu rate limiting agresif karena dapat mengganggu playback.

---

# 65. Access Control

Track metadata dan streaming endpoint harus memastikan user memiliki permission.

Jika private mode:

```text
Authenticated user -> allowed
Unauthenticated -> 401
```

Admin-only endpoint:

```text
Non-admin -> 403
```

---

# 66. Logging

Log harus sederhana.

Levels:

```text
INFO
WARN
ERROR
```

Log:

- Login.
- Failed login.
- Scan start.
- Scan complete.
- Scan errors.
- API errors.
- Server errors.

Jangan log:

- Password.
- Session cookie.
- Sensitive tokens.

---

# 67. Monitoring

Health endpoint:

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

Optional:

```http
GET /ready
```

---

# 68. Backup

Backup minimum:

```text
/data/music.db
```

Music library dapat dibackup menggunakan mekanisme storage/backup terpisah.

Playlist dan user data berada di SQLite sehingga backup database harus menjadi prioritas.

Recommended backup:

```text
Daily SQLite backup
```

Retensi:

```text
7 daily
4 weekly
```

---

# 69. Database Backup Safety

Gunakan SQLite backup mechanism atau safe copy ketika memungkinkan.

Jangan mengandalkan:

```bash
cp music.db backup.db
```

saat database sedang aktif jika membutuhkan konsistensi penuh.

---

# 70. Docker Deployment

Docker adalah metode deployment untuk production/public.

Contoh:

```text
Dockerfile
docker-compose.yml
Caddyfile
```

Application container:

```yaml
services:
  joydm:
    build: .
    volumes:
      - ./data:/data
      - ./music-library:/music-library:ro
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/music.db
      - MUSIC_LIBRARY_PATH=/music-library
```

Development lokal tidak perlu Docker.

# 71. Docker Resource Limits

Contoh deployment public:

```yaml
services:
  joydm:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
```

Application harus tetap usable dengan resource tersebut untuk penggunaan personal/small user base.

# 72. Container Healthcheck

Docker healthcheck:

```text
GET /health
```

Interval:

```text
30s
```

---

# 73. Configuration

Gunakan environment variables.

Contoh:

```env
APP_ENV=production
APP_PORT=8080

DATABASE_PATH=/data/music.db
MUSIC_LIBRARY_PATH=/music-library

SESSION_SECRET=change-me

LOG_LEVEL=info
```

Jangan hardcode:

- Password.
- Secret.
- Library path.
- Port.
- Credentials.

---

# 74. Configuration File

Optional:

```text
config.yaml
```

Namun environment variable tetap menjadi prioritas untuk deployment container.

---

# 75. Initial Setup

Saat pertama kali dijalankan:

```text
1. Create SQLite database
2. Run migrations
3. Create default admin
4. Create empty music library
5. Start HTTP server
6. Show setup page
```

Setup wizard:

```text
Welcome
   ↓
Create Admin
   ↓
Music Library Path
   ↓
Scan Library
   ↓
Ready
```

---

# 76. Empty Library State

Jika tidak ada musik:

UI harus menampilkan:

```text
Your music library is empty.

Add your music files to:

/music-library/

Then click "Scan Library".
```

Admin mendapatkan tombol:

```text
Scan Library
```

---

# 77. File Naming

Aplikasi tidak boleh mewajibkan format folder tertentu.

Tetapi struktur yang direkomendasikan:

```text
Artist/
  Album/
    Track.mp3
```

Metadata file tetap menjadi source utama.

---

# 78. Duplicate Detection

Scanner harus dapat mendeteksi kemungkinan duplicate.

Duplicate criteria:

```text
Same path
```

atau:

```text
Same metadata + same file size
```

Optional future:

```text
Audio fingerprinting
```

Tidak diperlukan untuk MVP.

---

# 79. Error Handling

Jika satu file rusak:

```text
Scanner skips file
+
logs error
+
continues scanning
```

Jangan membuat seluruh scan gagal karena satu file.

Contoh:

```text
12,421 files scanned
12,418 indexed
3 skipped
```

---

# 80. Unsupported File

File yang tidak didukung:

```text
.txt
.pdf
.zip
.exe
```

harus diabaikan.

Scanner hanya membaca supported audio extensions.

---

# 81. File Permission

Application process harus memiliki:

```text
Read
```

permission terhadap music library.

Tidak diperlukan:

```text
Write
```

untuk music library pada MVP.

Ini meningkatkan security.

---

# 82. Admin File Management

MVP **tidak perlu menyediakan file manager web**.

Musik dimasukkan melalui:

- SSH.
- SMB.
- NAS.
- File copy.
- Existing storage management.

Admin hanya melakukan:

```text
Scan Library
```

setelah file ditambahkan.

---

# 83. Avoid Unnecessary Transcoding

Transcoding membutuhkan:

- CPU.
- RAM.
- Temporary storage.
- Additional latency.

MVP harus menghindarinya.

Jika suatu saat diperlukan:

```text
Optional Transcoding Service
```

dapat ditambahkan sebagai modul terpisah.

---

# 84. Optional Transcoding Architecture

Future:

```text
Browser
   |
   v
Node.js API
   |
   +--> Native Stream
   |
   +--> Transcoding Worker
            |
            v
          FFmpeg
```

Transcoding hanya aktif jika:

```text
Browser does not support source format
```

atau user memilih kualitas tertentu.

---

# 85. Scalability

Target MVP:

```text
1–20 concurrent users
```

dengan low-resource server.

Architecture harus memungkinkan peningkatan ke:

```text
20–100 concurrent users
```

dengan peningkatan hardware tanpa perubahan besar.

---

# 86. Streaming Concurrency

Streaming harus menggunakan OS file descriptor dan HTTP streaming.

Tidak boleh:

```text
Load complete file into memory.
```

Contoh:

```text
100 MB song
10 users
```

tidak boleh menyebabkan:

```text
~1 GB RAM usage
```

karena file streaming.

---

# 87. Performance Targets

Target:

### Initial page load

```text
< 1 second
```

pada LAN dengan server normal.

### API response

Typical:

```text
< 100 ms
```

untuk cached/simple metadata query.

### Start playback

Target:

```text
< 500 ms – 1 second
```

setelah browser memiliki akses ke file.

Actual performance bergantung pada network, storage, browser, dan file format.

---

# 88. Database Performance

SQLite indexes harus dibuat untuk:

```text
tracks.title
tracks.artist_id
tracks.album_id
tracks.genre_id
artists.name
albums.title
playlist_tracks.playlist_id
favorites.user_id
playback_history.user_id
```

---

# 89. Pagination

Library dengan banyak track tidak boleh mengirim seluruh database dalam satu response.

Contoh:

```http
GET /api/tracks?page=1&limit=50
```

Default:

```text
50 tracks/page
```

Maximum:

```text
200 tracks/request
```

---

# 90. Infinite Scroll

Frontend dapat menggunakan:

```text
Infinite scrolling
```

atau pagination.

Infinite scrolling direkomendasikan untuk mobile.

---

# 91. Search Optimization

Untuk library kecil:

```text
SQLite LIKE
```

Untuk library besar:

```text
SQLite FTS5
```

FTS5 dapat ditambahkan setelah kebutuhan meningkat.

---

# 92. API Pagination Response

Contoh:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 12450,
      "total_pages": 249
    }
  }
}
```

---

# 93. Error Pages

Minimal:

```text
401 Unauthorized
403 Forbidden
404 Not Found
429 Too Many Requests
500 Internal Server Error
```

UI harus menampilkan error yang friendly.

---

# 94. Offline Behavior

Full offline playback bukan MVP requirement.

Namun UI shell dapat menggunakan service worker pada future release.

Optional future:

```text
PWA
```

---

# 95. PWA Future

Potential features:

- Install to home screen.
- Offline UI.
- Media session integration.
- Background playback support.
- Mobile lock-screen controls.

---

# 96. Media Session API

Recommended future/MVP enhancement.

Browser Media Session API digunakan agar:

- Lock screen menampilkan song.
- Play/pause button bekerja.
- Previous/next bekerja.
- Headset controls bekerja.

Metadata:

```text
title
artist
album
artwork
```

---

# 97. Browser Compatibility

Target:

- Chrome.
- Edge.
- Firefox.
- Safari.
- Mobile Safari.
- Android Chrome.

Prioritas:

```text
Chrome/Edge
Safari
Firefox
```

---

# 98. Accessibility

Minimum:

- Keyboard navigation.
- Visible focus state.
- Semantic HTML.
- ARIA labels untuk icon-only buttons.
- Sufficient contrast.
- Screen reader-friendly controls.
- Play button harus memiliki accessible label.

---

# 99. Internationalization

MVP dapat menggunakan:

```text
English
```

atau:

```text
Indonesian
```

Text UI sebaiknya dipisahkan dari source code agar mudah diterjemahkan.

Future:

```text
i18n
```

---

# 100. Theme

MVP:

```text
Dark mode
Light mode
```

Default:

```text
Dark
```

Preference disimpan di:

```text
localStorage
```

---

# 101. JoyDM State

Client-side state:

```text
currentTrack
queue
currentIndex
isPlaying
volume
muted
shuffle
repeatMode
currentTime
duration
```

State yang perlu persistent:

```text
volume
theme
queue
lastTrack
lastPosition
```

---

# 102. Repeat Modes

Support:

```text
Off
Repeat All
Repeat One
```

---

# 103. Shuffle

Shuffle harus mengacak queue tanpa kehilangan original ordering secara permanen.

Contoh:

```text
Original:
A B C D

Shuffle:
C A D B
```

Ketika shuffle dimatikan, sistem dapat kembali ke ordering normal.

---

# 104. Mini Player

Saat user berpindah halaman:

```text
Home
Songs
Albums
Artists
```

player tetap aktif.

Audio tidak boleh restart hanya karena route/content berubah.

---

# 105. Fullscreen Player

Mobile/desktop:

```text
Artwork
Song
Artist
Progress
Controls
Queue
```

Full-screen player harus memiliki:

```text
Back
Favorite
Share optional
```

---

# 106. URL Routing

Frontend routes:

```text
/
 /songs
 /artists
 /artists/:id
 /albums
 /albums/:id
 /playlists
 /playlists/:id
 /favorites
 /settings
 /admin
```

Backend API tetap:

```text
/api/*
```

---

# 107. SEO

SEO bukan prioritas karena aplikasi bersifat private/self-hosted.

Namun basic:

```html
<title>
<meta name="description">
```

dapat disediakan.

---

# 108. Privacy

Aplikasi harus bersifat private by default.

Tidak ada:

- Analytics pihak ketiga.
- Tracking user.
- Advertising.
- External telemetry.

Optional self-hosted telemetry dapat ditambahkan di masa depan.

---

# 109. External Dependencies

Production runtime harus seminimal mungkin.

Ideal:

```text
Caddy
Node.js application
SQLite
Filesystem
```

Tidak wajib:

```text
Redis
PostgreSQL
Elasticsearch
RabbitMQ
Node
Python
```

---

# 110. Dependency Policy

Backend dependency harus:

- Mature.
- Actively maintained.
- Small.
- Well-tested.
- MIT/BSD/Apache compatible jika memungkinkan.

Hindari dependency yang hanya digunakan untuk satu fitur kecil jika fitur tersebut dapat dibuat menggunakan standard library.

---

# 111. Node.js Package Structure

Recommended:

```text
/cmd/server
/internal/auth
/internal/api
/internal/library
/internal/indexer
/internal/player
/internal/playlist
/internal/database
/internal/config
/internal/cache
/internal/middleware
/internal/models
/web
/migrations
```

---

# 112. Separation of Concerns

System harus memisahkan:

```text
HTTP Layer
    |
Service Layer
    |
Repository Layer
    |
SQLite
```

Music streaming:

```text
HTTP
 |
Streaming Service
 |
Filesystem
```

---

# 113. Repository Pattern

Database access harus melalui repository/service layer.

Jangan menyebarkan SQL ke seluruh HTTP handler.

---

# 114. Migration System

Database migration harus versioned.

Contoh:

```text
001_initial.sql
002_add_playback_history.sql
003_add_fts.sql
```

Application menjalankan migration otomatis saat startup.

---

# 115. Graceful Shutdown

Server harus mendukung:

```text
SIGTERM
SIGINT
```

Flow:

```text
Stop accepting new requests
        ↓
Finish active requests
        ↓
Close DB
        ↓
Exit
```

---

# 116. Concurrent Scanning

Hindari scanning terlalu agresif.

Scanner harus membatasi concurrency.

Contoh:

```text
2–4 workers
```

tergantung hardware.

Tujuan:

- Tidak membebani disk.
- Tidak membuat CPU spike.
- Tidak mengganggu streaming.

---

# 117. Scan Priority

Streaming playback harus memiliki prioritas lebih tinggi daripada background scan.

Jika server sedang memutar banyak lagu:

```text
Scanner should slow down
```

bukan menyebabkan playback terganggu.

---

# 118. Cache Strategy

Cache yang disarankan:

### Metadata

SQLite adalah source of truth.

### Artwork

Filesystem cache.

### API

Browser HTTP cache untuk data yang aman.

Tidak diperlukan Redis.

---

# 119. CDN

Tidak diperlukan.

Karena aplikasi self-hosted dan audio berasal dari local storage/NAS.

CDN hanya relevan jika deployment berkembang menjadi public/global streaming service.

---

# 120. Network Optimization

Gunakan:

- HTTP/2.
- Keep-alive.
- TLS session reuse.
- Gzip/Brotli untuk text assets.
- Range streaming untuk audio.

Jangan compress audio:

```text
MP3
FLAC
AAC
```

karena sudah compressed atau lossless encoded dan compression tambahan tidak memberikan manfaat berarti.

---

# 121. Security Headers

Caddy/application dapat memberikan:

```text
X-Content-Type-Options: nosniff
Content-Security-Policy
Referrer-Policy
Permissions-Policy
```

dan header security lain yang relevan.

---

# 122. Content Security Policy

CSP harus membatasi resource hanya dari domain aplikasi jika memungkinkan.

Contoh konsep:

```text
default-src 'self'
```

Tidak boleh membuka:

```text
*
```

tanpa alasan.

---

# 123. CSRF Protection

Karena authentication menggunakan cookie:

State-changing endpoint harus dilindungi dari CSRF.

Alternative architecture:

```text
Bearer token
```

dapat dipertimbangkan untuk API tertentu.

---

# 124. Session Management

Session harus memiliki:

```text
Secure
HttpOnly
SameSite
Expiration
```

Logout harus invalidate session.

---

# 125. Password Policy

Minimum:

```text
8 characters
```

Recommended:

```text
12+ characters
```

Tidak perlu memaksakan kompleksitas berlebihan jika password manager digunakan.

---

# 126. Admin First Run

Default admin password tidak boleh hardcoded.

Setup harus meminta:

```text
Username
Password
Confirm Password
```

---

# 127. Import Existing Library

Jika user sudah memiliki library:

```text
Mount existing folder
```

Kemudian:

```text
Scan Library
```

Aplikasi tidak mengubah file original.

---

# 128. Read-Only Music Library

Default mount:

```text
read-only
```

Jika Docker:

```yaml
- ./music-library:/music-library:ro
```

Ini sangat direkomendasikan untuk security.

---

# 129. File Integrity

Aplikasi tidak boleh:

- Rename music files.
- Delete music files.
- Modify music files.

MVP hanya:

```text
Read
Index
Stream
```

---

# 130. Admin Library Refresh

Admin dapat menjalankan:

```text
Scan Library
```

Jika file dihapus dari filesystem:

```text
DB record -> marked missing
```

dan kemudian dapat dibersihkan.

---

# 131. Missing File Handling

Jika database memiliki track tetapi file tidak ditemukan:

UI:

```text
File unavailable
```

Track tidak boleh menyebabkan player crash.

Optional:

```text
Cleanup Missing Tracks
```

---

# 132. System Status

Admin dashboard:

```text
Application
Version
Uptime
CPU
Memory
Disk
Database
Library
```

---

# 133. Metrics

Optional lightweight metrics:

```text
active_streams
total_tracks
scan_duration
scan_errors
http_requests
```

Prometheus bukan requirement MVP.

Jika ditambahkan, endpoint:

```text
/metrics
```

---

# 134. Observability

MVP:

```text
Structured logs
Health endpoint
Admin system status
```

Future:

```text
Prometheus
Grafana
OpenTelemetry
```

Tidak diperlukan untuk deployment kecil.

---

# 135. Testing Strategy

## Unit Test

Test:

- Authentication.
- Password hashing.
- Metadata parser.
- Scanner.
- Path validation.
- Playlist logic.
- Search.
- Pagination.

## Integration Test

Test:

- SQLite.
- API.
- Authentication.
- Streaming.
- Range request.

## Browser Test

Test:

- Play.
- Pause.
- Seek.
- Next.
- Queue.
- Mobile UI.

---

# 136. Streaming Test Cases

Test:

```text
GET full file
GET Range bytes=0-1024
GET Range middle of file
HEAD request
Invalid track
Unauthorized request
Missing file
Unsupported format
```

Expected:

```text
206 Partial Content
```

untuk valid range requests.

---

# 137. Load Testing

Test scenario:

```text
10 concurrent streams
20 concurrent streams
50 concurrent streams
```

Metrics:

- CPU.
- RAM.
- Disk I/O.
- Network throughput.
- Response latency.
- Playback interruptions.

---

# 138. Acceptance Criteria — Library

System dianggap berhasil jika:

- Empty library dapat dijalankan.
- File musik dapat dimasukkan secara manual.
- Scan menemukan file baru.
- Metadata berhasil dibaca.
- Deleted files terdeteksi.
- Duplicate tidak membuat record tidak terkendali.
- File original tidak dimodifikasi.

---

# 139. Acceptance Criteria — Player

Player berhasil jika:

- Lagu dapat dimainkan.
- Pause bekerja.
- Seek bekerja.
- Next/previous bekerja.
- Queue bekerja.
- Shuffle bekerja.
- Repeat bekerja.
- Volume bekerja.
- Mobile playback bekerja.
- Playback tidak terputus ketika berpindah halaman.

---

# 140. Acceptance Criteria — Streaming

Streaming berhasil jika:

- Server tidak membaca seluruh file ke RAM.
- Range request didukung.
- Seek bekerja.
- Content-Type benar.
- Content-Length benar.
- File besar dapat diputar.
- Multiple users dapat streaming secara bersamaan.

---

# 141. Acceptance Criteria — Performance

Pada server:

```text
1 vCPU
512 MB RAM
```

aplikasi harus:

- Start dengan cepat.
- Menggunakan memory secara stabil.
- Tidak membutuhkan database server eksternal.
- Tidak membutuhkan Node.js/Python runtime.
- Tetap dapat streaming audio.

---

# 142. Acceptance Criteria — Security

Harus:

- Tidak ada path traversal.
- Password tidak plaintext.
- HTTPS supported.
- Unauthorized user tidak dapat mengakses private library.
- Admin API protected.
- Music directory tidak writable oleh aplikasi.
- Secret tidak berada di source code.

---

# 143. MVP Scope

MVP harus mencakup:

### Backend

- Node.js server.
- SQLite.
- Authentication.
- Library scanner.
- Metadata indexing.
- Streaming.
- REST API.

### Frontend

- Dashboard.
- Songs.
- Artists.
- Albums.
- Search.
- Playlist.
- Favorites.
- Player.
- Queue.
- Responsive UI.

### Deployment

- Dockerfile.
- Docker Compose.
- Caddy configuration.
- Environment configuration.
- Empty music library.

---

# 144. Phase 2

Setelah MVP stabil:

- PWA.
- Media Session API.
- Scheduled library scan.
- Better search with FTS5.
- Smart playlists.
- Lyrics.
- Album artist handling.
- Multiple libraries.
- User profile.
- More advanced statistics.

---

# 145. Phase 3

Optional:

- FFmpeg transcoding.
- Audio quality selection.
- Download/offline mode.
- Mobile app wrapper.
- Android/iOS app.
- Chromecast.
- AirPlay.
- External authentication.
- LDAP/SSO.
- Multi-server library.

---

# 146. Future Multi-Library

Architecture dapat dikembangkan menjadi:

```text
Libraries
--------------------
Music
Audiobooks
Podcasts
```

Each library memiliki:

```text
library_id
path
type
```

Namun fitur ini tidak diperlukan pada MVP.

---

# 147. Future Audiobook Support

Jika dikembangkan:

- Chapter.
- Resume position.
- Playback speed.
- Bookmark.
- Sleep timer.

---

# 148. Future Podcast Support

Jika dikembangkan:

- RSS feeds.
- Episode metadata.
- Download.
- Auto refresh.

Tidak termasuk MVP.

---

# 149. Future Lyrics

Possible source:

- Embedded lyrics.
- Local `.lrc`.
- User-provided lyrics.

LRC support:

```text
[00:12.50] Lyric line
```

---

# 150. Future Equalizer

Equalizer dapat menggunakan Web Audio API.

Namun tidak menjadi MVP karena:

- Lebih kompleks.
- Browser compatibility.
- Additional CPU.
- Tidak dibutuhkan untuk core music streaming.

---

# 151. Future Audio Transcoding

FFmpeg dapat menjadi optional dependency.

Supported output:

```text
MP3
AAC
Opus
```

Transcoding hanya dilakukan on-demand.

Cache hasil transcoding jika diperlukan.

---

# 152. Future Download

Jika fitur download ditambahkan:

```text
Download original
```

harus mengikuti permission user.

Admin dapat mengaktifkan:

```text
ALLOW_DOWNLOAD=true
```

Default:

```text
false
```

---

# 153. Future Sharing

Potential:

```text
Share playlist
Share album
Share track
```

Private share token:

```text
/share/{token}
```

Harus memiliki expiration dan permission.

---

# 154. Recommended Repository Structure

```text
joydm/
│
├── src/
│   ├── server.js
│   ├── app.js
│   ├── config/
│   ├── api/
│   ├── auth/
│   ├── database/
│   ├── indexer/
│   ├── library/
│   ├── middleware/
│   ├── models/
│   ├── playlist/
│   ├── streaming/
│   └── utils/
│
├── migrations/
│   ├── 001_initial.sql
│   └── ...
│
├── web/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│
├── music-library/
│   └── .gitkeep
│
├── data/
│   └── .gitkeep
│
├── Dockerfile
├── docker-compose.yml
├── Caddyfile
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

# 155. Recommended Runtime Architecture

## Local

```text
                 Browser
                    |
                    v
             npm run dev
                    |
          +---------+---------+
          |                   |
          v                   v
     Vite Frontend       Node.js/Fastify
                              |
                       +------+------+
                       |             |
                       v             v
                    SQLite     Music Files
```

## Public

```text
                 Browser
                    |
                 HTTPS
                    |
                    v
                  Caddy
                    |
                    v
             Docker Container
                    |
              Node.js/Fastify
                    |
             +------+------+
             |             |
             v             v
          SQLite      Music Files
```

# 156. Why This Stack

## Node.js + Fastify

Dipilih karena:

- npm workflow sederhana.
- Development lokal sangat mudah.
- Fastify ringan dan cepat.
- Ecosystem Node.js mature.
- HTTP streaming dapat ditangani dengan baik.
- Production dapat dijalankan langsung atau melalui Docker.
- Tidak membutuhkan database server eksternal.

## SQLite

Dipilih karena:

- Zero configuration.
- Single file.
- Fast.
- Reliable.
- Easy backup.

## Vanilla JS + Vite

Dipilih karena:

- Frontend bundle tetap kecil.
- Vite mempercepat development.
- Tidak membutuhkan framework UI besar.
- Build production sederhana.

## Caddy

Dipilih untuk public deployment karena:

- Easy HTTPS.
- Simple configuration.
- Reliable reverse proxy.
- HTTP/2/3 support.

## Docker

Digunakan pada public deployment agar:

- Environment production konsisten.
- Deployment mudah dipindahkan.
- Dependency terisolasi.
- Upgrade/rollback lebih mudah.

# 157. Why Not a Heavier Backend Framework

Framework backend yang sangat besar tidak diperlukan untuk MVP karena JoyDM hanya membutuhkan:

```text
REST API
Authentication
SQLite
File indexing
HTTP streaming
```

Fastify menyediakan kebutuhan tersebut dengan overhead yang rendah.

# 158. Why Not React

React tidak diperlukan untuk MVP karena aplikasi music player ini dapat dibangun dengan:

```text
HTML
CSS
Vanilla JS
Vite
```

Pengurangan dependency frontend membantu menjaga initial load tetap cepat.

React dapat dipertimbangkan jika UI menjadi sangat kompleks.

# 159. Why Not PostgreSQL

PostgreSQL sangat bagus untuk aplikasi besar, tetapi untuk self-hosted personal/small deployment, SQLite sudah mencukupi dan menghilangkan satu service tambahan.

---

# 160. Why Not Redis

Tidak diperlukan karena:

- Queue dapat berada di browser.
- Session dapat menggunakan SQLite atau signed cookie.
- Metadata sudah disimpan SQLite.
- Artwork dapat dicache filesystem.
- Tidak ada kebutuhan caching terdistribusi pada MVP.

---

# 161. Critical Engineering Principles

Development harus mengikuti prinsip:

1. **Keep it simple.**
2. **Do not introduce infrastructure unless necessary.**
3. **Do not transcode unless required.**
4. **Do not load entire audio files into RAM.**
5. **Do not modify original music files.**
6. **Prefer standard library.**
7. **Keep database schema simple.**
8. **Keep frontend lightweight.**
9. **Security by default.**
10. **Performance should be measured, not assumed.**

---

# 162. Definition of Done

MVP dianggap selesai apabila:

- [ ] Server Node.js dapat dijalankan.
- [ ] SQLite otomatis dibuat.
- [ ] Admin dapat dibuat saat first run.
- [ ] Empty music library tersedia.
- [ ] Music folder dapat di-mount.
- [ ] Scanner dapat membaca library.
- [ ] Metadata tersimpan.
- [ ] Songs dapat ditampilkan.
- [ ] Artists dapat ditampilkan.
- [ ] Albums dapat ditampilkan.
- [ ] Search bekerja.
- [ ] Audio dapat dimainkan.
- [ ] Range request bekerja.
- [ ] Seek bekerja.
- [ ] Queue bekerja.
- [ ] Playlist bekerja.
- [ ] Favorites bekerja.
- [ ] Playback history bekerja.
- [ ] Responsive UI bekerja.
- [ ] Authentication bekerja.
- [ ] Authorization bekerja.
- [ ] Path traversal protection bekerja.
- [ ] Docker deployment bekerja.
- [ ] Caddy HTTPS configuration tersedia.
- [ ] Health endpoint tersedia.
- [ ] Backup database dapat dilakukan.
- [ ] Basic tests tersedia.
- [ ] Documentation tersedia.

---

# 163. Final Product Vision

Produk akhir harus terasa seperti:

> **"JoyDM — Spotify pribadi yang sangat ringan, self-hosted, tanpa iklan, tanpa tracking, dan menggunakan library musik milik sendiri."**

Namun secara teknis aplikasi tidak perlu meniru kompleksitas Spotify.

Fokus utama:

```text
Fast
+
Lightweight
+
Reliable
+
Private
+
Simple
+
Self-hosted
```

Arsitektur final yang direkomendasikan:

### Local Development

```text
npm
 +
Node.js + Fastify
 +
Vite + Vanilla JS
 +
SQLite
 +
Filesystem Music Library
```

### Public Production

```text
Caddy
 +
Docker
 +
Node.js + Fastify
 +
SQLite
 +
Filesystem Music Library
```

Dengan pendekatan ini, **JoyDM** dapat dikembangkan dan dijalankan secara lokal dengan workflow npm yang sederhana, kemudian dipindahkan ke deployment public menggunakan Docker tanpa mengubah arsitektur aplikasi secara fundamental.
