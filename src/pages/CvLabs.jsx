import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import PageHeader from '@/components/site/PageHeader';
import Reveal from '@/components/site/Reveal';
import { ErrorState, LoadingState, NotFoundState, MaintenanceState } from '@/components/site/States';
import { useContent } from '@/hooks/useContent';
import { getExperimentBySlug, getExperiments } from '@/services/contentService';
import { LAB_REGISTRY, labRoute } from '../../shared/lab-registry.js';

const load = async () => ({ group: await getExperimentBySlug('cv'), labs: await getExperiments() });
export default function CvLabs() {
  const state = useContent(load);
  if (state.loading) return <LoadingState label="正在读取视觉实验" />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  const { group, labs } = state.data;
  if (!group) return <NotFoundState label="计算机视觉实验室尚未发布" />;
  return <div className="inner-page labs-page">
    <PageHeader label="互动实验室 / 计算机视觉" title={group.title} />
    <div className="page-width page-content"><Link to="/labs" className="text-button"><ArrowLeft size={16} />返回互动实验室</Link>
      {group.runtime_status === 'maintenance' ? <MaintenanceState label="计算机视觉实验室正在维护" /> : <div className="lab-gallery cv-gallery">
        {labs.filter(lab => LAB_REGISTRY[lab.slug]?.parent === 'cv').map(lab => <Reveal key={lab.slug} className="lab-feature">
          <div className="lab-feature-visual"><img className="cv-preview" src={lab.cover_url || `/lab-previews/${lab.slug}.png`} alt={`${lab.title}实验预览`} loading="lazy" /></div>
          <div className="lab-feature-copy"><span className="eyebrow">{lab.computation_label}</span><h2>{lab.title}</h2><p>{lab.summary}</p>
            <Link to={labRoute(lab.slug)} className="text-button">进入实验 <ArrowUpRight size={18} /></Link>
          </div>
        </Reveal>)}
      </div>}
    </div>
  </div>;
}
