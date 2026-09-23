import { NEW_LABS, NEW_QUESTIONS, NEW_PRESETS } from './lab-seed.js';
import { DEFAULT_CONFIGS } from '../shared/experiment-config.js';
import { createRecord, publishRecord } from './content.js';
import { COURSE_CONTENT } from './course-content.js';

export const SEED_THEMES = Object.freeze([
  { slug: 'intro-ai', title: '走进人工智能', summary: '认识人工智能的基本概念、学习方式和应用边界。', keywords: ['数据', '模型', '智能'], experiment_slugs: ['neural-network'], sort_order: 10 },
  { slug: 'computer-vision', title: '用计算机视觉理解现实世界', summary: '观察卷积网络的图像特征，亲手训练姿势分类器。', keywords: ['像素', '图像', '视觉'], experiment_slugs: ['cv'], sort_order: 20 },
  { slug: 'generative-ai', title: '生成式 AI 与智能内容创作', summary: '通过 Transformer 的词元、注意力与采样理解语言生成。', keywords: ['生成', '概率', '温度'], experiment_slugs: ['transformer'], sort_order: 30 },
  { slug: 'embodied-intelligence', title: '从大模型到具身智能', summary: '观察智能体如何在环境中学习策略并通过动作完成任务。', keywords: ['智能体', '奖励', '行动'], experiment_slugs: ['reward-maze'], sort_order: 40 },
]);

export const SEED_EXPERIMENTS = Object.freeze([
  ...NEW_LABS,
  { slug: 'neural-network', engine_key: 'neural', title: '神经网络训练', theme_slug: 'intro-ai', summary: '调整数据和网络结构，观察模型如何学习分类。', instructions: '选择数据集，点击训练并观察损失和分类边界。', explanation: '前向传播、损失计算和反向传播共同改变网络参数。', computation_label: '神经网络与分类', default_config: DEFAULT_CONFIGS.neural, runtime_status: 'ready', sort_order: 10, featured: true },
  { slug: 'reward-maze', engine_key: 'maze', title: '机器人奖励迷宫', theme_slug: 'embodied-intelligence', summary: '通过 Q-learning 观察机器人从奖励中学习策略。', instructions: '选择地图和奖励参数，训练后试走策略。', explanation: '智能体依据允许动作和终止状态更新 Q 值。', computation_label: '奖励与策略', default_config: DEFAULT_CONFIGS.maze, runtime_status: 'ready', sort_order: 40, featured: true },
]);

function seedPresets() {
  return [
    ...NEW_PRESETS,
    { slug: 'neural-blobs', experiment_slug: 'neural-network', title: '从两团点开始', task_description: '先用没有隐藏层的网络区分两团点，观察训练损失与测试损失。', hint: '再切换 XOR，比较同一网络的能力。', config: { dataset: 'blobs', hiddenLayers: [], learningRate: 0.2, noise: 0.05, seed: 42 }, sort_order: 1 },
    { slug: 'neural-xor', experiment_slug: 'neural-network', title: '让网络学会 XOR', task_description: '训练带两个隐藏层的网络，观察弯曲的分类边界。', hint: '增加节点后还需要训练，结构本身不会自动给出正确答案。', config: { dataset: 'xor', hiddenLayers: [4,4], learningRate: 0.3, noise: 0.03, seed: 42 }, sort_order: 2 },
    { slug: 'maze-explore', experiment_slug: 'reward-maze', title: '探索一条安全路线', task_description: '在地图 A 中学习到达终点的策略，避开终止陷阱。', hint: '先训练，再使用策略试走。', config: { map: 'A', epsilon: 0.3, goalReward: 10, trapPenalty: -10, stepPenalty: -1, seed: 42 }, sort_order: 1 },
    { slug: 'maze-rewards', experiment_slug: 'reward-maze', title: '奖励改变会怎样', task_description: '在地图 B 中提高陷阱惩罚，观察回合奖励与试走结果。', hint: '更改奖励后旧学习会清空，比较时要留出训练过程。', config: { map: 'B', epsilon: 0.2, goalReward: 15, trapPenalty: -20, stepPenalty: -0.5, seed: 42 }, sort_order: 2 },
  ];
}

function seedQuestions() {
  const rows = [];
  function add(experiment_slug, question, answers, correct, explanation, type = 'single') {
    const n = rows.filter(row => row.experiment_slug === experiment_slug).length + 1;
    rows.push({ slug: `${experiment_slug}-q${n}`, experiment_slug, type, question, options: answers.map((text, i) => ({ id: String.fromCharCode(97+i), text })), correct_option_id: String.fromCharCode(97+correct), explanation, sort_order: n });
  }
  add('neural-network', '训练集和测试集的用途有什么不同？', ['训练集更新参数，测试集检查泛化', '两者都用于每步更新参数', '测试集只负责显示颜色'], 0, '测试集不参与模型参数更新，帮助判断模型能否处理未参与训练的数据。');
  add('neural-network', '反向传播主要计算什么？', ['损失对模型参数的梯度', '图片显示宽度', '教师给出的分数'], 0, '梯度说明参数的小变化会怎样影响损失。');
  add('neural-network', '训练损失下降就一定说明测试表现变好。', ['正确', '错误'], 1, '模型可能过拟合训练集，需要一起观察测试损失。', 'truefalse');
  add('reward-maze', 'Q-learning 的 Q 值表示什么？', ['状态下采取某动作的预计累计回报', '机器人已经走过的格数', '到终点的直线距离'], 0, 'Q 值根据实际奖励和后续允许动作的价值更新。');
  add('reward-maze', '探索率较高意味着什么？', ['更经常尝试随机允许动作', '一定更快到达终点', '取消全部障碍物'], 0, '探索能帮助发现路线，也可能暂时降低回合奖励。');
  add('reward-maze', '进入终点或终止陷阱后还应继续累计下一步 Q 值。', ['应该继续', '不应该继续'], 1, '终态目标只包含本步奖励，不再 bootstrap。', 'truefalse');
  for (const args of NEW_QUESTIONS) add(...args);
  return rows;
}

async function upsertAndPublish(db, kind, payload, { publish = true } = {}) {
  const existing = db.prepare('SELECT id FROM content_records WHERE kind = ? AND slug = ?').get(kind, payload.slug);
  if (existing) return { skipped: true, id: existing.id };
  const draft = await createRecord(db, kind, payload);
  if (!publish) return { skipped: false, id: draft.id, published: false };
  await publishRecord(db, kind, draft.id);
  return { skipped: false, id: draft.id, published: true };
}

export async function seedInitialContent(db) {
  const result = { created: 0, skipped: 0 };
  const settings = await upsertAndPublish(db, 'settings', {
    slug: 'site', key: 'site', site_name: '人工智能科普课程与互动实验室', school_names: ['东华大学', '东华大学附属实验学校'],
    hero_title: '人工智能课程，互动实验室', hero_description: '',
    project_intro: '面向初高中学生的人工智能科普课程与互动实验。', teaching_features: ['课程讲解', '浏览器实验', '课堂小测'],
    about_text: '项目由东华大学与东华大学附属实验学校合作开展。', section_visibility: { themes: true, teacher: true, experiments: true, works: true, activities: true },
    featured_experiment_slugs: SEED_EXPERIMENTS.filter(item => item.featured).map((item) => item.slug), featured_work_slugs: [], footer_text: '人工智能科普课程与互动实验室',
  });
  result[settings.skipped ? 'skipped' : 'created'] += 1;
  for (const payload of SEED_THEMES) {
    const item = await upsertAndPublish(db, 'themes', { ...payload, ...COURSE_CONTENT[payload.slug] });
    result[item.skipped ? 'skipped' : 'created'] += 1;
  }
  for (const payload of SEED_EXPERIMENTS) {
    const item = await upsertAndPublish(db, 'experiments', payload);
    result[item.skipped ? 'skipped' : 'created'] += 1;
  }
  for (const payload of seedPresets()) {
    const item = await upsertAndPublish(db, 'presets', payload);
    result[item.skipped ? 'skipped' : 'created'] += 1;
  }
  for (const payload of seedQuestions()) {
    const item = await upsertAndPublish(db, 'quizzes', payload);
    result[item.skipped ? 'skipped' : 'created'] += 1;
  }
  const teacher = await upsertAndPublish(db, 'teacher', { slug: 'teacher', key: 'teacher', visible: false }, { publish: false });
  result[teacher.skipped ? 'skipped' : 'created'] += 1;
  return result;
}
