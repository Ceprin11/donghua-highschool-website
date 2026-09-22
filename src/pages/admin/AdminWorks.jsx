import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2 } from "lucide-react";
import MediaPicker from "@/components/admin/MediaPicker";

export default function AdminTeacher() {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    base44.entities.TeacherProfile.filter({}, "-updated_date", 1).then((list) => {
      if (list && list.length) { setRecord(list[0]); setForm(list[0]); }
      else setForm({ key: "default", name: "", photo_asset_id: "", photo_url: "", organization: "", title_or_identity: "", project_role: "", short_bio: "", visible: false, status: "draft" });
    });
  }, []);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async (publish) => {
    setSaving(true); setMsg("");
    try {
      const data = { ...form, status: publish ? "published" : "draft" };
      if (record?.id) await base44.entities.TeacherProfile.update(record.id, data);
      else { const r = await base44.entities.TeacherProfile.create(data); setRecord(r); }
      setForm(data);
      setMsg(publish ? "已发布" : "草稿已保存");
    } catch (e) { setMsg("保存失败：" + e.message); }
    setSaving(false);
  };

  if (!form) return <div className="text-muted-foreground">加载中…</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">主讲教师介绍</h1>
      <p className="text-sm text-muted-foreground mb-6">仅六项资料；未确认前不公开展示。</p>
      <div className="space-y-5">
        <Field label="姓名"><input className={inputCls} value={form.name || ""} onChange={(e) => update("name", e.target.value)} placeholder="待补充" /></Field>
        <Field label="单位或学院"><input className={inputCls} value={form.organization || ""} onChange={(e) => update("organization", e.target.value)} placeholder="待补充" /></Field>
        <Field label="职称或身份"><input className={inputCls} value={form.title_or_identity || ""} onChange={(e) => update("title_or_identity", e.target.value)} placeholder="待补充" /></Field>
        <Field label="项目职责"><input className={inputCls} value={form.project_role || ""} onChange={(e) => update("project_role", e.target.value)} placeholder="待补充" /></Field>
        <Field label="简短介绍"><textarea className={inputCls} rows={4} value={form.short_bio || ""} onChange={(e) => update("short_bio", e.target.value)} placeholder="待补充" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visible || false} onChange={(e) => update("visible", e.target.checked)} /> 公开展示（首页与关于项目）</label>
        <MediaPicker
          label="教师照片"
          value={{ asset_id: form.photo_asset_id, url: form.photo_url }}
          onChange={(v) => { update("photo_asset_id", v?.asset_id || ""); update("photo_url", v?.url || ""); }}
        />
        <div className="flex items-center gap-3">
          <button onClick={() => save(false)} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存草稿
          </button>
          <button onClick={() => save(true)} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 发布
          </button>
          {msg && <span className={`text-sm ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary";
function Field({ label, children }) { return <div><label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>{children}</div>; }