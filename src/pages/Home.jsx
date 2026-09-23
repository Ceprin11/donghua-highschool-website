import { labRoute, topLevelLab } from '../../shared/lab-registry.js';
import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, BrainCircuit, ScanLine, Sparkles, Route, Plus, Minus } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import Reveal from "@/components/site/Reveal";
import TopicVisual from "@/components/site/TopicVisual";
import TeacherCard from "@/components/site/TeacherCard";
import NeuralPreview from "@/components/site/NeuralPreview";
import { AssetImage } from "@/components/site/Media";
import { EmptyState, ErrorState, LoadingState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getCourseThemes, getExperiments, getStudentWorks, getTeacherProfile, getTeachingActivities } from "@/services/contentService";
import "@/styles/home.css";

/** @type {import("../services/contentService").SiteSettings} */
const FALLBACK_SETTINGS = { hero_title: "人工智能课程，互动实验室", hero_description: "", section_visibility: { themes: true, teacher: true, experiments: true, works: true, activities: true } };
const ICONS = { neural: BrainCircuit, cv: ScanLine, transformer: Sparkles, maze: Route };
const QUESTIONS = ["机器是怎样学会分类的？", "计算机看到的世界是什么样？", "AI 为什么会给出不同的回答？", "机器人如何学会下一步行动？"];
const TOPIC_INDEX = { "intro-ai": 0, "computer-vision": 1, "generative-ai": 2, "embodied-intelligence": 3 };

export default function Home() {
  const { settings: loadedSettings, settingsError } = /** @type {{settings: import("../services/contentService").SiteSettings | null, settingsError: Error | null}} */ (useOutletContext());
  const settings = loadedSettings || FALLBACK_SETTINGS;
  const themes = useContent(getCourseThemes);
  const experiments = useContent(getExperiments);
  const teacher = useContent(getTeacherProfile);
  const works = useContent(getStudentWorks);
  const activities = useContent(getTeachingActivities);
  const [activeTheme, setActiveTheme] = useState(0);
  const visible = { ...FALLBACK_SETTINGS.section_visibility, ...settings.section_visibility };
  const featuredExperiments = (experiments.data || []).filter(topLevelLab).filter(item => settings.featured_experiment_slugs?.includes(item.slug) || item.featured);
  const displayedExperiments = (featuredExperiments.length ? featuredExperiments : experiments.data?.filter(topLevelLab) || []).slice(0, 4);
  const featuredWorks = (works.data || []).filter(item => settings.featured_work_slugs?.includes(item.slug) || item.featured);
  const displayedWorks = (featuredWorks.length ? featuredWorks : works.data || []).slice(0, 3);
  const neuralReady = (experiments.data || []).some(item => item.engine_key === "neural" && item.runtime_status === "ready");
  const hasHeroImage = Boolean(settings.hero_media_asset_id || settings.hero_media_url);
  const visualIndex = TOPIC_INDEX[themes.data?.[activeTheme]?.slug] ?? 0;
  const titleLines = (settings.hero_title || FALLBACK_SETTINGS.hero_title).split(/[，,]/u);
  if (settingsError) return <ErrorState error={settingsError} onRetry={() => window.location.reload()} />;

  return <div className="home-page">
    <section className="home-hero">
      <div className="hero-copy">
        
        <h1>{titleLines.map((line, index) => <span key={index}>{line}</span>)}</h1>
        {settings.hero_description && <p className="hero-description">{settings.hero_description}</p>}
        <div className="hero-actions"><Link to="/labs" className="orange-button">进入实验室 <ArrowUpRight size={19} /></Link>{visible.themes ? <a href="#courses" className="text-button">查看课程 <ArrowRight size={17} /></a> : <Link to="/courses" className="text-button">查看课程 <ArrowRight size={17} /></Link>}</div>
      </div>
      <div className="hero-stage">{hasHeroImage ? <AssetImage assetId={settings.hero_media_asset_id} src={settings.hero_media_url} alt="人工智能课程" className="hero-custom-image" aspect="aspect-[16/7]" /> : neuralReady ? <NeuralPreview /> : <div className="hero-static-visual"><TopicVisual index={0} /></div>}</div>
      <div className="hero-caption"><Link to={neuralReady ? "/labs/neural-network" : "/labs"}>{neuralReady ? "打开完整实验" : "进入实验室"} <ArrowUpRight size={15} /></Link></div>
    </section>

    {visible.themes && <Reveal className="home-section home-courses" id="courses">
      <div className="section-topline"><span className="eyebrow">课程介绍</span><Link to="/courses" className="text-button">全部课程 <ArrowUpRight size={17} /></Link></div>
      <h2>课程主题</h2>
      
      {themes.loading ? <LoadingState label="正在读取课程" /> : themes.error ? <ErrorState error={themes.error} onRetry={themes.reload} /> : themes.data?.length ? <div className="course-explorer">
        <div className="course-visual"><TopicVisual index={visualIndex} /><span className="visual-caption">{["数据 · 学习 · 预测", "像素 · 颜色 · 轮廓", "语言 · 概率 · 生成", "探索 · 奖励 · 行动"][visualIndex]}</span></div>
        <div className="course-accordion">{themes.data.slice(0, 4).map((theme, index) => <div key={theme.slug} className={`course-topic ${activeTheme === index ? "is-active" : ""}`}>
          <h3><button type="button" aria-expanded={activeTheme === index} aria-controls={`course-panel-${index}`} onClick={() => setActiveTheme(index)}><span className="topic-number">0{index + 1}</span><span>{theme.title}</span>{activeTheme === index ? <Minus size={18} /> : <Plus size={18} />}</button></h3>
          <div id={`course-panel-${index}`} hidden={activeTheme !== index} className="course-answer"><p className="course-question">{QUESTIONS[TOPIC_INDEX[theme.slug]]}</p><p>{theme.summary}</p><Link to={`/courses/${theme.slug}`}>了解这个主题 <ArrowRight size={15} /></Link></div>
        </div>)}</div>
      </div> : <EmptyState title="课程即将更新" />}
    </Reveal>}

    {visible.experiments && <section className="home-labs"><Reveal className="home-section">
      
      <div className="labs-heading"><h2>互动实验室</h2></div>
      {experiments.loading ? <LoadingState label="正在读取实验" /> : experiments.error ? <ErrorState error={experiments.error} onRetry={experiments.reload} /> : displayedExperiments.length ? <div className="experiment-list">{displayedExperiments.map((experiment, index) => {
        const Icon = ICONS[experiment.engine_key] || BrainCircuit;
        return <Link key={experiment.slug} to={labRoute(experiment.slug)} className="experiment-row"><span className="experiment-number">0{index + 1}</span><span className="experiment-icon"><Icon size={28} strokeWidth={1.4} /></span><h3>{experiment.title}</h3><p>{experiment.summary}</p><span className="experiment-open">{experiment.runtime_status === "maintenance" ? "维护中" : "开始实验"}<ArrowUpRight size={21} /></span></Link>;
      })}</div> : <EmptyState title="实验即将更新" />}
    </Reveal></section>}

    <Reveal className="home-section home-method">
      <div><h2>关于项目</h2><p className="section-description">{settings.project_intro || "面向初高中学生的人工智能科普课程与互动实验。"}</p>{settings.teaching_features?.length > 0 && <p className="method-features">{settings.teaching_features.join(" · ")}</p>}<Link to="/about" className="text-button">关于这个项目 <ArrowUpRight size={17} /></Link></div>
      <div className="method-steps">{[["课程讲解", "人工智能基础、应用与社会影响。"], ["互动实验", "调整数据和参数，查看模型输出。"], ["课堂讨论", "分析实验结果，讨论课程案例。"]].map(([title, description], index) => <div key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>
    </Reveal>

    {visible.teacher && (teacher.loading || teacher.error || teacher.data) && <Reveal className="home-section home-editorial"><h2>主讲教师</h2>{teacher.loading ? <LoadingState /> : teacher.error ? <ErrorState error={teacher.error} onRetry={teacher.reload} /> : <TeacherCard teacher={teacher.data} />}</Reveal>}
    {visible.works && (works.loading || works.error || displayedWorks.length > 0) && <Reveal className="home-section home-editorial"><div className="section-topline"><span className="eyebrow">学生作品</span><Link to="/works" className="text-button">全部作品 <ArrowUpRight size={17} /></Link></div><h2>学生作品</h2>{works.loading ? <LoadingState /> : works.error ? <ErrorState error={works.error} onRetry={works.reload} /> : <div className="editorial-grid">{displayedWorks.map(work => <Link key={work.slug} to={`/works/${work.slug}`}><AssetImage assetId={work.cover_asset_id} src={work.cover_image_url} alt={work.title} /><h3>{work.title}</h3><p>{work.summary}</p></Link>)}</div>}</Reveal>}
    {visible.activities && (activities.loading || activities.error || activities.data?.length > 0) && <Reveal className="home-section home-editorial"><h2>教学活动</h2>{activities.loading ? <LoadingState /> : activities.error ? <ErrorState error={activities.error} onRetry={activities.reload} /> : <div className="editorial-grid">{activities.data.slice(0, 3).map(activity => <article key={activity.id}>{activity.photo_asset_ids?.[0] && <AssetImage assetId={activity.photo_asset_ids[0]} alt={activity.title} />}<h3>{activity.title}</h3><p>{activity.description}</p></article>)}</div>}</Reveal>}
    
  </div>;
}
