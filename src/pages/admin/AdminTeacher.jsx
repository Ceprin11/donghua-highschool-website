import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2 } from "lucide-react";

export default function AdminSettings() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    base44.entities.SiteSettings.filter({}, "-updated_date", 1).then((list) => {
      if (list && list.length) { setRecord(list[0]); setForm(list[0]); }
      else { setForm({ key: "default", site_name: "人工智能科普课程与互动实验室", school_names: ["东华大学", "东华大学附属松江高级中学"], hero_title: "", hero_description: "", project_intro: "", teaching_features: [], about_text: "", contact_email: "", footer_text: "", filing_info: "", section_visibility: {}, featured_experiment_slugs: [], featured_work_slugs: [], status: "published" }); }
    });
  }, []);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const updateArray = (field, value) => setForm((f) => ({ ...f, [field]: value.split("\n").filter(Boolean) }));

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      if (record?.id) {
        await base44.entities.SiteSettings.update(record.id, form);
      } else {
        await base44.entities.SiteSettings.create(form);
      }
      setMsg("保存成功");
    } catch (e) { setMsg("保存失败：" + e.message); }
    setSaving(false);
  };

  if (!form) return <div className="text-muted-foreground">加载中…</div>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">首页与网站设置</h1>
      <div className="space-y-5">
        <Field label="网站名称"><input className={inputCls} value={form.site_name || ""} onChange={(e) => update("site_name", e.target.value)} /></Field>
        <Field label="合作学校（每行一个）"><textarea className={inputCls} rows={2} value={(form.school_names || []).join("\n")} onChange={(e) => updateArray("school_names", e.target.value)} /></Field>
        <Field label="首页主标题"><input className={inputCls} value={form.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} /></Field>
        <Field label="首页介绍"><textarea className={inputCls} rows={3} value={form.hero_description || ""} onChange={(e) => update("hero_description", e.target.value)} /></Field>
        <Field label="项目简介"><textarea className={inputCls} rows={4} value={form.project_intro || ""} onChange={(e) => update("project_intro", e.target.value)} /></Field>
        <Field label="教学特色（每行一条）"><textarea className={inputCls} rows={3} value={(form.teaching_features || []).join("\n")} onChange={(e) => updateArray("teaching_features", e.target.value)} /></Field>
        <Field label="关于项目正文"><textarea className={inputCls} rows={4} value={form.about_text || ""} onChange={(e) => update("about_text", e.target.value)} /></Field>
        <Field label="联系邮箱"><input className={inputCls} value={form.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} placeholder="未提供可留空" /></Field>
        <Field label="页脚文字"><input className={inputCls} value={form.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)} /></Field>
        <Field label="备案信息"><input className={inputCls} value={form.filing_info || ""} onChange={(e) => update("filing_info", e.target.value)} placeholder="未提供可留空" /></Field>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm font-medium mb-3">首页区块显示</div>
          {["themes", "teacher", "experiments", "works", "activities"].map((k) => (
            <label key={k} className="flex items-center gap-2 mb-2 text-sm">
              <input type="checkbox" checked={form.section_visibility?.[k] !== false} onChange={(e) => update("section_visibility", { ...form.section_visibility, [k]: e.target.checked })} />
              {k}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存
          </button>
          {msg && <span className={`text-sm ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary";
function Field({ label, children }) { return <div><label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>{children}</div>; }