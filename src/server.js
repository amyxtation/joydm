import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase, closeDatabase } from './database/index.js';
import { purgeExpiredSessions } from './auth/sessions.js';
import { runScan } from './indexer/scanner.js';

initDatabase();

const purged = purgeExpiredSessions();
if (purged) logger.info('purged expired sessions', { count: purged });

const app = await buildApp();

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  logger.error('failed to start server', { error: error.message });
  process.exit(1);
}

logger.info('JoyDM listening', {
  url: `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`,
  env: config.env,
  library: config.libraryPath,
  private: config.privateMode,
});

if (config.scanOnStartup) {
  runScan({ reason: 'startup' }).catch((error) => logger.error('startup scan failed', { error: error.message }));
}

/** Graceful shutdown: stop accepting requests, close DB, exit (PRD §115). */
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });

  const timer = setTimeout(() => {
    logger.warn('forced exit after shutdown timeout');
    process.exit(1);
  }, 10_000);
  timer.unref();

  try {
    await app.close();
    closeDatabase();
    logger.info('shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('shutdown error', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('unhandled rejection', { reason: String(reason) }));
process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});
