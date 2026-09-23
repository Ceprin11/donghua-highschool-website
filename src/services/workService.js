import { createAdminContent, deleteAdminContent, listAdminContent, publishAdminContent, unpublishAdminContent, updateAdminContent } from "./adminService";

const KIND = "works";
export const listWorksAdmin = () => listAdminContent(KIND);
export const createWork = (payload) => createAdminContent(KIND, payload);
export const updateWork = (id, payload) => updateAdminContent(KIND, id, payload);
export const publishWork = (id) => publishAdminContent(KIND, id);
export const unpublishWork = (id) => unpublishAdminContent(KIND, id);
export const deleteWork = (id) => deleteAdminContent(KIND, id);
