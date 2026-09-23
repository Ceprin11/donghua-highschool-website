const JSON_HEADERS = { Accept: "application/json" };

let csrfToken = "";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function setCsrfToken(token) {
  csrfToken = token || "";
}

export function getCsrfToken() {
  return csrfToken;
}

function isMutation(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase());
}

async function readBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return await response.text();
}

export async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  Object.entries(JSON_HEADERS).forEach(([key, value]) => {
    if (!headers.has(key)) headers.set(key, value);
  });
  let body = options.body;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== "string") {
    body = JSON.stringify(body);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (isMutation(method) && csrfToken && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrfToken);

  let response;
  try {
    response = await fetch(path, { ...options, method, headers, body, credentials: "same-origin" });
  } catch (error) {
    throw new ApiError("无法连接到本地服务，请确认后端已启动。", 0, { cause: error });
  }
  const data = await readBody(response);
  if (!response.ok) {
    const message = data && typeof data === "object" && (data.message || data.error)
      ? data.message || data.error
      : `请求失败（${response.status}）`;
    throw new ApiError(message, response.status, data);
  }
  return data;
}

export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  throw new ApiError("服务返回的内容格式无效。", 502, data);
}

export function unwrapPayload(data) {
  return data || null;
}

export function mediaUrl(id, fallback = "") {
  if (!id) return typeof fallback === "string" && fallback.startsWith("/media/") ? fallback : "";
  if (String(id).startsWith("/")) return id;
  return `/media/${encodeURIComponent(id)}`;
}
