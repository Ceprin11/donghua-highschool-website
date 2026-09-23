import { labRoute, topLevelLab } from '../../shared/lab-registry.js';
import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";
import ExperimentArt from "@/components/site/ExperimentArt";
import { EmptyState, ErrorState, LoadingState } from "@/components/site/States";
import { useContent } from "@/hooks/useContent";
import { getExperiments } from "@/services/contentService";

export default function Labs() {
  const experiments = useContent(getExperiments);
  return <div className="inner-page labs-page">
    <PageHeader label="互动实验室" title="互动实验室" />
    <div className="page-width page-content">
      <div className="collection-heading"><h2>选择一个实验</h2></div>
      {experiments.loading ? <LoadingState label="正在读取实验" /> : experiments.error ? <ErrorState error={experiments.error} onRetry={experiments.reload} /> : experiments.data?.length ? <div className="lab-gallery">{experiments.data.filter(topLevelLab).map((experiment, index) => <Reveal key={experiment.slug} className={`lab-feature ${index === 0 ? "lab-feature-wide" : ""}`}><div className="lab-feature-visual"><ExperimentArt engine={experiment.engine_key} /></div><div className="lab-feature-copy"><span className="eyebrow">{experiment.computation_label}</span><h2>{experiment.title}</h2><p>{experiment.summary}</p>{experiment.runtime_status === "maintenance" ? <span className="maintenance-label">维护中，稍后再来看看</span> : <Link to={labRoute(experiment.slug)} className={index === 0 ? "orange-button" : "text-button"}>开始实验 <ArrowUpRight size={18} /></Link>}</div></Reveal>)}</div> : <EmptyState title="实验即将更新" description="新的实验会在这里展示。" />}
    </div>
  </div>;
}
