import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
await mkdir('../../public/experiments/teachable', { recursive: true });
await cp('public', '../../public/experiments/teachable', { recursive: true });
await build({ entryPoints: ['main.js'], bundle: true, outfile: '../../public/experiments/teachable/main.js', format: 'iife', target: 'es2020', minify: true });
