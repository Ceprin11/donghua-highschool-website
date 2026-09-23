import React from "react";
import { Link } from "react-router-dom";

export default function Footer({ settings }) {
  const schools = settings?.school_names?.length ? settings.school_names : ["东华大学", "东华大学附属实验学校"];
  return <footer className="site-footer"><div className="footer-main"><div className="footer-identity"><span className="footer-wordmark">{settings?.site_name || "人工智能科普课程与互动实验室"}</span><p>{schools.join(" · ")}</p></div><div className="footer-links"><div><h2>课程与实验</h2><Link to="/courses">课程介绍</Link><Link to="/labs">互动实验室</Link><Link to="/works">学生作品</Link></div><div><h2>了解更多</h2><Link to="/about">关于项目</Link><Link to="/credits">开源致谢</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {settings?.footer_text || "人工智能科普课程与互动实验室"}</span><div>{settings?.contact_email && <a href={`mailto:${settings.contact_email}`}>联系我们</a>}{settings?.filing_info && <span>{settings.filing_info}</span>}<Link to="/admin">管理入口</Link></div></div></footer>;
}
