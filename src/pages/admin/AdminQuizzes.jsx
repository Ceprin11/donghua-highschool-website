import React, { useEffect, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/site/States";
import { listAdminContent } from "@/services/adminService";
import { createQuiz, deleteQuiz, listQuizzesAdmin, publishQuiz, unpublishQuiz, updateQuiz } from "@/services/quizService";
import { inputClass, Field } from "./AdminLayout";
import { envelopePayload } from "./adminUtils";

const blank = (sort = 0) => ({
  slug: "",
  experiment_slug: "",
  type: "single",
  question: "",
  options: [{ id: "a", text: "" }, { id: "b", text: "" }],
  correct_option_id: "a",
  explanation: "",
  sort_order: sort,
});

export default function AdminQuizzes() {
  const [records, setRecords] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [questions, experimentRecords] = await Promise.all([
        listQuizzesAdmin(),
        listAdminContent("experiments"),
      ]);
      setRecords(questions);
      setExperiments(experimentRecords);
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
    if (!editing.slug.trim() || !editing.question.trim() || !editing.experiment_slug) {
      setMessage("请填写题目 slug、题目和关联实验");
      return;
    }
    const options = editing.options
      .filter((option) => option.text.trim())
      .map((option, index) => ({
        id: option.id || String.fromCharCode(97 + index),
        text: option.text.trim(),
      }));
    if (editing.type === "truefalse" && options.length !== 2) {
      setMessage("判断题必须恰好有两个选项");
      return;
    }
    if (editing.type === "single" && options.length < 2) {
      setMessage("单选题至少需要两个选项");
      return;
    }
    if (!options.some((option) => option.id === editing.correct_option_id)) {
      setMessage("请选择正确答案");
      return;
    }
    try {
      const payload = { ...editing, options };
      if (editing.id) await updateQuiz(editing.id, payload);
      else await createQuiz(payload);
      setEditing(null);
      setMessage("题目已保存为草稿");
      await load();
    } catch (saveError) {
      setMessage(saveError.message || "保存失败");
    }
  };

  if (loading) return <LoadingState label="正在读取题目" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold">课堂小测</h1>
          <p className="mt-2 text-sm text-muted-foreground">题目只在学生浏览器中判分，不提交姓名、成绩或学习轨迹。</p>
        </div>
        <button onClick={() => setEditing(blank(records.length))} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Plus size={16} />新增题目
        </button>
      </div>
      {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}
      <div className="space-y-3">
        {records.length ? records.map((record) => (
          <QuestionRow
            key={record.id}
            record={record}
            experiments={experiments}
            onEdit={() => {
              const payload = envelopePayload(record);
              setEditing({
                ...payload,
                id: record.id,
                options: Array.isArray(payload.options) ? payload.options : blank().options,
              });
            }}
            onReload={load}
            onMessage={setMessage}
          />
        )) : <EmptyState title="还没有题目" description="为五个实验分别添加两到三道题。" />}
      </div>
      {editing && <Editor value={editing} setValue={setEditing} experiments={experiments} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuestionRow({ record, experiments, onEdit, onReload, onMessage }) {
  const payload = envelopePayload(record);
  const exp = experiments.map(envelopePayload).find((item) => item.slug === payload.experiment_slug);

  const publish = async () => {
    try {
      await publishQuiz(record.id);
      onMessage(record.status === "published" ? "题目更新已发布" : "题目已发布");
      await onReload();
    } catch (publishError) {
      onMessage(publishError.message || "发布失败");
    }
  };

  const unpublish = async () => {
    try {
      await unpublishQuiz(record.id);
      onMessage("题目已下架");
      await onReload();
    } catch (unpublishError) {
      onMessage(unpublishError.message || "下架失败");
    }
  };

  const remove = async () => {
    if (!window.confirm("确认删除这道题目？")) return;
    try {
      await deleteQuiz(record.id);
      await onReload();
    } catch (deleteError) {
      onMessage(deleteError.message || "删除失败");
    }
  };

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 md:flex-row md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{payload.type === "truefalse" ? "判断" : "单选"}</span>
          <span className="font-medium">{payload.question}</span>
          <StatusBadge status={record.status || payload.status} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{exp?.title || payload.experiment_slug} · {payload.options?.length || 0} 个选项</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <button onClick={onEdit} className="rounded-lg border border-border px-3 py-2 text-xs">编辑</button>
        {record.status === "published" ? (
          <>
            <button onClick={publish} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">发布更新</button>
            <button onClick={unpublish} className="rounded-lg border border-border px-3 py-2 text-xs text-red-700">下架</button>
          </>
        ) : (
          <button onClick={publish} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">发布</button>
        )}
        <button onClick={remove} className="rounded-lg border border-border p-2 text-red-600"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function Editor({ value, setValue, experiments, onSave, onClose }) {
  const update = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const options = Array.isArray(value.options) ? value.options : [];

  const updateType = (type) => {
    if (type === "truefalse") {
      const nextOptions = [
        options[0] || { id: "a", text: "" },
        options[1] || { id: "b", text: "" },
      ];
      setValue((current) => ({
        ...current,
        type,
        options: nextOptions,
        correct_option_id: nextOptions.some((option) => option.id === current.correct_option_id) ? current.correct_option_id : "a",
      }));
      return;
    }
    const nextOptions = options.length >= 2
      ? options
      : [...options, ...Array.from({ length: 2 - options.length }, (_, index) => ({
        id: String.fromCharCode(97 + options.length + index),
        text: "",
      }))];
    setValue((current) => ({ ...current, type, options: nextOptions }));
  };

  const updateOption = (index, text) => {
    setValue((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, text } : option),
    }));
  };

  const addOption = () => {
    const id = String.fromCharCode(97 + options.length);
    setValue((current) => ({ ...current, options: [...current.options, { id, text: "" }] }));
  };

  const removeOption = (index) => {
    if (options.length <= 2) return;
    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
    setValue((current) => ({
      ...current,
      options: nextOptions,
      correct_option_id: nextOptions.some((option) => option.id === current.correct_option_id) ? current.correct_option_id : nextOptions[0].id,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{value.id ? "编辑题目" : "新增题目"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="关联实验">
              <select className={inputClass} value={value.experiment_slug} onChange={(event) => update("experiment_slug", event.target.value)}>
                <option value="">请选择实验</option>
                {experiments.map((record) => {
                  const experiment = envelopePayload(record);
                  return <option key={record.id || experiment.slug} value={experiment.slug}>{experiment.title || experiment.slug}</option>;
                })}
              </select>
            </Field>
            <Field label="唯一 slug">
              <input className={inputClass} value={value.slug} onChange={(event) => update("slug", event.target.value)} placeholder="例如 nn-basics-q1" />
            </Field>
          </div>
          <Field label="题型">
            <select className={inputClass} value={value.type} onChange={(event) => updateType(event.target.value)}>
              <option value="single">单选题</option>
              <option value="truefalse">判断题</option>
            </select>
          </Field>
          <Field label="题目">
            <textarea className={inputClass} rows={3} value={value.question} onChange={(event) => update("question", event.target.value)} />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-foreground">
              <span>选项</span>
              {value.type === "single" && <button type="button" onClick={addOption} className="text-xs text-primary hover:underline">添加选项</button>}
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.id || index} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-semibold uppercase text-muted-foreground">{option.id || String.fromCharCode(97 + index)}</span>
                  <input className={`${inputClass} mt-0`} value={option.text} onChange={(event) => updateOption(index, event.target.value)} placeholder={`选项 ${index + 1}`} />
                  {value.type === "single" && options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700" title="删除选项"><Trash2 size={15} /></button>}
                </div>
              ))}
            </div>
            {value.type === "truefalse" && <p className="mt-2 text-xs text-muted-foreground">判断题必须保留恰好两个选项。</p>}
          </div>
          <Field label="正确答案">
            <select className={inputClass} value={value.correct_option_id} onChange={(event) => update("correct_option_id", event.target.value)}>
              {options.map((option, index) => <option key={option.id || index} value={option.id}>{option.text || `选项 ${index + 1}`}</option>)}
            </select>
          </Field>
          <Field label="解析">
            <textarea className={inputClass} rows={4} value={value.explanation || ""} onChange={(event) => update("explanation", event.target.value)} />
          </Field>
          <Field label="排序">
            <input type="number" className={inputClass} value={value.sort_order || 0} onChange={(event) => update("sort_order", Number(event.target.value))} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Save size={16} />保存草稿</button>
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
