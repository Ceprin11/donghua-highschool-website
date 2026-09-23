import { cp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const selected = process.argv.slice(2);
const wants = name => !selected.length || selected.includes(name);
async function clearOutput(name) {
  const parent = path.join(root, 'public', 'experiments');
  const target = path.resolve(parent, name);
  if (path.dirname(target) !== parent || !['cnn-explainer','tensorspace','transformer','teachable'].includes(name)) throw new Error('Invalid generated output directory');
  await rm(target, {recursive:true,force:true});
}
async function copy(from, to) {
  await mkdir(path.dirname(path.join(root, to)), { recursive: true });
  await cp(path.join(root, from), path.join(root, to), { recursive: true });
}
async function externalizeScripts(file) {
  const target = path.join(root, file);
  let html = await readFile(target, 'utf8');
  let index = 0;
  const writes = [];
  html = html.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g, (tag, attributes, code) => {
    if (!code.trim() || attributes.includes('application/json')) return tag;
    const name = `runtime-${++index}.js`;
    writes.push(writeFile(path.join(path.dirname(target), name), code));
    return `<script${attributes} src="./${name}"></script>`;
  });
  await Promise.all(writes);
  await writeFile(target, html);
}
function build(name) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: path.join(root, 'vendor', name), stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`${name} 构建失败`);
}

if (wants('cnn')) {
  build('cnn-explainer');
  await clearOutput('cnn-explainer');
  const dest = 'public/experiments/cnn-explainer';
  await copy('vendor/cnn-explainer/public', dest);
  const assets = {
    'd3/dist/d3.min.js': 'd3.min.js',
    'bulma/css/bulma.min.css': 'bulma.min.css',
    '@tensorflow/tfjs/dist/tf.min.js': 'tf.min.js',
    '@fortawesome/fontawesome-free/js/all.min.js': 'fontawesome.min.js',
    'smooth-scroll/dist/smooth-scroll.polyfills.min.js': 'smooth-scroll.min.js',
    'mathjax/es5': 'mathjax',
    '@fontsource/neucha': 'neucha',
  };
  for (const [from, to] of Object.entries(assets)) await copy(`vendor/cnn-explainer/node_modules/${from}`, `${dest}/lib/${to}`);
  await copy('vendor/cnn-explainer/LICENSE', `${dest}/LICENSE.txt`);
}
if (wants('tensorspace')) {
  await clearOutput('tensorspace');
  for (const folder of ['lib', 'lenet']) await copy(`vendor/tensorspace/examples/${folder}`, `public/experiments/tensorspace/examples/${folder}`);
  await copy('vendor/tensorspace/dist/tensorspace.js', 'public/experiments/tensorspace/dist/tensorspace.js');
  await copy('vendor/tensorspace/LICENSE', 'public/experiments/tensorspace/LICENSE.txt');
  await externalizeScripts('public/experiments/tensorspace/examples/lenet/lenet.html');
}
if (wants('transformer')) {
  const sizes = await Promise.all(Array.from({length:63}, async (_, i) => (await stat(path.join(root, `vendor/transformer-explainer/static/model-v2/gpt2.onnx.part${i}`))).size));
  await writeFile(path.join(root, 'vendor/transformer-explainer/static/model-v2/manifest.json'), JSON.stringify({sizes}));
  build('transformer-explainer');
  await clearOutput('transformer');
  await copy('vendor/transformer-explainer/build', 'public/experiments/transformer');
  for (const file of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']) {
    await copy(`vendor/transformer-explainer/node_modules/onnxruntime-web/dist/${file}`, `public/experiments/transformer/wasm/${file}`);
  }
  await copy('vendor/transformer-explainer/LICENSE', 'public/experiments/transformer/LICENSE.txt');
  await copy('vendor/transformer-explainer/node_modules/@fontsource/jersey-10/LICENSE', 'public/experiments/transformer/JERSEY-FONT-LICENSE.txt');
  await externalizeScripts('public/experiments/transformer/index.html');
}
if (wants('teachable')) {
  await clearOutput('teachable');
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','build'], { cwd: path.join(root,'apps/teachable'), stdio:'inherit', shell:process.platform==='win32' });
  if(result.status !== 0) throw new Error('姿势训练构建失败');
}
console.log('实验子应用资源已生成。');
