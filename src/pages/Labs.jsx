import React, { useState, useEffect, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import ExperimentShell from "@/components/experiments/ExperimentShell";
import QuizPanel from "@/components/quiz/QuizPanel";
import { getExperimentBySlug, getPresetsForExperiment, getQuizForExperiment } from "@/services/contentService";

const NeuralLab = lazy(() => import("@/experiments/neural/NeuralLab"));
const VisionLab = lazy(() => import("@/experiments/vision/VisionLab"));
const TemperatureLab = lazy(() => import("@/experiments/temperature/TemperatureLab"));
const MazeLab = lazy(() => import("@/experiments/maze/MazeLab"));
const GestureLab = lazy(() => import("@/experiments/gesture/GestureLab"));

const ENGINE_MAP = {
  neural: NeuralLab,
  vision: VisionLab,
  temperature: TemperatureLab,
  maze: MazeLab,
  gesture: GestureLab,
};

const GUIDING_QUESTIONS = {
  neural: "修改数据和网络结构后，模型如何学会分类？",
  vision: "图像在计算机中是什么样的？处理操作如何改变它？",
  temperature: "候选词的概率分布如何随温度变化？抽样结果有何不同？",
  maze: "机器人如何通过试错和奖励学会找到终点？",
  gesture: "计算机如何通过摄像头看到你的手势？",
};

export default function LabDetail() {
  const { slug } = useParams();
  const [experiment, setExperiment] = useState(null);
  const [presets, setPresets] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    getExperimentBySlug(slug).then((exp) => {
      if (!exp) { setNotFound(true); setLoading(false); return; }
      setExperiment(exp);
      getPresetsForExperiment(slug).then(setPresets).catch(() => {});
      getQuizForExperiment(slug).then(setQuizzes).catch(() => {});
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-[1280px] px-5 py-20 text-center text-muted-foreground">加载中…</div>;
  if (notFound) return <div className="mx-auto max-w-[1280px] px-5 py-20 text-center"><div className="text-lg text-foreground mb-2">实验不存在或未发布</div><a href="/labs" className="text-sm text-primary hover:underline">返回实验列表</a></div>;

  const LabComponent = ENGINE_MAP[experiment.engine_key];
  const guidingQuestion = GUIDING_QUESTIONS[experiment.engine_key];

  return (
    <ExperimentShell experiment={experiment} guidingQuestion={guidingQuestion}>
      {experiment.runtime_status === "maintenance" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">该实验算法仍在完善中（维护状态），内容已发布但运行可能不稳定。</div>
      )}
      {presets.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">挑战案例：</span>
          {presets.map((p) => (
            <button key={p.slug} onClick={() => setActivePreset(p)} className={`px-3 py-1.5 rounded-lg text-sm border ${activePreset?.slug === p.slug ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{p.title}</button>
          ))}
        </div>
      )}
      {activePreset && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-sm font-medium text-foreground">{activePreset.task_description}</div>
          {activePreset.hint && <div className="mt-1 text-xs text-muted-foreground">提示：{activePreset.hint}</div>}
        </div>
      )}
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">实验加载中…</div>}>
        {LabComponent ? <LabComponent preset={activePreset} /> : <div className="text-muted-foreground">未知实验引擎</div>}
      </Suspense>
      {quizzes.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">课堂小测</h2>
          <QuizPanel questions={quizzes} />
        </div>
      )}
    </ExperimentShell>
  );
}