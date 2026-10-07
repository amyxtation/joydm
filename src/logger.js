import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

const stream = fs.createWriteStream(path.join(config.logPath, 'joydm.log'), { flags: 'a' });

/** Never log secrets — PRD §66. */
function redact(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = Array.isArray(value) ? [] : {};
  for (const [key, val] of Object.entries(value)) {
    if (/password|secret|token|cookie|authorization/i.test(key)) clone[key] = '[redacted]';
    else if (val && typeof val === 'object') clone[key] = redact(val);
    else clone[key] = val;
  }
  return clone;
}

function write(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const entry = { time: new Date().toISOString(), level, message, ...(meta ? { meta: redact(meta) } : {}) };
  const line = JSON.stringify(entry);
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line);
  stream.write(`${line}\n`);
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};
