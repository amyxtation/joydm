#!/usr/bin/env node
/**
 * Runs the API server and the Vite dev server together (`npm run dev`).
 * Dependency-free: spawns Node for the API and Vite's own CLI for the frontend.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [];
let shuttingDown = false;

function start(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = label.padEnd(6);
  const forward = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) target.write(`[${prefix}] ${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    process.stdout.write(`[${prefix}] exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write('JoyDM dev: API on http://localhost:8080, web on http://localhost:5173\n');

start('api', process.execPath, ['--watch', path.join(root, 'src', 'server.js')]);
start('web', process.execPath, [viteBin, '--port', '5173']);
