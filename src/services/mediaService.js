import { getCsrfToken, mediaUrl, request, unwrapList } from "./apiClient";

export async function listMedia() {
  const data = await request("/api/admin/media");
  return unwrapList(data);
}

export function uploadMedia(file, source = "", onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    const token = getCsrfToken();
    if (token) xhr.setRequestHeader("X-CSRF-Token", token);
    const form = new FormData();
    form.append("file", file);
    if (source) form.append("source", source);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("上传失败，请检查网络连接。"));
    xhr.onload = () => {
      let data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* server returned text */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.message || `上传失败（${xhr.status}）`));
    };
    xhr.send(form);
  });
}

export const deleteMedia = (id) => request(`/api/admin/media/${encodeURIComponent(id)}`, { method: "DELETE" });
export const updateMediaSource = (id, source) => request(`/api/admin/media/${encodeURIComponent(id)}`, { method: "PUT", body: { source } });
export { mediaUrl };
