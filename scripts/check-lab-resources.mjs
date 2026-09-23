import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'../public/experiments');
async function exists(file) { const info=await stat(path.join(root,file)).catch(()=>null); if(!info?.isFile() || !info.size) throw new Error(`缺少实验资源 ${file}。运行 npm run labs:prepare 和 npm run labs:build。`); }
async function model(file) {
  await exists(file); const json=JSON.parse(await readFile(path.join(root,file),'utf8'));
  for(const group of json.weightsManifest) for(const shard of group.paths) await exists(path.posix.join(path.posix.dirname(file),shard));
}
for(const file of ['cnn-explainer/index.html','cnn-explainer/bundle.js','cnn-explainer/lib/tf.min.js','tensorspace/examples/lenet/lenet.html','teachable/index.html','teachable/main.js','transformer/index.html','transformer/runtime-1.js','transformer/tokenizers/Xenova/gpt2/tokenizer.json','transformer/wasm/ort-wasm-simd-threaded.wasm']) await exists(file);
await model('cnn-explainer/assets/data/model.json');await model('tensorspace/examples/lenet/lenetModel/mnist.json');await model('teachable/pose-model/model.json');
await exists('teachable/pose-samples/squats.mp4');
for(let index=0;index<63;index++) await exists(`transformer/model-v2/gpt2.onnx.part${index}`);
await exists('transformer/model-v2/manifest.json');
const {sizes} = JSON.parse(await readFile(path.join(root,'transformer/model-v2/manifest.json'),'utf8'));
if(sizes.length !== 63) throw new Error('Transformer 分片清单数量不正确');
for(let index=0;index<63;index++) if((await stat(path.join(root,`transformer/model-v2/gpt2.onnx.part${index}`))).size !== sizes[index]) throw new Error(`Transformer 分片 ${index} 长度不完整`);
console.log('实验入口、权重分片、分词器、姿势样本与 WASM 文件齐全。');
