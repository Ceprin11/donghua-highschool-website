// Q-learning on a 2D grid — real Q-table updates, epsilon-greedy action selection.
// Q(s,a) ← Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]; terminal goal uses r only.

export const CELL = { EMPTY: 0, START: 1, GOAL: 2, OBSTACLE: 3, TRAP: 4 };

export function emptyMap(rows, cols) {
  const grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(CELL.EMPTY));
  return grid;
}

export function defaultMapA() {
  const g = emptyMap(6, 6);
  g[0][0] = CELL.START;
  g[5][5] = CELL.GOAL;
  g[2][2] = CELL.OBSTACLE;
  g[2][3] = CELL.OBSTACLE;
  g[3][3] = CELL.OBSTACLE;
  g[4][1] = CELL.TRAP;
  return g;
}

export function defaultMapB() {
  const g = emptyMap(6, 6);
  g[0][0] = CELL.START;
  g[0][5] = CELL.GOAL;
  g[2][1] = CELL.OBSTACLE;
  g[2][2] = CELL.OBSTACLE;
  g[2][3] = CELL.OBSTACLE;
  g[2][4] = CELL.OBSTACLE;
  g[4][3] = CELL.TRAP;
  g[3][0] = CELL.TRAP;
  return g;
}

const ACTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // up, down, left, right

export class MazeAgent {
  constructor(rows, cols, config = {}) {
    this.rows = rows;
    this.cols = cols;
    this.alpha = config.alpha ?? 0.2;
    this.gamma = config.gamma ?? 0.9;
    this.epsilon = config.epsilon ?? 0.2;
    this.goalReward = config.goalReward ?? 10;
    this.trapPenalty = config.trapPenalty ?? -10;
    this.stepPenalty = config.stepPenalty ?? -1;
    this.maxSteps = config.maxSteps ?? 50;
    this.resetLearning();
  }

  resetLearning() {
    this.Q = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) row.push(new Array(4).fill(0));
      this.Q.push(row);
    }
    this.episodes = 0;
    this.history = [];
  }

  isTerminal(grid, r, c) {
    return grid[r][c] === CELL.GOAL || grid[r][c] === CELL.TRAP;
  }

  validActions(grid, r, c) {
    const out = [];
    for (let a = 0; a < 4; a++) {
      const nr = r + ACTIONS[a][0];
      const nc = c + ACTIONS[a][1];
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && grid[nr][nc] !== CELL.OBSTACLE) {
        out.push(a);
      }
    }
    return out;
  }

  pickAction(grid, r, c) {
    const valid = this.validActions(grid, r, c);
    if (valid.length === 0) return -1;
    if (Math.random() < this.epsilon) {
      return valid[Math.floor(Math.random() * valid.length)];
    }
    // pick max Q among valid, tie-break randomly
    let best = valid[0];
    let bestVal = this.Q[r][c][best];
    const ties = [best];
    for (let i = 1; i < valid.length; i++) {
      const a = valid[i];
      const v = this.Q[r][c][a];
      if (Math.abs(v - bestVal) < 1e-9) { ties.push(a); }
      else if (v > bestVal) { bestVal = v; best = a; ties.length = 0; ties.push(a); }
    }
    return ties[Math.floor(Math.random() * ties.length)];
  }

  // Run one episode, returns { steps, reward, reachedGoal }
  runEpisode(grid, startPos) {
    let r = startPos.r, c = startPos.c;
    let totalReward = 0;
    let steps = 0;
    let reachedGoal = false;
    while (steps < this.maxSteps) {
      const a = this.pickAction(grid, r, c);
      if (a < 0) break;
      const nr = r + ACTIONS[a][0];
      const nc = c + ACTIONS[a][1];
      let reward = this.stepPenalty;
      let terminal = false;
      if (grid[nr][nc] === CELL.GOAL) { reward = this.goalReward; reachedGoal = true; terminal = true; }
      else if (grid[nr][nc] === CELL.TRAP) { reward = this.trapPenalty; terminal = true; }
      // update
      const target = terminal ? reward : reward + this.gamma * Math.max(...this.Q[nr][nc]);
      this.Q[r][c][a] += this.alpha * (target - this.Q[r][c][a]);
      totalReward += reward;
      steps++;
      r = nr; c = nc;
      if (terminal) break;
    }
    this.episodes++;
    this.history.push({ episode: this.episodes, steps, reward: totalReward, reachedGoal });
    return { steps, reward: totalReward, reachedGoal };
  }

  // Derive current greedy policy path (not used as "learned shortest path" claim)
  greedyPath(grid, startPos, maxSteps = 30) {
    const path = [{ r: startPos.r, c: startPos.c }];
    let r = startPos.r, c = startPos.c;
    const visited = new Set([`${r},${c}`]);
    for (let s = 0; s < maxSteps; s++) {
      if (this.isTerminal(grid, r, c)) break;
      const valid = this.validActions(grid, r, c);
      if (valid.length === 0) break;
      let best = valid[0];
      for (const a of valid) if (this.Q[r][c][a] > this.Q[r][c][best]) best = a;
      r += ACTIONS[best][0];
      c += ACTIONS[best][1];
      const key = `${r},${c}`;
      if (visited.has(key)) break;
      visited.add(key);
      path.push({ r, c });
    }
    return path;
  }

  // BFS reachability check (separate from RL)
  isReachable(grid, startPos) {
    const visited = new Set([`${startPos.r},${startPos.c}`]);
    const queue = [startPos];
    while (queue.length) {
      const { r, c } = queue.shift();
      if (grid[r][c] === CELL.GOAL) return true;
      for (const [dr, dc] of ACTIONS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
            grid[nr][nc] !== CELL.OBSTACLE && !visited.has(`${nr},${nc}`)) {
          visited.add(`${nr},${nc}`);
          queue.push({ r: nr, c: nc });
        }
      }
    }
    return false;
  }
}