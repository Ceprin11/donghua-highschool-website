# 独立后端架构

## 运行边界

网站由一个 Node.js 进程提供 Express API，并在生产环境从同一进程提供 Vite 静态构建。浏览器只访问同域的 `/api` 和受控的 `/media/:id`。实验计算留在浏览器内，不把训练过程、摄像头画面或学生答题记录写入数据库。

`createApp({ dataDir, publicOrigin, db, staticDir, secureCookies, trustProxy })` 是后端工厂。`dataDir` 默认是当前项目工作目录下的 `data`，生产环境应显式配置到持久磁盘。配置会拒绝项目 `public` 或 `dist` 目录本身及其子目录，避免把数据库或上传文件放入静态资源树。SQLite 文件位于 `dataDir/site.sqlite`，上传文件位于 `dataDir/media`。应用启动时执行 `migrations/*.sql`，启用外键、WAL 和五秒锁等待。

## 数据模型

`content_records` 保存八类可编辑内容：`settings`、`teacher`、`themes`、`experiments`、`presets`、`quizzes`、`works` 和 `activities`。每条记录保留 `draft_json` 和 `published_json` 两份内容，数据库列保存 kind、slug、状态和时间。`settings` 与 `teacher` 是由 `id` 和 `(kind, singleton_key)` 唯一约束保护的单例，固定 id 分别为 `site` 和 `teacher`。课程主题只允许种子定义的四个 slug，实验通过 shared/lab-registry.js 固定注册，包含 `neural`、`cv`、`cnn`、`lenet`、`transformer`、`teachable` 和 `maze`，这些固定记录不能删除、改 slug 或改引擎。CV 是目录组，三个子实验的 parent_slug 固定为 cv。

`experiment_meta` 通过外键保存固定 `engine_key` 和当前运行状态。`child_content_meta` 通过外键连接预设、小测和父实验。实验配置在保存和发布时调用 `shared/experiment-config.js` 的白名单校验。素材引用记录在 `media_refs`，同时保存草稿引用和发布版引用。管理员、持久会话和操作日志分别位于 `admins`、`sessions` 和 `admin_logs`。

## 公开和管理 API

公开读取接口返回 JSON 本体，不包裹额外的 `data` 字段。

```text
GET /api/content/:kind
GET /api/content/:kind/:slug
```

公开查询只使用明确的 `published_json`。教师发布但 `visible` 为 `false` 时仍保持管理员可编辑，访客看不到。预设和小测只有在父实验的发布版存在且 `runtime_status` 为 `ready` 时才公开。父实验下架或进入维护状态时，子资源不能单独绕过父级状态。CV 目录的发布和运行状态也参与子实验、观察任务、小测及媒体引用的公开判断。

管理接口需要管理员会话。列表和详情返回：

```json
{
  "id": "记录 id",
  "slug": "当前草稿 slug",
  "draft": {},
  "published": {},
  "status": "draft 或 published",
  "draftPending": false
}
```

```text
GET    /api/admin/content/:kind
GET    /api/admin/content/:kind/:id
POST   /api/admin/content/:kind
PUT    /api/admin/content/:kind/:id
POST   /api/admin/content/:kind/:id/publish
POST   /api/admin/content/:kind/:id/unpublish
DELETE /api/admin/content/:kind/:id
GET    /api/admin/overview
GET    /api/admin/export
```

保存草稿只改 `draft_json` 和当前草稿关系。已发布的标题、slug、父实验状态和素材引用不会变化。发布在一个 SQLite 事务内校验并替换 `published_json`，再重建该记录的发布版素材引用。下架清空发布版和发布版素材引用，草稿仍可编辑。删除受父记录和素材引用的外键保护。

## 管理员会话

管理员通过本机 CLI 初始化，不开放注册。密码使用 Node `crypto.scryptSync` 派生，随机 salt 不进入前端。会话 id 和 CSRF token 都是随机不透明值，保存在 SQLite 的 `sessions` 表；浏览器只保存 HttpOnly、SameSite=Lax 的 `sid` Cookie。登录会轮换会话，退出和修改密码会撤销旧会话，过期会话会清理。

`GET /api/auth/session` 会为没有 Cookie 的浏览器建立匿名会话，并返回 `{ authenticated, csrfToken, initialized }`。登录、退出、改密码、管理写操作和上传必须同时带匹配的 `Origin` 与 `X-CSRF-Token`。登录失败按来源地址限速，错误响应不透露管理员是否存在。

## 素材访问

素材通过受控的 `GET /media/:id` 提供，应用不会把上传目录挂成静态目录。管理员可访问全部已登记素材，访客只能访问发布版内容实际引用的素材。图片接受 JPEG、PNG、WebP，视频接受 MP4、WebM；服务端同时检查大小、请求 MIME 和文件特征，原始文件名会被清理。上传上限为 20 MiB，文件名和磁盘路径不会出现在 URL 中。

视频和其他可流式素材支持单段 Range 请求。响应使用 `Cache-Control: private, no-store`，因此下架后不会继续产生新的匿名读取。仍被草稿或发布版内容引用的素材拒绝删除；删除会先确认磁盘文件成功移除，再删除数据库记录。

## 导出和备份

`GET /api/admin/export` 导出活跃内容的完整草稿、发布版内容和素材清单；归档旧实验及其专属挑战、小测留在数据库备份和升级日志中，不进入可重新导入的内容包，不包含密码哈希、会话或密钥。备份脚本应在停写或停服窗口内同时复制 SQLite 数据库和 `dataDir/media`，恢复先写入新的临时目录并完成健康检查，确认无误后再切换数据目录。种子脚本只补缺失 slug，不覆盖人工内容。
