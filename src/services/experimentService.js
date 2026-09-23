import { createAdminContent, deleteAdminContent, listAdminContent, publishAdminContent, unpublishAdminContent, updateAdminContent } from "./adminService";

export const listExperimentsAdmin = () => listAdminContent("experiments");
export const createExperiment = (payload) => createAdminContent("experiments", payload);
export const updateExperiment = (id, payload) => updateAdminContent("experiments", id, payload);
export const publishExperiment = (id) => publishAdminContent("experiments", id);
export const unpublishExperiment = (id) => unpublishAdminContent("experiments", id);
export const deleteExperiment = (id) => deleteAdminContent("experiments", id);
export const listPresetsAdmin = () => listAdminContent("presets");
export const savePreset = (payload, id) => id ? updateAdminContent("presets", id, payload) : createAdminContent("presets", payload);
export const publishPreset = (id) => publishAdminContent("presets", id);
export const unpublishPreset = (id) => unpublishAdminContent("presets", id);
export const deletePreset = (id) => deleteAdminContent("presets", id);
