import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, FastForward, RotateCcw, Trash2, MapPin } from "lucide-react";
import { MazeAgent, CELL, defaultMapA, defaultMapB, emptyMap } from "./MazeEngine";

const COLS = 6, ROWS = 6;
const CELL_COLORS = {
  [CELL.EMPTY]: "bg-white",
  [CELL.START]: "bg-green-100 border-green-400",
  [CELL.GOAL]: "bg-blue-100 border-blue-400",
  [CELL.OBSTACLE]: "bg-foreground/80",
  [CELL.TRAP]: "bg-red-100 border-red-400",
};

export default function MazeLab({ preset }) {
  const config = preset?.config || {};
  const [grid, setGrid] = useState(() => {
    if (config.map === "B") return defaultMapB();
    return defaultMapA();
  });
  const [editTool, setEditTool] = useState(CELL.OBSTACLE);
  const [goalReward, setGoalReward] = useState(config.goalReward ?? 10);
  const [trapPenalty, setTrapPenalty] = useState(config.trapPenalty ?? -10);
  const [stepPenalty, setStepPenalty] = useState(config.stepPenalty ?? -1);
  const [epsilon, setEpsilon] = useState(config.epsilon ?? 0.2);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState("normal");
  const [episodes, setEpisodes] = useState(0);
  const [lastEpisode, setLastEpisode] = useState(null);
  const [path, setPath] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);

  const agentRef = useRef(null);
  const timerRef = useRef(null);

  const startPos = useCallback(() => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === CELL.START) return { r, c };
    return { r: 0, c: 0 };
  }, [grid]);

  const ensureAgent = useCallback(() => {
    if (!agentRef.current) {
      agentRef.current = new MazeAgent(ROWS, COLS, { goalReward, trapPenalty, stepPenalty, epsilon });
    }
    return agentRef.current;
  }, [goalReward, trapPenalty, stepPenalty, epsilon]);

  const resetLearning = () => {
    agentRef.current = new MazeAgent(ROWS, COLS, { goalReward, trapPenalty, stepPenalty, epsilon });
    setEpisodes(0); setLastEpisode(null); setPath([]); setRewardHistory([]);
  };

  const runOne = useCallback(() => {
    const agent = ensureAgent();
    agent.epsilon = epsilon;
    agent.goalReward = goalReward;
    agent.trapPenalty = trapPenalty;
    agent.stepPenalty = stepPenalty;
    const res = agent.runEpisode(grid, startPos());
    setEpisodes(agent.episodes);
    setLastEpisode(res);
    setRewardHistory((h) => [...h.slice(-49), res.reward]);
    setPath(agent.greedyPath(grid, startPos()));
  }, [grid, startPos, ensureAgent, epsilon, goalReward, trapPenalty, stepPenalty]);

  useEffect(() => {
    if (running) {
      const interval = speed === "fast" ? 30 : speed === "slow" ? 600 : 200;
      timerRef.current = setInterval(runOne, interval);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, speed, runOne]);

  const handleCellClick = (r, c) => {
    if (running) return;
    const next = grid.map((row) => [...row]);
    if (editTool === CELL.START) {
      for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (next[rr][cc] === CELL.START) next[rr][cc] = CELL.EMPTY;
      next[r][c] = CELL.START;
    } else if (editTool === CELL.GOAL) {
      for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (next[rr][cc] === CELL.GOAL) next[rr][cc] = CELL.EMPTY;
      next[r][c] = CELL.GOAL;
    } else {
      if (next[r][c] === CELL.START || next[r][c] === CELL.GOAL) return;
      next[r][c] = next[r][c] === editTool ? CELL.EMPTY : editTool;
    }
    setGrid(next);
    resetLearning();
  };

  const loadMap = (which) => { setGrid(which === "B" ? defaultMapB() : defaultMapA()); resetLearning(); };

  const reachable = ensureAgent().isReachable(grid, startPos());

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="inline-block p-2 rounded-lg border border-border bg-muted/20">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {grid.map((row, r) => row.map((cell, c) => {
                const onPath = path.some((p) => p.r === r && p.c === c);
                return (
                  <button key={`${r},${c}`} onClick={() => handleCellClick(r, c)}
                    className={`w-11 h-11 rounded border-2 ${CELL_COLORS[cell]} ${onPath ? "ring-2 ring-primary" : ""} flex items-center justify-center text-xs font-medium hover:opacity-80`}>
                    {cell === CELL.START && "起"}
                    {cell === CELL.GOAL && "终"}
                    {cell === CELL.TRAP && "陷"}
                    {cell === CELL.OBSTACLE && ""}
                  </button>
                );
              }))}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">点击格子编辑地图；高亮为当前策略路线</div>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setEditTool(CELL.OBSTACLE)} className={`px-3 py-1.5 rounded text-xs border ${editTool === CELL.OBSTACLE ? "bg-foreground text-background border-foreground" : "border-border"}`}>障碍</button>
            <button onClick={() => setEditTool(CELL.TRAP)} className={`px-3 py-1.5 rounded text-xs border ${editTool === CELL.TRAP ? "bg-red-200 border-red-400" : "border-border"}`}>陷阱</button>
            <button onClick={() => setEditTool(CELL.START)} className={`px-3 py-1.5 rounded text-xs border ${editTool === CELL.START ? "bg-green-200 border-green-400" : "border-border"}`}>起点</button>
            <button onClick={() => setEditTool(CELL.GOAL)} className={`px-3 py-1.5 rounded text-xs border ${editTool === CELL.GOAL ? "bg-blue-200 border-blue-400" : "border-border"}`}>终点</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadMap("A")} className="px-3 py-1.5 rounded text-xs border border-border hover:bg-accent">地图 A</button>
            <button onClick={() => loadMap("B")} className="px-3 py-1.5 rounded text-xs border border-border hover:bg-accent">地图 B</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">终点奖励</label><input type="number" value={goalReward} onChange={(e) => setGoalReward(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-border text-sm" /></div>
            <div><label className="text-xs text-muted-foreground">陷阱惩罚</label><input type="number" value={trapPenalty} onChange={(e) => setTrapPenalty(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-border text-sm" /></div>
            <div><label className="text-xs text-muted-foreground">每步惩罚</label><input type="number" value={stepPenalty} onChange={(e) => setStepPenalty(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-border text-sm" /></div>
            <div><label className="text-xs text-muted-foreground">探索率 ε</label><input type="number" min={0} max={1} step={0.05} value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-border text-sm" /></div>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">训练轮数</span><span className="font-mono font-semibold">{episodes}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">上一轮步数</span><span className="font-mono">{lastEpisode?.steps ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">上一轮奖励</span><span className="font-mono">{lastEpisode?.reward ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">是否到达终点</span><span className="font-mono">{lastEpisode ? (lastEpisode.reachedGoal ? "是" : "否") : "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">地图可达</span><span className="font-mono">{reachable ? "是" : "否（请调整）"}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRunning(!running)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {running ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> 开始训练</>}
            </button>
            <button onClick={runOne} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><MapPin size={14} /> 单轮尝试</button>
            <button onClick={() => setSpeed(speed === "fast" ? "normal" : "fast")} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><FastForward size={14} /> {speed === "fast" ? "常速" : "快速"}</button>
            <button onClick={() => setSpeed("slow")} className={`px-3.5 py-2.5 rounded-lg border border-border text-sm ${speed === "slow" ? "bg-accent" : "hover:bg-accent"}`}>慢速</button>
            <button onClick={resetLearning} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm hover:bg-accent"><Trash2 size={14} /> 清空学习</button>
          </div>
        </div>
      </div>
      {rewardHistory.length > 1 && (
        <div className="rounded-lg border border-border p-3">
          <div className="text-sm font-medium mb-2">累计奖励变化</div>
          <svg width="100%" height="120" viewBox="0 0 300 120" className="overflow-visible">
            <polyline fill="none" stroke="#9B2635" strokeWidth="2"
              points={rewardHistory.map((r, i) => `${(i / (rewardHistory.length - 1)) * 300},${100 - ((r + 20) / 40) * 100}`).join(" ")} />
          </svg>
        </div>
      )}
      <div className="text-xs text-muted-foreground px-3 py-2 rounded bg-muted/30">这是决策学习的简化示例，不等于完整具身智能系统。</div>
    </div>
  );
}