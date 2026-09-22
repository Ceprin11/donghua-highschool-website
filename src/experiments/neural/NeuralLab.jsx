import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, ChevronDown } from "lucide-react";
import { NeuralNet, generateData, splitData } from "./NeuralEngine";

const DATASETS = [
  { key: "cluster", label: "两团点" },
  { key: "circle", label: "圆环" },
  { key: "xor", label: "交叉/XOR" },
  { key: "spiral", label: "螺旋" },
];

export default function NeuralLab({ preset }) {
  const [dataset, setDataset] = useState(preset?.config?.dataset || "circle");
  const [hiddenLayers, setHiddenLayers] = useState(preset?.config?.hiddenLayers || [4, 4]);
  const [lr, setLr] = useState(preset?.config?.learningRate ?? 0.3);
  const [noise, setNoise] = useState(0);
  const [testRatio, setTestRatio] = useState(0.3);
  const [running, setRunning] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [trainLoss, setTrainLoss] = useState(0);
  const [testLoss, setTestLoss] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [boundary, setBoundary] = useState(null);

  const netRef = useRef(null);
  const dataRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);

  const initData = useCallback(() => {
    const d = generateData(dataset, 42 + Math.floor(noise * 100));
    const split = splitData(d.points, d.labels, testRatio);
    dataRef.current = { ...d, ...split };
    return { data: d, split };
  }, [dataset, noise, testRatio]);

  const initNet = useCallback(() => {
    const sizes = [2, ...hiddenLayers, 1];
    netRef.current = new NeuralNet(sizes, 1);
    setEpoch(0);
    setTrainLoss(0);
    setTestLoss(0);
  }, [hiddenLayers]);

  useEffect(() => { initData(); initNet(); }, []); // eslint-disable-line

  const recomputeBoundary = useCallback(() => {
    if (!netRef.current) return;
    const res = 24;
    const grid = [];
    for (let i = 0; i < res; i++) {
      const row = [];
      for (let j = 0; j < res; j++) {
        const x = (j / (res - 1)) * 2 - 1;
        const y = (i / (res - 1)) * 2 - 1;
        row.push(netRef.current.predict([x, y]));
      }
      grid.push(row);
    }
    setBoundary(grid);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // boundary
    if (boundary) {
      const res = boundary.length;
      const cw = W / res, ch = H / res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const p = boundary[i][j];
          const r = Math.round(155 * (1 - p) + 220 * p);
          const g = Math.round(38 * (1 - p) + 230 * p);
          const b = Math.round(53 * (1 - p) + 240 * p);
          ctx.fillStyle = `rgba(${r},${g},${b},0.16)`;
          ctx.fillRect(j * cw, i * ch, cw + 1, ch + 1);
        }
      }
    }
    // points
    const d = dataRef.current;
    if (!d) return;
    const toPx = (x) => ((x + 1) / 2) * W;
    const toPy = (y) => ((1 - (y + 1) / 2)) * H;
    d.train.points.forEach((p, i) => {
      ctx.fillStyle = d.train.labels[i] === 1 ? "#9B2635" : "#3a6ea5";
      ctx.beginPath();
      ctx.arc(toPx(p[0]), toPy(p[1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    d.test.points.forEach((p, i) => {
      ctx.fillStyle = d.test.labels[i] === 1 ? "#9B2635" : "#3a6ea5";
      ctx.beginPath();
      ctx.arc(toPx(p[0]), toPy(p[1]), 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [boundary]);

  useEffect(() => { draw(); }, [draw]);

  const loop = useCallback(() => {
    if (!netRef.current || !dataRef.current) return;
    const d = dataRef.current;
    // train a few steps per frame
    for (let s = 0; s < 3; s++) {
      netRef.current.trainStep(d.train.points, d.train.labels, lr);
    }
    setEpoch((e) => e + 3);
    const tl = netRef.current.computeLoss(d.train.points, d.train.labels);
    const vl = netRef.current.computeLoss(d.test.points, d.test.labels);
    setTrainLoss(tl);
    setTestLoss(vl);
    recomputeBoundary();
    if (running) rafRef.current = requestAnimationFrame(loop);
  }, [lr, running, recomputeBoundary]);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(loop);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, loop]);

  const handleDataset = (key) => { setDataset(key); setRunning(false); setTimeout(() => { initData(); initNet(); }, 0); };
  const handleLayers = (layerIdx, val) => {
    const next = [...hiddenLayers];
    next[layerIdx] = Math.max(1, Math.min(8, val));
    setHiddenLayers(next);
    setRunning(false);
    setTimeout(initNet, 0);
  };
  const handleReset = () => { setRunning(false); initNet(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {DATASETS.map((d) => (
          <button key={d.key} onClick={() => handleDataset(d.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${dataset === d.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <canvas ref={canvasRef} width={360} height={360} className="w-full max-w-[360px] aspect-square rounded-lg border border-border bg-white" />
          <div className="mt-2 text-xs text-muted-foreground">实心点为训练数据，空心点为测试数据（不参与训练）</div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">训练轮数</span><span className="font-mono font-semibold">{epoch}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">训练损失</span><span className="font-mono">{trainLoss.toFixed(4)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">测试损失</span><span className="font-mono">{testLoss.toFixed(4)}</span></div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">学习率：{lr.toFixed(2)}</label>
            <input type="range" min={0.01} max={1} step={0.01} value={lr} onChange={(e) => setLr(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground mb-2">隐藏层节点</div>
            <div className="flex gap-3">
              {[0, 1].map((li) => (
                <div key={li} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">第{li + 1}层</span>
                  <input type="number" min={1} max={8} value={hiddenLayers[li]} onChange={(e) => handleLayers(li, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 rounded border border-border text-sm" />
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ChevronDown size={14} className={showAdvanced ? "rotate-180" : ""} /> 进阶参数
          </button>
          {showAdvanced && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <label className="text-sm font-medium">数据噪声：{noise.toFixed(2)}</label>
                <input type="range" min={0} max={0.5} step={0.05} value={noise} onChange={(e) => setNoise(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
              </div>
              <div>
                <label className="text-sm font-medium">测试集比例：{testRatio.toFixed(2)}</label>
                <input type="range" min={0.1} max={0.5} step={0.05} value={testRatio} onChange={(e) => setTestRatio(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
              </div>
              <button onClick={() => { initData(); initNet(); }} className="text-sm px-3 py-1.5 rounded border border-border hover:bg-accent">重新生成数据</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setRunning(!running)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {running ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> 开始训练</>}
            </button>
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent">
              <RotateCcw size={16} /> 重新初始化网络
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}