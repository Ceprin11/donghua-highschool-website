export const NEW_LABS = [
  { slug: 'cv', engine_key: 'cv', title: '计算机视觉实验室', summary: '卷积网络、手写数字识别与姿势分类。', computation_label: '图像与视觉', sort_order: 20 },
  { slug: 'cnn-explainer', engine_key: 'cnn', title: 'CNN 探索', summary: '查看卷积、激活和池化运算及特征图。', instructions: '切换图片，点击特征图展开运算，再播放卷积或池化动画。', explanation: 'Tiny VGG 的权重已经训练完成。特征图来自当前输入的真实前向计算。文章中的卷积参数演示是独立算子。', sort_order: 21 },
  { slug: 'lenet', engine_key: 'lenet', title: '手写数字与三维网络', summary: '手写数字识别与 LeNet 各层输出可视化。', instructions: '在右侧画布书写数字。点击网络层展开，拖动视图旋转，滚轮缩放。', explanation: 'LeNet 接收 28 × 28 的灰度输入，分类概率和各层输出来自同一次计算。', sort_order: 22 },
  { slug: 'teachable-machine', engine_key: 'teachable', title: '教 AI 认识姿势', summary: '采集姿势样本，训练和测试姿势分类器。', instructions: '为每个类别采集至少 5 个姿势样本，然后训练。用摄像头或新图片测试，也可以先载入站立与下蹲示例。', explanation: 'PoseNet 检测人体关键点并提取姿势特征，本次样本训练姿势分类器。画面中的骨架和类别概率来自真实计算。', sort_order: 24 },
  { slug: 'transformer', engine_key: 'transformer', title: 'Transformer 探索', summary: '查看 GPT-2 的词元、注意力和文本生成过程。', instructions: '等待 GPT-2 加载，修改英文短句，展开注意力和 MLP，调整温度与采样。', explanation: '使用上游 GPT-2 模型及可视化。词元保留原文。模型加载前展示的例句结果来自上游预计算数据。', computation_label: '语言与生成', sort_order: 30 },
].map(lab => ({ theme_slug: lab.slug === 'transformer' ? 'generative-ai' : 'computer-vision', instructions: '', explanation: '', computation_label: '计算机视觉', default_config: {}, runtime_status: 'ready', featured: ['cv', 'transformer'].includes(lab.slug), ...lab }));

export const NEW_QUESTIONS = [
  ['cnn-explainer', '切换输入图片后，哪些内容会发生变化？', ['各层特征图和分类概率', '已经训练好的网络权重', '卷积核的尺寸'], 0, '输入改变后重新执行前向计算，固定模型的权重不变。'],
  ['cnn-explainer', '池化层的主要作用是什么？', ['汇总局部区域的信息', '给图像添加类别名称', '从服务器取得答案'], 0, '池化汇总局部区域并减小空间尺寸。'],
  ['lenet', '手写数字送入网络前是什么形式？', ['28 × 28 灰度数值', '一段文字', '手写者的身份'], 0, '画布经过采样与归一化后成为模型输入。'],
  ['lenet', '三维网络中的中间层显示什么？', ['当前输入产生的特征', '随机生成的颜色', '训练者的成绩'], 0, '中间层与最终分类使用同一次输入计算。'],
  ['teachable-machine', '本次训练主要学习哪一部分？', ['连接姿势特征与类别的分类头', '从零训练整个 PoseNet', '摄像头驱动'], 0, 'PoseNet 提取姿势特征，用户采集的样本训练姿势分类头。'],
  ['teachable-machine', '增加新类别后应该做什么？', ['补充样本并重新训练', '沿用旧类别概率', '只修改颜色'], 0, '类别集合改变后，原分类头不再对应新任务。'],
  ['transformer', '注意力帮助模型做什么？', ['根据当前上下文汇总词元信息', '保证答案符合事实', '把所有词元翻译成中文'], 0, '注意力权重随当前输入改变。'],
  ['transformer', '提高温度通常会怎样？', ['让候选概率更分散', '保证生成内容正确', '增加模型参数数量'], 0, '温度改变采样分布，不核验事实。'],
];

export const NEW_PRESETS = NEW_LABS.filter(lab => lab.slug !== 'cv').map(lab => ({
  slug: `${lab.slug}-observe`, experiment_slug: lab.slug, title: '观察与比较',
  task_description: lab.instructions, hint: '记录改变输入前后，图形和结果的区别。', config: {}, challenge_kind: 'observation', sort_order: 1,
}));
