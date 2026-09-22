import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2 } from "lucide-react";

export default function AdminExperiments() {
  const [experiments, setExperiments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);
  const load = () => base44.entities.Experiment.filter({}, "sort_order", 100).then(setExperiments).catch(() => {});

  const startEdit = (e) => setEditing({ ...e });
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      if (editing.id) await base44.entities.Experiment.update(editing.id, editing);
      else await base44.entities.Experiment.create(editing);
      setMsg("保存成功"); setEditing(null); load();
    } catch (err) { setMsg("保存失败：" + err.message); }
    setSaving(false);
  };
  const publish = async (e) => { try { await base44.entities.Experiment.update(e.id, { status: "published" }); load(); } catch (err) { setMsg("发布失败"); } };
  const setRuntime = async (e, status) => { try { await base44.entities.Experiment.update(e.id, { runtime_status: status }); load(); } catch (err) {} };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">实验管理</h1>
      {msg && <div className={`text-sm mb-3 ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</div>}
      <div className="space-y-3">
        {experiments.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{e.title} <span className="text-xs text-muted-foreground ml-2">/{e.slug} · {e.engine_key}</span></div>
                <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{e.summary}</div>
                <div className="flex gap-2 mt-2">
                  {e.status === "published" ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">已发布</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">草稿</span>}
                  {e.runtime_status === "ready" ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">算法就绪</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">维护中</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(e)} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent">编辑</button>
                {e.status !== "published" && <button onClick={() => publish(e)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">发布</button>}
                <button onClick={() => setRuntime(e, e.runtime_status === "ready" ? "maintenance" : "ready")} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent">{e.runtime_status === "ready" ? "设为维护" : "设为就绪"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">编辑实验</h2>
            <div className="space-y-4">
              <Field label="标题"><input className={inputCls} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="简介"><textarea className={inputCls} rows={3} value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} /></Field>
              <Field label="计算标注"><input className={inputCls} value={editing.computation_label} onChange={(e) => setEditing({ ...editing, computation_label: e.target.value })} /></Field>
              <Field label="操作指引"><textarea className={inputCls} rows={3} value={editing.instructions} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} /></Field>
              <Field label="原理说明"><textarea className={inputCls} rows={3} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} /></Field>
              <Field label="主题 slug"><input className={inputCls} value={editing.theme_slug} onChange={(e) => setEditing({ ...editing, theme_slug: e.target.value })} /></Field>
              <Field label="排序"><input type="number" className={inputCls} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> 首页精选</label>
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