import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
async function download(url, file) {
  const target = path.join(root, file);
  try { if ((await stat(target)).size > 0) return; } catch { /* Missing resources are downloaded below. */ }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(file);
}
const tokenizerBase = 'https://huggingface.co/Xenova/gpt2/resolve/bf2c7f02e0b826c60d03af341171bde20893da66';
for (const file of ['tokenizer.json', 'tokenizer_config.json', 'config.json']) {
  await download(`${tokenizerBase}/${file}`, `vendor/transformer-explainer/static/tokenizers/Xenova/gpt2/${file}`);
}
const poseBase = 'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075';
const dest = 'apps/teachable/public/pose-model';
await download(`${poseBase}/model-stride16.json`, `${dest}/model.json`);
const model = JSON.parse(await readFile(path.join(root, dest, 'model.json'), 'utf8'));
for (const file of new Set(model.weightsManifest.flatMap(group => group.paths))) await download(`${poseBase}/${file}`, `${dest}/${file}`);
await download('https://raw.githubusercontent.com/tensorflow/tfjs-models/6a9a5e8a7f50421ff6310bd1db566b5929ba1ec3/pose-detection/test_data/pose_squats.mp4', 'apps/teachable/public/pose-samples/squats.mp4');
