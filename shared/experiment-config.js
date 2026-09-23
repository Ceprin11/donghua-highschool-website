/**
 * The small, shared contract used by the browser experiments and the API.
 *
 * Configuration is data only.  The validators intentionally use an allow list
 * so a preset cannot turn into executable code or silently change an engine's
 * meaning.  `validateConfig(engine, value)` returns a complete copy using the
 * safe defaults.  Use `{ partial: true }` when validating an individual form
 * patch before merging it.
 */

export const ENGINE_KEYS = Object.freeze(["neural", "maze", "cv", "cnn", "lenet", "teachable", "transformer"]);

export const DEFAULT_CONFIGS = Object.freeze({
  cv: Object.freeze({}), cnn: Object.freeze({}), lenet: Object.freeze({}),
  teachable: Object.freeze({}), transformer: Object.freeze({}),
  neural: Object.freeze({
    schemaVersion: 1,
    problem: "classification",
    dataset: "circle",
    regressionDataset: "reg-plane",
    hiddenLayers: Object.freeze([4, 4]),
    features: Object.freeze(["x", "y"]),
    activation: "tanh",
    regularization: "none",
    regularizationRate: 0,
    learningRate: 0.3,
    noise: 0.05,
    testRatio: 0.3,
    batchSize: 32,
    samples: 160,
    seed: 42,
    stepsPerFrame: 3,
  }),
  maze: Object.freeze({
    schemaVersion: 1,
    map: "A",
    alpha: 0.2,
    gamma: 0.9,
    epsilon: 0.2,
    goalReward: 10,
    trapPenalty: -10,
    stepPenalty: -1,
    maxSteps: 50,
    seed: 42,
    speed: "normal",
  }),
});

const SCHEMA = {
  cv: { fields: {} }, cnn: { fields: {} }, lenet: { fields: {} },
  teachable: { fields: {} }, transformer: { fields: {} },
  neural: {
    fields: {
      schemaVersion: integer(1, 1),
      problem: oneOf(["classification", "regression"]),
      regressionDataset: oneOf(["reg-plane", "reg-gauss"]),
      dataset: oneOf(["blobs", "cluster", "circle", "xor", "spiral"]),
      hiddenLayers: arrayOf(integer(1, 8), 0, 6),
      features: arrayOf(oneOf(["x", "y", "xSquared", "ySquared", "xy", "sinX", "sinY"]), 1, 7),
      activation: oneOf(["tanh", "relu", "sigmoid", "linear"]),
      regularization: oneOf(["none", "l1", "l2"]),
      regularizationRate: number(0, 1),
      learningRate: number(0.0001, 1),
      noise: number(0, 1),
      testRatio: number(0.1, 0.9),
      batchSize: integer(1, 128),
      samples: integer(32, 1000),
      seed: integer(-2147483648, 2147483647),
      stepsPerFrame: integer(1, 12),
    },
  },
  maze: {
    fields: {
      schemaVersion: integer(1, 1),
      map: oneOf(["A", "B"]),
      grid: mazeGrid(),
      alpha: number(0, 1),
      gamma: number(0, 1),
      epsilon: number(0, 1),
      goalReward: number(-100, 100),
      trapPenalty: number(-100, 0),
      stepPenalty: number(-100, 0),
      maxSteps: integer(1, 500),
      seed: integer(-2147483648, 2147483647),
      speed: oneOf(["slow", "normal", "fast"]),
    },
  },
};

function integer(min, max) {
  return { check(value, path) {
    if (!Number.isInteger(value) || value < min || value > max) {
      fail(path, `必须是 ${min} 至 ${max} 的整数`);
    }
  } };
}

function number(min, max) {
  return { check(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      fail(path, `必须是 ${min} 至 ${max} 的有限数字`);
    }
  } };
}


function oneOf(values) {
  return { check(value, path) {
    if (!values.includes(value)) fail(path, `只能是 ${values.join("、")}`);
  } };
}


function arrayOf(item, minLength = 0, maxLength = Number.MAX_SAFE_INTEGER) {
  return { check(value, path) {
    if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
      fail(path, `必须是长度 ${minLength} 至 ${maxLength} 的数组`);
    }
    value.forEach((entry, index) => item.check(entry, `${path}[${index}]`));
  } };
}

function mazeGrid() {
  return { check(value, path) {
    if (!Array.isArray(value) || value.length < 2 || value.length > 12) fail(path, "地图行数必须是 2 至 12");
    const width = value[0]?.length;
    if (!Array.isArray(value[0]) || width < 2 || width > 12) fail(path, "地图列数必须是 2 至 12");
    let starts = 0; let goals = 0;
    value.forEach((row, r) => {
      if (!Array.isArray(row) || row.length !== width) fail(`${path}[${r}]`, "地图必须是规则矩形");
      row.forEach((cell, c) => {
        if (!Number.isInteger(cell) || cell < 0 || cell > 4) fail(`${path}[${r}][${c}]`, "地图格只能是 0 至 4");
        if (cell === 1) starts += 1;
        if (cell === 2) goals += 1;
      });
    });
    if (starts !== 1) fail(path, "地图必须有且只有一个起点");
    if (goals !== 1) fail(path, "地图必须有且只有一个终点");
  } };
}

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "必须是对象");
}

function assertOnlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, "不是允许的配置字段");
}

function fail(path, message) {
  throw new Error(`${path} 配置错误：${message}`);
}

function clone(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function mergeObjects(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    // Arrays, maps and candidate lists are values.  They are replaced as a
    // whole so a half-updated preset can never retain stale array entries.
    result[key] = Array.isArray(value) ? clone(value) : value && typeof value === "object" ? mergeObjects(result[key] || {}, value) : value;
  }
  return result;
}

/** Validate and return a complete, detached config. */
export function validateConfig(engine, value = {}, { partial = false } = {}) {
  if (!ENGINE_KEYS.includes(engine)) throw new Error(`未知实验引擎：${String(engine)}`);
  assertPlainObject(value, "config");
  const schema = SCHEMA[engine];
  const input = clone(value);
  assertOnlyKeys(input, Object.keys(schema.fields), "config");
  const config = partial ? input : mergeObjects(DEFAULT_CONFIGS[engine], input);
  for (const [key, validator] of Object.entries(schema.fields)) {
    if (Object.prototype.hasOwnProperty.call(config, key)) validator.check(config[key], `config.${key}`);
  }
  if (!partial && schema.refine) schema.refine(config);
  return config;
}

/** Merge preset layers. Later objects win and arrays are replaced. */
export function mergeConfig(engine, ...layers) {
  if (!ENGINE_KEYS.includes(engine)) throw new Error(`未知实验引擎：${String(engine)}`);
  let merged = {};
  for (const layer of layers) {
    const patch = layer == null ? {} : validateConfig(engine, layer, { partial: true });
    merged = mergeObjects(merged, patch);
  }
  return validateConfig(engine, merged);
}
