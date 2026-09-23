# 实验专区升级

主站设计、课程、教师、作品、媒体与独立后端继续保留。神经网络和奖励迷宫沿用原地址、算法和数据身份。

| 入口 | 页面 |
| --- | --- |
| /labs | 四个顶层入口 |
| /labs/neural-network | 神经网络分类与回归 |
| /labs/cv | 计算机视觉目录 |
| /labs/cv/cnn-explainer | CNN 探索 |
| /labs/cv/lenet | 手写数字与三维网络 |
| /labs/cv/lenet-training | LeNet 训练 |
| /labs/cv/teachable-machine | 图像采样与训练 |
| /labs/transformer | Transformer 探索 |
| /labs/reward-maze | 机器人奖励迷宫 |

旧 pixel-vision 跳转 CV，temperature-sampling 跳转 Transformer，gesture-lab 跳转图像训练。旧专用模块、参数表单、MediaPipe 依赖和模型已退出活跃构建，原文件保存在非公开 _project_review/20260923-lab-upgrade/retired。

shared/lab-registry.js 固定运行入口、类型、所属目录与配置能力。后台编辑内容不改变执行地址。CV 下架或维护后，公开详情、挑战、小测和相关素材的公开检查遵守父组状态。统计将 1 个目录与 7 个可运行实验分开。新实验挑战为观察任务，神经网络和迷宫继续应用真实参数。

## 数据升级与回滚

结构迁移 002_lab_registry.sql 扩展元数据表。保留历史引擎值用于备份恢复，不注册旧实验为可运行入口。内容升级是独立命令，不会随服务启动自动执行。

本轮在临时数据库和私有预览副本验证内容升级，尚未修改原默认数据的发布内容。对现有真实数据执行前，需要停服并由使用者确认目标目录。

可直接访问 http://127.0.0.1:4180/labs 查看已迁移的副本。重启命令是 `node --env-file-if-exists=.env scripts/preview-labs.mjs`。数据保存在 `_project_review/20260923-lab-upgrade/preview-data`，第一次运行复制原数据库和媒体，之后复用该副本。管理员仍使用副本中原有的账号，没有创建默认密码。

```powershell
npm run labs:upgrade -- --data-dir D:/private/site-data
npm run labs:upgrade -- --data-dir D:/private/site-data --apply
npm run labs:upgrade -- --data-dir D:/private/site-data --rollback D:/private/site-data/lab-upgrade-backups/时间.json
```

默认命令列出计划。apply 先在数据目录的私有 lab-upgrade-backups 内保存 SQLite 备份，再下架明确的三个旧实验及专属挑战、小测，更新课程与精选入口，补齐新内容。重复执行不覆盖人工编辑。JSON 日志记录受影响内容原始状态和新建记录 ID，可在同一维护窗口回滚。不在回滚前继续编辑这些受影响内容；回滚会恢复维护前的版本。教师、作品和真实媒体文件不在内容迁移范围。

完整数据库事故恢复沿用 backup、restore 命令。部署镜像只包含构建结果与服务代码，不包含快照、截图、测试日志或私有数据库。
