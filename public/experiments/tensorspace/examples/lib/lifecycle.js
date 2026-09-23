// Course integration: release the isolated visualization when its document closes.
function disposeTensorSpace(model) {
  const view = model.modelRenderer;
  if (!view) return;
  view.animate = function () {};
  view.cameraControls.dispose();
  view.scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    materials.forEach(material => { if (material.map) material.map.dispose(); material.dispose(); });
  });
  model.clear();
  if (model.resource) model.resource.dispose();
  view.renderer.dispose(); view.renderer.forceContextLoss();
}
