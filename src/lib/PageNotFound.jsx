import React from "react";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";

export default function PageNotFound() {
  return <main className="min-h-screen bg-background px-5 py-20"><div className="mx-auto flex max-w-md flex-col items-center text-center"><FileQuestion size={40} className="text-primary" /><div className="mt-5 text-7xl font-light text-primary/25">404</div><h1 className="mt-3 text-2xl font-bold text-foreground">页面不存在</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">这个地址没有对应的公开内容，页面可能已下架。</p><Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><ArrowLeft size={16} />返回首页</Link></div></main>;
}
