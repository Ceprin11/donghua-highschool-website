import React from "react";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import WorkCover from "@/components/site/WorkCover";
import { ErrorState, LoadingState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getStudentWorks } from "@/services/contentService";

const TYPE_LABEL = { interactive: "互动作品", video: "视频作品", image: "图像作品", project: "项目作品" };
export default function Works() {
  const works = useContent(getStudentWorks);
  return <div className="inner-page works-page">
    <PageHeader label="学生作品" title="学生作品" />
    <div className="page-width page-content"><div className="collection-heading"><h2>学生作品</h2>{works.data && <span>{works.data.length} 件作品</span>}</div>
      {works.loading ? <LoadingState label="正在读取作品" /> : works.error ? <ErrorState error={works.error} onRetry={works.reload} /> : works.data?.length ? <div className="works-grid">{works.data.map(work => <Reveal key={work.id || work.slug} className="work-story"><Link to={`/works/${work.slug}`}><WorkCover work={work} /><div className="work-meta"><span>{TYPE_LABEL[work.work_type] || "项目作品"}</span>{work.is_demo && <span className="demo-label">演示样例</span>}</div><h2>{work.title}<ArrowUpRight size={19} /></h2>{work.summary && <p>{work.summary}</p>}<div className="work-byline">{work.author_display_name || "匿名"}</div></Link></Reveal>)}</div> : <Reveal className="collection-empty"><FolderOpen size={44} strokeWidth={1} /><h2>还没有发布作品</h2><Link className="orange-button" to="/labs">进入实验室 <ArrowUpRight size={17} /></Link></Reveal>}
    </div>
  </div>;
}
