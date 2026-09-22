import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EXPORT_ENTITIES = [
  "SiteSettings", "TeacherProfile", "CourseTheme", "Experiment",
  "ExperimentPreset", "QuizQuestion", "StudentWork", "TeachingActivity", "MediaAsset",
];

export default function AdminOverview() {
  const [stats, setStats] = useState({ works: 0, experiments: 0, quizzes: 0, themes: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setExportMsg("");
    try {
      const data = { schemaVersion: "1.0", exportedAt: new Date().toISOString(), entities: {} };
      for (const name of EXPORT_ENTITIES) {
        const list = await base44.entities[name].filter({}, "-created_date", 500);
        data.entities[name] = list || [];
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg("导出成功，文件已开始下载");
    } catch (e) {
      setExportMsg("导出失败：" + e.message);
    }
    setExporting(false);
  };

  useEffect(() => {
    Promise.all([
      base44.entities.StudentWork.filter({}).catch(() => []),
      base44.entities.Experiment.filter({}).catch(() => []),
      base44.entities.QuizQuestion.filter({}).catch(() => []),
      base44.entities.CourseTheme.filter({}).catch(() => []),
    ]).then(([w, e, q, t]) => {
      setStats({
        works: (w || []).filter((x) => x.status === "published").length,
        experiments: (e || []).filter((x) => x.status === "published").length,
        quizzes: (q || []).filter((x) => x.status === "published").length,
        themes: (t || []).filter((x) => x.status === "published").length,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: "已发布作品", value: stats.works, link: "/admin/works" },
    { label: "可用实验", value: stats.experiments, link: "/admin/experiments" },
    { label: "已发布题目", value: stats.quizzes, link: "/admin/quizzes" },
    { label: "课程主题", value: stats.themes, link: "/admin/courses" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">建设概览</h1>
      {loading ? <div className="text-muted-foreground">加载中…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <Link key={c.label} to={c.link} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="text-3xl font-bold text-primary">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
            </Link>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">常用入口</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/settings" className="px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent">首页与网站设置</Link>
          <Link to="/admin/teacher" className="px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent">主讲教师</Link>
          <Link to="/admin/works" className="px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent">学生作品</Link>
          <Link to="/admin/experiments" className="px-3.5 py-2 rounded-lg border border-border text-sm hover:bg-accent">实验管理</Link>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">数据导出</h2>
        <p className="text-xs text-muted-foreground mb-3">导出全部内容实体为 JSON 文件（每类最多 500 条）。素材文件本体需另行下载备份，详见迁移文档。</p>
        <button onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 导出内容数据
        </button>
        {exportMsg && <div className={`mt-2 text-xs ${exportMsg.includes("失败") ? "text-red-600" : "text-green-600"}`}>{exportMsg}</div>}
      </div>
      <div className="mt-4 text-xs text-muted-foreground">本后台不展示访问量与学生人数等未实际统计的数据。</div>
    </div>
  );
}