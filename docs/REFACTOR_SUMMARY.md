# 独立前后端重构摘要

## 新运行结构

React、Vite、React Router 和 Tailwind 保留。Express 提供同域 API，better-sqlite3 提供持久化 SQLite，媒体保存在 DATA_DIR 并经受控接口访问。管理员会话和密码验证由本地服务端负责。

运行入口是 src/main.jsx、src/App.jsx 和 server/index.js。前端各业务服务只访问同域 /api。网站生产构建没有 Base44 SDK、构建插件、应用 ID、平台 token 或远程认证依赖。

## 文件恢复与替换

| 旧文件或模块 | 本轮处理 |
| --- | --- |
| src/App.jsx、lib/AuthContext 等全站平台认证 | 公开站点免登录，管理员在 /admin/login 登录，本地 API 验证会话 |
| vite.config.js、index.html | 移除平台注入，恢复本地代理，更新中文标题、语言、描述和 AI 文字 favicon |
| src/services/contentService.js | 改为真实同域接口，新增 teacher/work/experiment/quiz/media/auth 服务 |
| Labs.jsx 实为详情、LabDetail.jsx 实为首页 | 恢复实验列表和独立详情路由，五种引擎懒加载 |
| About.jsx 实为作品编辑 | 恢复关于项目与同一条教师展示，作品编辑回归管理页 |
| AdminLayout.jsx 实为实验编辑器 | 新建登录检查、管理导航与 Outlet，实验编辑回归独立页面 |
| AdminWorks.jsx 实为教师表单 | 教师六项字段放到 AdminTeacher，作品放到 AdminWorks |
| AdminTeacher/AdminSettings/AdminQuizzes 的错位内容 | 按设置、小测、概览的实际职责恢复，所有按钮连接新后端 |
| lib/utils/query-client、图片和通知 Hook | 清理平台工具，恢复有用工具与同域图片组件 |
| NeuralEngine.js 实为迷宫界面 | 补写独立教学 MLP，训练与梯度测试覆盖真实计算 |
| MazeLab.jsx 实为 Q 引擎、MazeEngine.js 实为手势副本 | 恢复 Q 引擎与界面，修正合法动作 bootstrap 和终止陷阱可达性 |
| TemperatureLab.jsx 只有重复引擎 | 保留稳定概率运算，补概率图、抽样和频数界面 |
| VisionLab.jsx | 保留像素计算，抽出可测试引擎，补中值、邻域与素材切换刷新 |
| GestureLab.jsx | 改为本地 MediaPipe 资源、可取消摄像头会话、统一坐标和 Pointer Events |
| ExperimentShell、QuizPanel | 保留本机小测和课堂展示，挑战参数经共享契约进入真实引擎 |
| base44/entities | 保留为离线原字段参考，不参与运行 |

## 内容与媒体规则

每条业务内容保留一份草稿和一份发布版。保存草稿不会改变访客旧版。发布后替换，撤回后访客不可读。教师唯一，隐藏状态由服务端处理。预设与小测受父实验的公开及运行状态约束。

媒体由素材 ID 引用。访客只读取当前公开内容实际引用的文件。编辑中的新图片和未引用素材保持私有。删除前检查引用，成功时同时处理磁盘文件与数据库记录。

主视觉、校徽、教师、作品和活动均可通过素材选择器维护。后台课程、作品、实验、挑战、题目和活动都具有发布更新入口。固定四主题与五引擎禁止删除或改换身份。神经网络分别提供重置模型和重新生成数据，迷宫提供当前 Q 表策略试走，演示模式放大文字与操作区域。

## 数据来源

本地原包只有源码与 Schema，没有可恢复的正式内容记录、媒体、教师信息或模型资源。本轮新增四主题、五实验、十挑战、十五题和默认站点文案，均为新教学初始化内容。重复初始化只补缺失记录，不覆盖人工编辑。

教师为空草稿。规范校徽、照片、真实作品、活动照片、联系方式和备案信息仍由项目方提供。没有创建公开的伪造人物或学生成果。

## 恢复点与历史

开工时 Git 工作区干净，起始提交 1679372。源码备份位于工作区的 `_source_snapshots/20260923-004622/source.zip`，共 142 个源码文件，排除依赖、构建、环境文件、凭据、数据库和大数据。备份不在网站项目静态目录，也不进入 Docker 构建上下文。

原始 PROJECT_AUDIT.md 和 CHATGPT_HANDOFF.md 保留于 _project_review/20260922-223119。本轮没有自动提交、推送、连接 Base44 线上、修改云资源或部署阿里云。

实际通过和未测事项集中记录在 docs/TEST_REPORT.md。最终交接入口为 CHATGPT_HANDOFF_REFACTORED.md。
