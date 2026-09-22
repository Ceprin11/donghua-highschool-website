import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";

export default function AdminQuizzes() {
  const [questions, setQuestions] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); base44.entities.Experiment.filter({}, "sort_order", 100).then(setExperiments).catch(() => {}); }, []);
  const load = () => base44.entities.QuizQuestion.filter({}, "sort_order", 100).then(setQuestions).catch(() => {});

  const startNew = () => setEditing({ experiment_slug: "", type: "single", question: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }], correct_option_id: "a", explanation: "", sort_order: 0, status: "draft" });

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      if (editing.id) await base44.entities.QuizQuestion.update(editing.id, editing);
      else await base44.entities.QuizQuestion.create(editing);
      setMsg("保存成功"); setEditing(null); load();
    } catch (e) { setMsg("保存失败：" + e.message); }
    setSaving(false);
  };
  const remove = async (q) => { if (!confirm("确认删除此题目？")) return; try { await base44.entities.QuizQuestion.delete(q.id); load(); } catch {} };
  const publish = async (q) => { try { await base44.entities.QuizQuestion.update(q.id, { status: "published" }); load(); } catch {} };

  const updateOption = (idx, text) => { const opts = [...editing.options]; opts[idx] = { ...opts[idx], text }; setEditing({ ...editing, options: opts }); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">小测管理</h1>
        <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"><Plus size={16} /> 新增题目</button>
      </div>
      {msg && <div className={`text-sm mb-3 ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</div>}
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium text-foreground text-sm">{q.question}</div>
              <div className="text-xs text-muted-foreground mt-1">{q.type === "truefalse" ? "判断题" : "单选题"} · {q.status === "published" ? "已发布" : "草稿"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...q })} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent">编辑</button>
              {q.status !== "published" && <button onClick={() => publish(q)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">发布</button>}
              <button onClick={() => remove(q)} className="px-2 py-1.5 rounded-lg border border-border text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing.id ? "编辑题目" : "新增题目"}</h2>
            <div className="space-y-4">
              <Field label="关联实验"><select className={inputCls} value={editing.experiment_slug} onChange={(e) => setEditing({ ...editing, experiment_slug: e.target.value })}><option value="">选择实验</option>{experiments.map((ex) => <option key={ex.id} value={ex.slug}>{ex.title}</option>)}</select></Field>
              <Field label="题型"><select className={inputCls} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}><option value="single">单选</option><option value="truefalse">判断</option></select></Field>
              <Field label="题目"><textarea className={inputCls} rows={2} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} /></Field>
              <div>
                <div className="text-sm font-medium mb-1.5">选项（选择正确答案）</div>
                {editing.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input type="radio" checked={editing.correct_option_id === opt.id} onChange={() => setEditing({ ...editing, correct_option_id: opt.id })} />
                    <input className={inputCls} value={opt.text} onChange={(e) => updateOption(i, e.target.value)} placeholder={`选项 ${opt.id}`} />
                  </div>
                ))}
              </div>
              <Field label="解析"><textarea className={inputCls} rows={2} value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} /></Field>
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