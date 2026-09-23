import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function PageHeader({ label, title, description = "", parent = null, children = null }) {
  return <header className="page-header">
    <div className="page-width">
      <nav className="page-breadcrumb" aria-label="当前位置"><Link to="/">首页</Link><ChevronRight size={13} />{parent && <><Link to={parent.to}>{parent.label}</Link><ChevronRight size={13} /></>}<span aria-current="page">{label}</span></nav>
      <div className="page-heading"><h1>{title}</h1>{description && <p>{description}</p>}{children}</div>
    </div>
  </header>;
}
