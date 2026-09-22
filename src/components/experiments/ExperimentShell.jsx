import React, { useState, useCallback, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, RotateCcw } from "lucide-react";

// Unified shell for all five experiments: title, guiding question, large viz area,
// explanation, challenges, quiz. Demo mode hides nav and enlarges controls.
export default function ExperimentShell({ experiment, children, onReset, guidingQuestion }) {
  const [demoMode, setDemoMode] = useState(false);
  const navigate = useNavigate();

  const toggleDemo = useCallback(() => setDemoMode((v) => !v), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && demoMode) setDemoMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoMode]);

  if (!experiment) return null;

  return (
    <div className={demoMode ? "fixed inset-0 z-50 bg-background overflow-auto" : ""}>
      {demoMode && (
        <button onClick={toggleDemo} className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-base font-medium shadow-lg">
          <Minimize2 size={18} /> 退出演示模式
        </button>
      )}
      <div className={demoMode ? "max-w-[1400px] mx-auto px-6 py-8" : "mx-auto max-w-[1280px] px-5 md:px-8 py-8"}>
        {!demoMode && (
          <Link to="/labs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft size={16} /> 返回实验列表
          </Link>
        )}
        <div className="mb-6">
          <div className="text-xs font-semibold text-primary tracking-widest uppercase mb-1.5">互动实验</div>
          <h1 className={`${demoMode ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"} font-bold text-foreground`} style={{ fontFamily: "var(--font-display)" }}>{experiment.title}</h1>
          {guidingQuestion && <p className={`mt-2 ${demoMode ? "text-lg" : "text-base"} text-muted-foreground`}>{guidingQuestion}</p>}
          {experiment.computation_label && (
            <div className="mt-3 inline-block text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground font-medium">{experiment.computation_label}</div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 mb-6">
          {children}
        </div>
        {!demoMode && (
          <>
            {experiment.explanation && (
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">原理说明</h2>
                <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">{experiment.explanation}</p>
              </section>
            )}
            {experiment.instructions && (
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">操作指引</h2>
                <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">{experiment.instructions}</p>
              </section>
            )}
            <div className="flex gap-3">
              <button onClick={toggleDemo} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent">
                <Maximize2 size={16} /> 进入演示模式
              </button>
              {onReset && <button onClick={onReset} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent"><RotateCcw size={16} /> 重置</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}