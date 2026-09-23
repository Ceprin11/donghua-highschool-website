/** Reviewed local entry points. Content editors change copy, never executable URLs. */
export const LAB_REGISTRY = Object.freeze({
  'neural-network': { engine: 'neural', route: '/labs/neural-network', kind: 'experiment', parent: '', configurable: true },
  cv: { engine: 'cv', route: '/labs/cv', kind: 'group', parent: '', configurable: false },
  'cnn-explainer': { engine: 'cnn', route: '/labs/cv/cnn-explainer', kind: 'experiment', parent: 'cv', src: '/experiments/cnn-explainer/index.html', configurable: false },
  lenet: { engine: 'lenet', route: '/labs/cv/lenet', kind: 'experiment', parent: 'cv', src: '/experiments/tensorspace/examples/lenet/lenet.html', configurable: false },
  'teachable-machine': { engine: 'teachable', route: '/labs/cv/teachable-machine', kind: 'experiment', parent: 'cv', src: '/experiments/teachable/index.html', configurable: false },
  transformer: { engine: 'transformer', route: '/labs/transformer', kind: 'experiment', parent: '', src: '/experiments/transformer/', configurable: false },
  'reward-maze': { engine: 'maze', route: '/labs/reward-maze', kind: 'experiment', parent: '', configurable: true },
});
export const LEGACY_LAB_REDIRECTS = Object.freeze({ 'pixel-vision': '/labs/cv', 'temperature-sampling': '/labs/transformer', 'gesture-lab': '/labs/cv/teachable-machine', 'lenet-training': '/labs/cv/lenet' });
export const labRoute = slug => LAB_REGISTRY[slug]?.route || LEGACY_LAB_REDIRECTS[slug] || '/labs';
export const topLevelLab = lab => Boolean(LAB_REGISTRY[lab.slug] && !LAB_REGISTRY[lab.slug].parent);
