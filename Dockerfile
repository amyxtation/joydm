# ---- Stage 1: build the frontend -------------------------------------------
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY web ./web
RUN npm run build

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:24-alpine AS runtime
ENV APP_ENV=production \
    APP_PORT=8080 \
    DATABASE_PATH=/data/music.db \
    MUSIC_LIBRARY_PATH=/music-library \
    LOG_PATH=/logs

WORKDIR /app

# Only production dependencies end up in the image (PRD §110 / §157).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY --from=web /app/dist ./dist

RUN mkdir -p /data /music-library /logs && chown -R node:node /data /logs
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
