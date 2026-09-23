import React from "react";
import { Film, Image, Box, MousePointer2 } from "lucide-react";
import { AssetImage } from "./Media";

const ICONS = { image: Image, video: Film, interactive: MousePointer2, project: Box };
export default function WorkCover({ work }) {
  const Icon = ICONS[work.work_type] || Box;
  return <div className="work-cover">{work.cover_asset_id || work.cover_image_url ? <AssetImage assetId={work.cover_asset_id} src={work.cover_image_url} alt={work.title} aspect="aspect-[16/10]" /> : <div className={`work-cover-art cover-${work.work_type || "project"}`} aria-label="作品封面"><span className="cover-orbit" /><span className="cover-orbit orbit-two" /><Icon size={60} strokeWidth={1} aria-hidden="true" /></div>}</div>;
}
