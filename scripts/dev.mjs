import { spawn } from 'node:child_process';
import process from 'node:process';
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3001', PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:5173' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill()); process.exitCode = code; }
for (const child of children) { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => stop(code || 0)); }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
