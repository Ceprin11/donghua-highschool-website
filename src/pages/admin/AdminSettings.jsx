import React, { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import MediaPicker from "@/components/admin/MediaPicker";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/site/States";
import {
  createAdminContent,
  deleteAdminContent,
  getAdminContent,
  listAdminContent,
  publishAdminContent,
  unpublishAdminContent,
  updateAdminContent,
} from "@/services/adminService";
import { inputClass, Field } from "./AdminLayout";
import { arrayToLines, envelopePayload, linesToArray } from "./adminUtils";

const DEFAULT_SETTINGS = {
  key: "site",
  site_name: "人工智能科普课程与互动实验室",
  school_names: ["东华大学", "东华大学附属实验学校"],
  hero_title: "人工智能课程，互动实验室",
  hero_description: "",
  project_intro: "",
  about_text: "",
  teaching_features: [],
  contact_email: "",
  footer_text: "",
  filing_info: "",
  hero_media_asset_id: "",
  logo_asset_ids: [],
  featured_experiment_slugs: [],
  featured_work_slugs: [],
  section_visibility: { themes: true, teacher: true, experiments: true, works: true, activities: true },
};

const assetRefs = (value) => (Array.isArray(value) ? value : [])
  .map((item) => (typeof item === "string" ? { asset_id: item } : item))
  .filter((item) => item?.asset_id);

const assetIds = (value) => (Array.isArray(value) ? value : [])
  .map((item) => (typeof item === "string" ? item : item?.asset_id))
  .filter(Boolean);

export default function AdminSettings() {
  const [tab, setTab] = useState("site");
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [activities, setActivities] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsEnvelope, activityRecords] = await Promise.all([
        getAdminContent("settings", "site"),
        listAdminContent("activities"),
      ]);
      const settings = envelopePayload(settingsEnvelope);
      setForm({
        ...DEFAULT_SETTINGS,
        ...settings,
        section_visibility: {
          ...DEFAULT_SETTINGS.section_visibility,
          ...(settings.section_visibility || {}),
        },
      });
      setActivities(activityRecords);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateAdminContent("settings", "site", {
        ...form,
        school_names: linesToArray(form.school_names),
        teaching_features: linesToArray(form.teaching_features),
        featured_experiment_slugs: linesToArray(form.featured_experiment_slugs),
        featured_work_slugs: linesToArray(form.featured_work_slugs),
        logo_asset_ids: assetIds(form.logo_asset_ids).slice(0, 2),
      });
      setMessage("首页设置已保存为草稿");
      await load();
    } catch (saveError) {
      setMessage(saveError.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    try {
      await publishAdminContent("settings", "site");
      setMessage("首页设置已发布");
      await load();
    } catch (publishError) {
      setMessage(publishError.message || "发布失败");
    }
  };

  if (loading) return <LoadingState label="正在读取项目设置" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div>
      <Heading
        title="首页与项目设置"
        description="维护网站文案、展示区块和教学活动。保存后先形成草稿，发布后访客才能看到。"
      />
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("site")}
          className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === "site" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          网站内容
        </button>
        <button
          onClick={() => setTab("activities")}
          className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === "activities" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >
          教学活动
        </button>
      </div>
      {tab === "site" ? (
        <SiteForm
          form={form}
          setForm={setForm}
          saving={saving}
          message={message}
          onSave={save}
          onPublish={publish}
        />
      ) : (
        <ActivitiesPanel
          records={activities}
          onReload={load}
          activity={activity}
          setActivity={setActivity}
        />
      )}
    </div>
  );
}

function SiteForm({ form, setForm, saving, message, onSave, onPublish }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const visibility = (key, value) => setForm((current) => ({
    ...current,
    section_visibility: { ...current.section_visibility, [key]: value },
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">首页文案</h2>
        <div className="mt-5 space-y-5">
          <Field label="网站名称">
            <input className={inputClass} value={form.site_name || ""} onChange={(event) => update("site_name", event.target.value)} />
          </Field>
          <Field label="合作学校（每行一个）">
            <textarea className={inputClass} rows={2} value={arrayToLines(form.school_names)} onChange={(event) => update("school_names", event.target.value)} />
          </Field>
          <Field label="主视觉标题">
            <input className={inputClass} value={form.hero_title || ""} onChange={(event) => update("hero_title", event.target.value)} />
          </Field>
          <Field label="主视觉说明">
            <textarea className={inputClass} rows={3} value={form.hero_description || ""} onChange={(event) => update("hero_description", event.target.value)} />
          </Field>
          <MediaPicker
            label="网站主视觉图片"
            value={{ asset_id: form.hero_media_asset_id }}
            onChange={(asset) => update("hero_media_asset_id", asset?.asset_id || "")}
          />
          <Field label="项目简介">
            <textarea className={inputClass} rows={5} value={form.project_intro || ""} onChange={(event) => update("project_intro", event.target.value)} />
          </Field>
          <Field label="教学特点（每行一个）">
            <textarea className={inputClass} rows={4} value={arrayToLines(form.teaching_features)} onChange={(event) => update("teaching_features", event.target.value)} />
          </Field>
          <Field label="关于项目补充介绍">
            <textarea className={inputClass} rows={4} value={form.about_text || ""} onChange={(event) => update("about_text", event.target.value)} />
          </Field>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">合作校徽</h2>
          <div className="mt-4 space-y-4">
            <MediaPicker
              label="双校 Logo（最多两张）"
              multiple
              value={assetRefs(form.logo_asset_ids)}
              onChange={(items) => update("logo_asset_ids", items.slice(0, 2))}
            />
            <p className="text-xs text-muted-foreground">未选择 Logo 时，网站导航会显示合作学校文字。</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">首页区块</h2>
          <div className="mt-4 space-y-3">
            {[["themes", "课程主题"], ["teacher", "主讲教师"], ["experiments", "互动实验"], ["works", "学生作品"], ["activities", "教学活动"]].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm">
                <span>{label}</span>
                <input type="checkbox" checked={form.section_visibility?.[key] !== false} onChange={(event) => visibility(key, event.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">精选与页脚</h2>
          <div className="mt-4 space-y-4">
            <Field label="精选实验 slug（每行一个）">
              <textarea className={inputClass} rows={3} value={arrayToLines(form.featured_experiment_slugs)} onChange={(event) => update("featured_experiment_slugs", event.target.value)} />
            </Field>
            <Field label="精选作品 slug（每行一个）">
              <textarea className={inputClass} rows={3} value={arrayToLines(form.featured_work_slugs)} onChange={(event) => update("featured_work_slugs", event.target.value)} />
            </Field>
            <Field label="联系邮箱">
              <input type="email" className={inputClass} value={form.contact_email || ""} onChange={(event) => update("contact_email", event.target.value)} />
            </Field>
            <Field label="备案或说明">
              <input className={inputClass} value={form.filing_info || ""} onChange={(event) => update("filing_info", event.target.value)} />
            </Field>
            <Field label="页脚文字">
              <input className={inputClass} value={form.footer_text || ""} onChange={(event) => update("footer_text", event.target.value)} />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            <Save size={16} />
            {saving ? "保存中…" : "保存草稿"}
          </button>
          <button onClick={onPublish} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">发布当前草稿</button>
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
        </div>
      </div>
    </div>
  );
}

function ActivitiesPanel({ records, onReload, activity, setActivity }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const blank = { slug: "", title: "", description: "", photo_asset_ids: [], sort_order: records.length };
  const form = activity || blank;
  const update = (key, value) => setActivity({ ...form, [key]: value });

  const edit = (record) => {
    const payload = envelopePayload(record);
    setActivity({ ...payload, id: record.id, photo_asset_ids: assetRefs(payload.photo_asset_ids) });
  };

  const save = async () => {
    if (!form.slug.trim() || !form.title.trim()) {
      setMessage("请填写活动标题和唯一 slug");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = { ...form, photo_asset_ids: assetIds(form.photo_asset_ids) };
      if (form.id) await updateAdminContent("activities", form.id, payload);
      else await createAdminContent("activities", payload);
      setActivity(null);
      setMessage("活动草稿已保存");
      await onReload();
    } catch (saveError) {
      setMessage(saveError.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (record) => {
    try {
      await publishAdminContent("activities", record.id);
      setMessage(record.status === "published" ? "活动更新已发布" : "活动已发布");
      await onReload();
    } catch (publishError) {
      setMessage(publishError.message || "发布失败");
    }
  };

  const unpublish = async (record) => {
    try {
      await unpublishAdminContent("activities", record.id);
      setMessage("活动已下架");
      await onReload();
    } catch (unpublishError) {
      setMessage(unpublishError.message || "下架失败");
    }
  };

  const remove = async (record) => {
    if (!window.confirm(`确认删除「${envelopePayload(record).title}」？`)) return;
    try {
      await deleteAdminContent("activities", record.id);
      await onReload();
    } catch (deleteError) {
      setMessage(deleteError.message || "删除失败");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        {records.length ? records.map((record) => {
          const payload = envelopePayload(record);
          return (
            <div key={record.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div>
                <div className="font-medium text-foreground">{payload.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{payload.description}</div>
                <div className="mt-2"><StatusBadge status={record.status || payload.status} /></div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button onClick={() => edit(record)} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">编辑</button>
                {record.status === "published" ? (
                  <>
                    <button onClick={() => publish(record)} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">发布更新</button>
                    <button onClick={() => unpublish(record)} className="rounded-lg border border-border px-3 py-2 text-xs text-red-700 hover:bg-red-50">下架</button>
                  </>
                ) : (
                  <button onClick={() => publish(record)} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">发布</button>
                )}
                <button onClick={() => remove(record)} className="rounded-lg border border-border p-2 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        }) : <EmptyState title="还没有教学活动" description="添加一条课堂或展示活动记录。" />}
        <button onClick={() => setActivity(blank)} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"><Plus size={16} />新增活动</button>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">{form.id ? "编辑活动" : "新增活动"}</h2>
        <div className="mt-5 space-y-4">
          <Field label="唯一 slug">
            <input className={inputClass} value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="例如 open-day" />
          </Field>
          <Field label="活动标题">
            <input className={inputClass} value={form.title} onChange={(event) => update("title", event.target.value)} />
          </Field>
          <Field label="活动说明">
            <textarea className={inputClass} rows={5} value={form.description || ""} onChange={(event) => update("description", event.target.value)} />
          </Field>
          <MediaPicker
            label="教学活动照片"
            multiple
            value={assetRefs(form.photo_asset_ids)}
            onChange={(items) => update("photo_asset_ids", items)}
          />
          <Field label="排序">
            <input type="number" className={inputClass} value={form.sort_order || 0} onChange={(event) => update("sort_order", Number(event.target.value))} />
          </Field>
          <div className="flex gap-2">
            <button disabled={saving} onClick={save} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">保存草稿</button>
            <button onClick={() => setActivity(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm">取消</button>
          </div>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      </section>
    </div>
  );
}

function Heading({ title, description }) {
  return <div className="mb-8"><h1 className="text-3xl font-bold text-foreground">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>;
}
