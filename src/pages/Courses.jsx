import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/site/SectionHeading";
import { getCourseThemes, getExperiments } from "@/services/contentService";

export default function Courses() {
  const [themes, setThemes] = useState([]);
  const [experiments, setExperiments] = useState([]);

  useEffect(() => {
    getCourseThemes().then(setThemes).catch(() => {});
    getExperiments().then(setExperiments).catch(() => {});
  }, []);

  const expByTheme = (slug) => experiments.filter((e) => e.theme_slug === slug);

  return (
    <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-10">
      <SectionHeading eyebrow="课程介绍" title="人工智能科普课程" description="面向初高中学生与授课教师，通过四个主题与五个互动实验，让 AI 知识可观察、可尝试。" />
      <div className="rounded-xl border border-border bg-card p-6 mb-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div><div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">课程定位</div><p className="text-sm text-foreground/80">高校与附属中学合作建设的科普课程，强调原理可视化与动手体验。</p></div>
          <div><div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">面向对象</div><p className="text-sm text-foreground/80">初高中学生、授课教师，以及了解课程建设成果的学校人员。</p></div>
          <div><div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">教学特色</div><p className="text-sm text-foreground/80">真实可运行的实验，区分真实计算与教学预设，支持课堂投屏演示。</p></div>
        </div>
      </div>
      <div className="space-y-8">
        {themes.map((t, i) => (
          <div key={t.slug} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid md:grid-cols-3">
              <div className="bg-muted/30 p-6 flex flex-col justify-center">
                <div className="text-3xl font-bold text-primary/20 mb-1">0{i + 1}</div>
                <h3 className="text-xl font-bold text-foreground">{t.title}</h3>
                {t.keywords?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.keywords.map((k, ki) => <span key={ki} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{k}</span>)}
                  </div>
                )}
              </div>
              <div className="md:col-span-2 p-6">
                <p className="text-base text-foreground/80 leading-relaxed">{t.summary}</p>
                {expByTheme(t.slug).length > 0 && (
                  <div className="mt-5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">相关实验</div>
                    <div className="flex flex-wrap gap-2">
                      {expByTheme(t.slug).map((e) => (
                        <Link key={e.slug} to={`/labs/${e.slug}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent hover:border-primary/30">
                          {e.title} <ArrowRight size={14} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}