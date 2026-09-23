import test from "node:test";
import assert from "node:assert/strict";
import { CELL, MazeAgent } from "../src/experiments/maze/MazeEngine.js";

test("maze bootstrap only sees legal actions, never an obstacle direction", () => {
  const grid = [[CELL.START, CELL.EMPTY, CELL.OBSTACLE], [CELL.EMPTY, CELL.EMPTY, CELL.GOAL]];
  const agent = new MazeAgent(2, 3, { alpha: 1, gamma: 0.9, epsilon: 0, seed: 1 });
  // Force the first move to the middle top cell. At that cell action 3 points
  // into an obstacle and must not affect the update for the legal move down.
  agent.Q[0][0][3] = 10;
  agent.Q[0][1][1] = 5;
  // At the successor (1,1), action 1 points out of the grid. The historical
  // bug used this 999 in max(Q[nextState]) even though it is illegal.
  agent.Q[1][1][1] = 999;
  agent.Q[1][1][3] = 2;
  agent.runEpisode(grid, { r: 0, c: 0 });
  assert.ok(Math.abs(agent.Q[0][1][1] - 0.8) < 1e-12, "legal update should use max Q over legal successor actions only");
  assert.equal(agent.validActions(grid, 0, 1).includes(3), false);
});

test("terminal traps are not transit nodes for reachability", () => {
  const grid = [[CELL.START, CELL.TRAP, CELL.EMPTY, CELL.GOAL], [CELL.OBSTACLE, CELL.OBSTACLE, CELL.OBSTACLE, CELL.OBSTACLE]];
  const agent = new MazeAgent(2, 4, { seed: 2 });
  assert.equal(agent.isReachable(grid, { r: 0, c: 0 }), false);
});

test("terminal goal update does not bootstrap from the goal Q row and reset clears learning", () => {
  const grid = [[CELL.START, CELL.GOAL], [CELL.EMPTY, CELL.EMPTY]];
  const agent = new MazeAgent(2, 2, { alpha: 1, gamma: 0.9, epsilon: 0, goalReward: 10, seed: 3 });
  agent.Q[0][0][3] = 1;
  agent.Q[0][1].fill(1000);
  agent.runEpisode(grid, { r: 0, c: 0 });
  assert.equal(agent.Q[0][0][3], 10);
  assert.equal(agent.history.length, 1);
  agent.resetLearning();
  assert.equal(agent.history.length, 0);
  assert.equal(agent.Q[0][0][3], 0);
});
