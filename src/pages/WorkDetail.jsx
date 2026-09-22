import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import PlaceholderImage from "@/components/site/PlaceholderImage";
import { Image } from "@/components/ui/image";
import { getWorkBySlug, getCourseThemes } from "@/services/contentService";

export default function WorkDetail() {
  const { slug } = useParams();
  const [work, setWork] = useState(null);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getWorkBySlug(slug).then((w) => {
      if (!w) { setNotFound(true); setLoading(false); return; }
      setWork(w); setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
    getCourseThemes().then(setThemes).catch(() => {});
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-[900px] px-5 py-20 text-center text-muted-foreground">加载中…</div>;
  if (notFound) return (
    <div className="mx-auto max-w-[900px] px-5 py-20 text-center">
      <div className="text-lg text-foreground mb-2">作品不存在或已下架</div>
      <Link to="/works" className="text-sm text-primary hover:underline">返回作品列表</Link>
    </div>
  );

  const theme = themes.find((t) => t.slug === work.theme_slug);
  const safeUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return null;
  };
  const demo = safeUrl(work.demo_url);

  return (
    <div className="mx-auto max-w-[900px] px-5 md:px-8 py-10">
      <Link to="/works" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft size={16} /> 返回作品列表</Link>
      {work.cover_image_url ? (
        <Image src={work.cover_image_url} alt={work.title} className="w-full aspect-[16/9] rounded-lg bg-muted" fittingType="fill" />
      ) : (
        <PlaceholderImage label={work.title} aspect="aspect-[16/9]" />
      )}
      <h1 className="mt-5 text-2xl md:text-3xl font-bold text-foreground">{work.title}</h1>
      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>作者：{work.author_display_name || "匿名"}</span>
        {theme && <span>主题：{theme.title}</span>}
        {work.is_demo && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">演示样例（非学生提交）</span>}
      </div>
      {work.summary && <p className="mt-4 text-base text-foreground/80 leading-relaxed">{work.summary}</p>}
      {work.creative_highlights && (
        <div className="mt-6"><h2 className="text-sm font-semibold text-foreground mb-1.5">创意亮点</h2><p className="text-sm text-foreground/80 leading-relaxed">{work.creative_highlights}</p></div>
      )}
      {work.ai_knowledge && (
        <div className="mt-5"><h2 className="text-sm font-semibold text-foreground mb-1.5">用到的 AI 知识或工具</h2><p className="text-sm text-foreground/80 leading-relaxed">{work.ai_knowledge}</p></div>
      )}
      {demo && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground mb-1.5">演示链接</h2>
          <a href={demo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all">{demo} <ExternalLink size={14} /></a>
          <div className="mt-1 text-xs text-muted-foreground">外部链接将在新窗口打开</div>
        </div>
      )}
    </div>
  );
}