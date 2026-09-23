import { request, setCsrfToken } from "./apiClient";

let session = null;

export async function getSession() {
  const result = await request("/api/auth/session");
  session = result || { authenticated: false };
  setCsrfToken(session.csrfToken || "");
  return session;
}

export async function login(username, password) {
  if (!session?.csrfToken) await getSession();
  const result = await request("/api/auth/login", { method: "POST", body: { username, password } });
  session = { ...(session || {}), ...(result || {}), authenticated: true };
  setCsrfToken(session.csrfToken || "");
  return session;
}

export async function logout() {
  const result = await request("/api/auth/logout", { method: "POST" });
  session = { authenticated: false };
  setCsrfToken("");
  return result;
}

export async function changePassword(currentPassword, newPassword) {
  return request("/api/auth/password", { method: "POST", body: { currentPassword, newPassword } });
}

export function clearSession() {
  session = null;
  setCsrfToken("");
}

export const authService = { getSession, login, logout, changePassword, clearSession };
