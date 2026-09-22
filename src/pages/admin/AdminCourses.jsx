import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2, Plus } from "lucide-react";

export default function AdminCourses() {
  const [themes, setThemes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);
  const load = () => base44.entities.CourseTheme.filter({}, "sort_order", 100).then(setThemes).catch(() => {});

  const startNew = () => setEditing({ slug: "", title: "", summary: "", keywords: [], cover_asset_id: "", experiment_slugs: [], sort_order: themes.length, status: "draft" });
  const startEdit = (t) => setEditing({ ...t });

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const data = { ...editing, keywords: Array.isArray(editing.keywords) ? editing.keywords : (editing.keywords ? editing.keywords.split("\n") : []) };
      if (editing.id) await base44.entities.CourseTheme.update(editing.id, data);
      else await base44.entities.CourseTheme.create(data);
      setMsg("保存成功"); setEditing(null); load();
    } catch (e) { setMsg("保存失败：" + e.message); }
    setSaving(false);
  };

  const publish = async (t) => {
    try { await base44.entities.CourseTheme.update(t.id, { status: "published" }); load(); } catch (e) { setMsg("发布失败：" + e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">课程介绍管理</h1>
        <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"><Plus size={16} /> 新增主题</button>
      </div>
      {msg && <div className={`text-sm mb-3 ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</div>}
      <div className="space-y-3">
        {themes.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{t.title} <span className="text-xs text-muted-foreground ml-2">/{t.slug}</span>
                {t.status === "published" ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">已发布</span> : <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">草稿</span>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{t.summary}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(t)} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent">编辑</button>
              {t.status !== "published" && <button onClick={() => publish(t)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">发布</button>}
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing.id ? "编辑主题" : "新增主题"}</h2>
            <div className="space-y-4">
              <Field label="slug（英文标识）"><input className={inputCls} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
              <Field label="标题"><input className={inputCls} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="简介（80-150字）"><textarea className={inputCls} rows={4} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></Field>
              <Field label="关键词（每行一个）"><textarea className={inputCls} rows={3} value={Array.isArray(editing.keywords) ? editing.keywords.join("\n") : editing.keywords} onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split("\n") })} /></Field>
              <Field label="排序"><input type="number" className={inputCls} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-lg border border-border text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary";
function Field({ label, children }) { return <div><label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>{children}</div>; }