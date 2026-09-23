/*
 * A small, independent MLP used by the classroom neural-network lab.
 *
 * It deliberately has no framework or network dependency. The same forward
 * pass is used by training, loss reporting and the decision-map renderer.
 * Hidden layers support tanh, ReLU, sigmoid and linear activations. The output
 * uses sigmoid with binary cross-entropy for classification, or a linear
 * output with mean squared error for regression, plus optional L1/L2 penalties.
 * The implementation also exposes a finite-difference check.
 */

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

function gaussian(random) {
  const u = Math.max(random(), Number.MIN_VALUE);
  const v = Math.max(random(), Number.MIN_VALUE);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function datasetOptions(seedOrOptions, maybeOptions) {
  if (seedOrOptions && typeof seedOrOptions === "object") return { seed: 42, ...seedOrOptions };
  return { seed: seedOrOptions ?? 42, ...(maybeOptions || {}) };
}

/** Generate deterministic two-dimensional classification or regression data. */
export function generateData(dataset = "circle", seedOrOptions = 42, maybeOptions = {}) {
  const options = datasetOptions(seedOrOptions, maybeOptions);
  const random = seededRandom(options.seed);
  const count = Math.max(8, Math.min(1000, Math.floor(options.count ?? options.samples ?? 160)));
  const noise = clamp(Number(options.noise ?? 0), 0, 1);
  const key = dataset === "blobs" || dataset === "twoBlobs" ? "cluster" : dataset;
  if (!["cluster", "circle", "xor", "spiral", "reg-plane", "reg-gauss"].includes(key)) throw new Error(`未知神经网络数据集：${String(dataset)}`);

  if (key === "reg-plane" || key === "reg-gauss") {
    const points = []; const labels = [];
    for (let i = 0; i < count; i++) {
      const x = random() * 2 - 1, y = random() * 2 - 1;
      const target = key === "reg-plane" ? (x + y) / 2 :
        [[-.45, -.45, 1], [.45, .45, 1], [-.45, .45, -1], [.45, -.45, -1]].reduce((sum, [cx, cy, sign]) => sum + sign * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / .1), 0);
      points.push([x, y]);
      labels.push(target + gaussian(random) * noise * .25);
    }
    return { dataset: key, problem: "regression", points, labels };
  }

  const points = [];
  const labels = [];
  for (let i = 0; i < count; i += 1) {
    const label = i % 2;
    let x = 0;
    let y = 0;
    if (key === "cluster") {
      const center = label === 0 ? -0.45 : 0.45;
      x = center + gaussian(random) * (0.17 + noise * 0.23);
      y = center + gaussian(random) * (0.17 + noise * 0.23);
    } else if (key === "circle") {
      const angle = random() * Math.PI * 2;
      const radius = label === 0 ? 0.27 + random() * 0.15 : 0.63 + random() * 0.2;
      const radialJitter = gaussian(random) * noise * 0.18;
      x = (radius + radialJitter) * Math.cos(angle);
      y = (radius + radialJitter) * Math.sin(angle);
    } else if (key === "xor") {
      x = random() * 2 - 1;
      y = random() * 2 - 1;
      const quadrantLabel = (x >= 0) === (y >= 0) ? 1 : 0;
      x += gaussian(random) * noise * 0.08;
      y += gaussian(random) * noise * 0.08;
      points.push([clamp(x, -1, 1), clamp(y, -1, 1)]);
      labels.push(quadrantLabel);
      continue;
    } else {
      const t = 0.12 + (Math.floor(i / 2) / Math.max(1, count / 2 - 1)) * 0.88;
      const angle = 1.65 * Math.PI * t + (label ? Math.PI : 0);
      const radius = t;
      x = radius * Math.cos(angle) + gaussian(random) * noise * 0.11;
      y = radius * Math.sin(angle) + gaussian(random) * noise * 0.11;
    }
    points.push([clamp(x, -1, 1), clamp(y, -1, 1)]);
    labels.push(label);
  }
  return { dataset: key, problem: "classification", points, labels };
}

/** Deterministic, seeded train/test split. Test points never enter trainBatch. */
export function splitData(points, labels, testRatio = 0.3, seed = 1337) {
  if (!Array.isArray(points) || !Array.isArray(labels) || points.length !== labels.length || points.length < 2) throw new Error("神经网络数据切分错误：points 和 labels 必须等长且至少有两个样本");
  if (!Number.isFinite(testRatio) || testRatio <= 0 || testRatio >= 1) throw new Error("神经网络数据切分错误：testRatio 必须在 0 和 1 之间");
  const indices = points.map((_, index) => index);
  const random = seededRandom(seed);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const testCount = Math.max(1, Math.min(points.length - 1, Math.round(points.length * testRatio)));
  const testIndices = indices.slice(0, testCount);
  const trainIndices = indices.slice(testCount);
  const pack = (chosen) => ({ points: chosen.map((index) => [...points[index]]), labels: chosen.map((index) => Number(labels[index])) });
  return { train: pack(trainIndices), test: pack(testIndices), trainIndices, testIndices };
}

export const INPUT_FEATURES = [
  { key: "x", label: "X₁", value: (x, _y) => x },
  { key: "y", label: "X₂", value: (x, y) => y },
  { key: "xSquared", label: "X₁²", value: (x, _y) => x * x },
  { key: "ySquared", label: "X₂²", value: (x, y) => y * y },
  { key: "xy", label: "X₁X₂", value: (x, y) => x * y },
  { key: "sinX", label: "sin(X₁)", value: (x, _y) => Math.sin(x) },
  { key: "sinY", label: "sin(X₂)", value: (x, y) => Math.sin(y) },
];

const ACTIVATIONS = {
  tanh: { value: Math.tanh, derivative: (z, a) => 1 - a * a },
  relu: { value: z => Math.max(0, z), derivative: z => z > 0 ? 1 : 0 },
  sigmoid: { value: sigmoid, derivative: (z, a) => a * (1 - a) },
  linear: { value: z => z, derivative: () => 1 },
};

function sigmoid(value) {
  if (value >= 0) {
    const e = Math.exp(-value);
    return 1 / (1 + e);
  }
  const e = Math.exp(value);
  return e / (1 + e);
}

function assertVector(input, expected, name = "输入") {
  if (!Array.isArray(input) || input.length !== expected || input.some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error(`${name}必须包含 ${expected} 个有限数字`);
}

export class NeuralNet {
  constructor(layerSizes = [2, 4, 1], seed = 1, options = {}) {
    if (!Array.isArray(layerSizes) || layerSizes.length < 2 || layerSizes.some((size) => !Number.isInteger(size) || size < 1 || size > 64)) throw new Error("神经网络结构错误：每层必须有 1 至 64 个节点");
    this.features = options.features || ["x", "y"];
    if (!this.features.length || this.features.some(key => !INPUT_FEATURES.some(f => f.key === key)) || layerSizes[0] !== this.features.length || layerSizes.at(-1) !== 1) throw new Error("网络输入必须匹配所选特征，并使用 1 个输出");
    this.problem = options.problem || "classification";
    if (!["classification", "regression"].includes(this.problem)) throw new Error("未知任务类型");
    this.featureFunctions = this.features.map(key => INPUT_FEATURES.find(f => f.key === key).value);
    this.activation = options.activation || "tanh";
    if (!ACTIVATIONS[this.activation]) throw new Error("未知激活函数");
    this.regularization = options.regularization || "none";
    this.regularizationRate = options.regularizationRate || 0;
    const config = seed && typeof seed === "object" ? seed : { seed };
    this.layerSizes = [...layerSizes];
    this.seed = config.seed ?? 1;
    this.batchSize = Math.max(1, Math.min(128, Math.floor(config.batchSize ?? options.batchSize ?? 32)));
    this.random = seededRandom(this.seed);
    this.weights = [];
    this.biases = [];
    for (let layer = 1; layer < this.layerSizes.length; layer += 1) {
      const inputSize = this.layerSizes[layer - 1];
      const outputSize = this.layerSizes[layer];
      const limit = Math.sqrt(6 / (inputSize + outputSize));
      this.weights.push(Array.from({ length: outputSize }, () => Array.from({ length: inputSize }, () => (this.random() * 2 - 1) * limit)));
      this.biases.push(new Array(outputSize).fill(0));
    }
    this.batchCursor = 0;
  }

  forwardWithCache(input) {
    assertVector(input, 2);
    const activations = [this.featureFunctions.map(fn => fn(input[0], input[1]))];
    const preActivations = [];
    for (let layer = 0; layer < this.weights.length; layer += 1) {
      const values = this.weights[layer].map((row, outputIndex) => row.reduce((sum, weight, inputIndex) => sum + weight * activations[layer][inputIndex], this.biases[layer][outputIndex]));
      preActivations.push(values);
      const isOutput = layer === this.weights.length - 1;
      activations.push(values.map((value) => isOutput ? this.problem === "regression" ? value : sigmoid(value) : ACTIVATIONS[this.activation].value(value)));
    }
    return { activations, preActivations };
  }

  forward(input) {
    return this.forwardWithCache(input).activations[this.weights.length][0];
  }

  predict(input) { return this.forward(input); }

  predictClass(input, threshold = 0.5) { return this.predict(input) >= threshold ? 1 : 0; }

  computeLoss(points, labels) {
    this.assertDataset(points, labels);
    let total = 0;
    for (let i = 0; i < points.length; i += 1) {
      if (this.problem === "regression") {
        total += (this.predict(points[i]) - labels[i]) ** 2;
      } else {
        const prediction = Math.max(1e-7, Math.min(1 - 1e-7, this.predict(points[i])));
        const target = labels[i];
        total += -(target * Math.log(prediction) + (1 - target) * Math.log(1 - prediction));
      }
    }
    const penalty = this.weights.flat(2).reduce((sum, weight) => sum + (this.regularization === "l1" ? Math.abs(weight) : this.regularization === "l2" ? weight * weight / 2 : 0), 0);
    return total / points.length + this.regularizationRate * penalty;
  }

  accuracy(points, labels) {
    this.assertDataset(points, labels);
    let correct = 0;
    for (let i = 0; i < points.length; i += 1) if (this.predictClass(points[i]) === (labels[i] ? 1 : 0)) correct += 1;
    return correct / points.length;
  }

  rootMeanSquaredError(points, labels) {
    this.assertDataset(points, labels);
    return Math.sqrt(points.reduce((total, point, i) => total + (this.predict(point) - labels[i]) ** 2, 0) / points.length);
  }

  gradients(points, labels) {
    this.assertDataset(points, labels);
    const gradients = { weights: this.weights.map((matrix) => matrix.map((row) => new Array(row.length).fill(0))), biases: this.biases.map((row) => new Array(row.length).fill(0)) };
    for (let sample = 0; sample < points.length; sample += 1) {
      const { activations, preActivations } = this.forwardWithCache(points[sample]);
      const deltas = new Array(this.weights.length);
      deltas[deltas.length - 1] = [(activations.at(-1)[0] - labels[sample]) * (this.problem === "regression" ? 2 : 1)];
      for (let layer = this.weights.length - 2; layer >= 0; layer -= 1) {
        deltas[layer] = this.weights[layer].map((_, node) => {
          let downstream = 0;
          for (let next = 0; next < this.weights[layer + 1].length; next += 1) downstream += this.weights[layer + 1][next][node] * deltas[layer + 1][next];
          const activation = activations[layer + 1][node];
          return downstream * ACTIVATIONS[this.activation].derivative(preActivations[layer][node], activation);
        });
      }
      for (let layer = 0; layer < this.weights.length; layer += 1) {
        for (let node = 0; node < this.weights[layer].length; node += 1) {
          gradients.biases[layer][node] += deltas[layer][node];
          for (let input = 0; input < this.weights[layer][node].length; input += 1) gradients.weights[layer][node][input] += deltas[layer][node] * activations[layer][input];
        }
      }
    }
    const scale = 1 / points.length;
    gradients.weights.forEach((matrix, layer) => matrix.forEach((row, node) => row.forEach((value, input) => {
      const weight = this.weights[layer][node][input];
      row[input] = value * scale + this.regularizationRate * (this.regularization === "l1" ? Math.sign(weight) : this.regularization === "l2" ? weight : 0);
    })));
    for (const row of gradients.biases) for (let i = 0; i < row.length; i += 1) row[i] *= scale;
    return gradients;
  }

  trainBatch(points, labels, learningRate = 0.1) {
    if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) throw new Error("学习率必须是 0 和 1 之间的有限数字");
    const gradients = this.gradients(points, labels);
    for (let layer = 0; layer < this.weights.length; layer += 1) {
      for (let node = 0; node < this.weights[layer].length; node += 1) {
        this.biases[layer][node] -= learningRate * gradients.biases[layer][node];
        for (let input = 0; input < this.weights[layer][node].length; input += 1) this.weights[layer][node][input] -= learningRate * gradients.weights[layer][node][input];
      }
    }
    return this.computeLoss(points, labels);
  }

  /** Train one bounded batch, rotating through the dataset deterministically. */
  trainStep(points, labels, learningRate = 0.1, batchSize = this.batchSize) {
    this.assertDataset(points, labels);
    const size = Math.max(1, Math.min(this.batchSize, Math.floor(batchSize || this.batchSize), points.length));
    const batchPoints = [];
    const batchLabels = [];
    for (let i = 0; i < size; i += 1) {
      const index = (this.batchCursor + i) % points.length;
      batchPoints.push(points[index]);
      batchLabels.push(labels[index]);
    }
    this.batchCursor = (this.batchCursor + size) % points.length;
    return this.trainBatch(batchPoints, batchLabels, learningRate);
  }

  trainEpoch(points, labels, learningRate = 0.1, batchSize = this.batchSize) {
    this.assertDataset(points, labels);
    const size = Math.max(1, Math.min(this.batchSize, Math.floor(batchSize || this.batchSize), points.length));
    let batches = 0;
    for (let offset = 0; offset < points.length; offset += size) {
      const end = Math.min(points.length, offset + size);
      this.trainBatch(points.slice(offset, end), labels.slice(offset, end), learningRate);
      batches += 1;
    }
    return { batches, loss: this.computeLoss(points, labels) };
  }

  getNetworkSnapshot() {
    return { layerSizes: [...this.layerSizes], weights: this.weights.map((m) => m.map((row) => [...row])), biases: this.biases.map((row) => [...row]) };
  }

  setNetworkSnapshot(snapshot) {
    if (!snapshot || JSON.stringify(snapshot.layerSizes) !== JSON.stringify(this.layerSizes)) throw new Error("网络快照结构与当前网络不一致");
    this.weights = snapshot.weights.map((m) => m.map((row) => [...row]));
    this.biases = snapshot.biases.map((row) => [...row]);
  }

  assertDataset(points, labels) {
    if (!Array.isArray(points) || !Array.isArray(labels) || points.length !== labels.length || points.length < 1) throw new Error("神经网络训练数据必须非空且等长");
    points.forEach((point) => assertVector(point, 2, "训练点"));
    labels.forEach((label) => {
      if (!Number.isFinite(label)) throw new Error("目标值必须是有限数字");
      if (this.problem === "classification" && label !== 0 && label !== 1) throw new Error("分类标签只能是 0 或 1");
    });
  }
}

/** Build the same model's probabilities over a square coordinate grid. */
export function decisionGrid(network, resolution = 24) {
  if (!network || typeof network.predict !== "function") throw new Error("decisionGrid 需要一个可预测的网络");
  const size = Math.max(2, Math.min(80, Math.floor(resolution)));
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => network.predict([(col / (size - 1)) * 2 - 1, 1 - (row / (size - 1)) * 2])));
}

/** Compare analytic gradients to finite differences on a small network. */
export function numericalGradientCheck(network, points, labels, { epsilon = 1e-5, maxParameters = 256 } = {}) {
  const analytic = network.gradients(points, labels);
  const checked = [];
  for (let layer = 0; layer < network.weights.length && checked.length < maxParameters; layer += 1) {
    for (let node = 0; node < network.weights[layer].length && checked.length < maxParameters; node += 1) {
      for (let input = 0; input < network.weights[layer][node].length && checked.length < maxParameters; input += 1) {
        const original = network.weights[layer][node][input];
        network.weights[layer][node][input] = original + epsilon;
        const plus = network.computeLoss(points, labels);
        network.weights[layer][node][input] = original - epsilon;
        const minus = network.computeLoss(points, labels);
        network.weights[layer][node][input] = original;
        checked.push({ analytic: analytic.weights[layer][node][input], numerical: (plus - minus) / (2 * epsilon) });
      }
    }
  }
  for (let layer = 0; layer < network.biases.length && checked.length < maxParameters; layer += 1) {
    for (let node = 0; node < network.biases[layer].length && checked.length < maxParameters; node += 1) {
      const original = network.biases[layer][node];
      network.biases[layer][node] = original + epsilon;
      const plus = network.computeLoss(points, labels);
      network.biases[layer][node] = original - epsilon;
      const minus = network.computeLoss(points, labels);
      network.biases[layer][node] = original;
      checked.push({ analytic: analytic.biases[layer][node], numerical: (plus - minus) / (2 * epsilon) });
    }
  }
  const errors = checked.map(({ analytic: a, numerical: n }) => Math.abs(a - n) / Math.max(1e-8, Math.abs(a) + Math.abs(n)));
  return { checked: checked.length, maxRelativeError: Math.max(...errors, 0), meanRelativeError: errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length) };
}
