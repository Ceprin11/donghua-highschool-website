# 迁移文档：Base44 → 阿里云

## 重要说明

当前阶段在 Base44 内完成前台、管理后台与托管后端。**导出代码不等于独立后端迁移完成。** 托管数据库、认证与存储不会因更改域名或 eject 自动搬到阿里云。当前阶段不需要强行部署另一套外部后端。

## 平台依赖清单

### 1. 数据库（Base44 Entities）

- **依赖位置**：`base44/entities/*.jsonc` 定义 schema；`src/services/contentService.js` 与管理后台通过 `base44.entities.*` SDK 访问。
- **接口契约**：`list`、`filter`、`create`、`update`、`delete`、`bulkCreate` 等。
- **迁移后**：替换为 PostgreSQL / MySQL，需实现等效的表结构、查询过滤与行级权限。
- **测试方法**：迁移后验证每个实体的 CRUD、公开/私有过滤、管理员权限。

### 2. 身份验证

- **依赖位置**：`src/lib/AuthContext.jsx`、`src/components/ProtectedRoute.jsx`、`@/api/base44Client`。
- **接口契约**：`base44.auth.me()`、`isAuthenticated()`、`logout()`、`loginViaEmailPassword()`。
- **迁移后**：替换为自建 JWT/Session 认证；管理员角色存储在用户表 role 字段。
- **测试方法**：登录、登出、角色判断、未登录访问公开页不跳转。

### 3. 文件存储

- **依赖位置**：`src/pages/admin/AdminMedia.jsx` 使用 `base44.integrations.Core.UploadPublicFile`。
- **接口契约**：上传返回 `{ file_url }`，公开可读。
- **迁移后**：替换为阿里云 OSS；MediaAsset 表存储 OSS key 与签名 URL 逻辑。
- **测试方法**：上传、读取、删除文件。

### 4. 后端函数

- **当前首版未使用后端函数**；所有数据访问通过 SDK + RLS 完成。
- **迁移后**：如需服务端逻辑（导出、草稿隔离），实现为阿里云函数计算 / 轻量服务器接口。

### 5. MediaPipe 模型资源

- **依赖位置**：`src/experiments/gesture/GestureLab.jsx` → `RESOURCE_CONFIG`。
- **当前**：CDN 加载 `@mediapipe/tasks-vision` 与 hand_landmarker 模型。
- **迁移后**：将 WASM 与模型文件自托管到阿里云 OSS，更新 `RESOURCE_CONFIG` 中的 URL。
- **测试方法**：离线环境加载模型、检测手部关键点。

## 数据导出与恢复

### 导出内容数据

通过管理后台或 SDK 导出所有实体记录（需分页覆盖全部数据）：

```javascript
// 导出示例（需在管理端实现导出按钮）
const entities = ["SiteSettings", "TeacherProfile", "CourseTheme", "Experiment",
  "ExperimentPreset", "QuizQuestion", "StudentWork", "TeachingActivity", "MediaAsset"];
const exportData = { schemaVersion: "1.0", exportedAt: new Date().toISOString(), entities: {} };
for (const name of entities) {
  let all = [], offset = 0;
  do {
    const batch = await base44.entities[name].filter({}, "-created_date", 500, offset);
    all = all.concat(batch); offset += batch.length;
  } while (batch.length === 500);
  exportData.entities[name] = all;
}
```

### 素材清单

导出 MediaAsset 记录包含：id、file_name、file_url、mime_type、size、asset_kind、access_visibility。

**注意**：file_url 为短期有效的公开 URL，不能作为长期备份。需单独下载所有文件到本地或 OSS。

### 恢复

1. 在目标环境创建等效数据库表。
2. 按 schema 导入内容数据。
3. 上传素材文件到目标存储，更新 file_url。
4. 验证每个实体的 CRUD 与权限。

## 不导出的内容

- 管理员认证凭据不混入内容导出。
- 不尝试导出密码明文。
- AdminLog 为运行日志，可选导出。

## 当前限制

1. ContentDraft 草稿隔离机制已建表但未接入完整发布工作流。
2. 素材使用公开存储，草稿素材的 file_url 技术上可被访问（草稿内容本身通过 RLS 保护）。
3. 数据导出功能需在管理端实现按钮（当前提供代码示例）。