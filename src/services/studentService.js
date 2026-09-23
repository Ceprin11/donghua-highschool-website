import { request } from './apiClient';

let token = '';
export async function studentRequest(path, options = {}) {
  const result = await request(`/api/student/${path}`, { ...options, headers: { ...options.headers, 'X-CSRF-Token': token } });
  if (result?.csrfToken) token = result.csrfToken;
  return result;
}
export const studentSession = () => studentRequest('session');
export const studentFileUrl = (id, preview = false) => `/api/student/files/${id}${preview ? '?view=1' : ''}`;
