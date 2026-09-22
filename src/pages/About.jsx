import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2, Plus, Trash2, Star } from "lucide-react";
import MediaPicker from "@/components/admin/MediaPicker";

export default function AdminWorks() {
  const [works, setWorks] = useState([]);
  const [themes, setThemes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); base44.entities.CourseTheme.filter({}, "sort_order", 100).then(setThemes).catch(() => {}); }, []);
  const load = () => base44.entities.StudentWork.filter({}, "-updated_date", 100).then(setWorks).catch(() => {});

  const startNew = () => setEditing({ slug: "", title: "", summary: "", theme_slug: "", work_type: "project", author_display_name: "", ai_knowledge: "", creative_highlights: "", cover_asset_id: "", cover_image_url: "", demo_url: "", featured: false, sort_order: 0, is_demo: true, status: "draft" });
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      if (editing.id) await base44.entities.StudentWork.update(editing.id, editing);
      else await base44.entities.StudentWork.create(editing);
      setMsg("保存成功"); setEditing(null); load();
    } catch (e) { setMsg("保存失败：" + e.message); }
    setSaving(false);
  };
  const setStatus = async (w, status) => { try { await base44.entities.StudentWork.update(w.id, { status }); load(); } catch (e) { setMsg("操作失败"); } };
  const toggleFeatured = async (w) => { try { await base44.entities.StudentWork.update(w.id, { featured: !w.featured }); load(); } catch {} };
  const remove = async (w) => { if (!confirm(`确认删除「${w.title}」？此操作不可撤销。`)) return; try { await base44.entities.StudentWork.delete(w.id); load(); } catch (e) { setMsg("删除失败"); } };

  const filtered = works.filter((w) => filter === "all" || w.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">学生作品管理</h1>
        <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"><Plus size={16} /> 新增作品</button>
      </div>
      {msg && <div className={`text-sm mb-3 ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</div>}
      <div className="flex gap-2 mb-4">
        {["all", "draft", "published", "archived"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{f === "all" ? "全部" : f === "draft" ? "草稿" : f === "published" ? "已发布" : "已下架"}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((w) => (
          <div key={w.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-foreground flex items-center gap-2">{w.title} {w.featured && <Star size={14} className="text-amber-500 fill-amber-500" />} {w.is_demo && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">演示样例</span>}</div>
                <div className="text-sm text-muted-foreground mt-1">作者：{w.author_display_name || "匿名"} · {w.status}</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setEditing({ ...w })} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent">编辑</button>
                <button onClick={() => toggleFeatured(w)} className="px-2 py-1.5 rounded-lg border border-border text-sm hover:bg-accent"><Star size={14} /></button>
                {w.status !== "published" && <button onClick={() => setStatus(w, "published")} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">发布</button>}
                {w.status === "published" && <button onClick={() => setStatus(w, "archived")} className="px-3 py-1.5 rounded-lg border border-border text-sm">下架</button>}
                <button onClick={() => remove(w)} className="px-2 py-1.5 rounded-lg border border-border text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing.id ? "编辑作品" : "新增作品"}</h2>
            <div className="space-y-4">
              <Field label="slug"><input className={inputCls} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
              <Field label="标题"><input className={inputCls} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="简介"><textarea className={inputCls} rows={2} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></Field>
              <Field label="所属主题"><select className={inputCls} value={editing.theme_slug} onChange={(e) => setEditing({ ...editing, theme_slug: e.target.value })}><option value="">无</option>{themes.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}</select></Field>
              <Field label="作者展示名"><input className={inputCls} value={editing.author_display_name} onChange={(e) => setEditing({ ...editing, author_display_name: e.target.value })} /></Field>
              <Field label="创意亮点"><textarea className={inputCls} rows={2} value={editing.creative_highlights} onChange={(e) => setEditing({ ...editing, creative_highlights: e.target.value })} /></Field>
              <Field label="用到的 AI 知识或工具"><textarea className={inputCls} rows={2} value={editing.ai_knowledge} onChange={(e) => setEditing({ ...editing, ai_knowledge: e.target.value })} /></Field>
              <Field label="演示链接（https 网址）"><input className={inputCls} value={editing.demo_url} onChange={(e) => setEditing({ ...editing, demo_url: e.target.value })} /></Field>
              <MediaPicker
                label="封面图片"
                value={{ asset_id: editing.cover_asset_id, url: editing.cover_image_url }}
                onChange={(v) => setEditing({ ...editing, cover_asset_id: v?.asset_id || "", cover_image_url: v?.url || "" })}
              />
              <Field label="类型"><select className={inputCls} value={editing.work_type} onChange={(e) => setEditing({ ...editing, work_type: e.target.value })}><option value="project">项目</option><option value="image">图像</option><option value="video">视频</option><option value="interactive">互动</option></select></Field>
              <Field label="排序"><input type="number" className={inputCls} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> 精选</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_demo} onChange={(e) => setEditing({ ...editing, is_demo: e.target.checked })} /> 标记为演示样例（非学生提交）</label>
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