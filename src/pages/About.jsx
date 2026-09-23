import React from "react";
import { ArrowUpRight, BookOpen, FlaskConical, MessagesSquare } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import { AssetImage } from "@/components/site/Media";
import TeacherCard from "@/components/site/TeacherCard";
import { ErrorState, LoadingState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getTeacherProfile, getTeachingActivities } from "@/services/contentService";

export default function About() {
  const { settings, settingsError } = /** @type {{settings: import("../services/contentService").SiteSettings | null, settingsError: Error | null}} */ (useOutletContext());
  const teacher = useContent(getTeacherProfile);
  const activities = useContent(getTeachingActivities);
  const schools = settings?.school_names?.length ? settings.school_names : ["东华大学", "东华大学附属实验学校"];
  if (settingsError) return <ErrorState error={settingsError} onRetry={() => window.location.reload()} />;
  return <div className="inner-page about-page">
    <PageHeader label="关于项目" title="关于项目" description={settings?.about_text || settings?.project_intro || "东华大学与东华大学附属实验学校合作开展的人工智能科普课程。"} />
    <Reveal className="about-partnership page-width"><span className="eyebrow">合作学校</span><div>{schools.map((school, index) => <React.Fragment key={school}>{index > 0 && <span className="partnership-plus">+</span>}<h2>{school}</h2></React.Fragment>)}</div></Reveal>
    <section className="about-principles"><Reveal className="page-width"><div className="section-intro"><h2>课程安排</h2></div><div className="principles-grid">{[{ Icon: BookOpen, title: "课程讲解", description: "人工智能与社会、计算机视觉、生成式 AI、具身智能四个主题。" }, { Icon: FlaskConical, title: "互动实验", description: "在浏览器中调整模型参数，查看训练结果。" }, { Icon: MessagesSquare, title: "课堂讨论", description: "结合课程案例，讨论 AI 的应用与社会影响。" }].map(({ Icon, title, description }) => <div key={String(title)}><Icon size={28} strokeWidth={1.3} /><h3>{title}</h3><p>{description}</p></div>)}</div></Reveal></section>
    {(teacher.loading || teacher.error || teacher.data) && <Reveal className="page-width about-teacher"><div className="section-intro"><h2>主讲教师</h2></div>{teacher.loading ? <LoadingState label="正在读取教师资料" /> : teacher.error ? <ErrorState error={teacher.error} onRetry={teacher.reload} /> : <TeacherCard teacher={teacher.data} />}</Reveal>}
    {(activities.loading || activities.error || activities.data?.length > 0) && <Reveal className="page-width about-activities"><div className="section-intro"><h2>教学活动</h2></div>{activities.loading ? <LoadingState label="正在读取活动记录" /> : activities.error ? <ErrorState error={activities.error} onRetry={activities.reload} /> : <div className="activities-gallery">{activities.data.map(activity => <article key={activity.id || activity.title}><div className="activity-photos">{(activity.photo_asset_ids || []).map(id => <AssetImage key={id} assetId={id} alt={activity.title} />)}</div><h3>{activity.title}</h3><p>{activity.description}</p></article>)}</div>}</Reveal>}
    <Reveal className="about-contact"><div className="page-width"><div><h2>课程介绍</h2></div><div><Link to="/courses" className="orange-button">查看课程 <ArrowUpRight size={18} /></Link>{settings?.contact_email && <a href={`mailto:${settings.contact_email}`} className="text-button">联系项目 <ArrowUpRight size={17} /></a>}</div></div></Reveal>
  </div>;
}
