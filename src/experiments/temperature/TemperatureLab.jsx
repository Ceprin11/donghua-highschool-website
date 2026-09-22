// Softmax with temperature and sampling — real computation, no LLM calls.
// p_i = exp((z_i - max(z))/T) / sum_j exp((z_j - max(z))/T)

export function softmax(logits, temperature) {
  // T=0 handled separately as greedy by caller
  const T = Math.max(temperature, 1e-6);
  const maxZ = Math.max(...logits);
  const exps = logits.map((z) => Math.exp((z - maxZ) / T));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function greedyPick(logits) {
  let best = 0;
  for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
  return best;
}

export function sampleIndex(probs) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1;
}

export const SAMPLE_SENTENCES = [
  {
    text: "春天到了，校园里的花……",
    candidates: [
      { id: "kai", text: "开了", logits: 3.2 },
      { id: "xie", text: "谢了", logits: 1.1 },
      { id: "luo", text: "落了", logits: 0.8 },
      { id: "zhang", text: "长了", logits: 1.6 },
    ],
  },
  {
    text: "夜空中的星星……",
    candidates: [
      { id: "liang", text: "亮了", logits: 2.8 },
      { id: "an", text: "暗了", logits: 0.9 },
      { id: "shanshuo", text: "闪烁着", logits: 2.1 },
      { id: "xiaoshi", text: "消失了", logits: 0.4 },
    ],
  },
  {
    text: "机器人学会了……",
    candidates: [
      { id: "zoulu", text: "走路", logits: 2.5 },
      { id: "sikao", text: "思考", logits: 1.9 },
      { id: "shuijiao", text: "睡觉", logits: 0.3 },
      { id: "xiuli", text: "修理自己", logits: 0.7 },
    ],
  },
];