import React, { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { generateData, INPUT_FEATURES } from "./NeuralEngine";

const BLUE = [52, 139, 183];
const ORANGE = [244, 160, 54];
export function fieldColor(value) {
  const amount = Math.min(1, Math.abs(value));
  const color = value >= 0 ? ORANGE : BLUE;
  return `rgb(${color.map(c => Math.round(246 + (c - 246) * amount)).join(",")})`;
}
const featureFields = INPUT_FEATURES.map(feature => Array.from({ length: 24 }, (_, row) => Array.from({ length: 24 }, (_, col) => feature.value(col / 23 * 2 - 1, 1 - row / 23 * 2))));

// One forward pass per coordinate supplies every neuron's map and the output.
export function sampleNetwork(model, resolution = 24) {
  const nodes = model.layerSizes.slice(0, -1).map(size => Array.from({ length: size }, () => Array.from({ length: resolution }, () => [])));
  const output = Array.from({ length: resolution }, () => []);
  for (let row = 0; row < resolution; row++) for (let col = 0; col < resolution; col++) {
    const { activations } = model.forwardWithCache([col / (resolution - 1) * 2 - 1, 1 - row / (resolution - 1) * 2]);
    nodes.forEach((layer, l) => layer.forEach((field, node) => {
      const value = activations[l][node];
      field[row][col] = l > 0 && model.activation === "sigmoid" ? value * 2 - 1 : value;
    }));
    output[row][col] = model.problem === "regression" ? activations.at(-1)[0] : activations.at(-1)[0] * 2 - 1;
  }
  return { nodes, output };
}

export function FieldCanvas({ field, data = null, showTest = false, problem = "classification", discrete = false, point = null, onPoint = null, miniature = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext("2d"); const w = canvas.width;
    ctx.fillStyle = "#f5f6f6"; ctx.fillRect(0, 0, w, w);
    if (field) field.forEach((row, y) => row.forEach((value, x) => {
      ctx.fillStyle = fieldColor(discrete ? value >= 0 ? 1 : -1 : value);
      const unit = w / field.length; ctx.fillRect(x * unit, y * unit, unit + .5, unit + .5);
    }));
    const px = x => (x + 1) / 2 * w; const py = y => (1 - y) / 2 * w;
    if (data) {
      const draw = (group, test) => group.points.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(px(p[0]), py(p[1]), test ? 4 : 3.5, 0, 2 * Math.PI);
        const color = problem === "regression" ? fieldColor(group.labels[i]) : group.labels[i] ? "#ef9925" : "#2582ae";
        ctx.fillStyle = test ? "white" : color;
        ctx.strokeStyle = test ? color : "#fff";
        ctx.lineWidth = test ? 1.7 : .8; ctx.fill(); ctx.stroke();
      });
      draw(data.train, false); if (showTest) draw(data.test, true);
    }
    if (point) {
      ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px(point.x), py(point.y), 7, 0, 2 * Math.PI); ctx.stroke();
    }
  }, [field, data, showTest, problem, discrete, point]);
  const choose = event => {
    if (!onPoint) return;
    const rect = ref.current.getBoundingClientRect();
    onPoint({ x: (event.clientX - rect.left) / rect.width * 2 - 1, y: 1 - (event.clientY - rect.top) / rect.height * 2 });
  };
  return <canvas ref={ref} width={miniature ? 48 : 360} height={miniature ? 48 : 360} className={miniature ? "nn-mini-map" : "nn-result-map"} aria-label={miniature ? undefined : problem === "regression" ? "回归与神经元输出热力图" : "分类与神经元输出热力图"} aria-hidden={miniature || undefined} onClick={choose} />;
}

export function DataThumbnail({ dataset }) {
  const data = useMemo(() => generateData(dataset, 9, { count: 90, noise: 0 }), [dataset]);
  return <svg viewBox="0 0 64 64" aria-hidden="true">{data.points.map((p, i) => <circle key={i} cx={5 + (p[0] + 1) * 27} cy={5 + (1 - p[1]) * 27} r="1.4" fill={data.problem === "regression" ? fieldColor(data.labels[i]) : data.labels[i] ? "#e6a342" : "#4494b8"} />)}</svg>;
}

export function NetworkDiagram({ view, settings, onFeature, onLayerSize, onHover, selected, onSelect, onEdge }) {
  const container = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setAvailableWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const count = settings.hiddenLayers.length;
  const width = Math.max(400, 170 + count * 120, availableWidth);
  const yFeature = node => 94 + INPUT_FEATURES.findIndex(f => f.key === settings.features[node]) * 57;
  const xLayer = layer => 75 + layer * (width - 93) / (count + 1);
  const yNode = (layer, node) => layer === 0 ? yFeature(node) : layer === count + 1 ? 245 : 94 + node * 57;
  return <>{availableWidth > 0 && width > availableWidth && <p className="nn-caption nn-scroll-hint">左右滑动查看完整网络</p>}<div ref={container} className="nn-diagram-scroll" tabIndex={0} aria-label="神经网络结构，可横向滚动"><div className="nn-diagram" style={{ width, height: 545 }}>
    <svg className="nn-connections" width={width} height="545" aria-label="网络连接权重">
      {view?.snapshot.weights.flatMap((matrix, layer) => matrix.flatMap((row, to) => row.map((weight, from) => {
        const x1 = xLayer(layer) + 22, x2 = xLayer(layer + 1) - 22;
        const y1 = yNode(layer, from), y2 = yNode(layer + 1, to);
        const d = `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
        return <g key={`${layer}-${to}-${from}`} className="nn-edge" onClick={() => onEdge({ layer, to, from })}>
          <path d={d} fill="none" stroke={weight >= 0 ? "#e3a249" : "#65a1be"} strokeWidth={Math.min(5, .5 + Math.abs(weight) * 1.3)} opacity=".58" />
          <path className="nn-edge-hit" d={d} fill="none" stroke="transparent" strokeWidth="10" role="button" tabIndex={0} aria-label={`连接 ${layer + 1}-${from + 1}-${to + 1} 权重 ${weight.toFixed(3)}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdge({ layer, to, from }); } }}><title>权重 {weight.toFixed(4)} · 点击调整</title></path>
        </g>;
      })))}
    </svg>
    {INPUT_FEATURES.map((feature, index) => {
      const enabled = settings.features.includes(feature.key); const input = settings.features.indexOf(feature.key);
      return <button key={feature.key} className={`nn-feature ${enabled ? "is-enabled" : ""}`} style={{ left: 0, top: 72 + index * 57 }} aria-label={`输入特征 ${feature.label}`} aria-pressed={enabled} disabled={enabled && settings.features.length === 1} onClick={() => onFeature(feature.key)} onMouseEnter={() => enabled && onHover({ layer: 0, node: input })} onMouseLeave={() => onHover(null)} onFocus={() => enabled && onHover({ layer: 0, node: input })} onBlur={() => onHover(null)}><span>{feature.label}</span><FieldCanvas field={featureFields[index]} miniature /></button>;
    })}
    {settings.hiddenLayers.map((size, index) => <React.Fragment key={index}>
      <div className="nn-neuron-controls" style={{ left: xLayer(index + 1) - 45 }}><div><button aria-label={`隐藏层 ${index + 1} 增加神经元`} disabled={size >= 8} onClick={() => onLayerSize(index, size + 1)}><Plus size={14} /></button><button aria-label={`隐藏层 ${index + 1} 减少神经元`} disabled={size <= 1} onClick={() => onLayerSize(index, size - 1)}><Minus size={14} /></button></div><label><input aria-label={`隐藏层 ${index + 1}`} type="number" min="1" max="8" value={size} onChange={e => onLayerSize(index, Number(e.target.value) || 1)} /> 个神经元</label></div>
      {Array.from({ length: size }, (_, node) => <button key={node} className={`nn-neuron ${selected?.layer === index + 1 && selected?.node === node ? "is-selected" : ""}`} style={{ left: xLayer(index + 1) - 22, top: yNode(index + 1, node) - 22 }} aria-label={`查看隐藏层 ${index + 1} 神经元 ${node + 1}`} onMouseEnter={() => onHover({ layer: index + 1, node })} onMouseLeave={() => onHover(null)} onFocus={() => onHover({ layer: index + 1, node })} onBlur={() => onHover(null)} onClick={() => onSelect({ layer: index + 1, node })}><FieldCanvas field={view?.fields.nodes[index + 1]?.[node]} miniature /><span className="nn-bias" style={{ backgroundColor: fieldColor(view?.snapshot.biases[index]?.[node] || 0) }} title={`偏置 ${(view?.snapshot.biases[index]?.[node] || 0).toFixed(4)}`} /></button>)}
    </React.Fragment>)}
    <div className="nn-output-node" style={{ left: xLayer(count + 1) - 12, top: 233 }} title={settings.problem === "regression" ? "回归输出" : "分类输出"} />
    <p className="nn-diagram-caption">每个方块展示一个神经元的输出。<br />悬停放大，点击固定查看。</p>
  </div></div></>;
}

export function LossChart({ history }) {
  const max = Math.max(.001, ...history.flatMap(item => [item.trainLoss, item.testLoss]));
  const path = key => history.map((item, i) => `${i / Math.max(1, history.length - 1) * 280},${54 - item[key] / max * 49}`).join(" ");
  return <svg className="nn-loss-chart" viewBox="0 0 280 62" role="img" aria-label="训练与测试损失曲线"><line x1="0" y1="55" x2="280" y2="55" stroke="#e3e4e5" />{history.length > 1 ? <><polyline points={path("trainLoss")} fill="none" stroke="#92999d" strokeWidth="1.6" /><polyline points={path("testLoss")} fill="none" stroke="#252b2e" strokeWidth="1.6" /></> : <text x="0" y="35" fill="#8b9195" fontSize="11">训练后显示损失变化</text>}</svg>;
}
