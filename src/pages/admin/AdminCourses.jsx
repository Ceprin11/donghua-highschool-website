import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import MediaPicker from "@/components/admin/MediaPicker";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/site/States";
import { listAdminContent, publishAdminContent, unpublishAdminContent, updateAdminContent } from "@/services/adminService";
import { inputClass, Field } from "./AdminLayout";
import { arrayToLines, envelopePayload, linesToArray } from "./adminUtils";

export default function AdminCourses() {
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRecords(await listAdminContent("themes"));
      setError(null);
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
    if (!editing?.id) {
      setMessage("课程主题尚未初始化，无法保存");
      return;
    }
    if (!editing.title.trim() || !editing.slug.trim()) {
      setMessage("请填写主题标题和唯一 slug");
      return;
    }
    try {
      const payload = {
        ...editing,
        keywords: linesToArray(editing.keywords),
        takeaways: linesToArray(editing.takeaways),
        experiment_slugs: linesToArray(editing.experiment_slugs),
      };
      await updateAdminContent("themes", editing.id, payload);
      setEditing(null);
      setMessage("课程主题已保存为草稿");
      await load();
    } catch (saveError) {
      setMessage(saveError.message || "保存失败");
    }
  };

  const publish = async (record) => {
    try {
      await publishAdminContent("themes", record.id);
      setMessage(record.status === "published" ? "课程主题更新已发布" : "课程主题已发布");
      await load();
    } catch (publishError) {
      setMessage(publishError.message || "发布失败");
    }
  };

  const unpublish = async (record) => {
    try {
      await unpublishAdminContent("themes", record.id);
      setMessage("课程主题已下架");
      await load();
    } catch (unpublishError) {
      setMessage(unpublishError.message || "下架失败");
    }
  };

  if (loading) return <LoadingState label="正在读取课程主题" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold">课程主题</h1>
          <p className="mt-2 text-sm text-muted-foreground">固定维护四个主题，每个主题可以关联已支持的实验。</p>
        </div>
      </div>
      {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-3">
        {records.length ? records.map((record) => {
          const payload = envelopePayload(record);
          return (
            <div key={record.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">{payload.title}</h2>
                  <span className="font-mono text-xs text-muted-foreground">/{record.slug || payload.slug}</span>
                  <StatusBadge status={record.status || payload.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{payload.summary}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  onClick={() => setEditing({
                    ...payload,
                    id: record.id,
                    slug: record.slug || payload.slug,
                    keywords: arrayToLines(payload.keywords),
                    takeaways: arrayToLines(payload.takeaways),
                    experiment_slugs: arrayToLines(payload.experiment_slugs),
                  })}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  编辑
                </button>
                {record.status === "published" ? (
                  <>
                    <button onClick={() => publish(record)} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">发布更新</button>
                    <button onClick={() => unpublish(record)} className="rounded-lg border border-border px-3 py-2 text-sm text-red-700 hover:bg-red-50">下架</button>
                  </>
                ) : (
                  <button onClick={() => publish(record)} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">发布</button>
                )}
              </div>
            </div>
          );
        }) : <EmptyState title="还没有课程主题" description="课程主题由系统固定初始化，请先运行初始化脚本。" />}
      </div>
      {editing && <Editor value={editing} setValue={setEditing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Editor({ value, setValue, onSave, onClose }) {
  const update = (key, next) => setValue((current) => ({ ...current, [key]: next }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">编辑课程主题</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">关闭</button>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="唯一 slug">
              <input className={`${inputClass} bg-muted text-muted-foreground`} value={value.slug} readOnly aria-readonly="true" />
            </Field>
            <Field label="排序">
              <input type="number" className={inputClass} value={value.sort_order || 0} onChange={(event) => update("sort_order", Number(event.target.value))} />
            </Field>
          </div>
          <Field label="标题">
            <input className={inputClass} value={value.title} onChange={(event) => update("title", event.target.value)} />
          </Field>
          <Field label="主题简介">
            <textarea className={inputClass} rows={4} value={value.summary || ""} onChange={(event) => update("summary", event.target.value)} />
          </Field>
          <Field label="关键词（每行一个）">
            <textarea className={inputClass} rows={3} value={value.keywords || ""} onChange={(event) => update("keywords", event.target.value)} />
          </Field>
          <Field label="课程详细介绍">
            <textarea className={inputClass} rows={4} value={value.overview || ""} onChange={(event) => update("overview", event.target.value)} />
          </Field>
          <fieldset className="space-y-4 border-t border-border pt-4"><legend className="text-sm font-medium">核心内容</legend>
            {(value.sections || []).map((section, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <Field label={`内容 ${index + 1} 标题`}><input className={inputClass} value={section.title} onChange={event => update("sections", value.sections.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} /></Field>
              <Field label={`内容 ${index + 1} 说明`}><textarea className={inputClass} rows={3} value={section.body} onChange={event => update("sections", value.sections.map((item, i) => i === index ? { ...item, body: event.target.value } : item))} /></Field>
              <button type="button" className="text-sm text-red-700" onClick={() => update("sections", value.sections.filter((_, i) => i !== index))}>删除内容 {index + 1}</button>
            </div>)}
            <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" disabled={(value.sections || []).length >= 12} onClick={() => update("sections", [...(value.sections || []), { title: "", body: "" }])}>添加核心内容</button>
          </fieldset>
          <Field label="学习收获（每行一条）"><textarea className={inputClass} rows={4} value={value.takeaways || ""} onChange={event => update("takeaways", event.target.value)} /></Field>
          <Field label="课堂案例标题"><input className={inputClass} value={value.activity_title || ""} onChange={event => update("activity_title", event.target.value)} /></Field>
          <Field label="课堂案例内容"><textarea className={inputClass} rows={4} value={value.activity_description || ""} onChange={event => update("activity_description", event.target.value)} /></Field>
          <Field label="思考问题"><textarea className={inputClass} rows={2} value={value.discussion || ""} onChange={event => update("discussion", event.target.value)} /></Field>
          <Field label="关联实验 slug（每行一个）">
            <textarea className={inputClass} rows={3} value={value.experiment_slugs || ""} onChange={(event) => update("experiment_slugs", event.target.value)} />
          </Field>
          <MediaPicker
            label="主题封面"
            value={{ asset_id: value.cover_asset_id, url: value.cover_url }}
            onChange={(asset) => setValue((current) => ({ ...current, cover_asset_id: asset?.asset_id || "", cover_url: asset?.url || "" }))}
          />
          <div className="flex gap-2 pt-3">
            <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Save size={16} />保存草稿</button>
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
