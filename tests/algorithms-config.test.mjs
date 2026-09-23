import test from "node:test";
import assert from "node:assert/strict";
import { ENGINE_KEYS, mergeConfig, validateConfig } from "../shared/experiment-config.js";

test("registered engine configs have defaults and arrays replace", () => {
  assert.deepEqual(ENGINE_KEYS, ["neural", "maze", "cv", "cnn", "lenet", "teachable", "transformer"]);
  const merged = mergeConfig("neural", { hiddenLayers: [2] }, { dataset: "xor" });
  assert.deepEqual(merged.hiddenLayers, [2]);
  assert.equal(merged.dataset, "xor");
  assert.deepEqual(validateConfig("cnn", {}), {});
});

test("config validation rejects unknown fields and unsafe ranges", () => {
  assert.throws(() => validateConfig("neural", { script: "run()" }), /不是允许的配置字段/);
  assert.throws(() => validateConfig("cnn", { iframeUrl: "https://example.com" }), /不是允许的配置字段/);
  assert.throws(() => validateConfig("maze", { epsilon: 2 }), /epsilon/);
});

test("neural task configs preserve separate classification and regression datasets", () => {
  assert.equal(validateConfig("neural", { dataset: "xor" }).problem, "classification");
  const config = mergeConfig("neural", { dataset: "spiral" }, { problem: "regression", regressionDataset: "reg-gauss" });
  assert.equal(config.dataset, "spiral");
  assert.equal(config.problem, "regression");
  assert.equal(config.regressionDataset, "reg-gauss");
  assert.throws(() => validateConfig("neural", { problem: "clustering" }), /problem/);
  assert.throws(() => validateConfig("neural", { regressionDataset: "circle" }), /regressionDataset/);
});
