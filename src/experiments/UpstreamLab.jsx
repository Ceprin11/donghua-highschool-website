import { useEffect, useRef, useState } from 'react';
import { LAB_REGISTRY } from '../../shared/lab-registry.js';

export default function UpstreamLab({ experiment }) {
  const frame = useRef(null);
  const [error, setError] = useState('');
  const entry = LAB_REGISTRY[experiment.slug];
  useEffect(() => {
    const controller = new AbortController();
    fetch(entry.src, { method: 'HEAD', signal: controller.signal }).then(response => {
      if (!response.ok) setError(`实验资源暂时无法读取（${response.status}），请稍后重试。`);
    }).catch(e => { if (e.name !== 'AbortError') setError('实验资源无法读取，请检查本地服务。'); });
    const current = frame.current;
    return () => { controller.abort(); if (current) current.src = 'about:blank'; };
  }, [entry.src]);
  if (error) return <p role="alert" className="p-8">{error}</p>;
  return <iframe ref={frame} className="upstream-lab-frame" title={experiment.title} src={entry.src}
    allow={experiment.engine_key === 'teachable' ? "camera 'self'; fullscreen 'self'" : "fullscreen 'self'"}
    sandbox={experiment.engine_key === 'teachable' ? 'allow-scripts allow-same-origin allow-downloads' : 'allow-scripts allow-same-origin'} allowFullScreen />;
}
