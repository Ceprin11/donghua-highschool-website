# 第三方代码、模型与素材

## 运行依赖

精确依赖版本由 package-lock.json 锁定，实际安装以 `npm ci` 为准。

| 资源 | 用途 | 许可与来源 |
| --- | --- | --- |
| React、React DOM | 页面与交互 | MIT，https://github.com/facebook/react |
| Vite、React 插件 | 本地开发与生产构建 | MIT，https://github.com/vitejs/vite |
| React Router | 浏览器路由 | MIT，https://github.com/remix-run/react-router |
| Tailwind CSS | 样式 | MIT，https://github.com/tailwindlabs/tailwindcss |
| Lucide | 界面图标 | ISC，https://github.com/lucide-icons/lucide |
| Radix UI 及保留的 UI 组件依赖 | 可复用界面基础 | 各包许可证随 npm 包保留，Radix 为 MIT |
| Express | HTTP API | MIT，https://github.com/expressjs/express |
| better-sqlite3 | SQLite 驱动 | MIT，https://github.com/WiseLibs/better-sqlite3；SQLite 为 public domain |
| multer | 有界媒体上传 | MIT，https://github.com/expressjs/multer |
| file-type | 文件实际类型识别 | MIT，https://github.com/sindresorhus/file-type |
| Playwright | 本地浏览器验收 | Apache-2.0，https://github.com/microsoft/playwright |

## 本轮开源实验

CNN Explainer 和 Transformer Explainer 使用 MIT 许可。TensorSpace 和 Teachable Machine Community 使用 Apache-2.0。具体 commit、采用文件、模型与数据来源、适配差异见 [UPSTREAM_LABS](UPSTREAM_LABS.md)。源码与部署目录保留各项目 LICENSE。

TensorFlow.js 和 ONNX Runtime 分别使用 Apache-2.0 与 MIT 许可。三维示例复用仓库自带 Three.js、Tween、TrackballControls、SignaturePad。GPT-2 使用 OpenAI 模型与 Xenova 分词器，PoseNet 使用 Google 官方 TFJS 预训练模型，手写数字使用 TensorSpace 随附的 MNIST LeNet 模型。依赖精确版本见独立锁文件。

旧 MediaPipe 手势模块和专属模型已移到非公开历史归档，不再部署。姿势训练页使用 Teachable Machine Pose 0.8.6 的开源训练代码和课程工作区，不冒充 Google 官方网站。

姿势示例视频来自 [TensorFlow tfjs-models](https://github.com/tensorflow/tfjs-models/blob/6a9a5e8a7f50421ff6310bd1db566b5929ba1ec3/pose-detection/test_data/pose_squats.mp4)，按仓库 Apache-2.0 许可保留。Transformer 中文文章由上游 Article.svelte 翻译改编，保留 MIT 许可与作者署名。

## 算法与教学素材

神经网络是本项目独立编写的教学 MLP，没有复制或移植 TensorFlow Playground 的实现。TensorFlow Playground 是交互教学参考，来源 https://github.com/tensorflow/playground。训练与梯度验证见 docs/ALGORITHMS.md。

Q-learning 保留本地原有算法。旧独立温度和像素实验已退役。没有安装或嵌入 REINFORCEjs、TensorFlow 服务或 OpenCV.js。不得把参考思路写成已经复用了这些库的代码。

神经网络点集、迷宫地图、挑战和小测保留。新增观察任务与小测对应实际实验。CNN 图片保留上游来源，具体素材许可核对状态见 UPSTREAM_LABS.md。教师照片、学生作品和活动照片由管理员提供和确认来源。



首页的网络示意图是说明性图形，不是实时训练结果。AI 文字 favicon 是本站的简单文字标记，不是学校校徽。
