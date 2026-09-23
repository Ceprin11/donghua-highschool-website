import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { NeuralNet, generateData, splitData, decisionGrid } from "@/experiments/neural/NeuralEngine";

function createSession(dataset) {
  const data = generateData(dataset, 42, { count: 120, noise: 0.03 });
  return { dataset, data, split: splitData(data.points, data.labels, 0.3, 43), model: new NeuralNet([2, 6, 4, 1], 44), step: 0, history: [] };
}

export default function NeuralPreview() {
  const [session, setSession] = useState(() => createSession("circle"));
  const [frame, setFrame] = useState(0);
  const { dataset, step } = session;
  const [running, setRunning] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const container = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(container.current);
    const visibility = () => setPageVisible(!document.hidden);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduceMotion = () => { if (motion.matches) setRunning(false); };
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", reduceMotion);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", reduceMotion); };
  }, []);

  useEffect(() => {
    if (!running || !inView || !pageVisible) return;
    const timer = window.setInterval(() => {
      const { model, split } = session;
      for (let i = 0; i < 8; i++) model.trainStep(split.train.points, split.train.labels, 0.2);
      session.step += 8;
      session.history.push(model.computeLoss(split.train.points, split.train.labels));
      setFrame(value => value + 1);
      if (session.step >= 640) setRunning(false);
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, inView, pageVisible, session]);

  useEffect(() => {
    const ctx = canvas.current.getContext("2d");
    const size = canvas.current.width;
    const grid = decisionGrid(session.model, 40);
    grid.forEach((row, y) => row.forEach((probability, x) => {
      ctx.fillStyle = `rgb(${Math.round(210 + 45 * probability)}, ${Math.round(231 - 10 * probability)}, ${Math.round(244 - 71 * probability)})`;
      ctx.fillRect(x * size / 40, y * size / 40, size / 40 + 1, size / 40 + 1);
    }));
    session.data.points.forEach(([x, y], index) => {
      ctx.beginPath(); ctx.arc((x + 1) / 2 * size, (1 - y) / 2 * size, 4, 0, Math.PI * 2);
      ctx.fillStyle = session.data.labels[index] ? "#ec930c" : "#3586b2";
      ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.4; ctx.stroke();
    });
  }, [session, frame]);

  const loss = session.model.computeLoss(session.split.train.points, session.split.train.labels);
  const accuracy = session.model.accuracy(session.split.test.points, session.split.test.labels);
  const restart = () => setSession(createSession(dataset));
  const chooseDataset = (value) => { if (value !== dataset) setSession(createSession(value)); };
  const layers = [[{ x: 36, y: 91 }, { x: 36, y: 175 }], Array.from({ length: 6 }, (_, i) => ({ x: 139, y: 28 + i * 42 })), Array.from({ length: 4 }, (_, i) => ({ x: 242, y: 49 + i * 56 })), [{ x: 345, y: 133 }]];

  return <div ref={container} className="neural-preview" aria-label="神经网络训练预览">
    <div className="preview-toolbar"><div className="preview-brand"><span className="preview-brand-mark">ai</span><span>互动实验室</span><span className="preview-breadcrumb">/ 神经网络训练</span></div><Link to="/labs/neural-network">打开实验 <ArrowUpRight size={15} /></Link></div>
    <div className="preview-workspace">
      <aside className="preview-controls"><div className="preview-panel-label"><SlidersHorizontal size={14} /> 实验设置</div><label>选择数据集</label><div className="dataset-switch">{[["circle", "圆环"], ["xor", "交叉"]].map(([key, label]) => <button key={key} aria-pressed={dataset === key} onClick={() => chooseDataset(key)}>{label}</button>)}</div><div className="preview-setting"><span>隐藏层</span><strong>6 · 4</strong></div><div className="preview-setting"><span>学习率</span><strong>0.2</strong></div><div className="preview-setting"><span>数据点</span><strong>120</strong></div><div className="preview-run-controls"><button className="preview-play" onClick={() => { if (step >= 640) restart(); setRunning(value => !value); }}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? "暂停训练" : "开始训练"}</button><button className="preview-reset" onClick={restart} aria-label="重新训练"><RotateCcw size={15} /></button></div><p className="preview-hint">换一组数据，<br />看看网络如何学习。</p></aside>
      <div className="preview-network"><div className="preview-panel-label">神经网络<span className={`training-status ${running && inView ? "is-running" : ""}`}><i />{running ? "训练中" : step >= 640 ? "训练完成" : "已暂停"}</span></div><svg viewBox="0 0 380 270" role="img" aria-label="两层隐藏层的神经网络，连线显示权重">{layers.slice(0, -1).map((layer, l) => layer.map((from, i) => layers[l + 1].map((to, j) => { const weight = session.model.weights[l][j][i]; return <line key={`${l}-${i}-${j}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={weight > 0 ? "#eba343" : "#83b0cc"} strokeWidth={Math.min(3, 0.6 + Math.abs(weight))} opacity=".55" />; })))}{layers.map((layer, l) => layer.map((node, i) => <g key={`${l}-${i}`}><circle cx={node.x} cy={node.y} r="13" fill="white" stroke={l === 3 ? "#ee9a18" : "#b9c6ce"} strokeWidth="1.7" /><circle cx={node.x} cy={node.y} r="5" fill={l === 3 ? "#ffac27" : "#dae7ee"} /></g>))}</svg><div className="network-labels"><span>输入</span><span>隐藏层</span><span>输出</span></div><div className="preview-metrics"><div><span>训练步数</span><strong data-testid="preview-step">{step.toString().padStart(3, "0")}</strong></div><div><span>训练损失</span><strong>{loss.toFixed(3)}</strong></div><div><span>测试准确率</span><strong>{Math.round(accuracy * 100)}<small>%</small></strong></div></div></div>
      <div className="preview-result"><div className="preview-panel-label">分类边界<span className="result-legend"><i />A <i />B</span></div><canvas ref={canvas} width="280" height="280" role="img" aria-label="随训练变化的分类边界与数据点" /><div className="loss-label"><span>损失曲线</span><span>观察误差的变化</span></div><svg className="preview-loss" viewBox="0 0 280 65" role="img" aria-label="训练损失曲线"><path d="M0 64H280 M0 32H280" stroke="#e9ebed" fill="none" /><polyline points={session.history.map((value, i) => `${i / 79 * 280},${60 - Math.min(1, value) * 54}`).join(" ")} fill="none" stroke="#e99000" strokeWidth="2" /></svg></div>
    </div>
  </div>;
}
