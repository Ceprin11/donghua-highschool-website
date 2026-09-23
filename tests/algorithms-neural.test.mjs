import test from "node:test";
import assert from "node:assert/strict";
import { NeuralNet, generateData, numericalGradientCheck, splitData } from "../src/experiments/neural/NeuralEngine.js";

test("neural data is deterministic and train/test indices do not overlap", () => {
  const first = generateData("xor", { seed: 18, count: 80, noise: 0.04 });
  const second = generateData("xor", { seed: 18, count: 80, noise: 0.04 });
  assert.deepEqual(first, second);
  const split = splitData(first.points, first.labels, 0.25, 19);
  assert.equal(split.train.points.length + split.test.points.length, 80);
  assert.equal(new Set([...split.trainIndices, ...split.testIndices]).size, 80);
  assert.equal(split.trainIndices.filter((index) => split.testIndices.includes(index)).length, 0);
});

test("MLP gradients match finite differences and XOR learns", () => {
  const data = generateData("xor", { seed: 4, count: 120, noise: 0.02 });
  const split = splitData(data.points, data.labels, 0.25, 5);
  const model = new NeuralNet([2, 6, 6, 1], { seed: 7, batchSize: 24 });
  const check = numericalGradientCheck(model, split.train.points.slice(0, 5), split.train.labels.slice(0, 5));
  assert.ok(check.maxRelativeError < 1e-4, `gradient error ${check.maxRelativeError}`);
  const initialLoss = model.computeLoss(split.train.points, split.train.labels);
  for (let epoch = 0; epoch < 180; epoch += 1) model.trainEpoch(split.train.points, split.train.labels, 0.2, 24);
  assert.ok(model.computeLoss(split.train.points, split.train.labels) < initialLoss * 0.35);
  assert.ok(model.accuracy(split.test.points, split.test.labels) >= 0.75);
});

test("playground activations, transformed inputs and regularization have correct gradients", () => {
  const points = [[.24, -.31], [-.54, .62], [.78, .12]];
  for (const activation of ["tanh", "relu", "sigmoid", "linear"]) {
    for (const regularization of ["none", "l1", "l2"]) {
      const model = new NeuralNet([3, 3, 1], 28, { features: ["xSquared", "xy", "sinY"], activation, regularization, regularizationRate: .02 });
      const check = numericalGradientCheck(model, points, [0, 1, 1]);
      assert.ok(check.maxRelativeError < .001, `${activation}/${regularization}: ${check.maxRelativeError}`);
    }
  }
});

test("squared input features let a network without hidden layers learn concentric circles", () => {
  const data = generateData("circle", { seed: 19, count: 160, noise: 0 });
  const split = splitData(data.points, data.labels, .3, 20);
  const model = new NeuralNet([2, 1], 21, { features: ["xSquared", "ySquared"] });
  const initial = model.computeLoss(split.train.points, split.train.labels);
  for (let epoch = 0; epoch < 300; epoch++) model.trainEpoch(split.train.points, split.train.labels, .3);
  assert.ok(model.computeLoss(split.train.points, split.train.labels) < initial * .4);
  assert.ok(model.accuracy(split.test.points, split.test.labels) > .95);
});

test("regression datasets are deterministic, continuous and cover negative and positive targets", () => {
  for (const dataset of ["reg-plane", "reg-gauss"]) {
    const data = generateData(dataset, 42, { count: 160, noise: .05 });
    assert.deepEqual(data, generateData(dataset, 42, { count: 160, noise: .05 }));
    assert.equal(data.problem, "regression");
    assert.ok(data.labels.some(y => y < 0));
    assert.ok(data.labels.some(y => y > 0));
    assert.ok(new Set(data.labels).size > 100);
    const clean = generateData(dataset, 42, { count: 160, noise: 0 });
    assert.deepEqual(data.points, clean.points);
    assert.notDeepEqual(data.labels, clean.labels);
  }
});

test("regression gradients match mean squared error for all activations and regularizers", () => {
  for (const activation of ["tanh", "relu", "sigmoid", "linear"]) for (const regularization of ["none", "l1", "l2"]) {
    const model = new NeuralNet([3, 3, 1], 28, { problem: "regression", features: ["xSquared", "xy", "sinY"], activation, regularization, regularizationRate: .02 });
    const check = numericalGradientCheck(model, [[.24, -.31], [-.54, .62], [.78, .12]], [-.45, .27, .62]);
    assert.ok(check.maxRelativeError < .001, `${activation}/${regularization}: ${check.maxRelativeError}`);
  }
  const linear = new NeuralNet([2, 1], 7, { problem: "regression" });
  linear.weights = [[[2, -1]]]; linear.biases = [[.5]];
  assert.equal(linear.predict([-1, 1]), -2.5);
  assert.equal(linear.predict([1, -1]), 3.5);
  assert.equal(linear.computeLoss([[0, 0]], [-.5]), 1);
  assert.equal(linear.rootMeanSquaredError([[0, 0]], [-.5]), 1);
});

test("regression learns plane and multi-Gaussian targets on held-out data", () => {
  for (const dataset of ["reg-plane", "reg-gauss"]) {
    const data = generateData(dataset, 42, { count: 160, noise: .05 });
    const split = splitData(data.points, data.labels, .3, 43);
    const model = new NeuralNet([2, 4, 4, 1], 44, { problem: "regression" });
    const initial = model.rootMeanSquaredError(split.test.points, split.test.labels);
    for (let i = 0; i < 900; i++) model.trainStep(split.train.points, split.train.labels, .3);
    const final = model.rootMeanSquaredError(split.test.points, split.test.labels);
    assert.ok(final < initial * .6, `${dataset}: RMSE ${initial} to ${final}`);
    if (dataset === "reg-plane") assert.ok(final < .04);
  }
});
