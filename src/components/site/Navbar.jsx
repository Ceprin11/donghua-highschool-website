import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "首页" },
  { to: "/courses", label: "课程介绍" },
  { to: "/labs", label: "互动实验室" },
  { to: "/works", label: "学生作品" },
  { to: "/about", label: "关于项目" },
];

export default function Navbar({ siteName }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isActive = (to) => to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-sm shadow-sm border-b border-border" : "bg-background/80 backdrop-blur-sm"}`}>
      <div className="mx-auto max-w-[1280px] px-5 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          <Link to="/" className="flex flex-col leading-tight group">
            <span className="text-[13px] md:text-sm font-medium text-muted-foreground tracking-wide">东华大学 · 东华大学附属松江高级中学</span>
            <span className="text-base md:text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{siteName || "人工智能科普课程与互动实验室"}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? "text-primary bg-accent"
                    : "text-foreground/80 hover:text-primary hover:bg-accent/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            className="md:hidden p-2 rounded-md text-foreground hover:bg-accent"
            onClick={() => setOpen(!open)}
            aria-label="菜单"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="px-5 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2.5 rounded-md text-sm font-medium ${
                  isActive(item.to) ? "text-primary bg-accent" : "text-foreground/80 hover:bg-accent/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}