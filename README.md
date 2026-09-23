# 人工智能科普课程与互动实验室

东华大学与东华大学附属实验学校合作的 AI 科普课程网站。访客无需登录，管理员通过独立后台维护内容。前端使用 React、Vite、React Router 和 Tailwind；后端使用 Express 与 SQLite。实验计算均在浏览器内完成。总目录有四个入口，包含六个可运行实验。

## 本地启动

在包含本文件和 package.json 的项目目录执行。使用 Node 24 LTS，当前验证版本为 24.15.0，npm 为 11.12.1。

下面的初始化命令用于空数据目录。已有内容库使用下文的可回滚升级流程，不执行 `db:seed`。

```powershell
npm ci
npm --prefix vendor/cnn-explainer ci --ignore-scripts
npm --prefix vendor/transformer-explainer ci --ignore-scripts
npm --prefix apps/teachable ci --ignore-scripts
npm run labs:prepare
npm run labs:build
npm run db:migrate
npm run db:seed
npm run admin:init
npm run dev
```

公开网站为 http://127.0.0.1:5173，后台为 http://127.0.0.1:5173/admin。开发命令同时启动 Vite 和 3001 端口的真实后端。请使用该地址，以便 Origin 校验与开发代理一致。

本项目的 `.npmrc` 使用 `ignore-scripts=true` 安装依赖。better-sqlite3 13.0.3 官方包已经包含 Windows、Linux 和 macOS 的预编译库，但 npm 会因其 binding.gyp 隐式尝试本机编译；这里直接使用随包的库。该设置只在本项目生效，`npm run`、测试和构建仍正常执行。真实 SQLite 启动和生产构建用于验证安装结果。当前支持 Node 24 的 x64/arm64 环境。

管理员通过本机命令交互初始化，密码输入隐藏，没有默认密码。公开站点不依赖管理员是否已初始化。初始化教师资料为空草稿；不会生成真实学生作品或人物资料。

首次安装与资源准备需要访问 npm、官方源码及模型来源。准备后运行只请求本站资源。使用 `npm run labs:check` 检查分片、模型清单和 WASM。详细来源与独立构建命令见 [UPSTREAM_LABS](docs/UPSTREAM_LABS.md)。Transformer 原模型约 657 MB，需要给浏览器留出足够内存。

## 数据和发布

默认数据目录是项目内的 data，可用 DATA_DIR 指定独立持久磁盘目录。SQLite 保存在 `DATA_DIR/site.sqlite`，媒体保存在 `DATA_DIR/media`。不要把该目录放进 public、dist 或静态服务器目录。

后台提供首页与项目设置、四个课程主题、主讲教师、作品、实验目录与观察任务、小测、素材和完整内容导出。修改先保存草稿，再发布。访客在再次发布前继续看到旧版本。下架后，作品原地址和不再被其他公开内容引用的媒体停止匿名读取。

素材支持 JPEG、PNG、WebP、MP4 和 WebM，单文件最多 20 MiB。作品演示链接由管理员审核后填写。图像、视频和照片通过素材选择器复用，素材被引用时不能直接删除。

内容 JSON 导出包含记录和素材清单，不包含素材文件本体。可恢复的数据库与文件备份使用独立备份命令，操作说明见 docs/DEPLOY_ALIYUN.md。

## 课程

四张课程卡片可进入 /courses/:slug 详情页，首页的主题入口也直达对应课程。四课内容从用户提供的 PPT 提炼，包含简介、核心内容、学习收获、课堂案例与关联实验。后台课程主题可编辑详情，保存草稿后再发布。来源页码与验证结果见 [COURSE_CONTENT](docs/COURSE_CONTENT.md)。

## 实验

| 入口 | 内容 |
| --- | --- |
| /labs/neural-network | 保留神经网络分类、回归、参数、挑战与小测 |
| /labs/cv | CV 目录，三张真实预览卡片 |
| /labs/cv/cnn-explainer | CNN 网络、卷积、激活、池化与原模型 |
| /labs/cv/lenet | 手写数字与三维 LeNet |
| /labs/cv/teachable-machine | 人体姿势采样、PoseNet 特征与分类头训练 |
| /labs/transformer | GPT-2 词元、注意力、中间值与采样 |
| /labs/reward-maze | 保留真实 Q-learning、地图编辑、奖励与策略试走 |

新实验在同源 iframe 内使用独立依赖，保留上游图形和动效。主站负责目录、课堂模式、观察任务和折叠小测。神经网络与迷宫继续使用参数挑战。相机只有主动点击后才申请视频权限。样本留在本次浏览器会话，不上传。

已有数据使用可回滚升级，先在隔离副本验收。不要用种子脚本代替旧内容迁移。执行和回滚命令见 [LAB_UPGRADE_SUMMARY](docs/LAB_UPGRADE_SUMMARY.md)。默认内容库未执行整套实验迁移。2026-09-23 的姿势替换与 CNN 训练下架已单独应用到现有预览库，默认库无对应记录可更新。

## 验证和生产运行

```powershell
npm run lint
npm run typecheck
npm test
npm run labs:check
npm run build
npm run test:e2e
```

浏览器测试使用真实临时 SQLite 和生产构建，阻断外部运行请求。Windows 默认使用已安装 Chrome，其他环境可先执行 `npx playwright install chromium`。真实摄像头不由自动测试开启。

生产运行先设置 NODE_ENV=production、PUBLIC_ORIGIN 为正式 HTTPS 域名，以及持久 DATA_DIR，再执行 `npm start`。生产进程同域提供 dist、API、受控媒体和模型。完整部署、反向代理、管理员恢复及备份恢复说明见 docs/DEPLOY_ALIYUN.md。

## 待补资料与已知限制

主讲教师六项资料、正式学生作品、活动图片、联系邮箱和备案信息待补。页眉默认使用两所学校官网的校徽，后台可上传替换。校徽和实验素材来源见开源与素材说明。

真实摄像头需要在实际电脑、手机和平板上确认授权、采样、重训后的识别效果和退出后的摄像头指示灯。Docker 与阿里云实际部署的验证状态见测试报告。当前工作不包含云端上线。

Transformer 页面下方的完整说明文章、五张图注与术语说明已中文化，保留原图、公式和参考链接。

## 文档

- docs/ARCHITECTURE.md 说明数据库、API、会话和发布规则。
- docs/ALGORITHMS.md 说明配置和真实算法。
- docs/DEPLOY_ALIYUN.md 说明运行、部署与维护。
- docs/POSE_TRANSLATION_UPDATE.md 记录姿势识别、CNN 训练下架与 Transformer 中文文章的更新。
- docs/LAB_TEST_REPORT.md 记录本轮实验升级验证；docs/TEST_REPORT.md 保留历史结果。
- docs/LAB_PARITY_REPORT.md 记录上游操作对应与已知差异。
- docs/REFACTOR_SUMMARY.md 记录旧文件恢复与替换。
- docs/THIRD_PARTY_NOTICES.md 记录依赖、模型和素材归属。
- CHATGPT_HANDOFF_LABS.md 提供本轮中文交接；CHATGPT_HANDOFF_REFACTORED.md 保留整站重构记录。

原始只读报告保留在 _project_review/20260922-223119，base44/entities 是离线历史 Schema。运行时不依赖 Base44。
