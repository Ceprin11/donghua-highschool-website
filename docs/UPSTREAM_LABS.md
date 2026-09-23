# 上游实验与本地构建

本轮从指定的四个官方仓库取得源码。主站继续使用 React 与 Express。原版实验在同源独立文档中运行，iframe 负责隔离样式与依赖。没有指向海外演示站的 iframe。

| 项目 | 取得的 commit | 本地来源与许可 |
| --- | --- | --- |
| [CNN Explainer](https://github.com/poloclub/cnn-explainer) | d0971f9447ed9806022a3d47587b62394682bc51 | vendor/cnn-explainer，MIT |
| [TensorSpace](https://github.com/tensorspace-team/tensorspace) | eec8a46524fd3fb4c9f9fba804fa81d592637534 | vendor/tensorspace，Apache-2.0，库版本 0.6.1 |
| [Transformer Explainer](https://github.com/poloclub/transformer-explainer) | bfe50afba10b9b560b84143ee1107d977defa74f | vendor/transformer-explainer，MIT |
| [Teachable Machine Community](https://github.com/googlecreativelab/teachablemachine-community) | 55aa0bb84acaa9efcbb9a2068eaefbb72cddae2c | vendor/teachablemachine-community/libraries/pose，Apache-2.0，0.8.6 |

## 构建

在项目根目录运行。下载与安装只发生在开发准备阶段。

```powershell
npm ci
npm --prefix vendor/cnn-explainer ci --ignore-scripts
npm --prefix vendor/transformer-explainer ci --ignore-scripts
npm --prefix apps/teachable ci --ignore-scripts
npm run labs:prepare
npm run labs:build
npm run labs:check
npm run build
```

三个 npm 子项目各有 package-lock.json。TensorSpace 使用所取 commit 自带的发布库和手写数字示例，不运行它的旧测试、部署或安装脚本。单独构建可运行 `node scripts/build-labs.mjs cnn`、`tensorspace`、`transformer` 或 `teachable`。模型缺失会阻止主站生产构建，不使用 CDN 回退。构建会替换对应的生成目录，避免积累旧文件；模型和原始源码保留在 vendor/apps。精确修改清单与已跟踪文件补丁见 [upstream-patches/README.md](upstream-patches/README.md)。

| 实验 | 来源入口 | 产物与 base |
| --- | --- | --- |
| CNN | src/main.js、Rollup | public/experiments/cnn-explainer，/experiments/cnn-explainer |
| LeNet 手写 | examples/lenet/lenet.html | public/experiments/tensorspace/examples/lenet |
| Transformer | src/routes/+page.svelte、SvelteKit/Vite | public/experiments/transformer，/experiments/transformer/ |
| 姿势训练 | apps/teachable/main.js、esbuild | public/experiments/teachable |

## 模型、素材和依赖

CNN 保留 public/assets/data/model.json、group1-shard1of1.bin 和 public/assets/img 中的上游图片。D3 5.16、Bulma 0.8、FontAwesome 5.3.1、Smooth Scroll 15、MathJax 3.2.2 和 Neucha 字体在构建时从锁定 npm 包复制。TensorFlow.js 使用仓库声明的 1.4.0。原 HTML 所写 1.0.0 与当前源码的加载 API 不一致，本地实际运行已据此修正。

TensorSpace 使用仓库 examples/lib 的 TensorFlow.js 1.0.0、Three.js、Tween、TrackballControls、SignaturePad 与发布的 tensorspace.js。手写模型是 lenetModel/mnist.json 和 mnist.weights.bin。模型和示例未替换为其他网络。MNIST 来自其原始手写数字数据，出处 https://yann.lecun.com/exdb/mnist/。

已取得并采用的是 Apache-2.0 仓库中的具体示例。指定网站的 lenet_zh.html 及 trainingLeNet.html 未取得独立的站点源码仓库，因此不将站点外壳、额外控件或所有站点素材声称为已完整复制。CNN 训练示例已从公开构建中移除，原始仓库源码保留。

Transformer 保留 static/model-v2 下 63 个分片，合计 656,662,664 字节，对应上游可解释 GPT-2 导出模型。模型架构及导出脚本保留在 src/utils/model。GPT-2 分词器取得自 https://huggingface.co/Xenova/gpt2，三个 JSON 保存于 static/tokenizers/Xenova/gpt2。GPT-2 模型来源为 OpenAI GPT-2，MIT。ONNX Runtime Web 1.23 的 WASM 与模块从本地 npm 包复制。上游 Vite 5 与 Svelte 插件 6 的声明冲突，本地将子应用 Vite 固定为 6.4.1，未改变主站 Vite。

Teachable 的姿势训练类来自 libraries/pose/src/teachable-posenet.ts 与 custom-posenet.ts，副本在 apps/teachable/pose-upstream，版本 0.8.6。TensorFlow.js 固定 1.3.1，PoseNet 固定 2.2.1。预训练 PoseNet MobileNetV1 使用倍率 0.75、输入 257、步长 16，模型来自 https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/model-stride16.json，权重按清单下载到本地。官方训练类复用热图与偏移特征训练分类头。

姿势示例视频来自 TensorFlow tfjs-models 仓库 pose-detection/test_data/pose_squats.mp4，固定 commit 为 6a9a5e8a7f50421ff6310bd1db566b5929ba1ec3，遵循仓库 Apache-2.0 许可。视频、模型均从本站加载。参考界面为 https://teachablemachine.withgoogle.com/train/pose，采用其灰底三栏、类别卡、训练卡与预览卡布局，保留中文文案和移动端排列。

各源码 LICENSE 保留，运行目录提供对应 LICENSE.txt。依赖包许可保留在各 node_modules 以及锁文件对应的 npm 包中。CNN 示例图片按上游仓库随附素材保留来源，未单独取得每张图片作者的补充授权声明；正式对外发布前应核对学校对这些素材的使用要求。

## 适配内容

- CNN 保留网络排布、配色、展开动画、分类模型和独立卷积参数演示。移除跨站推荐和自动 YouTube 加载。运行资源本地化，主要控件中文化，补充推理临时张量释放。
- TensorSpace 保留原三维网络和操作。手写预测来自同次画布输入。CNN 训练页不再构建。
- Transformer 保留词元、Embedding、Attention、MLP、概率与采样。词元文本不翻译。移除统计与自动视频加载，公式样式本地化。增加真实加载状态与错误，使用字节数组初始化 ONNX，避免大 Blob 复制。旧推理结果可失效，退出释放 session。
- 姿势训练页面按类别、训练、预览三个工作区实现，复用官方可训练代码。它是课程改编页面，不是 Google 官网完整前端的复制。
- 同源子应用的响应头允许本站嵌入；动态求值仅放在实验静态目录，以适配旧运行库。主站与后台维持原安全策略。页面不接收管理员令牌，也不提供任意 iframe 或脚本地址配置。

## 已知差异

分词器下载来源固定为 Xenova/gpt2 的 bf2c7f02e0b826c60d03af341171bde20893da66。Transformer 的 Jersey 10 字体使用锁定的 @fontsource/jersey-10 5.2.8。本地加载器按生成的分片长度清单顺序读取到一个缓冲区，减少内存复制；ONNX 使用单线程 Worker WASM，关闭图优化与权重预打包，保持同一份模型。手机顶栏改为分行排列，模型图可横向平移。20 页交互讲解与完整说明文章已中文化。文章保留五张原图、公式和参考链接，图注解释英文标签；手机正文按视口排版。

CNN 的长篇说明、部分深层术语以及两项实验的原图文字仍保留英文。Transformer 正文和图注已中文化，原示例词元与作者姓名保留。桌面网络保留原比例，窄屏通过实验内部平移查看。真实手机、平板 GPU 和摄像头需要设备验证。运行与交互的实际结果见 LAB_TEST_REPORT.md 和 LAB_PARITY_REPORT.md。
