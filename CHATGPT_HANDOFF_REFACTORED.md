# 独立网站重构交接

本轮根据用户提供的重构文档实际修改工程。项目已改为 React/Vite/Tailwind 前端、Express API、better-sqlite3 数据库、本地受控媒体和 SQLite 持久会话。核心运行不再依赖 Base44。

## 工程位置和运行

项目根目录为 `D:\AILAB\东华附中网站\base44-project-6ab2679d9ca59d8561e683c9-2026-09-22T14-07-47-944Z`。

已验证 Node 24.15.0、npm 11.12.1。使用项目锁文件和 `.npmrc` 安装。后者禁用依赖安装生命周期脚本，直接使用 better-sqlite3 13.0.3 官方包自带的预编译库，避免 npm 对 binding.gyp 隐式启动本机编译。显式 npm run、测试和构建仍执行，重装后真实 SQLite 测试通过。

```powershell
npm ci
npm run models:check
npm run db:migrate
npm run db:seed
npm run admin:init
npm run dev
```

公开网站 `http://127.0.0.1:5173`，管理员入口 `http://127.0.0.1:5173/admin`。开发进程使用 3001 端口后端和 5173 端口 Vite 代理。管理员需要在本机交互终端隐藏输入初始化，至少 12 位密码，没有默认凭据。恢复命令为 `npm run admin:init -- --reset`。

交付时依赖和模型已准备，默认开发数据库已创建 36 条初始化内容，本地预览已启动。管理员仍未初始化。健康检查返回数据库可读、目录可写，Vite 首页返回 200。下次打开工程时按上述命令启动即可，seed 会保留已有内容。

生产构建运行 `npm run build`。正式启动使用 NODE_ENV=production、HTTPS PUBLIC_ORIGIN、私有持久 DATA_DIR，再执行 `npm start`。Docker、Compose、Nginx 文件已准备，实际阿里云部署未执行。

## 数据位置和规则

默认数据库为 `data/site.sqlite`，上传目录为 `data/media`。可通过 DATA_DIR 指向项目外的私有本地磁盘目录。禁止 public/dist 数据目录，不能用 Nginx alias 暴露上传目录。

初始化共 36 条记录，包括站点设置、一份教师空草稿、四主题、五实验、十挑战、十五题。种子可重复运行，不覆盖已有编辑。教学内容是本轮新建，没有声称恢复了平台真实数据。

每条内容保留 draft_json 与 published_json。保存已发布内容时访客仍看旧版，发布更新后才原子替换。下架后公开列表和详情都不可读。settings 和 teacher 是数据库单例。四主题和五实验身份固定，slug 和 engine 不可修改，仍允许编辑、发布和下架。

素材通过 `/media/:id` 读取，匿名访问必须有当前公开内容的发布版引用。教师隐藏、实验维护或下架同样影响其相关素材公开权限。草稿引用不会公开文件。删除被任何内容引用的素材会被拒绝。支持 JPEG/PNG/WebP/MP4/WebM，单文件 20 MiB，视频支持 Range。

## 功能和关键模块

五个前台栏目及后台概览、设置、课程、教师、作品、实验、挑战、小测、素材、导出均接真实本地 API。教师只维护六项资料，首页与关于页面共用。作品支持正文、图集、视频、人工审核演示链接、预览、精选和排序。小测只在本机判分。

| 路径 | 作用 |
| --- | --- |
| src/App.jsx、components/site、pages | 前台路由、导航、状态、五栏目 |
| src/pages/admin | 真实管理表单和发布操作 |
| src/services | 同域内容、教师、作品、实验、题目、媒体和认证接口 |
| server/app.js、auth.js | HTTP 路由、Cookie 会话、来源和 CSRF 校验 |
| server/content.js、media.js | 内容校验、草稿发布、受控媒体 |
| server/db.js、migrations | SQLite 约束、迁移、WAL 和事务 |
| shared/experiment-config.js | 五个引擎的配置字段、范围与合并规则 |
| src/experiments | 五个浏览器实验及纯算法 |
| scripts | 开发、模型、初始化、备份恢复、离线导入 |
| tests | 算法、真实 API、代理、启动、运维和浏览器测试 |

神经网络是独立教学 MLP，不是 Playground 移植。像素处理保留原图，提供均值、中值和 Sobel。温度实验使用教学分数和真实 softmax 抽样。迷宫使用真实 Q-learning，已修复非法动作 bootstrap 和穿过终止陷阱的可达性错误。

手势运行库固定 MediaPipe Tasks Vision 0.10.32，模型和 WASM 在 public/models/mediapipe，通过官方准备脚本管理。实际本地模型已经在浏览器中处理程序视频，生命周期和坐标规则有测试。自动测试没有打开真实摄像头；真实手部识别和设备效果仍待用户验证。

## 验证与维护

准确的执行结果、截图和待验事项见 `docs/TEST_REPORT.md`。统一检查命令为 `npm run lint`、`npm run typecheck`、`npm test`、`npm run models:check`、`npm run build`、`npm run test:e2e`。测试数据库与管理员都在临时目录，不写入正式内容。浏览器测试阻断所有外部运行请求。

停服备份使用 `npm run backup -- --stopped --out 新的私有目录`。恢复使用 `npm run restore -- --from 备份目录 --to 新目录`，不会覆盖现有目录，恢复后旧会话失效。已经实际演练数据库和媒体恢复。

离线导入只支持本站 schemaVersion=1 导出，默认 dry-run，显式 `--apply --stopped` 执行。冲突不覆盖。JSON 不带媒体文件，整站迁移使用数据库与媒体备份。维护或已下架实验下的发布子项可以按导出状态恢复，公开读取仍受父实验限制。

## 待补资料和真机事项

待提供规范校徽、教师姓名/照片/单位/身份/职责/简介、正式作品、活动图片、联系邮箱和备案信息。后台已有录入入口，缺失处使用空状态或文字校名。

需要用户在实际电脑、手机和平板上点击开启摄像头，检查 21 点观察、捏合抓放、三个目标、前后摄像头、低性能模式、拒绝权限、离页/隐藏时指示灯关闭。正式域名需要 HTTPS。Docker、Nginx 和阿里云实际部署也需在目标环境验收。

## 变更与恢复点

开始时 Git HEAD 为 `1679372`，工作区干净。当前改动保留未提交，没有自动提交、推送、SSH、购买云资源、访问 Base44 线上或开启真实摄像头。

源码快照在 `D:\AILAB\东华附中网站\_source_snapshots\20260923-004622\source.zip`，共 142 个源文件，排除依赖、构建、环境凭据、数据库和大型数据。历史审计 `PROJECT_AUDIT.md`、`CHATGPT_HANDOFF.md` 保留在原 `_project_review/20260922-223119`，不要把它们当成本轮测试结论。

后续请直接在这套独立架构上维护。先阅读 README、ARCHITECTURE、TEST_REPORT 和当前代码，尊重已有未提交修改。没有新需求时，不增加多管理员、学生账号、聊天、线上模型服务或复杂运维平台。
