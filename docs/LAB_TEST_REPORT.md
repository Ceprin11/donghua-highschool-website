# 实验升级测试报告

2026-09-23 后续更新的测试结果见 [POSE_TRANSLATION_UPDATE](POSE_TRANSLATION_UPDATE.md)。本文保留初次实验移植的历史验收。

测试日期 2026-09-23。Node 24.15.0，npm 11.12.1，Windows Chrome 152.0.7977.83。浏览器测试使用独立临时 SQLite、真实 Express 和生产 `dist`，不 mock 业务 API。真实摄像头没有开启。

## 已通过

| 检查 | 结果和覆盖 |
| --- | --- |
| npm run lint | 通过 |
| npm run typecheck | 通过 |
| npm test | 39 项通过；算法、草稿发布、媒体、备份恢复、导入、CV 父子公开规则、迁移幂等与回滚 |
| npm run labs:build | CNN、TensorSpace 两示例、Transformer、图像训练独立构建通过 |
| npm run labs:check / npm run build | 模型清单和分片检查、主站构建通过 |
| tests/browser/site.spec.js | 19 项全站回归通过；包括 1440、768、360px 全部路由、保留实验、后台登录与内容发布、素材、教师、课程、作品 |
| tests/browser/upstreams.spec.js | 7 项通过；五个新实验真实计算、展开和训练操作，以及模拟相机和错误处理 |
| tests/browser/lab-layout.spec.js | 3 项通过；四个总入口、四个 CV 子页、旧地址重定向，768 与 360px 触屏下五个新实验的核心操作与课堂模式 |

触屏扩展测试包括说明卡片在视口内完整显示、翻页和跳到第 20 页，以及采样控件和翻页栏的边界检查。验收中修复了 CNN 窄屏节点被连线覆盖、Transformer 生成按钮超出固定顶栏、可见区域比例判断导致手机控件被禁用、手机说明卡片与采样栏截断、图像训练脚本未就绪时按钮可点击的问题。目录图片测试滚动进入视口并等待懒加载图片实际解码。最终结果见 `layout-final.log`。

## 具体证据

- CNN 第一卷积层三个位置与直接卷积运算误差小于 0.0001。切图改变特征图。卷积与池化可展开、暂停、关闭；连续切换图像后的 TFJS 张量数量不高于初始值。
- LeNet 手写测试使用两种不同笔画输入；真实分类、中间层、画布清空、视角旋转缩放与重置可用。训练页开始、停止、切测试图、重置和再训练通过。训练数据先划分后打乱，不混入所显示的测试样本。
- Transformer 使用全部原始模型和本地分词器。首次推理完成后输入 The cat is，断言新词元出现、旧例句消失，再等待生成结束。Embedding 与 Attention 展开、返回、Top-p 与温度操作通过。曾发现并修复内存中止和旧文本订阅错误；未删除对应断言。
- 图像训练用有来源的预置图进行真实训练，删除样本后旧预测失效，重训恢复。新增/删除类别、重命名再训练和清空通过。重复释放问题经重训测试发现后修复。
- 模拟摄像头只生成 canvas 视频流。检查未点击时不申请设备、只请求 video、单张和连续采样、关闭时结束 tracks、关闭后的迟到授权也结束 tracks。权限拒绝和 MobileNet 404 显示错误并恢复训练按钮。
- 测试从新浏览器上下文进入生产文件，阻断外部 HTTP 请求。新实验实际运行和全站回归均未发现外部运行请求。WASM MIME、丢失资源 404、API/媒体不回落成 SPA HTML 已验证。
- 迁移测试先删除所有新增实验，模拟旧库，确认创建新内容、重复运行不再改动、回滚删除新记录并还原旧状态。神经网络与作品保持原内容。导出过滤旧归档后可重新导入。

## 日志与截图

私有目录 `_project_review/20260923-lab-upgrade/` 保存 `lint-final.log`、`typecheck-final.log`、`unit-final.log`、`build-final.log`、`labs-build-final.log`、`upstreams-final.log`、`site-final.log`、`layout-final.log`。`site-final.log` 同时包含首次布局测试失败和 19 项全站通过，不能把整份日志说成全绿。

桌面及操作截图见 LAB_PARITY_REPORT.md。`layouts/` 保存 CV、图像训练、LeNet 和 Transformer 的终端截图。`layout-textbook-scroll-failure.log` 记录测试没有先滚动外层页面而无法点击 iframe 底部控件的失败，最终测试补上实际滚动后再点击。历史失败日志保留用于解释修复。备份和测试报告不进入静态目录或镜像。

## 未执行

没有开启真实摄像头，没有执行 Docker、阿里云部署或原默认内容库迁移。手机和平板为 Chrome 视口与触摸模拟，不能代替真实 GPU、相机切换、授权提示和设备指示灯检查。在线上游站点逐状态视觉对照与完整中间张量数值对照未完成，细节见 LAB_PARITY_REPORT.md。
