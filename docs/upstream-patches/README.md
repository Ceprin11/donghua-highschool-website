# 上游修改文件

这些补丁记录已跟踪文件相对取得 commit 的修改。新增适配文件保留在 vendor/apps 源码中，清单中的 ?? 表示新增文件。取得源码的 Git 元数据另存于私有审计目录，vendor 作为普通源码目录交付，避免被主仓库误加入为 gitlink。姿势训练适配源码位于 apps/teachable。

## cnn-explainer

Commit d0971f9447ed9806022a3d47587b62394682bc51

```text
 M .gitignore
 M package.json
 M public/index.html
 M rollup.config.js
 M src/App.svelte
 M src/Header.svelte
 M src/article/Article.svelte
 M src/detail-view/ActivationAnimator.svelte
 M src/detail-view/Activationview.svelte
 M src/detail-view/ConvolutionAnimator.svelte
 M src/detail-view/Convolutionview.svelte
 M src/detail-view/Dataview.svelte
 M src/detail-view/HyperparameterAnimator.svelte
 M src/detail-view/Hyperparameterview.svelte
 M src/detail-view/PoolAnimator.svelte
 M src/detail-view/Poolview.svelte
 M src/overview/Overview.svelte
 M src/utils/cnn-tf.js
?? package-lock.json
```

## tensorspace

Commit eec8a46524fd3fb4c9f9fba804fa81d592637534

```text
 M .gitignore
 M examples/lenet/lenet.html
 M examples/trainingLeNet/data/mnist_data.js
 M examples/trainingLeNet/trainingLeNet.html
?? examples/lib/lifecycle.js
?? examples/trainingLeNet/training.js
```

## transformer-explainer

Commit bfe50afba10b9b560b84143ee1107d977defa74f

```text
 M package-lock.json
 M package.json
 M src/app.html
 M src/components/Embedding.svelte
 M src/components/InputForm.svelte
 M src/components/Mlp.svelte
 M src/components/Sampling.svelte
 M src/components/Temperature.svelte
 M src/components/Topbar.svelte
 M src/components/article/Article.svelte
 M src/components/common/Slider.svelte
 M src/components/textbook/TextbookCard.svelte
 M src/components/textbook/TextbookNavigation.svelte
 M src/routes/+layout.svelte
 M src/routes/+page.svelte
 M src/utils/Katex.svelte
 M src/utils/animation.ts
 M src/utils/data.ts
 M src/utils/fetchChunks.js
 M src/utils/textbookPages.ts
 M svelte.config.js
 M vite.config.ts
?? src/routes/+layout.ts
?? static/model-v2/manifest.json
?? static/tokenizers/
```

## teachablemachine-community

Commit 55aa0bb84acaa9efcbb9a2068eaefbb72cddae2c

```text
```
