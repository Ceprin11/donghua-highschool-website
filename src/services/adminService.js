import { request, unwrapList } from "./apiClient";

export async function listAdminContent(kind) {
  const data = await request(`/api/admin/content/${encodeURIComponent(kind)}`);
  return unwrapList(data);
}

export async function getAdminContent(kind, id) {
  const data = await request(`/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
  return data;
}

export async function createAdminContent(kind, payload) {
  return request(`/api/admin/content/${encodeURIComponent(kind)}`, { method: "POST", body: payload });
}

export async function updateAdminContent(kind, id, payload) {
  return request(`/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
}

export async function publishAdminContent(kind, id) {
  return request(`/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

export async function unpublishAdminContent(kind, id) {
  return request(`/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/unpublish`, { method: "POST" });
}

export async function deleteAdminContent(kind, id) {
  return request(`/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAdminOverview() {
  return request("/api/admin/overview");
}

export async function downloadAdminExport() {
  const response = await fetch("/api/admin/export", { credentials: "same-origin" });
  if (!response.ok) throw new Error(`导出失败（${response.status}）`);
  return response.blob();
}

export function adminPayload(envelope) {
  return envelope?.draft || envelope?.published || envelope || {};
}
