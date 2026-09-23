import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FastForward, MapPin, Pause, Play, Trash2 } from "lucide-react";
import { mergeConfig } from "../../../shared/experiment-config.js";
import { CELL, cloneGrid, defaultMapA, defaultMapB, findCell, MazeAgent } from "./MazeEngine";

const CELL_COLORS = { [CELL.EMPTY]: "bg-white", [CELL.START]: "bg-green-100 border-green-400", [CELL.GOAL]: "bg-blue-100 border-blue-400", [CELL.OBSTACLE]: "bg-foreground/80", [CELL.TRAP]: "bg-red-100 border-red-400" };

function safeConfig(preset) {
  try { return mergeConfig("maze", preset?.config || {}); } catch { return mergeConfig("maze"); }
}

function gridFromConfig(config) { return config.grid ? cloneGrid(config.grid) : config.map === "B" ? defaultMapB() : defaultMapA(); }

export default function MazeLab({ preset }) {
  const config = useMemo(() => safeConfig(preset), [preset]);
  const [settings, setSettings] = useState(config);
  const [grid, setGrid] = useState(() => gridFromConfig(config));
  const [editTool, setEditTool] = useState(Number(CELL.OBSTACLE));
  const [running, setRunning] = useState(false);
  const [lastEpisode, setLastEpisode] = useState(null);
  const [path, setPath] = useState([]);
  const [history, setHistory] = useState([]);
  const agentRef = useRef(null);
  const timerRef = useRef(null);
  const generationRef = useRef(0);
  const presetKeyRef = useRef("");
  const start = useMemo(() => findCell(grid, CELL.START), [grid]);
  const reachable = useMemo(() => {
    try { return ensureReadableAgent(settings).isReachable(grid, start); } catch { return false; }
  }, [grid, settings]);

  function ensureReadableAgent(nextSettings) {
    return new MazeAgent(grid.length, grid[0].length, nextSettings);
  }

  const stopTraining = useCallback(() => {
    generationRef.current += 1;
    setRunning(false);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetLearning = useCallback(() => {
    stopTraining();
    agentRef.current = new MazeAgent(grid.length, grid[0].length, settings);
    setLastEpisode(null); setPath([]); setHistory([]);
  }, [grid, settings, stopTraining]);

  useEffect(() => {
    const key = JSON.stringify(preset?.config || {});
    if (presetKeyRef.current === key) return;
    presetKeyRef.current = key;
    stopTraining();
    setSettings(config);
    setGrid(gridFromConfig(config));
    agentRef.current = null;
    setLastEpisode(null); setPath([]); setHistory([]);
  }, [preset, config, stopTraining]);

  useEffect(() => () => stopTraining(), [stopTraining]);

  const runOne = useCallback(() => {
    const agent = agentRef.current || new MazeAgent(grid.length, grid[0].length, settings);
    agentRef.current = agent;
    agent.alpha = settings.alpha; agent.gamma = settings.gamma; agent.epsilon = settings.epsilon;
    agent.goalReward = settings.goalReward; agent.trapPenalty = settings.trapPenalty; agent.stepPenalty = settings.stepPenalty; agent.maxSteps = settings.maxSteps;
    const result = agent.runEpisode(grid, findCell(grid, CELL.START));
    setLastEpisode(result); setHistory(agent.history.slice(-80)); setPath(agent.greedyPath(grid, findCell(grid, CELL.START), settings.maxSteps));
  }, [grid, settings]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = settings.speed === "fast" ? 35 : settings.speed === "slow" ? 650 : 220;
    timerRef.current = setInterval(runOne, interval);
    return () => { if (timerRef.current !== null) clearInterval(timerRef.current); timerRef.current = null; };
  }, [running, runOne, settings.speed]);

  const toggleRunning = () => {
    if (running) stopTraining();
    else { if (!agentRef.current) agentRef.current = new MazeAgent(grid.length, grid[0].length, settings); setRunning(true); }
  };

  const updateSetting = (key, value) => {
    const nextSettings = { ...settings, [key]: value };
    stopTraining();
    setSettings(nextSettings);
    agentRef.current = new MazeAgent(grid.length, grid[0].length, nextSettings);
    setLastEpisode(null); setHistory([]); setPath([]);
  };
  const handleCellClick = (row, col) => {
    if (running) return;
    const next = cloneGrid(grid);
    if (editTool === CELL.START || editTool === CELL.GOAL) {
      if (next[row][col] === (editTool === CELL.START ? CELL.GOAL : CELL.START)) return;
      const old = editTool === CELL.START ? CELL.START : CELL.GOAL;
      for (let r = 0; r < next.length; r += 1) for (let c = 0; c < next[r].length; c += 1) if (next[r][c] === old) next[r][c] = CELL.EMPTY;
      next[row][col] = editTool;
    } else {
      if (next[row][col] === CELL.START || next[row][col] === CELL.GOAL) return;
      next[row][col] = next[row][col] === editTool ? CELL.EMPTY : editTool;
    }
    setGrid(next); stopTraining(); agentRef.current = null; setLastEpisode(null); setHistory([]); setPath([]);
  };

  const loadMap = (which) => { stopTraining(); const next = which === "B" ? defaultMapB() : defaultMapA(); setSettings((current) => ({ ...current, map: which, grid: undefined })); setGrid(next); agentRef.current = null; setLastEpisode(null); setHistory([]); setPath([]); };

  const maxReward = Math.max(1, ...history.map((item) => item.reward));
  const minReward = Math.min(-1, ...history.map((item) => item.reward));
  const rewardPoints = history.length > 1 ? history.map((item, index) => `${(index / (history.length - 1)) * 300},${110 - ((item.reward - minReward) / Math.max(1, maxReward - minReward)) * 100}`).join(" ") : "";

  return <div className="space-y-5">
    <div className="grid md:grid-cols-2 gap-5">
      <div><div className="w-full max-w-[360px] p-2 rounded-lg border border-border bg-muted/20"><div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}>{grid.map((row, r) => row.map((cell, c) => { const onPath = path.some((point) => point.r === r && point.c === c); return <button key={`${r},${c}`} onClick={() => handleCellClick(r, c)} className={`w-full aspect-square min-w-0 rounded border-2 ${CELL_COLORS[cell]} ${onPath ? "ring-2 ring-primary" : ""} flex items-center justify-center text-xs font-medium hover:opacity-80`} aria-label={`第${r + 1}行第${c + 1}列`}>{cell === CELL.START && "起"}{cell === CELL.GOAL && "终"}{cell === CELL.TRAP && "陷"}</button>; }))}</div></div><div className="mt-2 text-xs text-muted-foreground">点击格子编辑地图；高亮路线来自当前 Q 表策略。起点和终点不能被障碍或陷阱覆盖。</div></div>
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">{[[CELL.OBSTACLE, "障碍"], [CELL.TRAP, "陷阱"], [CELL.START, "起点"], [CELL.GOAL, "终点"]].map(([tool, label]) => <button key={tool} onClick={() => setEditTool(Number(tool))} className={`px-3 py-1.5 rounded text-xs border ${editTool === tool ? "bg-accent border-primary" : "border-border"}`}>{label}</button>)}</div>
        <div className="flex gap-2"><button onClick={() => loadMap("A")} className="px-3 py-1.5 rounded text-xs border border-border hover:bg-accent">地图 A</button><button onClick={() => loadMap("B")} className="px-3 py-1.5 rounded text-xs border border-border hover:bg-accent">地图 B</button></div>
        <div className="grid grid-cols-2 gap-3">{[["goalReward", "终点奖励", -100, 100, 1], ["trapPenalty", "陷阱惩罚", -100, 0, 1], ["stepPenalty", "每步惩罚", -100, 0, 0.1], ["epsilon", "探索率 ε", 0, 1, 0.05]].map(([key, label, min, max, step]) => <label key={key} className="text-xs text-muted-foreground">{label}<input type="number" min={min} max={max} step={step} value={settings[key]} onChange={(event) => updateSetting(key, Number(event.target.value))} className="w-full px-2 py-1 rounded border border-border text-sm text-foreground" /></label>)}</div>
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">训练轮数</span><span className="font-mono font-semibold">{history.length ? history[history.length - 1].episode : 0}</span></div><div className="flex justify-between"><span className="text-muted-foreground">上一轮步数</span><span className="font-mono">{lastEpisode?.steps ?? "-"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">上一轮奖励</span><span className="font-mono">{lastEpisode?.reward ?? "-"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">结果</span><span className="font-mono">{lastEpisode ? (lastEpisode.reachedGoal ? "到达终点" : lastEpisode.reason === "trap" ? "掉入陷阱" : "未到达") : "-"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">地图可达</span><span className="font-mono">{reachable ? "是" : "否，请调整地图"}</span></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={toggleRunning} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">{running ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> 开始训练</>}</button><button onClick={runOne} disabled={running} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-50"><MapPin size={14} /> 单轮尝试</button><button onClick={() => setSettings((current) => ({ ...current, speed: current.speed === "fast" ? "normal" : "fast" }))} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><FastForward size={14} /> {settings.speed === "fast" ? "常速" : "快速"}</button><button onClick={() => setSettings((current) => ({ ...current, speed: "slow" }))} className={`px-3.5 py-2.5 rounded-lg border border-border text-sm ${settings.speed === "slow" ? "bg-accent" : "hover:bg-accent"}`}>慢速</button><button onClick={resetLearning} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><Trash2 size={14} /> 清空学习</button></div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3"><button onClick={() => { stopTraining(); if (agentRef.current) setPath(agentRef.current.greedyPath(grid, findCell(grid, CELL.START), settings.maxSteps)); }} disabled={!history.length} className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-50">策略试走</button>{path.length > 0 && <span role="status" className="text-sm">当前策略经过 {path.length} 个格子，{grid[path[path.length - 1].r][path[path.length - 1].c] === CELL.GOAL ? "到达终点" : "尚未到达终点，请继续训练或调整奖励"}。</span>}</div>
    {history.length > 1 && <div className="rounded-lg border border-border p-3"><div className="text-sm font-medium mb-2">每轮奖励（纵轴包含负奖励）</div><svg width="100%" height="120" viewBox="0 0 300 120" className="overflow-visible"><polyline fill="none" stroke="#d88b13" strokeWidth="2" points={rewardPoints} /><line x1="0" y1={110 - ((0 - minReward) / Math.max(1, maxReward - minReward)) * 100} x2="300" y2={110 - ((0 - minReward) / Math.max(1, maxReward - minReward)) * 100} stroke="#9ca3af" strokeDasharray="3 3" /></svg></div>}
    <div className="text-xs text-muted-foreground px-3 py-2 rounded bg-muted/30">机器人通过探索更新每一步的行动价值。到达终点或陷阱，本轮结束。训练后，试走它学到的路线。</div>
  </div>;
}
