import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";

// Pixel & image lab — real Canvas pixel processing. No cloud services, no student uploads.
const PRESETS = [
  { name: "色块渐变", generator: drawGradient },
  { name: "清晰图案", generator: drawPattern },
  { name: "自然图像", generator: drawNature },
];

function drawGradient(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#9B2635");
  g.addColorStop(0.5, "#e8a23a");
  g.addColorStop(1, "#3a6ea5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function drawPattern(ctx, w, h) {
  ctx.fillStyle = "#F8F7F4"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#9B2635" : "#25272B"; ctx.fillRect(i * w / 8, 0, w / 8, h); }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) ctx.fillRect(c * w / 8, r * h / 8, w / 16, h / 16);
}
function drawNature(ctx, w, h) {
  // procedural "natural" image — sky + ground + sun, no external image dependency
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, "#7db9e8"); sky.addColorStop(1, "#c9e0f0");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.7);
  ctx.fillStyle = "#6a8d4f"; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = "#f2c34a"; ctx.beginPath(); ctx.arc(w * 0.75, h * 0.25, h * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2f5d3a"; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.7); ctx.lineTo(w * 0.22, h * 0.45); ctx.lineTo(w * 0.38, h * 0.45); ctx.closePath(); ctx.fill();
}

export default function VisionLab({ preset }) {
  const config = preset?.config || {};
  const W = 256, H = 256;
  const [presetIdx, setPresetIdx] = useState(config.preset ?? 0);
  const [grayscale, setGrayscale] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [denoiseLevel, setDenoiseLevel] = useState(0);
  const [edgeMode, setEdgeMode] = useState(false);
  const [zoomPixel, setZoomPixel] = useState(null);

  const origRef = useRef(null);
  const noiseRef = useRef(null);
  const canvasRef = useRef(null);

  // Build original once
  const buildOriginal = useCallback(() => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    PRESETS[presetIdx].generator(ctx, W, H);
    origRef.current = ctx.getImageData(0, 0, W, H);
    // build fixed noise sample for this preset
    const noise = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() < 0.5 ? 0 : 255;
    noiseRef.current = noise;
  }, [presetIdx]);

  useEffect(() => { buildOriginal(); }, [buildOriginal]);

  const process = useCallback(() => {
    if (!origRef.current) return;
    const src = origRef.current.data;
    const noise = noiseRef.current;
    const out = new Uint8ClampedArray(src.length);
    const cf = (contrast + 100) / 100;
    for (let i = 0; i < src.length; i += 4) {
      let r = src[i], g = src[i + 1], b = src[i + 2];
      // contrast
      r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128;
      // grayscale
      if (grayscale > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r * (1 - grayscale) + lum * grayscale;
        g = g * (1 - grayscale) + lum * grayscale;
        b = b * (1 - grayscale) + lum * grayscale;
      }
      // add fixed noise (same sample each time for fair comparison)
      if (noiseLevel > 0) {
        const n = noise[i];
        r = r * (1 - noiseLevel) + n * noiseLevel;
        g = g * (1 - noiseLevel) + n * noiseLevel;
        b = b * (1 - noiseLevel) + n * noiseLevel;
      }
      // median-ish denoise (simple 3x3 average when denoiseLevel>0)
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
    }
    // denoise via box blur
    if (denoiseLevel > 0) {
      const blurred = boxBlur(out, W, H, Math.round(denoiseLevel * 3));
      for (let i = 0; i < out.length; i++) out[i] = blurred[i];
    }
    // sobel edge
    if (edgeMode) {
      const edges = sobelEdge(out, W, H);
      for (let i = 0; i < out.length; i += 4) {
        const e = edges[i / 4];
        out[i] = out[i + 1] = out[i + 2] = e;
      }
    }
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(new ImageData(out, W, H), 0, 0);
  }, [grayscale, contrast, noiseLevel, denoiseLevel, edgeMode]);

  useEffect(() => { process(); }, [process]);

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * W);
    const y = Math.floor((e.clientY - rect.top) / rect.height * H);
    const ctx = canvasRef.current.getContext("2d");
    const px = ctx.getImageData(x, y, 1, 1).data;
    setZoomPixel({ x, y, r: px[0], g: px[1], b: px[2] });
  };

  const reset = () => { setGrayscale(0); setContrast(0); setNoiseLevel(0); setDenoiseLevel(0); setEdgeMode(false); setZoomPixel(null); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => { setPresetIdx(i); reset(); }} className={`px-3.5 py-2 rounded-lg text-sm border ${presetIdx === i ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{p.name}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">原图（不可变）</div>
          <OriginalCanvas presetIdx={presetIdx} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">处理结果</div>
          <canvas ref={canvasRef} width={W} height={H} onClick={handleCanvasClick} className="w-full max-w-[256px] aspect-square rounded-lg border border-border bg-white cursor-crosshair" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">灰度：{Math.round(grayscale * 100)}%</label>
          <input type="range" min={0} max={1} step={0.05} value={grayscale} onChange={(e) => setGrayscale(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
        </div>
        <div>
          <label className="text-sm font-medium">对比度：{contrast > 0 ? `+${contrast}` : contrast}</label>
          <input type="range" min={-50} max={50} step={1} value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
        </div>
        <div>
          <label className="text-sm font-medium">噪声强度：{Math.round(noiseLevel * 100)}%</label>
          <input type="range" min={0} max={0.5} step={0.02} value={noiseLevel} onChange={(e) => setNoiseLevel(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
        </div>
        <div>
          <label className="text-sm font-medium">去噪强度：{Math.round(denoiseLevel * 100)}%</label>
          <input type="range" min={0} max={1} step={0.05} value={denoiseLevel} onChange={(e) => setDenoiseLevel(parseFloat(e.target.value))} className="w-full accent-[#9B2635]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEdgeMode(!edgeMode)} className={`px-3.5 py-2 rounded-lg text-sm border ${edgeMode ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>Sobel 边缘检测</button>
        <button onClick={reset} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent"><RotateCcw size={14} /> 重置</button>
      </div>
      {zoomPixel && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <span className="font-medium">像素 ({zoomPixel.x}, {zoomPixel.y})：</span>
          <span className="font-mono ml-2">R={zoomPixel.r} G={zoomPixel.g} B={zoomPixel.b}</span>
          <span className="inline-block w-6 h-6 rounded ml-2 align-middle" style={{ background: `rgb(${zoomPixel.r},${zoomPixel.g},${zoomPixel.b})` }} />
        </div>
      )}
      <div className="text-xs text-muted-foreground px-3 py-2 rounded bg-muted/30">图像处理基础；传统滤波不是大模型智能修复。</div>
    </div>
  );
}

function OriginalCanvas({ presetIdx }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; const ctx = c.getContext("2d");
    PRESETS[presetIdx].generator(ctx, 256, 256);
  }, [presetIdx]);
  return <canvas ref={ref} width={256} height={256} className="w-full max-w-[256px] aspect-square rounded-lg border border-border bg-white" />;
}

function boxBlur(data, w, h, radius) {
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const i = (ny * w + nx) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      }
      const i = (y * w + x) * 4;
      out[i] = r / n; out[i + 1] = g / n; out[i + 2] = b / n; out[i + 3] = 255;
    }
  }
  return out;
}

function sobelEdge(data, w, h) {
  const out = new Uint8ClampedArray(w * h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = -gray[(y - 1) * w + x - 1] - 2 * gray[y * w + x - 1] - gray[(y + 1) * w + x - 1]
        + gray[(y - 1) * w + x + 1] + 2 * gray[y * w + x + 1] + gray[(y + 1) * w + x + 1];
      const gy = -gray[(y - 1) * w + x - 1] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + x + 1]
        + gray[(y + 1) * w + x - 1] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + x + 1];
      out[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return out;
}