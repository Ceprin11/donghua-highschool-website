import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Trash2, Loader2 } from "lucide-react";

export default function AdminMedia() {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { load(); }, []);
  const load = () => base44.entities.MediaAsset.filter({}, "-created_date", 100).then(setAssets).catch(() => {});

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
    if (!allowed.includes(file.type)) { setMsg("不支持的文件类型，仅允许 JPEG/PNG/WebP 图片和 MP4/WebM 视频"); return; }
    if (file.size > 20 * 1024 * 1024) { setMsg("文件过大，限制 20MB"); return; }
    setUploading(true); setMsg("");
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const assetKind = file.type.startsWith("video/") ? "video" : "image";
      await base44.entities.MediaAsset.create({ file_name: file.name, file_url, mime_type: file.type, size: file.size, asset_kind: assetKind, description: "", source_note: "管理员上传", access_visibility: "public" });
      setMsg("上传成功"); load();
    } catch (err) { setMsg("上传失败：" + err.message); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = async (a) => {
    if (!confirm(`确认删除素材「${a.file_name}」？请先检查是否仍被内容引用。`)) return;
    try { await base44.entities.MediaAsset.delete(a.id); load(); } catch (e) { setMsg("删除失败"); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">素材管理</h1>
      {msg && <div className={`text-sm mb-3 ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{msg}</div>}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={handleUpload} disabled={uploading} className="text-sm" />
        <div className="mt-2 text-xs text-muted-foreground">支持 JPEG/PNG/WebP 图片和 MP4/WebM 视频，单个文件不超过 20MB。仅管理员可上传。</div>
        {uploading && <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> 上传中…</div>}
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {assets.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-3">
            {a.asset_kind === "image" ? <img src={a.file_url} alt={a.file_name} className="w-full aspect-video object-cover rounded-lg bg-muted" /> : <video src={a.file_url} className="w-full aspect-video object-cover rounded-lg bg-black" />}
            <div className="mt-2 text-sm font-medium text-foreground truncate">{a.file_name}</div>
            <div className="text-xs text-muted-foreground">{a.mime_type} · {Math.round(a.size / 1024)}KB</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(a.file_url); setMsg("已复制 URL"); }} className="px-2.5 py-1 rounded border border-border text-xs hover:bg-accent">复制 URL</button>
              <button onClick={() => remove(a)} className="px-2.5 py-1 rounded border border-border text-xs text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      {assets.length === 0 && <div className="text-sm text-muted-foreground">暂无素材</div>}
    </div>
  );
}