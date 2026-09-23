import React from "react";
import { ArrowUpRight, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import ExperimentArt from "@/components/site/ExperimentArt";
import { AssetImage } from "@/components/site/Media";
import { EmptyState, ErrorState, LoadingState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getCourseThemes } from "@/services/contentService";
import "@/styles/courses.css";

const THEME_ART = { "intro-ai": "neural", "computer-vision": "cv", "generative-ai": "transformer", "embodied-intelligence": "maze" };
const SHORT_TITLES = { "intro-ai": "AI 与社会", "computer-vision": "计算机视觉", "generative-ai": "生成式 AI", "embodied-intelligence": "具身智能" };

export default function Courses() {
  const themes = useContent(getCourseThemes);
  const list = (themes.data || []).slice(0, 4);
  return <div className="inner-page courses-page">
    <PageHeader label="课程介绍" title="课程介绍" />
    {themes.loading ? <LoadingState label="正在读取课程" /> : themes.error ? <ErrorState error={themes.error} onRetry={themes.reload} /> : list.length ? <>
      <nav className="course-jump page-width" aria-label="课程主题">{list.map((theme, index) => <a key={theme.slug} href={`#${theme.slug}`}><span>0{index + 1}</span>{SHORT_TITLES[theme.slug] || theme.title}<ArrowDown size={15} /></a>)}</nav>
      <div className="course-chapters">{list.map((theme, index) => <Reveal key={theme.slug} id={theme.slug} className={`course-chapter ${index % 2 ? "chapter-reverse" : ""}`}>
        <Link to={`/courses/${theme.slug}`} className="page-width chapter-layout course-card-link" aria-label={`查看课程：${theme.title}`}>
          <div className="chapter-figure"><div className="figure-label"><span>课程 0{index + 1}</span><span>{(theme.keywords || []).join(" / ")}</span></div>{theme.cover_asset_id || theme.cover_url ? <AssetImage assetId={theme.cover_asset_id} src={theme.cover_url} alt="" aspect="aspect-[5/4]" /> : <ExperimentArt engine={THEME_ART[theme.slug]} />}</div>
          <div className="chapter-copy"><span className="eyebrow">课程主题 0{index + 1}</span><h2>{theme.title}</h2><p>{theme.summary}</p><div className="chapter-keywords">{(theme.keywords || []).map(word => <span key={word}>{word}</span>)}</div><span className="text-button course-open">查看课程内容<ArrowUpRight size={18} /></span></div>
        </Link>
      </Reveal>)}</div>
    </> : <div className="page-width page-content"><EmptyState title="课程即将更新" description="新的主题内容会在这里展示。" /></div>}
  </div>;
}
