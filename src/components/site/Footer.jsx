import React from "react";
import { Link } from "react-router-dom";

export default function Footer({ settings }) {
  const schools = settings?.school_names?.length ? settings.school_names : ["东华大学", "东华大学附属松江高级中学"];
  return (
    <footer className="mt-20 border-t border-border bg-card/50">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold text-foreground mb-2">{settings?.site_name || "人工智能科普课程与互动实验室"}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {schools.join(" · ")}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground mb-2 text-muted-foreground uppercase tracking-wider">说明与致谢</div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li><Link to="/data-notice" className="hover:text-primary transition-colors">数据与摄像头使用说明</Link></li>
              <li><Link to="/credits" className="hover:text-primary transition-colors">开源致谢</Link></li>
              <li><Link to="/admin" className="hover:text-primary transition-colors">管理员入口</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground mb-2 text-muted-foreground uppercase tracking-wider">联系与备案</div>
            <div className="text-sm text-muted-foreground space-y-1">
              {settings?.contact_email && <div>联系邮箱：{settings.contact_email}</div>}
              {settings?.filing_info && <div>{settings.filing_info}</div>}
              {!settings?.contact_email && !settings?.filing_info && <div className="text-xs italic">待补充</div>}
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col md:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} {schools.join(" · ")} · 人工智能科普课程与互动实验室</span>
          <span>{settings?.footer_text || "本网站为教学合作项目演示用途"}</span>
        </div>
      </div>
    </footer>
  );
}