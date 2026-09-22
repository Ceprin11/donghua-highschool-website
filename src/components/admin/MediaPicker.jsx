import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

// Admin-only asset picker: lists uploaded MediaAsset images and returns {asset_id, url}.
// Public pages can't read MediaAsset (admin-only RLS), so the picked file_url is
// stored directly on the content record for public display.
export default function MediaPicker({ label = "图片", value, onChange }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const openPicker = () => {
    setOpen(true);
    setLoading(true);
    base44.entities.MediaAsset.filter({ asset_kind: "image" }, "-created_date", 100)
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  const selected = value?.url ? value : null;

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex items-start gap-3">
        {selected ? (
          <Image src={selected.url} alt="已选图片" className="w-24 h-24 rounded-lg border border-border bg-muted" fittingType="fill" />
        ) : (
          <div className="w-24 h-24 rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">未选择</div>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={openPicker} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent">
            <ImagePlus size={15} /> {selected ? "更换图片" : "从素材库选择"}
          </button>
          {selected && (
            <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={15} /> 移除
            </button>
          )}
          <div className="text-xs text-muted-foreground">图片请先在“素材管理”中上传</div>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card rounded-xl border border-border max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">选择图片素材</h3>
            {loading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground text-sm"><Loader2 size={16} className="animate-spin" /> 加载中…</div>
            ) : assets.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">暂无图片素材，请先在“素材管理”中上传</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {assets.map((a) => (
                  <button key={a.id} type="button" onClick={() => { onChange({ asset_id: a.id, url: a.file_url }); setOpen(false); }} className="rounded-lg border border-border overflow-hidden hover:border-primary transition-colors text-left">
                    <Image src={a.file_url} alt={a.file_name} className="w-full aspect-square bg-muted" fittingType="fill" />
                    <div className="px-2 py-1.5 text-xs text-foreground truncate">{a.file_name}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}