import React from "react";
import { mediaUrl } from "@/services/apiClient";
import PlaceholderImage from "./PlaceholderImage";

export function AssetImage({ assetId, src = "", alt = "", className = "", aspect = "aspect-[4/3]" }) {
  const url = mediaUrl(assetId, src);
  if (!url) return <PlaceholderImage label={alt || "待补充图片"} aspect={aspect} className={className} />;
  return <img src={url} alt={alt} loading="lazy" className={`${aspect} w-full rounded-lg bg-muted object-cover ${className}`} />;
}

export function AssetVideo({ assetId, src = "", className = "", controls = true }) {
  const url = mediaUrl(assetId, src);
  if (!url) return null;
  return <video src={url} controls={controls} preload="metadata" className={`w-full rounded-lg bg-black ${className}`} />;
}
