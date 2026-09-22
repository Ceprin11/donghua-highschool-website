import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, CameraOff, RefreshCw, Hand, MousePointer2 } from "lucide-react";

// Camera gesture lab — uses MediaPipe Hand Landmarker loaded from CDN.
// Model/WASM resources are configured in one place (RESOURCE_CONFIG) for migration.
// If resources cannot be loaded, shows honest error state — never fakes skeleton.

const RESOURCE_CONFIG = {
  // Fixed versions; replace with self-hosted paths before production deploy in China.
  visionBase: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14",
  modelUrl: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  numHands: 1,
};

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

export default function GestureLab({ preset }) {
  const [mode, setMode] = useState("observe"); // observe | challenge
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | requesting | running | error | nodata
  const [errorMsg, setErrorMsg] = useState("");
  const [handState, setHandState] = useState("未检测到手");
  const [useMouseFallback, setUseMouseFallback] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const objectsRef = useRef([]);
  const grabbedRef = useRef(null);
  const completedRef = useRef(0);
  const startTimeRef = useRef(null);
  const [completed, setCompleted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const pinchRef = useRef(false);

  const loadLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    try {
      const vision = await import(/* @vite-ignore */ RESOURCE_CONFIG.visionBase + "/vision_bundle.mjs");
      const fileset = await vision.FilesetResolver.forVisionTasks(RESOURCE_CONFIG.visionBase + "/wasm");
      const handLandmarker = await vision.HandLandmarker.createFrom(fileset, {
        baseOptions: { modelAssetPath: RESOURCE_CONFIG.modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: RESOURCE_CONFIG.numHands,
      });
      landmarkerRef.current = handLandmarker;
      return handLandmarker;
    } catch (e) {
      throw new Error("模型加载失败：" + e.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
    setStatus("idle");
    setHandState("未检测到手");
    grabbedRef.current = null;
  }, []);

  useEffect(() => {
    const onVis = () => { if (document.hidden && rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stopCamera(); };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setStatus("requesting"); setErrorMsg("");
    if (!window.isSecureContext) {
      setStatus("error"); setErrorMsg("当前页面不是安全上下文（HTTPS），浏览器不允许使用摄像头。请通过 https:// 访问或在本地 localhost 打开。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await loadLandmarker();
      setCameraOn(true);
      setStatus("running");
      startTimeRef.current = mode === "challenge" ? Date.now() : null;
      completedRef.current = 0; setCompleted(0);
      if (mode === "challenge") initObjects();
      detectLoop();
    } catch (e) {
      setStatus("error");
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") setErrorMsg("摄像头权限被拒绝。请在浏览器地址栏点击摄像头图标，允许本网站使用摄像头后重试。");
      else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") setErrorMsg("未检测到摄像头设备。");
      else setErrorMsg("摄像头启动失败：" + e.message);
    }
  }, [loadLandmarker, mode]);

  const detectLoop = useCallback(() => {
    if (!videoRef.current || !landmarkerRef.current || !streamRef.current) return;
    if (document.hidden) return;
    const video = videoRef.current;
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarkerRef.current.detectForVideo(video, performance.now());
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        drawSkeleton(ctx, lm, canvas.width, canvas.height);
        const pinch = computePinch(lm);
        const isPinching = pinch.distance < pinch.threshold;
        setHandState(isPinching ? "捏合中" : "检测到手");
        if (mode === "challenge") handleChallenge(lm, isPinching);
      } else {
        setHandState("未检测到手");
        grabbedRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [mode]);

  const initObjects = () => {
    objectsRef.current = [
      { id: 0, x: 0.2, y: 0.5, label: "圆形", color: "#9B2635", shape: "circle", target: 0.15, placed: false },
      { id: 1, x: 0.5, y: 0.5, label: "方形", color: "#3a6ea5", shape: "square", target: 0.5, placed: false },
      { id: 2, x: 0.8, y: 0.5, label: "三角", color: "#e8a23a", shape: "triangle", target: 0.85, placed: false },
    ];
  };

  const handleChallenge = (lm, isPinching) => {
    const indexTip = lm[8];
    const px = indexTip.x, py = indexTip.y;
    // mirrored x for selfie view
    const mx = 1 - px, my = py;
    if (isPinching && !grabbedRef.current) {
      // grab nearest object within range
      for (const obj of objectsRef.current) {
        if (obj.placed) continue;
        const d = Math.hypot(mx - obj.x, my - obj.y);
        if (d < 0.12) { grabbedRef.current = obj; break; }
      }
    } else if (!isPinching && grabbedRef.current) {
      // release
      const obj = grabbedRef.current;
      if (Math.abs(obj.x - obj.target) < 0.08 && Math.abs(obj.y - 0.85) < 0.1) {
        obj.placed = true; obj.x = obj.target; obj.y = 0.85;
        completedRef.current++; setCompleted(completedRef.current);
        if (startTimeRef.current) setElapsed(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }
      grabbedRef.current = null;
    } else if (grabbedRef.current) {
      grabbedRef.current.x = mx; grabbedRef.current.y = my;
    }
    drawChallenge();
  };

  const drawChallenge = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // target zones
    objectsRef.current.forEach((obj) => {
      const tx = obj.target * canvas.width, ty = 0.85 * canvas.height;
      ctx.strokeStyle = obj.placed ? obj.color : "#999";
      ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(tx - 30, ty - 30, 60, 60);
      ctx.setLineDash([]);
      ctx.fillStyle = "#666"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(obj.label, tx, ty + 45);
    });
    // objects
    objectsRef.current.forEach((obj) => {
      if (obj.placed) return;
      const x = obj.x * canvas.width, y = obj.y * canvas.height;
      ctx.fillStyle = obj.color;
      if (obj.shape === "circle") { ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill(); }
      else if (obj.shape === "square") { ctx.fillRect(x - 22, y - 22, 44, 44); }
      else { ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x - 22, y + 18); ctx.lineTo(x + 22, y + 18); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(obj.label, x, y + 3);
    });
  };

  const computePinch = (lm) => {
    const thumb = lm[4], index = lm[8];
    const wrist = lm[0];
    const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    const palmSize = Math.hypot(thumb.x - wrist.x, thumb.y - wrist.y) || 0.001;
    const normalized = dist / palmSize;
    return { distance: normalized, threshold: 0.35 };
  };

  const drawSkeleton = (ctx, lm, w, h) => {
    ctx.strokeStyle = "#9B2635"; ctx.lineWidth = 3;
    HAND_CONNECTIONS.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
      ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
      ctx.stroke();
    });
    lm.forEach((p) => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc((1 - p.x) * w, p.y * h, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9B2635"; ctx.beginPath(); ctx.arc((1 - p.x) * w, p.y * h, 2.5, 0, Math.PI * 2); ctx.fill();
    });
  };

  // Mouse fallback for challenge mode
  const handleMouseChallenge = (e) => {
    if (mode !== "challenge" || !useMouseFallback) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const isDown = e.buttons === 1;
    if (isDown && !grabbedRef.current) {
      for (const obj of objectsRef.current) {
        if (obj.placed) continue;
        if (Math.hypot(mx - obj.x, my - obj.y) < 0.12) { grabbedRef.current = obj; break; }
      }
    } else if (!isDown && grabbedRef.current) {
      const obj = grabbedRef.current;
      if (Math.abs(obj.x - obj.target) < 0.08 && Math.abs(obj.y - 0.85) < 0.1) {
        obj.placed = true; obj.x = obj.target; obj.y = 0.85;
        completedRef.current++; setCompleted(completedRef.current);
        if (startTimeRef.current) setElapsed(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }
      grabbedRef.current = null;
    } else if (grabbedRef.current) { grabbedRef.current.x = mx; grabbedRef.current.y = my; }
    drawChallenge();
  };

  const switchMode = (m) => { stopCamera(); setMode(m); setUseMouseFallback(false); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => switchMode("observe")} className={`px-3.5 py-2 rounded-lg text-sm border ${mode === "observe" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
          <Hand size={14} className="inline mr-1" /> 原理观察
        </button>
        <button onClick={() => switchMode("challenge")} className={`px-3.5 py-2 rounded-lg text-sm border ${mode === "challenge" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
          搬运挑战
        </button>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        {mode === "observe" ? "点击「开启摄像头」后，展示手部关键点与骨架。模型负责检测关键点，交互规则负责判定捏合。" : "拇指与食指捏合抓取物体，移动到目标区后松开。需要摄像头授权。"}
      </div>
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ maxWidth: 640, margin: "0 auto" }}>
        <video ref={videoRef} playsInline muted className="w-full" style={{ transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} />
        <canvas ref={canvasRef} width={640} height={480}
          onMouseMove={handleMouseChallenge}
          onMouseDown={handleMouseChallenge}
          onMouseUp={handleMouseChallenge}
          className={`absolute inset-0 w-full h-full ${cameraOn || useMouseFallback ? "" : "hidden"} ${useMouseFallback ? "cursor-pointer" : ""}`} />
        {!cameraOn && !useMouseFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 p-6 text-center min-h-[300px]">
            <CameraOff size={40} className="mb-3 opacity-60" />
            <div className="text-sm">摄像头未开启</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {!cameraOn ? (
          <button onClick={startCamera} disabled={status === "requesting"} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            <Camera size={16} /> {status === "requesting" ? "正在请求权限…" : "开启摄像头"}
          </button>
        ) : (
          <button onClick={stopCamera} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><CameraOff size={16} /> 关闭摄像头</button>
        )}
        {mode === "challenge" && (
          <button onClick={() => { setUseMouseFallback(!useMouseFallback); if (!useMouseFallback) { initObjects(); completedRef.current = 0; setCompleted(0); startTimeRef.current = Date.now(); } }} className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm border ${useMouseFallback ? "bg-accent border-primary" : "border-border hover:bg-accent"}`}>
            <MousePointer2 size={14} /> 鼠标/触屏替代
          </button>
        )}
        {mode === "challenge" && completed > 0 && (
          <button onClick={() => { initObjects(); completedRef.current = 0; setCompleted(0); startTimeRef.current = Date.now(); setElapsed(0); }} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><RefreshCw size={14} /> 重新挑战</button>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="px-3 py-1.5 rounded-full bg-muted/40">状态：<span className="font-medium text-foreground">{handState}</span></div>
        {mode === "challenge" && <div className="px-3 py-1.5 rounded-full bg-muted/40">完成：<span className="font-medium text-primary">{completed} / 3</span>{elapsed > 0 && <span className="ml-2 text-muted-foreground">用时 {elapsed}s</span>}</div>}
      </div>
      {status === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium mb-1">无法使用摄像头</div>
          {errorMsg}
          <div className="mt-2 text-xs text-red-600/80">提示：若在预览 iframe 中无法授权，请打开顶层预览页面验证。</div>
        </div>
      )}
      <div className="text-xs text-muted-foreground px-3 py-2 rounded bg-muted/30">
        不自动开启摄像头；不申请麦克风；不上传、录制或保存视频帧和手部轨迹。退出页面后摄像头与推理任务停止。
        {useMouseFallback && <span className="block mt-1 text-amber-700">当前为鼠标/触屏替代操作，不算摄像头功能完成。</span>}
      </div>
    </div>
  );
}