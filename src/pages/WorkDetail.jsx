import React from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AssetVideo } from "@/components/site/Media";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import WorkCover from "@/components/site/WorkCover";
import { ErrorState, LoadingState, NotFoundState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getWorkBySlug } from "@/services/contentService";
import { mediaUrl } from "@/services/apiClient";

export default function WorkDetail() {
  const { slug } = useParams();
  const work = useContent(() => getWorkBySlug(slug), [slug]);
  if (work.loading) return <LoadingState label="正在读取作品" />;
  if (work.error) return <ErrorState error={work.error} onRetry={work.reload} />;
  if (!work.data) return <NotFoundState label="作品不存在或尚未发布" />;
  const item = work.data;
  const demoUrl = safeUrl(item.demo_url);
  const body = item.body || item.content;
  return <article className="inner-page work-detail">
    <PageHeader label="作品详情" parent={{ to: "/works", label: "学生作品" }} title={item.title} description={item.summary}><div className="article-byline"><span>{item.author_display_name || "匿名"}</span><span>{item.work_type === "video" ? "视频作品" : item.work_type === "image" ? "图像作品" : item.work_type === "interactive" ? "互动作品" : "项目作品"}</span>{item.is_demo && <span className="demo-label">演示样例</span>}</div></PageHeader>
    <div className="article-width">
      {(item.cover_asset_id || item.cover_image_url) && <Reveal className="article-cover"><WorkCover work={item} /></Reveal>}
      {body && <Reveal className="article-prose"><h2>作品介绍</h2><p>{body}</p></Reveal>}
      {(item.creative_highlights || item.ai_knowledge) && <Reveal className="article-notes">{item.creative_highlights && <div><span className="eyebrow">创意亮点</span><p>{item.creative_highlights}</p></div>}{item.ai_knowledge && <div><span className="eyebrow">用到的 AI 知识或工具</span><p>{item.ai_knowledge}</p></div>}</Reveal>}
      {item.image_asset_ids?.length > 0 && <Reveal className="article-gallery"><h2>作品图集</h2><div>{item.image_asset_ids.map((id, index) => <img key={`${id}-${index}`} src={mediaUrl(id)} alt={`作品图集 ${index + 1}`} loading="lazy" />)}</div></Reveal>}
      {(item.video_asset_id || item.video_url) && <Reveal className="article-video"><h2>作品视频</h2><AssetVideo assetId={item.video_asset_id} src={item.video_url} /></Reveal>}
      {demoUrl && <Reveal className="article-demo"><div><span className="eyebrow">亲自体验</span><h2>打开这个作品，继续探索。</h2></div><a href={demoUrl} target="_blank" rel="noopener noreferrer" className="orange-button">打开作品 <ArrowUpRight size={18} /></a></Reveal>}
      <div className="article-return"><Link to="/works" className="text-button"><ArrowLeft size={16} />返回作品列表</Link></div>
    </div>
  </article>;
}

function safeUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : ""; } catch { return ""; } }
