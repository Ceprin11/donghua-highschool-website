import React from "react";

// Honest placeholder for missing visual assets — never fakes a real photo or logo.
export default function PlaceholderImage({ label = "", className = "", aspect = "aspect-[4/3]" }) {
  return (
    <div className={`${aspect} ${className || ""} rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden`}>
      <div className="text-center px-4">
        <div className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-1">待补充素材</div>
        <div className="text-sm text-muted-foreground">{label || "图片占位"}</div>
      </div>
    </div>
  );
}
