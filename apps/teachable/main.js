import { createTeachable } from './pose-upstream/teachable-posenet';
import * as tf from '@tensorflow/tfjs';

const $ = id => document.getElementById(id);
const colors = ['#d18a29','#af67c2','#47a795','#548ac2','#d36d78','#8c9b43','#897bd0','#679ca3'];
let nextId=0;
const makeClass=()=>({id:++nextId,name:'类别 '+nextId,samples:[]});
let classes=[makeClass(),makeClass()];
let model=null,modelPromise=null,busy=false,trained=false,stopped=false,disposed=false,revision=0;
let stream=null,cameraRequest=0,cameraTimer=null,holding=null,captureRunning=false;
let previewSample=null,operation=Promise.resolve(),activeClass=null;
const status=text=>{if(!disposed)$('status').textContent=text;};
function invalidate() {
  revision++;trained=false;$('export').disabled=true;$('probabilities').replaceChildren();
  $('preview-help').textContent='样本变化后，重新训练再测试。';
  status('样本已更新，请训练模型');
}
function setBusy(value) {
  busy=value;
  for(const id of ['examples','add-class','clear-all','epochs','batch','learning-rate','test-image'])$(id).disabled=value;
  $('stop-training').hidden=!value||$('progress').hidden;
  renderClasses();
}
function renderClasses() {
  if(disposed)return;
  $('classes').replaceChildren();
  classes.forEach((item,index)=>{
    const card=document.createElement('article');card.className='card class-card';card.dataset.classId=item.id;
    const header=document.createElement('div');header.className='class-header';
    const name=document.createElement('input');name.value=item.name;name.maxLength=40;name.disabled=busy;name.setAttribute('aria-label','类别 '+item.id+' 名称');
    name.onchange=()=>{item.name=name.value.trim()||'类别 '+item.id;name.value=item.name;invalidate();renderClasses();};
    const remove=document.createElement('button');remove.textContent='删除类别';remove.disabled=busy||classes.length<=2;
    remove.onclick=()=>{classes=classes.filter(c=>c!==item);if(activeClass===item)activeClass=null;invalidate();renderClasses();};
    header.append(name,remove);
    const body=document.createElement('div');body.className='class-body';
    const count=document.createElement('p');count.className='sample-label';count.textContent=item.samples.length?'姿势样本 · '+item.samples.length+' 个':'添加姿势样本';
    const actions=document.createElement('div');actions.className='class-actions';
    const camera=document.createElement('button');camera.className='source-button';camera.disabled=busy;
    camera.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="12" height="14" rx="2"/><path d="m15 9 6-3v12l-6-3"/></svg>摄像头';
    camera.onclick=()=>{activeClass=item;startCamera();};
    const upload=document.createElement('label');upload.className='file-button';
    upload.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></svg>上传图片';
    const file=document.createElement('input');file.type='file';file.accept='image/*';file.multiple=true;file.hidden=true;file.disabled=busy;
    file.setAttribute('aria-label','上传 '+item.name+' 姿势图片');
    file.onchange=()=>uploadSamples(item,Array.from(file.files));upload.append(file);actions.append(camera,upload);
    const captures=document.createElement('div');captures.className='capture-controls';captures.hidden=!stream;
    const once=document.createElement('button');once.textContent='拍一张';once.disabled=busy||!stream;once.onclick=()=>capture(item);
    const hold=document.createElement('button');hold.textContent='按住录制姿势';hold.className='hold';hold.disabled=busy||!stream;
    hold.onpointerdown=event=>{event.preventDefault();hold.setPointerCapture(event.pointerId);holding=item;hold.textContent='正在录制…';captureHeld();};
    hold.onpointerup=hold.onpointercancel=()=>{holding=null;hold.textContent='按住录制姿势';renderClasses();};
    captures.append(once,hold);
    const grid=document.createElement('div');grid.className='sample-grid';
    item.samples.forEach((sample,sampleIndex)=>{
      const cell=document.createElement('div');cell.className='sample';
      const image=new Image();image.src=sample.thumbnail;image.alt=item.name+' 姿势样本 '+(sampleIndex+1);
      image.onclick=()=>{previewSample=sample;showSample(sample,colors[index]);if(trained&&!stream)predict(sample);};
      const del=document.createElement('button');del.textContent='×';del.disabled=busy;del.setAttribute('aria-label','删除 '+item.name+' 样本 '+(sampleIndex+1));
      del.onclick=()=>{item.samples.splice(sampleIndex,1);invalidate();renderClasses();};
      cell.append(image,del);grid.append(cell);
    });
    body.append(count,actions,captures,grid);card.append(header,body);$('classes').append(card);
  });
  $('add-class').disabled=busy||classes.length>=8;
  $('train').disabled=busy||classes.some(c=>c.samples.length<5);
}
async function ensureModel() {
  if(model)return model;
  if(!modelPromise)modelPromise=createTeachable({labels:[],modelSettings:{posenet:{architecture:'MobileNetV1',outputStride:16,inputResolution:257,multiplier:.75,modelUrl:'./pose-model/model.json'}}})
    .then(value=>{if(disposed){value.dispose();throw new Error('页面已关闭');}model=value;return value;})
    .finally(()=>{modelPromise=null;});
  return modelPromise;
}
function snapshot(source) {
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(!width||!height)throw new Error('画面尚未准备好');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=257;
  const ctx=canvas.getContext('2d'),scale=Math.min(257/width,257/height);
  ctx.fillStyle='#edf0f4';ctx.fillRect(0,0,257,257);
  ctx.drawImage(source,(257-width*scale)/2,(257-height*scale)/2,width*scale,height*scale);
  return canvas;
}
const edges=[[5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16]];
function drawPose(ctx,pose,color='#19b6b0') {
  if(!pose)return;
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;
  for(const [a,b]of edges){const p=pose.keypoints[a],q=pose.keypoints[b];if(p.score<.3||q.score<.3)continue;ctx.beginPath();ctx.moveTo(p.position.x,p.position.y);ctx.lineTo(q.position.x,q.position.y);ctx.stroke();}
  for(const point of pose.keypoints){if(point.score<.3)continue;ctx.beginPath();ctx.arc(point.position.x,point.position.y,2.5,0,Math.PI*2);ctx.fill();}
}
function showSample(sample,color) {
  const ctx=$('preview').getContext('2d');ctx.drawImage(sample.canvas,0,0);drawPose(ctx,sample.pose,color);
  $('preview').hidden=false;$('preview-empty').hidden=true;
}
function analyze(canvas) {
  const task=operation.then(async()=>{
    const current=await ensureModel();
    if(disposed)return null;
    const {pose,posenetOutput}=await current.estimatePose(canvas);
    if(disposed)return null;
    if(!pose||pose.keypoints.filter(point=>point.score>=.3).length<5)return null;
    const thumb=document.createElement('canvas');thumb.width=thumb.height=257;
    const ctx=thumb.getContext('2d');ctx.drawImage(canvas,0,0);drawPose(ctx,pose);
    return {canvas,pose,features:posenetOutput,thumbnail:thumb.toDataURL('image/jpeg',.75)};
  });
  operation=task.catch(()=>{});
  return task;
}
async function predict(sample) {
  if(!trained||busy||disposed||!sample)return;
  const run=revision;
  try{
    const values=await model.predict(sample.features);
    if(disposed||busy||!trained||revision!==run)return;
    $('probabilities').replaceChildren();
    values.forEach((value,index)=>{
      const row=document.createElement('div');row.className='probability';row.style.setProperty('--class-color',colors[index]);
      const label=document.createElement('div'),name=document.createElement('span'),score=document.createElement('span');
      name.textContent=value.className;score.textContent=(value.probability*100).toFixed(1)+'%';label.append(name,score);
      const bar=document.createElement('progress');bar.max=1;bar.value=value.probability;row.append(label,bar);$('probabilities').append(row);
    });
  }catch(error){status('预测失败：'+error.message);}
}
async function capture(item) {
  if(busy||captureRunning||!stream||item.samples.length>=100)return;
  captureRunning=true;const run=cameraRequest;
  try{
    const sample=await analyze(snapshot($('video')));
    if(disposed||run!==cameraRequest||busy||!classes.includes(item))return;
    if(!sample){$('camera-status').textContent='未检测到清晰姿势，请让头部和身体进入画面';return;}
    item.samples.push(sample);previewSample=sample;showSample(sample);invalidate();
    $('camera-status').textContent='已采集 '+item.name+' · '+item.samples.length+' 个姿势';
    if(!holding)renderClasses();
    else {const label=document.querySelector('[data-class-id="'+item.id+'"] .sample-label');if(label)label.textContent='姿势样本 · '+item.samples.length+' 个';}
  }catch(error){if(!disposed)$('camera-status').textContent='采样失败：'+error.message;}
  finally{captureRunning=false;}
}
async function captureHeld() {
  const item=holding;if(!item||disposed)return;
  await capture(item);
  if(holding===item&&stream&&!busy)setTimeout(captureHeld,160);
}
async function cameraLoop(run) {
  if(disposed||!stream||run!==cameraRequest)return;
  try{
    if(!busy&&!captureRunning&&!holding) {
      const sample=await analyze(snapshot($('video')));
      if(disposed||!stream||run!==cameraRequest)return;
      if(sample){showSample(sample);previewSample=sample;$('camera-status').textContent='已检测到姿势 · '+sample.pose.keypoints.filter(p=>p.score>=.3).length+' 个关键点';await predict(sample);}
      else{$('preview').getContext('2d').drawImage(snapshot($('video')),0,0);$('probabilities').replaceChildren();$('camera-status').textContent='未检测到清晰姿势，请让头部和身体进入画面';}
    }
  }catch(error){if(!disposed)$('camera-status').textContent='姿势检测失败：'+error.message;}
  if(!disposed&&stream&&run===cameraRequest)cameraTimer=setTimeout(()=>cameraLoop(run),160);
}
function stopCamera() {
  cameraRequest++;holding=null;clearTimeout(cameraTimer);
  stream?.getTracks().forEach(track=>track.stop());stream=null;$('video').srcObject=null;
  if(disposed)return;
  $('camera').disabled=false;$('camera-stop').disabled=true;$('camera-status').textContent='摄像头已关闭';renderClasses();
}
async function startCamera() {
  stopCamera();const run=++cameraRequest;
  $('camera').disabled=true;$('camera-stop').disabled=false;$('camera-status').textContent='正在等待摄像头授权';
  try{
    const deviceId=$('device').value;
    const next=await navigator.mediaDevices.getUserMedia({video:deviceId?{deviceId:{exact:deviceId}}:true,audio:false});
    if(disposed||run!==cameraRequest){next.getTracks().forEach(track=>track.stop());return;}
    stream=next;$('video').srcObject=next;await $('video').play();
    if(disposed||run!==cameraRequest)return;
    $('preview').hidden=false;$('preview-empty').hidden=true;
    $('camera-status').textContent='正在准备姿势检测模型';
    await ensureModel();if(disposed||run!==cameraRequest)return;
    const devices=await navigator.mediaDevices.enumerateDevices();if(disposed||run!==cameraRequest)return;
    $('device').replaceChildren();
    devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>{const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||'摄像头 '+(i+1);$('device').append(option);});
    if(deviceId)$('device').value=deviceId;
    renderClasses();cameraLoop(run);
  }catch(error){if(!disposed&&run===cameraRequest){stopCamera();$('camera-status').textContent='摄像头未开启：'+error.message;}}
}
async function uploadSamples(item,files) {
  if(busy)return;
  holding=null;setBusy(true);let accepted=0;
  try{
    status('正在检测上传图片中的姿势');
    for(const file of files.slice(0,100-item.samples.length)){
      const url=URL.createObjectURL(file);
      try{const image=new Image();image.src=url;await image.decode();const sample=await analyze(snapshot(image));if(disposed)return;if(sample){item.samples.push(sample);accepted++;previewSample=sample;showSample(sample);}}
      finally{URL.revokeObjectURL(url);}
    }
    if(accepted){invalidate();status('已添加 '+accepted+' 个姿势样本，请训练模型');}
    else status('没有检测到清晰姿势，请选择包含人物的图片');
  }catch(error){invalidate();status('添加样本失败：'+error.message);}
  finally{busy=false;if(disposed){model?.dispose();model=null;}else setBusy(false);}
}
function kneeAngle(pose) {
  const angles=[];
  for(const ids of [[11,13,15],[12,14,16]]){
    const points=ids.map(i=>pose.keypoints[i]);if(points.some(p=>p.score<.3))continue;
    const [a,b,c]=points.map(p=>p.position),u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];
    angles.push(Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))))));
  }
  return angles.length?angles.reduce((sum,value)=>sum+value,0)/angles.length:null;
}
async function loadExamples() {
  if(busy)return;
  stopCamera();setBusy(true);status('正在从示例视频提取姿势');
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  try{
    await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('示例视频无法读取'));video.src='./pose-samples/squats.mp4';});
    const samples=[];
    for(let i=0;i<40;i++){
      if(disposed)return;
      await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=(i+.5)*video.duration/40;});
      const sample=await analyze(snapshot(video));if(!sample)continue;
      const angle=kneeAngle(sample.pose);if(angle!==null)samples.push({...sample,angle});
      status('正在提取示例姿势 '+(i+1)+' / 40');await tf.nextFrame();
    }
    if(samples.length<24)throw new Error('示例视频中可用姿势不足，请上传人物图片或开启摄像头');
    samples.sort((a,b)=>a.angle-b.angle);
    classes[0].name='站立';classes[1].name='下蹲';classes[0].samples=samples.slice(-12);classes[1].samples=samples.slice(0,12);
    previewSample=classes[0].samples[0];showSample(previewSample);invalidate();status('已载入两类姿势，各 12 个样本');
  }catch(error){status('示例加载失败：'+error.message);}
  finally{video.removeAttribute('src');video.load();busy=false;if(disposed){model?.dispose();model=null;}else setBusy(false);}
}
async function train() {
  if(busy||classes.some(c=>c.samples.length<5))return;
  holding=null;stopped=false;invalidate();setBusy(true);$('progress').hidden=false;$('stop-training').hidden=false;
  const epochs=Math.max(1,Math.min(100,Number($('epochs').value)||50));$('epochs').value=epochs;
  $('progress').max=epochs;$('progress').value=0;$('loss').textContent='';
  try{
    await operation;const current=await ensureModel();if(disposed)return;
    current.setLabels(classes.map(c=>c.name));
    for(let i=0;i<classes.length;i++)for(const sample of classes[i].samples)await current.addExample(i,sample.features);
    current.prepare();status('正在训练姿势分类器');
    await current.train({denseUnits:100,epochs,batchSize:Number($('batch').value),learningRate:Number($('learning-rate').value)},{
      onBatchEnd:async()=>{if(stopped||disposed)current.model.stopTraining=true;await tf.nextFrame();},
      onEpochEnd:async(epoch,logs)=>{if(disposed)return;$('progress').value=epoch+1;status('训练 '+(epoch+1)+' / '+epochs+' 轮');$('loss').textContent='训练损失 '+logs.loss.toFixed(4)+' · 验证准确率 '+((logs.val_acc||0)*100).toFixed(1)+'%';},
    });
    if(disposed||stopped){status('训练已停止，请重新训练');return;}
    trained=true;$('export').disabled=false;$('preview-help').textContent='换一个姿势，观察类别概率的变化。';status('训练完成，可以测试姿势');
  }catch(error){status('训练失败：'+error.message);}
  finally{
    busy=false;
    if(disposed){model?.dispose();model=null;}
    else{$('stop-training').hidden=true;setBusy(false);if(trained)await predict(previewSample||classes[0].samples[0]);}
  }
}
function download(name,blob) {
  const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick=async()=>{
  if(!trained||busy)return;
  try{
    await model.save('downloads://pose-model');
    download('metadata.json',new Blob([JSON.stringify(model.getMetadata(),null,2)],{type:'application/json'}));
    status('已导出模型、权重和类别信息');
  }catch(error){status('导出失败：'+error.message);}
};
$('test-image').onchange=async event=>{
  const file=event.target.files[0];if(!file||busy)return;
  stopCamera();const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();const sample=await analyze(snapshot(image));if(disposed)return;if(!sample){$('probabilities').replaceChildren();$('camera-status').textContent='没有检测到清晰姿势';return;}previewSample=sample;showSample(sample);await predict(sample);$('camera-status').textContent='正在测试本机图片';}
  catch(error){if(!disposed)$('camera-status').textContent='图片检测失败：'+error.message;}
  finally{URL.revokeObjectURL(url);event.target.value='';}
};
$('camera').onclick=()=>{activeClass=null;startCamera();};$('camera-stop').onclick=stopCamera;
$('device').onchange=()=>{if(stream)startCamera();};
$('examples').onclick=loadExamples;$('train').onclick=train;
$('stop-training').onclick=()=>{stopped=true;if(model?.model)model.model.stopTraining=true;status('正在停止训练');};
$('add-class').onclick=()=>{if(!busy&&classes.length<8){classes.push(makeClass());invalidate();renderClasses();}};
$('clear-all').onclick=()=>{if(busy)return;stopCamera();classes=[makeClass(),makeClass()];previewSample=null;invalidate();$('preview').hidden=true;$('preview-empty').hidden=false;$('progress').hidden=true;$('loss').textContent='';renderClasses();status('项目已清空');};
window.addEventListener('pagehide',()=>{
  disposed=true;stopped=true;revision++;stopCamera();if(model?.model)model.model.stopTraining=true;
  if(!busy)operation.finally(()=>{model?.dispose();model=null;});classes=[];
});
$('camera').disabled=false;
setBusy(false);

