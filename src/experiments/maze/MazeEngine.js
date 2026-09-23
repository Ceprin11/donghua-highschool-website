// Q-learning on a finite grid. Legal actions are used both for behaviour and
// bootstrap values; goal and trap states are terminal and never bootstrap.

export const CELL = Object.freeze({ EMPTY: 0, START: 1, GOAL: 2, OBSTACLE: 3, TRAP: 4 });
export const ACTIONS = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]]);

export function emptyMap(rows = 6, cols = 6) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows > 12 || cols > 12) throw new Error("迷宫尺寸必须是 2 至 12");
  return Array.from({ length: rows }, () => new Array(cols).fill(CELL.EMPTY));
}

export function defaultMapA() {
  const grid = emptyMap();
  grid[0][0] = CELL.START; grid[5][5] = CELL.GOAL;
  grid[2][2] = CELL.OBSTACLE; grid[2][3] = CELL.OBSTACLE; grid[3][3] = CELL.OBSTACLE; grid[4][1] = CELL.TRAP;
  return grid;
}

export function defaultMapB() {
  const grid = emptyMap();
  grid[0][0] = CELL.START; grid[0][5] = CELL.GOAL;
  grid[2][1] = CELL.OBSTACLE; grid[2][2] = CELL.OBSTACLE; grid[2][3] = CELL.OBSTACLE; grid[2][4] = CELL.OBSTACLE;
  grid[4][3] = CELL.TRAP; grid[3][0] = CELL.TRAP;
  return grid;
}

export function cloneGrid(grid) { return grid.map((row) => [...row]); }

export function validateMap(grid) {
  if (!Array.isArray(grid) || grid.length < 2 || grid.length > 12 || !Array.isArray(grid[0]) || grid[0].length < 2 || grid[0].length > 12) throw new Error("迷宫地图必须是 2 至 12 行列的矩形");
  const cols = grid[0].length; let starts = 0; let goals = 0;
  grid.forEach((row, r) => {
    if (!Array.isArray(row) || row.length !== cols) throw new Error(`迷宫第 ${r + 1} 行长度不一致`);
    row.forEach((cell, c) => {
      if (!Number.isInteger(cell) || cell < CELL.EMPTY || cell > CELL.TRAP) throw new Error(`迷宫格 (${r},${c}) 类型错误`);
      if (cell === CELL.START) starts += 1;
      if (cell === CELL.GOAL) goals += 1;
    });
  });
  if (starts !== 1) throw new Error("迷宫必须有且只有一个起点");
  if (goals !== 1) throw new Error("迷宫必须有且只有一个终点");
  return { rows: grid.length, cols, grid: cloneGrid(grid) };
}

export function findCell(grid, value) {
  for (let r = 0; r < grid.length; r += 1) for (let c = 0; c < grid[r].length; c += 1) if (grid[r][c] === value) return { r, c };
  return null;
}

export function seededRandom(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MazeAgent {
  constructor(rows, cols, config = {}) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) throw new Error("迷宫尺寸错误");
    this.rows = rows; this.cols = cols;
    this.alpha = config.alpha ?? 0.2; this.gamma = config.gamma ?? 0.9; this.epsilon = config.epsilon ?? 0.2;
    this.goalReward = config.goalReward ?? 10; this.trapPenalty = config.trapPenalty ?? -10; this.stepPenalty = config.stepPenalty ?? -1; this.maxSteps = config.maxSteps ?? 50;
    this.random = typeof config.random === "function" ? config.random : seededRandom(config.seed ?? 42);
    this.resetLearning();
  }

  resetLearning() {
    this.Q = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => new Array(ACTIONS.length).fill(0)));
    this.episodes = 0; this.history = [];
  }

  isTerminal(grid, r, c) { return grid[r]?.[c] === CELL.GOAL || grid[r]?.[c] === CELL.TRAP; }

  validActions(grid, r, c) {
    if (grid?.[r]?.[c] === undefined || this.isTerminal(grid, r, c)) return [];
    const valid = [];
    for (let action = 0; action < ACTIONS.length; action += 1) {
      const nr = r + ACTIONS[action][0]; const nc = c + ACTIONS[action][1];
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && grid[nr][nc] !== CELL.OBSTACLE) valid.push(action);
    }
    return valid;
  }

  pickAction(grid, r, c) {
    const valid = this.validActions(grid, r, c);
    if (!valid.length) return -1;
    if (this.random() < this.epsilon) return valid[Math.floor(this.random() * valid.length)];
    let bestValue = Math.max(...valid.map((action) => this.Q[r][c][action]));
    const ties = valid.filter((action) => Math.abs(this.Q[r][c][action] - bestValue) < 1e-12);
    return ties[Math.floor(this.random() * ties.length)];
  }

  runEpisode(grid, startPos = findCell(grid, CELL.START)) {
    validateMap(grid);
    if (!startPos || startPos.r < 0 || startPos.r >= this.rows || startPos.c < 0 || startPos.c >= this.cols) throw new Error("迷宫起点不存在");
    let r = startPos.r; let c = startPos.c; let totalReward = 0; let steps = 0; let reachedGoal = false; let reason = "max_steps";
    if (this.isTerminal(grid, r, c)) reason = grid[r][c] === CELL.GOAL ? "goal" : "trap";
    while (steps < this.maxSteps && !this.isTerminal(grid, r, c)) {
      const action = this.pickAction(grid, r, c);
      if (action < 0) { reason = "dead_end"; break; }
      const nr = r + ACTIONS[action][0]; const nc = c + ACTIONS[action][1];
      const nextCell = grid[nr][nc];
      const reward = nextCell === CELL.GOAL ? this.goalReward : nextCell === CELL.TRAP ? this.trapPenalty : this.stepPenalty;
      const terminal = nextCell === CELL.GOAL || nextCell === CELL.TRAP;
      const legalNext = terminal ? [] : this.validActions(grid, nr, nc);
      // No legal next action is an absorbing dead end. In both terminal and
      // dead-end cases the target is the immediate reward only.
      const bootstrap = legalNext.length ? this.gamma * Math.max(...legalNext.map((nextAction) => this.Q[nr][nc][nextAction])) : 0;
      const target = reward + (terminal || !legalNext.length ? 0 : bootstrap);
      this.Q[r][c][action] += this.alpha * (target - this.Q[r][c][action]);
      totalReward += reward; steps += 1; r = nr; c = nc;
      if (terminal) { reachedGoal = nextCell === CELL.GOAL; reason = reachedGoal ? "goal" : "trap"; break; }
      if (steps >= this.maxSteps) reason = "max_steps";
    }
    this.episodes += 1;
    const result = { steps, reward: totalReward, reachedGoal, reason, terminal: reachedGoal || reason === "trap" };
    this.history.push({ episode: this.episodes, ...result });
    return result;
  }

  greedyPath(grid, startPos = findCell(grid, CELL.START), maxSteps = this.maxSteps) {
    validateMap(grid);
    if (!startPos) return [];
    const path = [{ r: startPos.r, c: startPos.c }]; const visited = new Set([`${startPos.r},${startPos.c}`]);
    let r = startPos.r; let c = startPos.c;
    for (let step = 0; step < maxSteps && !this.isTerminal(grid, r, c); step += 1) {
      const valid = this.validActions(grid, r, c); if (!valid.length) break;
      const best = valid.reduce((current, action) => this.Q[r][c][action] > this.Q[r][c][current] ? action : current, valid[0]);
      r += ACTIONS[best][0]; c += ACTIONS[best][1];
      const key = `${r},${c}`; if (visited.has(key)) break;
      visited.add(key); path.push({ r, c });
    }
    return path;
  }

  /** Reachability follows environment termination: traps are not transit nodes. */
  isReachable(grid, startPos = findCell(grid, CELL.START)) {
    validateMap(grid);
    if (!startPos) return false;
    const visited = new Set([`${startPos.r},${startPos.c}`]); const queue = [startPos];
    while (queue.length) {
      const current = queue.shift(); const cell = grid[current.r][current.c];
      if (cell === CELL.GOAL) return true;
      if (cell === CELL.TRAP) continue;
      for (const [dr, dc] of ACTIONS) {
        const nr = current.r + dr; const nc = current.c + dc; const key = `${nr},${nc}`;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && grid[nr][nc] !== CELL.OBSTACLE && !visited.has(key)) { visited.add(key); queue.push({ r: nr, c: nc }); }
      }
    }
    return false;
  }
}
