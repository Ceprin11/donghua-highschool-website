import React from "react";
import { AlertCircle, FileQuestion, RefreshCw, Wrench } from "lucide-react";

export function LoadingState({ label = "正在加载内容" }) {
  return <div className="min-h-[24rem] flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground" role="status"><span className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />{label}…</div>;
}

export function ErrorState({ error, onRetry = null, label = "内容加载失败" }) {
  return <div className="min-h-[18rem] flex flex-col items-center justify-center gap-3 px-5 text-center" role="alert"><AlertCircle size={28} className="text-primary" /><p className="text-base font-medium text-foreground">{label}</p><p className="max-w-md text-sm text-muted-foreground">{error?.message || "服务暂时不可用，请稍后重试。"}</p>{onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"><RefreshCw size={15} />重新加载</button>}</div>;
}

export function EmptyState({ title = "这里还没有内容", description = "管理员发布内容后会显示在这里。", action = null }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-12 text-center"><FileQuestion size={28} className="mx-auto mb-3 text-muted-foreground/60" /><p className="text-base font-medium text-foreground">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p>{action}</div>;
}

export function NotFoundState({ label = "页面不存在" }) {
  return <div className="min-h-[24rem] flex flex-col items-center justify-center gap-3 px-5 text-center"><FileQuestion size={32} className="text-primary" /><h1 className="text-xl font-semibold text-foreground">{label}</h1><p className="text-sm text-muted-foreground">内容可能已下架，或地址输入有误。</p></div>;
}

export function MaintenanceState({ label = "实验维护中" }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-10 text-center"><Wrench size={28} className="mx-auto mb-3 text-amber-700" /><p className="font-medium text-amber-900">{label}</p><p className="mt-1 text-sm text-amber-800">管理员正在更新这个内容，稍后再来看看。</p></div>;
}

export function PageIntro({ eyebrow, title, description = "", children = null }) {
  return <div className="mb-10 max-w-3xl"><div className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">{eyebrow}</div><h1 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>{title}</h1>{description && <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">{description}</p>}{children}</div>;
}

export function StatusBadge({ status = "draft", runtimeStatus = null }) {
  const label = runtimeStatus === "maintenance" ? "维护中" : status === "published" ? "已发布" : status === "archived" ? "已下架" : "草稿";
  const tone = runtimeStatus === "maintenance" ? "bg-amber-50 text-amber-800" : status === "published" ? "bg-emerald-50 text-emerald-700" : status === "archived" ? "bg-slate-100 text-slate-600" : "bg-primary/10 text-primary";
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}
