import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ExperimentShell from "@/components/experiments/ExperimentShell";
import QuizPanel from "@/components/quiz/QuizPanel";
import { ErrorState, LoadingState, MaintenanceState, NotFoundState } from "@/components/site/States";
import { getExperimentBySlug, getPresetsForExperiment, getQuizForExperiment } from "@/services/contentService";
import { mergeConfig } from "../../shared/experiment-config.js";
import { LAB_REGISTRY } from '../../shared/lab-registry.js';
import UpstreamLab from '@/experiments/UpstreamLab';

const ENGINE_MAP = { neural: lazy(() => import("@/experiments/neural/NeuralLab")), maze: lazy(() => import("@/experiments/maze/MazeLab")) };
const GUIDING_QUESTIONS = { neural: "修改数据和网络结构，观察模型如何学习分类与回归。", maze: "机器人如何通过试错和奖励学会找到终点？" };

export default function LabDetail() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, experiment: null, presets: [], quizzes: [], error: null, notFound: false });
  const [activePreset, setActivePreset] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null, notFound: false }));
    Promise.all([getExperimentBySlug(slug), getPresetsForExperiment(slug), getQuizForExperiment(slug)]).then(([experiment, presets, quizzes]) => {
      if (!active) return;
      setState({ loading: false, experiment, presets, quizzes, error: null, notFound: !experiment });
      setActivePreset(null);
      setRevision((value) => value + 1);
    }).catch((error) => { if (active) setState({ loading: false, experiment: null, presets: [], quizzes: [], error, notFound: false }); });
    return () => { active = false; };
  }, [slug]);
  const { loading, experiment, presets, quizzes, error, notFound } = state;
  const LabComponent = experiment && ENGINE_MAP[experiment.engine_key];
  const selected = useMemo(() => {
    if (!experiment) return null;
    try {
      return mergeConfig(experiment.engine_key, experiment.default_config || {}, activePreset?.config || {});
    } catch {
      return experiment.default_config || {};
    }
  }, [experiment, activePreset]);
  const applyPreset = (preset) => { setActivePreset(preset); setRevision((value) => value + 1); };
  const reset = () => { setActivePreset(null); setRevision((value) => value + 1); };
  if (loading) return <LoadingState label="正在准备实验" />;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  if (notFound) return <NotFoundState label="实验不存在或尚未发布" />;
  if (!experiment) return <NotFoundState label="实验不存在或尚未发布" />;
  const upstream = Boolean(LAB_REGISTRY[experiment.slug]?.src);
  return <ExperimentShell experiment={experiment} guidingQuestion={GUIDING_QUESTIONS[experiment.engine_key] || experiment.summary} onReset={upstream ? undefined : reset}>
    {experiment.runtime_status === "maintenance" ? <MaintenanceState label="该实验正在维护，暂不可运行" /> : <>
      {presets.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm text-muted-foreground">{upstream ? '观察任务' : '挑战案例'}</span>{presets.map((preset) => <button key={preset.id || preset.slug} type="button" onClick={() => applyPreset(preset)} className={`rounded-lg border px-3 py-2 text-sm transition ${activePreset?.slug === preset.slug ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40 hover:bg-accent"}`}>{preset.title}</button>)}</div>}
      {activePreset && <div className="mb-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-4"><div className="text-sm font-medium text-foreground">{activePreset.task_description}</div>{activePreset.hint && <div className="mt-1 text-xs text-muted-foreground">提示：{activePreset.hint}</div>}</div>}
      {upstream ? <UpstreamLab key={experiment.slug} experiment={experiment} /> : LabComponent ? <Suspense fallback={<LoadingState label="正在载入实验引擎" />}><LabComponent key={`${experiment.slug}-${revision}`} preset={{ config: selected }} /></Suspense> : <ErrorState label="实验引擎不可用" error={new Error("管理员配置的实验引擎尚未接入。")}/>} 
      {quizzes.length > 0 && (upstream ? <details className="mt-7 border-t border-border pt-5"><summary className="mb-5 cursor-pointer text-xl font-semibold">课堂小测</summary><QuizPanel questions={quizzes} /></details> : <section className="mt-10 border-t border-border pt-7"><h2 className="mb-5 text-xl font-semibold text-foreground">课堂小测</h2><QuizPanel questions={quizzes} /></section>)}
    </>}
  </ExperimentShell>;
}
