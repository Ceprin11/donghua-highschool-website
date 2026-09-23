import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import { ErrorState, LoadingState, NotFoundState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getCourseThemes, getExperiments } from "@/services/contentService";
import { labRoute } from "../../shared/lab-registry.js";
import "@/styles/courses.css";

export default function CourseDetail() {
  const { slug } = useParams();
  const themes = useContent(getCourseThemes);
  const experiments = useContent(getExperiments);
  if (themes.loading) return <LoadingState label="正在读取课程" />;
  if (themes.error) return <ErrorState error={themes.error} onRetry={themes.reload} />;
  const list = themes.data || [];
  const index = list.findIndex(course => course.slug === slug);
  const course = list[index];
  if (!course) return <NotFoundState label="课程不存在或尚未发布" />;
  const related = (experiments.data || []).filter(item => course.experiment_slugs?.includes(item.slug) || course.experiment_slugs?.includes(item.engine_key));
  const previous = list[index - 1], next = list[index + 1];
  return <article className="inner-page course-detail">
    <PageHeader label={course.title} parent={{ to: "/courses", label: "课程介绍" }} title={course.title} description={course.overview || course.summary}>
      <div className="course-detail-meta"><span>第 {index + 1} 课</span>{(course.keywords || []).map(word => <span key={word}>{word}</span>)}</div>
    </PageHeader>
    <div className="page-width course-detail-body">
      <div className="course-main">
        {course.sections?.length > 0 && <Reveal className="course-syllabus" aria-labelledby="course-content-heading">
          <span className="eyebrow">这节课讲什么</span><h2 id="course-content-heading">核心内容</h2>
          <div className="course-section-list">{course.sections.map((section, i) => <section key={i} className="course-section"><h3>{section.title}</h3><p>{section.body}</p></section>)}</div>
        </Reveal>}
        {course.takeaways?.length > 0 && <Reveal className="course-outcomes" aria-labelledby="course-outcomes-heading"><h2 id="course-outcomes-heading">你将学到</h2><ul>{course.takeaways.map((item, i) => <li key={i}>{item}</li>)}</ul></Reveal>}
      </div>
      <aside className="course-side">
        {course.activity_title && <Reveal className="course-classroom"><span className="eyebrow">课堂活动</span><h2>{course.activity_title}</h2><p>{course.activity_description}</p></Reveal>}
        {course.discussion && <Reveal className="course-question-block"><span className="eyebrow">带着问题出发</span><p>{course.discussion}</p></Reveal>}
      </aside>
    </div>
    <div className="page-width">
      {experiments.error ? <ErrorState label="关联实验加载失败" error={experiments.error} onRetry={experiments.reload} /> : experiments.loading ? <p className="course-lab-loading" role="status">正在读取关联实验</p> : related.length > 0 && <Reveal className="course-related" aria-labelledby="course-related-heading">
        <div><h2 id="course-related-heading">相关实验</h2></div>
        <div className="course-related-links">{related.map(item => <Link key={item.slug} to={labRoute(item.slug)}><span><strong>{item.title}</strong><small>{item.summary}</small>{item.runtime_status === "maintenance" && <small>维护中</small>}</span><ArrowUpRight size={22} /></Link>)}</div>
      </Reveal>}
      <nav className="course-pagination" aria-label="课程翻页">
        {previous ? <Link to={`/courses/${previous.slug}`}><span><ArrowLeft size={16} />上一课</span><strong>{previous.title}</strong></Link> : <Link to="/courses"><span><ArrowLeft size={16} />返回课程</span><strong>查看全部四个主题</strong></Link>}
        {next ? <Link to={`/courses/${next.slug}`} className="course-next"><span>下一课<ArrowRight size={16} /></span><strong>{next.title}</strong></Link> : <Link to="/courses" className="course-next"><span>全部课程<ArrowRight size={16} /></span><strong>查看全部课程</strong></Link>}
      </nav>
    </div>
  </article>;
}
