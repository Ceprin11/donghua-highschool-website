import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, RotateCcw, SlidersHorizontal } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import { LAB_REGISTRY } from '../../../shared/lab-registry.js';

export default function ExperimentShell({ experiment, children, onReset, guidingQuestion }) {
  const [demoMode, setDemoMode] = useState(false);
  const toggleDemo = useCallback(() => setDemoMode(value => !value), []);
  useEffect(() => {
    const onKey = event => { if (event.key === "Escape") setDemoMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!experiment) return null;
  return <div className={`inner-page lab-detail ${experiment.engine_key === "neural" ? "neural-detail" : ""} ${demoMode ? "lab-demo fixed inset-0 z-50 bg-background overflow-auto" : ""}`}>
    <div className="page-width">
      <header className="lab-detail-heading">
        {!demoMode && <nav className="lab-breadcrumb"><Link to="/labs" className="text-button lab-back"><ArrowLeft size={15} />互动实验室</Link>{LAB_REGISTRY[experiment.slug]?.parent && <><span>/</span><Link to="/labs/cv">计算机视觉</Link></>}<span>/</span><span>{experiment.title}</span></nav>}
        <span className="eyebrow">互动实验室{experiment.computation_label && <span> / {experiment.computation_label}</span>}</span>
        <h1>{experiment.title}</h1>{guidingQuestion && <p>{guidingQuestion}</p>}
      </header>
      <div className="laboratory"><div className="laboratory-toolbar"><span><SlidersHorizontal size={16} />实验工作台</span><div><button type="button" onClick={toggleDemo} className="text-button">{demoMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{demoMode ? "退出演示模式" : "进入演示模式"}</button>{onReset && <button type="button" onClick={onReset} className="text-button"><RotateCcw size={15} />重置</button>}</div></div><div className="experiment-content">{children}</div></div>
      {!demoMode && (experiment.explanation || experiment.instructions) && <Reveal className="lab-reading">{experiment.explanation && <section><span className="eyebrow">理解实验</span><h2>原理说明</h2><p>{experiment.explanation}</p></section>}{experiment.instructions && <section><span className="eyebrow">动手试试</span><h2>操作指引</h2><p>{experiment.instructions}</p></section>}</Reveal>}
    </div>
  </div>;
}
