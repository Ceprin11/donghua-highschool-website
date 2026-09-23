# 阿里云部署与维护

本项目按单机、单实例部署设计。前端、API、受控媒体和模型由同一个 Express 服务提供。SQLite 和媒体放在本机持久磁盘。不要启动多个应用副本或将 SQLite 放在共享网络磁盘。

本轮完成本地验证和部署配置，未连接阿里云，也未执行 Docker。正式部署前需要在目标机器执行本节操作并检查结果。

## 本地准备

使用 Node 24 LTS，已验证版本 24.15.0、npm 11.12.1。在项目根目录执行。

```powershell
npm ci
npm --prefix vendor/cnn-explainer ci --ignore-scripts
npm --prefix vendor/transformer-explainer ci --ignore-scripts
npm --prefix apps/teachable ci --ignore-scripts
npm run labs:prepare
npm run labs:build
npm run labs:check
npm run db:migrate
npm run db:seed
npm run admin:init
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，管理入口为 `/admin`。初始化命令在交互终端中隐藏输入密码，至少 12 位。没有默认账号密码。忘记密码时运行 `npm run admin:init -- --reset`，重新输入账号和密码，旧会话会撤销。

`.env` 可从 `.env.example` 复制后在本机编辑。不要提交该文件。默认 DATA_DIR 为项目的 data，数据库为 site.sqlite，上传文件位于 media。开发命令使用 Vite 的来源 `http://127.0.0.1:5173`。不要改用另一主机名后再关闭来源校验。

安装时保留项目 `.npmrc`。它让 npm 使用依赖包已附带的预编译资源，避免 better-sqlite3 13 的 binding.gyp 触发不需要的本机编译。Dockerfile 同样复制该配置。显式的迁移、种子、测试、构建命令照常执行。

构建与 Node 直接启动命令为 `npm run build` 和 `npm start`。本机检查生产构建可保留 NODE_ENV=development，并把 PUBLIC_ORIGIN 设为 `http://127.0.0.1:3001`。正式部署必须使用 NODE_ENV=production 和 HTTPS 的 PUBLIC_ORIGIN。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| NODE_ENV | 本地 development，正式 production |
| PORT | Express 端口，默认 3001 |
| DATA_DIR | 私有持久目录，禁止放进 public、dist 或任何 Web 静态目录 |
| PUBLIC_ORIGIN | 浏览器访问的完整来源，正式示例 `https://ai.example.edu.cn`，没有路径 |
| TRUST_PROXY | 直接启动留空；本机 Nginx 经过单跳访问 Compose 时设为 1 |

会话标识和 CSRF token 由服务器随机生成，保存在 SQLite；不需要额外 SESSION_SECRET。生产 Cookie 自动使用 Secure、HttpOnly 和 SameSite。管理员密码用 Node scrypt 验证，不提供公开注册。

## ECS、Docker 与 HTTPS

准备一台支持 Docker Compose 的 Linux ECS、域名和有效 TLS 证书。中国大陆公网网站按实际主体完成域名备案。安全组只开放实际需要的 80、443 和受限制的运维入口，不公开 3001。把项目源文件和本地模型资源上传到私有部署目录。

先在构建机完成 labs:prepare 和 labs:build。Docker 镜像只复制准备好的 public/experiments 产物，容器构建不会联网下载模型。新库可按下文执行 db:seed；已有库按 LAB_UPGRADE_SUMMARY.md 执行停服备份和升级，不直接套用新库初始化步骤。

Dockerfile 分阶段构建，运行用户为 node。构建上下文采用白名单，不含环境文件、审计、备份、数据库、测试凭据或上传原件。镜像包含程序和固定模型，数据保存在命名卷 site-data。

在项目目录执行以下 Linux 命令，替换示例域名。

```sh
export PUBLIC_ORIGIN=https://ai.example.edu.cn
docker compose -f deploy/compose.yml build
docker compose -f deploy/compose.yml run --rm app npm run db:migrate
docker compose -f deploy/compose.yml run --rm app npm run db:seed
docker compose -f deploy/compose.yml run --rm app npm run admin:init
docker compose -f deploy/compose.yml up -d
docker compose -f deploy/compose.yml ps
curl --fail http://127.0.0.1:3001/api/health
```

管理员初始化应在真实交互终端执行，不通过命令行参数、环境变量或管道传密码。Compose 只将端口绑定在宿主机 127.0.0.1。TRUST_PROXY=1 只适用于这里的单跳 Nginx 架构；如果改成其他拓扑，需要相应调整可信代理范围。

使用 deploy/nginx.conf.example 配置宿主机 Nginx，替换域名和证书路径，运行 `nginx -t` 后重新加载。Nginx 将所有请求转发到应用，保留 Host 与真实 HTTPS 来源，并覆盖客户端传入的转发头。不要为 DATA_DIR 添加 root 或 alias。20 MiB 上传限制由应用执行，Nginx 限制为 21m，容纳表单开销。

上线后检查 HTTPS 首页、`/api/health`、`/admin` 登录与退出、上传、作品发布及撤回、视频拖动播放、`/experiments/transformer/wasm/ort-wasm-simd-threaded.wasm` 的 application/wasm 类型。查看浏览器控制台，不应发生外部运行资源请求。摄像头需要 HTTPS 和用户点击授权，按测试报告执行真机检查。

## 备份和恢复

JSON 导出用于内容交换，不能代替数据库与媒体文件备份。系统备份包含管理员密码哈希，应按敏感文件保管。停服后执行，不直接复制正在写入的 SQLite 主文件。

Node 直接运行时，先正常停止服务，然后执行。

```powershell
npm run backup -- --stopped --out ../private-backups/backup-20260923
npm run restore -- --from ../private-backups/backup-20260923 --to ../restored-data-20260923
```

目标必须是新目录，命令不会覆盖现有数据。备份使用 SQLite backup API，复制清单中实际媒体，并校验数据库、外键和文件长度。恢复在新目录执行，清除会话后再验证。确认恢复结果后将 DATA_DIR 指向新目录，再启动应用。

Compose 使用新建的私有宿主机备份目录挂载到维护容器。下面示例中的目录需由运维人员设置为容器 node 用户可写。

```sh
docker compose -f deploy/compose.yml stop app
docker compose -f deploy/compose.yml run --rm -v /srv/donghua-private-backups:/backup app npm run backup -- --stopped --out /backup/backup-20260923
docker compose -f deploy/compose.yml up -d
```

恢复时先在私有挂载目录演练，不覆盖正在使用的卷。

```sh
docker compose -f deploy/compose.yml run --rm -v /srv/donghua-private-backups:/backup app npm run restore -- --from /backup/backup-20260923 --to /backup/restored-20260923
```

核对后停服，将 Compose 数据卷挂载改为恢复目录并保持 node 用户读写权限，再启动。保留旧卷供人工回退，切勿使用 `docker compose down -v` 删除唯一数据。

## 内容导入与更新

后台导出返回 schemaVersion=1 的全部内容和素材清单，不含密码、会话或密钥。离线导入只支持本站导出格式，不猜测没有样本的其他格式。保留输入文件，先 dry-run。

```powershell
npm run data:import -- --file ../private-export.json
npm run data:import -- --file ../private-export.json --apply --stopped
```

显式执行前停服。导入检查记录、slug、配置和素材引用，冲突时拒绝覆盖，重复记录跳过。JSON 本身不带媒体文件；带素材的整站搬迁使用备份恢复。只有目标已具备对应素材记录和文件时，才能导入引用这些素材的内容。

更新前停服备份。保留 PUBLIC_ORIGIN 和持久卷，重新构建镜像，运行迁移，再启动新版本。seed 只补缺失的教学初始化记录，不覆盖编辑内容；日常更新无需重复执行 seed。健康检查失败时查看本地服务日志并恢复旧程序或在新目录验证过的备份，不新建空数据库掩盖故障。

## 已知限制

Docker、Nginx、证书和阿里云实际环境尚未实测。单机数据库依赖本地持久磁盘。媒体撤回能停止新的匿名访问，不能收回访客已下载的文件。真实教师、校徽、作品、活动与联系资料需由管理员补充。
