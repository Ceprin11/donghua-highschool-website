import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/site/SectionHeading";
import PlaceholderImage from "@/components/site/PlaceholderImage";
import { Image } from "@/components/ui/image";
import { getStudentWorks, getCourseThemes } from "@/services/contentService";

export default function Works() {
  const [works, setWorks] = useState([]);
  const [themes, setThemes] = useState([]);
  const [themeFilter, setThemeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    getStudentWorks().then(setWorks).catch(() => {});
    getCourseThemes().then(setThemes).catch(() => {});
  }, []);

  const filtered = works.filter((w) => {
    if (themeFilter !== "all" && w.theme_slug !== themeFilter) return false;
    if (typeFilter !== "all" && w.work_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-10">
      <SectionHeading eyebrow="学生作品" title="学生作品展览" description="展示学生在课程中创作的作品。作品均为管理员审核后发布。" />
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm bg-card">
          <option value="all">全部主题</option>
          {themes.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm bg-card">
          <option value="all">全部类型</option>
          <option value="project">项目</option>
          <option value="image">图像</option>
          <option value="video">视频</option>
          <option value="interactive">互动</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">暂无已发布的作品</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((w) => (
            <Link key={w.slug} to={`/works/${w.slug}`} className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
              {w.cover_image_url ? (
                <Image src={w.cover_image_url} alt={w.title} className="w-full aspect-[4/3] bg-muted" fittingType="fill" />
              ) : (
                <PlaceholderImage label={w.title} aspect="aspect-[4/3]" />
              )}
              <div className="p-4">
                <h3 className="text-base font-semibold text-foreground group-hover:text-primary line-clamp-1">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{w.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{w.author_display_name || "匿名"}</span>
                  {w.is_demo && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">演示样例</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}