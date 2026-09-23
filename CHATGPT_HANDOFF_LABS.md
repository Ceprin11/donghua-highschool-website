# 实验升级交接

本轮按《实验专区升级》文档实施，保留当前主站、神经网络分类/回归和 Q-learning 迷宫。没有重做整站，也没有提交、推送或部署。

## 可运行入口

隔离预览为 http://127.0.0.1:4180/labs。CV 目录是 /labs/cv，子页分别为 cnn-explainer、lenet、teachable-machine；Transformer 为 /labs/transformer。保留 /labs/neural-network 和 /labs/reward-maze。

重启预览运行 `node --env-file-if-exists=.env scripts/preview-labs.mjs`。第一次运行将默认数据复制到 `_project_review/20260923-lab-upgrade/preview-data` 并只升级副本，后续复用此副本。原默认库没有执行整套实验内容迁移。后续姿势替换与 CNN 训练下架已应用到预览库，默认库没有相应记录，因此未改动。正常开发仍使用 `npm run dev` 的 5173 入口；已有库要按 LAB_UPGRADE_SUMMARY.md 执行内容升级才有完整新目录。

## 代码组织

- shared/lab-registry.js 固定路由、引擎和组归属。管理员不能填任意执行 URL。
- vendor/cnn-explainer 与 vendor/transformer-explainer 保存各自 Svelte 工程和锁文件。
- vendor/tensorspace 使用仓库 examples/lenet 与发行库；训练示例只保留源码，不再公开构建。
- apps/teachable 使用 Community Pose 0.8.6 的训练类、PoseNet 2.2.1、TFJS 1.3.1。工作区参考官方姿势训练页面。
- scripts/build-labs.mjs 输出 public/experiments。模型、字体和运行库从同域读取。主站通过 iframe 隔离各版本。
- server/lab-upgrade.js 和 scripts/upgrade-labs.mjs 提供内容快照、升级和回滚。结构迁移 002 保留历史数据所需的旧引擎值，但活跃注册表、公开 API 和构建不再运行旧实验。
- 旧模块、模型与旧测试归档在 `_project_review/20260923-lab-upgrade/retired`，不进公开目录。

## 2026-09-23 后续更新

已按用户要求下架看 CNN 怎样训练，旧地址 /labs/cv/lenet-training 跳转到 /labs/cv/lenet。教 AI 认识图像已替换为教 AI 认识姿势，提供真实关键点、采样、训练、预测与模型导出。目录共六个可运行实验和一个 CV 目录组。

Transformer 中文正文位于 vendor/transformer-explainer/src/components/article/Article.svelte。公式、原图和参考链接保留。手机正文宽度独立于上方可平移模型图。

定向内容更新备份和回滚日志位于 _project_review/20260923-pose-upgrade，升级函数为 upgradePoseLab。预览进程已重启。当前结果见 docs/POSE_TRANSLATION_UPDATE.md。

## 已解决的重要问题

CNN 模型计算的临时张量释放、面板动画定时器释放和窄屏压缩问题。TensorSpace 训练与可视化共享权重，测试集独立，停止和重置可用。图像训练重复释放会阻止二次训练，已修复。Transformer 的大 Blob 初始化会内存中止，改为单缓冲区流式读取与 Worker WASM；订阅曾读到旧句子，改用回调收到的新文本后词元与注意力正常更新。

## 验证与待办边界

初次移植验收结果保留在历史报告。姿势与中文文章更新后的 40 项单元/API 测试及浏览器结果见 docs/POSE_TRANSLATION_UPDATE.md。最新日志见 docs/LAB_TEST_REPORT.md。原版对应与差异见 docs/LAB_PARITY_REPORT.md；依赖、commit、构建命令、资源与许可见 docs/UPSTREAM_LABS.md。

真实摄像头、实际手机/平板 GPU、Docker 和云部署没有验证。TensorSpace 指定中文网站外壳的源码未取得，采用的是有明确许可的原仓库示例。CNN 长篇文章仍有英文，Transformer 20 页交互讲解和长篇正文已中文化，五张原图的英文标注在中文图注中解释。没有承诺在线原站逐像素一致或全部中间数值已经逐项对齐。

用户确认要迁移现有默认/生产内容后，再停服、检查目标目录并运行 labs:upgrade --apply。脚本先做数据库备份并写回滚日志。不要用 seed 代替旧实验下架，不要清空数据，也不要覆盖当前大量已有未提交修改。
