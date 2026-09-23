import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { mediaUrl } from "@/services/apiClient";

const NAV_ITEMS = [{ to: "/", label: "首页" }, { to: "/courses", label: "课程介绍" }, { to: "/labs", label: "互动实验室" }, { to: "/works", label: "学生作品" }, { to: "/about", label: "关于项目" }];
const SCHOOL_LOGOS = [
  { src: "/brand/dhu-emblem.png", alt: "东华大学校徽" },
  { src: "/brand/dhfx-emblem.png", alt: "东华大学附属实验学校校徽", className: "school-logo-affiliated" },
];

export default function Navbar({ siteName, settings }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const schools = settings?.school_names?.length ? settings.school_names : ["东华大学", "东华大学附属实验学校"];
  const uploadedLogos = (settings?.logo_asset_ids || []).map(asset => typeof asset === "string" ? asset : asset?.asset_id).filter(Boolean).slice(0, 2);
  const logos = uploadedLogos.length ? uploadedLogos.map((id, index) => ({ src: mediaUrl(id), alt: schools[index] || "学校校徽" })) : SCHOOL_LOGOS;
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = event => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const active = to => to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return <header className="site-header">
    <div className="school-strip"><div>{schools.join(" · ")}</div></div>
    <div className="site-nav">
      <Link to="/" className="site-wordmark" aria-label={siteName || settings?.site_name || "人工智能科普课程与互动实验室"}>
        <span className="school-logos">{logos.map(logo => <img key={logo.src} src={logo.src} alt={logo.alt} className={logo.className} width="44" height="44" />)}</span>
        <span className="wordmark-name">{siteName && siteName !== "人工智能科普课程与互动实验室" ? siteName : "人工智能"}<span>课程与互动实验室</span></span>
      </Link>
      <nav className="desktop-nav" aria-label="主导航">{NAV_ITEMS.map(item => <Link key={item.to} to={item.to} aria-current={active(item.to) ? "page" : undefined}>{item.label}</Link>)}</nav>
      <Link to="/labs" className="nav-cta">进入实验室 <ArrowUpRight size={16} /></Link>
      <button type="button" className="nav-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "关闭菜单" : "菜单"}>{open ? <X size={23} /> : <Menu size={23} />}</button>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="手机导航">{NAV_ITEMS.map(item => <Link key={item.to} to={item.to} aria-current={active(item.to) ? "page" : undefined}>{item.label}<ArrowUpRight size={16} /></Link>)}</nav>}
  </header>;
}
