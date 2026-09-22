import React, { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, FlaskConical, Sparkles, BookOpen } from "lucide-react";
import SectionHeading from "@/components/site/SectionHeading";
import PlaceholderImage from "@/components/site/PlaceholderImage";
import { Image } from "@/components/ui/image";
import TeacherCard from "@/components/site/TeacherCard";
import { getCourseThemes, getExperiments, getTeacherProfile, getStudentWorks, getTeachingActivities } from "@/services/contentService";

export default function Home() {
  const { settings } = useOutletContext();
  const [themes, setThemes] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [works, setWorks] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    getCourseThemes().then(setThemes).catch(() => {});
    getExperiments().then(setExperiments).catch(() => {});
    getTeacherProfile().then(setTeacher).catch(() => {});
    getStudentWorks().then(setWorks).catch(() => {});
    getTeachingActivities().then(setActivities).catch(() => {});
  }, []);

  const vis = settings?.section_visibility || {};
  const featuredExps = experiments.filter((e) => settings?.featured_experiment_slugs?.includes(e.slug) || e.featured).slice(0, 5);
  const featuredWorks = works.filter((w) => settings?.featured_work_slugs?.includes(w.slug) || w.featured).slice(0, 4);

  return (
    <div>
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div>
            <div className="text-sm font-medium text-primary mb-3">东华大学 · 东华大学附属松江高级中学</div>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {settings?.hero_title || "看见人工智能的原理，探索未来世界的可能"}
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed">
              {settings?.hero_description || "从认识人工智能，到理解机器如何感知、生成与行动。通过课程讲解与互动实验，让抽象的 AI 知识变得可观察、可尝试。"}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/courses" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                了解课程 <ArrowRight size={16} />
              </Link>
              <Link to="/labs" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-border text-sm font-medium hover:bg-accent">
                <FlaskConical size={16} /> 进入互动实验室
              </Link>
            </div>
          </div>
          <div className="relative">
            <NeuralPreview />
          </div>
        </div>
      </section>

      {settings?.project_intro && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-8">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-10">
            <SectionHeading eyebrow="项目简介" title="合作建设的人工智能科普课程" />
            <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">{settings.project_intro}</p>
            {settings?.teaching_features?.length > 0 && (
              <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {settings.teaching_features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border p-3.5">
                    <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {vis.themes && themes.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12">
          <SectionHeading eyebrow="课程主题" title="四大课程主题" description="从认识 AI 到理解机器如何感知、生成与行动" />
          <div className="grid sm:grid-cols-2 gap-5">
            {themes.map((t) => (
              <Link key={t.slug} to="/courses" className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{t.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">{t.summary}</p>
                    </div>
                    <BookOpen size={20} className="text-muted-foreground/50 shrink-0" />
                  </div>
                  {t.keywords?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.keywords.slice(0, 4).map((k, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {vis.teacher && teacher && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12">
          <div className="bg-card/50 rounded-2xl border border-border p-6 md:p-8">
            <SectionHeading eyebrow="主讲教师" title="课程主讲教师" />
            <TeacherCard teacher={teacher} />
          </div>
        </section>
      )}

      {vis.experiments && featuredExps.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12">
          <SectionHeading eyebrow="互动实验" title="动手体验 AI 原理" description="五个可操作的互动实验，在浏览器中真实运行" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredExps.map((e) => (
              <Link key={e.slug} to={`/labs/${e.slug}`} className="group rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical size={18} className="text-primary" />
                  <span className="text-xs text-muted-foreground">{e.computation_label || "互动实验"}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground group-hover:text-primary">{e.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{e.summary}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm text-primary">进入实验 <ArrowRight size={14} /></div>
                {e.engine_key === "gesture" && <div className="mt-1.5 text-xs text-amber-700">需要摄像头授权</div>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {vis.works && featuredWorks.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12">
          <SectionHeading eyebrow="学生作品" title="精选学生作品" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredWorks.map((w) => (
              <Link key={w.slug} to={`/works/${w.slug}`} className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
                {w.cover_image_url ? (
                  <Image src={w.cover_image_url} alt={w.title} className="w-full aspect-[4/3] bg-muted" fittingType="fill" />
                ) : (
                  <PlaceholderImage label={w.title} aspect="aspect-[4/3]" />
                )}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary line-clamp-1">{w.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{w.summary}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link to="/works" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">查看全部作品 <ArrowRight size={14} /></Link>
          </div>
        </section>
      )}

      {vis.activities && activities.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-12">
          <SectionHeading eyebrow="教学活动" title="教学活动记录" />
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {activities.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <PlaceholderImage label={a.title} aspect="aspect-[4/3]" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">{a.title}</h3>
                {a.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NeuralPreview() {
  return (
    <div className="relative aspect-[4/3] rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 overflow-hidden">
      <svg viewBox="0 0 400 300" className="w-full h-full">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fdfcfa" /><stop offset="1" stopColor="#f0ede8" /></linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#bg)" />
        {[80, 160, 240, 320].map((x, li) => (
          <g key={x}>
            {[100, 150, 200].map((y, ni) => (
              <g key={y}>
                {li < 3 && [100, 150, 200].map((y2) => (
                  <line key={y2} x1={x} y1={y} x2={x + 80} y2={y2} stroke="#9B2635" strokeWidth="0.5" opacity={Math.random() * 0.4 + 0.1} />
                ))}
                <circle cx={x} cy={y} r="9" fill="#fff" stroke="#9B2635" strokeWidth="1.5" />
              </g>
            ))}
          </g>
        ))}
        <text x="200" y="280" textAnchor="middle" fontSize="11" fill="#60656D">神经网络结构示意（非实时训练）</text>
      </svg>
    </div>
  );
}