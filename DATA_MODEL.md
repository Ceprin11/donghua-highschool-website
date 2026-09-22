# 数据模型与权限

## 实体清单

| 实体 | 用途 | 公开读取 | 管理员写入 |
|------|------|----------|------------|
| SiteSettings | 网站单例设置 | status=published | 全部 |
| TeacherProfile | 主讲教师单例 | status=published 且 visible=true | 全部 |
| CourseTheme | 四个课程主题 | status=published | 全部 |
| Experiment | 五个实验 | status=published | 全部 |
| ExperimentPreset | 实验挑战案例 | status=published | 全部 |
| QuizQuestion | 课堂小测题目 | status=published | 全部 |
| StudentWork | 学生作品 | status=published | 全部 |
| TeachingActivity | 教学活动 | status=published | 全部 |
| MediaAsset | 素材管理 | 仅管理员 | 仅管理员 |
| ContentDraft | 内容草稿 | 仅管理员 | 仅管理员 |
| AdminLog | 操作日志 | 仅管理员 | 仅管理员 |

## RLS 规则

### 公开内容实体（SiteSettings, TeacherProfile, CourseTheme, Experiment, ExperimentPreset, QuizQuestion, StudentWork, TeachingActivity）

```json
{
  "read": { "$or": [ { "data.status": "published" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "user_condition": { "role": "admin" } },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

- 匿名访客只能读取 `status: "published"` 的记录。
- 管理员可读取所有记录（含草稿）。
- 只有管理员可创建、更新、删除。
- StudentWork 的 `archived` 状态不属于 `published`，下架后匿名不可读。

### 管理专用实体（MediaAsset, ContentDraft, AdminLog）

```json
{
  "read": { "user_condition": { "role": "admin" } },
  "create": { "user_condition": { "role": "admin" } },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

- 仅管理员可读写。草稿与素材记录不会泄露给匿名访客。

## 发布机制

- 每条内容记录有 `status` 字段：`draft`（草稿，私有）或 `published`（已发布，公开）。
- StudentWork 额外有 `archived`（已下架，私有）。
- 管理员编辑已发布内容时，可直接更新记录（首版未实现多级草稿隔离）。
- ContentDraft 实体预留用于"已发布内容的待发布修改"隔离，当前首版未接入完整草稿工作流。

## 关系

- CourseTheme.experiment_slugs → Experiment.slug（多对多引用）
- Experiment.theme_slug → CourseTheme.slug
- ExperimentPreset.experiment_slug → Experiment.slug
- QuizQuestion.experiment_slug → Experiment.slug
- StudentWork.theme_slug → CourseTheme.slug
- 各实体的 *_asset_id → MediaAsset.id（素材引用，当前以字段存储 file_url 供公开展示）

## 权限要点

1. 管理员角色由平台设置初始化，不接受请求体、URL、localStorage 中的 role/isAdmin。
2. 公开页面不因未登录跳转登录。
3. 不提供万能 CRUD 函数；每个实体独立配置 RLS。
4. MediaAsset 为管理员私有，但已发布内容中存储的 file_url 为公开存储地址（UploadPublicFile）。
5. 草稿题目不公开；已发布答案随题目下发到前端（低风险自测，不做防作弊）。