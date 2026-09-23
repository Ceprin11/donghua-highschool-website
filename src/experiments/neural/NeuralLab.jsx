import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, StepForward, Plus, Minus } from "lucide-react";
import { mergeConfig } from "../../../shared/experiment-config.js";
import { NeuralNet, generateData, splitData, INPUT_FEATURES } from "./NeuralEngine";
import { DataThumbnail, FieldCanvas, NetworkDiagram, LossChart, sampleNetwork } from "./NeuralVisualization";
import "./playground.css";

const DATASETS = [{ key: "circle", label: "圆环" }, { key: "xor", label: "交叉 / XOR" }, { key: "cluster", label: "两团点" }, { key: "spiral", label: "螺旋" }];
const REGRESSION_DATASETS = [{ key: "reg-plane", label: "平面" }, { key: "reg-gauss", label: "多峰曲面" }];
const LEARNING_RATES = [.0001, .001, .003, .01, .03, .1, .2, .3, 1];

export default function NeuralLab({ preset }) {
  const [settings, setSettings] = useState(() => {
    const config = mergeConfig("neural", preset?.config || {});
    return { ...config, dataset: config.dataset === "blobs" ? "cluster" : config.dataset };
  });
  const [running, setRunning] = useState(false);
  const [view, setView] = useState(null);
  const [history, setHistory] = useState([]);
  const [showTest, setShowTest] = useState(false);
  const [discrete, setDiscrete] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [edge, setEdge] = useState(null);
  const [point, setPoint] = useState(null);
  const session = useRef(null);
  const settingsRef = useRef(settings);
  const frame = useRef(null);
  const runningRef = useRef(false);
  const lastPaint = useRef(0);
  settingsRef.current = settings;

  const stop = useCallback(() => {
    runningRef.current = false; setRunning(false);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const refresh = useCallback((record = false) => {
    const { model, data, step, seen } = session.current;
    const stats = { step, epoch: seen / data.train.points.length,
      trainLoss: model.computeLoss(data.train.points, data.train.labels), testLoss: model.computeLoss(data.test.points, data.test.labels),
      trainMetric: model.problem === "regression" ? model.rootMeanSquaredError(data.train.points, data.train.labels) : model.accuracy(data.train.points, data.train.labels),
      testMetric: model.problem === "regression" ? model.rootMeanSquaredError(data.test.points, data.test.labels) : model.accuracy(data.test.points, data.test.labels) };
    setView({ stats, snapshot: model.getNetworkSnapshot(), fields: sampleNetwork(model), data });
    if (record) setHistory(items => [...items.slice(-179), stats]);
  }, []);
  const initialize = useCallback((config) => {
    stop();
    const generated = generateData(config.problem === "regression" ? config.regressionDataset : config.dataset, config.seed, { count: config.samples, noise: config.noise });
    const data = splitData(generated.points, generated.labels, config.testRatio, config.seed + 1);
    const model = new NeuralNet([config.features.length, ...config.hiddenLayers, 1], config.seed + 2, config);
    session.current = { model, data, step: 0, seen: 0 };
    setHistory([]); setSelected(null); setHovered(null); setEdge(null); setPoint(null); refresh();
  }, [stop, refresh]);
  useEffect(() => { initialize(settingsRef.current); }, [initialize]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); runningRef.current = false; if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [stop]);
  const train = useCallback((count) => {
    const state = session.current; const config = settingsRef.current;
    state.model.batchSize = config.batchSize;
    state.model.regularization = config.regularization;
    state.model.regularizationRate = config.regularizationRate;
    for (let i = 0; i < count; i++) {
      state.model.trainStep(state.data.train.points, state.data.train.labels, config.learningRate, config.batchSize);
      state.step++; state.seen += Math.min(config.batchSize, state.data.train.points.length);
    }
    refresh(true);
  }, [refresh]);
  const tick = useCallback((time) => {
    if (!runningRef.current) return;
    if (time - lastPaint.current >= 80) { train(settingsRef.current.stepsPerFrame); lastPaint.current = time; }
    frame.current = requestAnimationFrame(tick);
  }, [train]);
  const toggle = () => {
    if (runningRef.current) return stop();
    runningRef.current = true; setRunning(true); lastPaint.current = 0;
    frame.current = requestAnimationFrame(tick);
  };
  const update = (key, value, reset = true) => {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next; setSettings(next);
    if (reset) initialize(next);
    else if (session.current) {
      session.current.model.regularization = next.regularization;
      session.current.model.regularizationRate = next.regularizationRate; refresh();
    }
  };
  const toggleFeature = (key) => {
    const enabled = settings.features.includes(key);
    if (enabled && settings.features.length === 1) return;
    update("features", INPUT_FEATURES.filter(f => f.key === key ? !enabled : settings.features.includes(f.key)).map(f => f.key));
  };
  const layerSize = (index, value) => update("hiddenLayers", settings.hiddenLayers.map((size, i) => i === index ? Math.max(1, Math.min(8, value)) : size));
  const editWeight = (value) => {
    if (!Number.isFinite(value)) return;
    stop(); session.current.model.weights[edge.layer][edge.to][edge.from] = Math.max(-10, Math.min(10, value)); refresh();
  };
  const regression = settings.problem === "regression";
  const resultLabel = regression ? "回归结果" : "分类结果";
  const active = hovered || selected;
  const displayField = active ? view?.fields.nodes[active.layer]?.[active.node] : view?.fields.output;
  const activeLabel = active ? active.layer === 0 ? INPUT_FEATURES.find(f => f.key === settings.features[active.node])?.label : `隐藏层 ${active.layer} · 神经元 ${active.node + 1}` : resultLabel;
  const stats = view?.stats;
  const rates = [...new Set([...LEARNING_RATES, settings.learningRate])].sort((a, b) => a - b);
  return <div className="nn-playground">
    <div className="nn-controls">
      <div className="nn-transport">
        <button aria-label="重置模型" title="重置模型" onClick={() => initialize(settings)}><RotateCcw size={19} /></button>
        <button className="nn-play" aria-label={running ? "暂停" : "开始训练"} title={running ? "暂停" : "开始训练"} onClick={toggle}>{running ? <Pause size={23} /> : <Play size={23} fill="currentColor" />}</button>
        <button aria-label="单步训练" title="单步训练" onClick={() => { stop(); train(1); }}><StepForward size={21} /></button>
      </div>
      <div className="nn-step"><span>步数</span><strong className="font-mono" data-testid="neural-step">{stats?.step || 0}</strong><small>{(stats?.epoch || 0).toFixed(1)} 轮</small></div>
      <Select label="学习率" value={settings.learningRate} onChange={value => update("learningRate", Number(value), false)}>{rates.map(rate => <option key={rate} value={rate}>{rate}</option>)}</Select>
      <Select label="激活函数" value={settings.activation} onChange={value => update("activation", value)}><option value="tanh">Tanh</option><option value="relu">ReLU</option><option value="sigmoid">Sigmoid</option><option value="linear">Linear</option></Select>
      <Select label="正则化" value={settings.regularization} onChange={value => update("regularization", value, false)}><option value="none">无</option><option value="l1">L1</option><option value="l2">L2</option></Select>
      <label className="nn-select">正则化强度<input aria-label="正则化强度" type="number" min="0" max="1" step="0.001" value={settings.regularizationRate} disabled={settings.regularization === "none"} onChange={e => update("regularizationRate", Math.max(0, Math.min(1, Number(e.target.value))), false)} /></label>
      <Select label="任务类型" value={settings.problem} onChange={value => { setDiscrete(false); update("problem", value); }}><option value="classification">分类</option><option value="regression">回归</option></Select>
    </div>
    <div className="nn-workspace">
      <section className="nn-data"><h2>数据</h2><p className="nn-caption">{regression ? "预测随位置变化的连续数值。" : "选择你想分类的数据。"}</p>
        <div className="nn-datasets">{(regression ? REGRESSION_DATASETS : DATASETS).map(item => <button key={item.key} aria-label={item.label} aria-pressed={(regression ? settings.regressionDataset : settings.dataset) === item.key} title={item.label} onClick={() => update(regression ? "regressionDataset" : "dataset", item.key)}><DataThumbnail dataset={item.key} /><span>{item.label}</span></button>)}</div>
        <Range label="训练集比例" value={Math.round((1 - settings.testRatio) * 100)} suffix="%" min={10} max={90} step={5} onChange={value => update("testRatio", Number((1 - value / 100).toFixed(2)))} />
        <Range label="噪声" value={Math.round(settings.noise * 100)} suffix="%" min={0} max={100} step={1} onChange={value => update("noise", value / 100)} />
        <Range label="批大小" value={settings.batchSize} min={1} max={128} step={1} onChange={value => update("batchSize", value, false)} />
        <button className="nn-regenerate" onClick={() => update("seed", (settings.seed + 1) | 0)}><RotateCcw size={14} />重新生成数据</button>
        <p className="nn-caption nn-seed">{view?.data.train.points.length || 0} 个训练样本<br />{view?.data.test.points.length || 0} 个测试样本<br /><span>数据种子 {settings.seed}</span></p>
      </section>
      <section className="nn-network"><div className="nn-network-head"><div><h2>输入特征</h2><p className="nn-caption">点击选择输入。</p></div><div className="nn-layer-tools"><button aria-label="增加隐藏层" disabled={settings.hiddenLayers.length >= 6} onClick={() => update("hiddenLayers", [...settings.hiddenLayers, 4])}><Plus size={16} /></button><button aria-label="减少隐藏层" disabled={!settings.hiddenLayers.length} onClick={() => update("hiddenLayers", settings.hiddenLayers.slice(0, -1))}><Minus size={16} /></button><h2>{settings.hiddenLayers.length} 个隐藏层</h2></div></div>
        <NetworkDiagram view={view} settings={settings} onFeature={toggleFeature} onLayerSize={layerSize} onHover={setHovered} selected={selected} onSelect={node => { setSelected(node); setEdge(null); }} onEdge={next => { stop(); setEdge(next); }} />
        <div className="nn-network-note"><span className="nn-line-sample" />连线越粗，权重的绝对值越大。悬停查看数值，点击调整权重。</div>
        {edge && view && <div className="nn-weight-editor"><label>连接权重<input aria-label="连接权重" type="number" min="-10" max="10" step="0.1" value={view.snapshot.weights[edge.layer][edge.to][edge.from]} onChange={e => editWeight(Number(e.target.value))} /></label><button onClick={() => setEdge(null)}>完成</button></div>}
      </section>
      <section className="nn-output"><div className="nn-output-title"><h2>输出</h2><span className={`nn-status ${running ? "is-running" : ""}`}>{running ? "训练中" : "已暂停"}</span></div>
        <div className="nn-loss-values"><span>测试损失 <strong data-testid="neural-test-loss">{stats?.testLoss.toFixed(4) || "—"}</strong></span><span>训练损失 <strong data-testid="neural-train-loss">{stats?.trainLoss.toFixed(4) || "—"}</strong></span></div>
        <LossChart history={history} />
        <div className="nn-field-heading"><span>{activeLabel}</span>{selected && <button onClick={() => setSelected(null)}>返回{resultLabel}</button>}</div>
        <FieldCanvas field={displayField} data={view?.data} showTest={showTest} problem={settings.problem} discrete={discrete && !active && !regression} point={point} onPoint={setPoint} />
        <div className="nn-axis"><span>−1</span><span>X₁</span><span>1</span></div>
        <div className="nn-color-legend"><span>{active || regression ? "−1" : "类别 0"}</span><i /><span>{active || regression ? "1" : "类别 1"}</span></div>
        <div className="nn-output-options"><label><input type="checkbox" checked={showTest} onChange={e => setShowTest(e.target.checked)} />显示测试数据</label>{!regression && <label><input type="checkbox" checked={discrete} onChange={e => setDiscrete(e.target.checked)} />离散化输出</label>}</div>
        <div className="nn-accuracy"><span>{regression ? "训练 RMSE" : "训练准确率"}<strong data-testid="neural-train-metric">{regression ? (stats?.trainMetric || 0).toFixed(4) : `${((stats?.trainMetric || 0) * 100).toFixed(1)}%`}</strong></span><span>{regression ? "测试 RMSE" : "测试准确率"}<strong data-testid="neural-test-metric">{regression ? (stats?.testMetric || 0).toFixed(4) : `${((stats?.testMetric || 0) * 100).toFixed(1)}%`}</strong></span></div>
        <p className="nn-caption">{regression ? "颜色表示连续数值，数据点颜色表示真实值。RMSE 越小，预测越接近真实值。" : "背景显示预测，实心点是训练数据，空心点是测试数据。"}</p>
        {point && session.current && <p className="nn-prediction">坐标 ({point.x.toFixed(2)}, {point.y.toFixed(2)})<br />{regression ? "预测值" : "属于类别 1 的概率"} {session.current.model.predict([point.x, point.y]).toFixed(3)}</p>}
      </section>
    </div>
    <div className="nn-footnote"><span>从数据到特征，再到每个神经元学到的形状。</span><a href="https://playground.tensorflow.org/" target="_blank" rel="noreferrer">交互设计参考 TensorFlow Playground ↗</a></div>
  </div>;
}
function Select({ label, value, onChange, children }) { return <label className="nn-select">{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>; }
function Range({ label, value, min, max, step, suffix = "", onChange }) { return <label className="nn-range"><span>{label}<strong>{value}{suffix}</strong></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>; }
