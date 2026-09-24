import { ApiError, getCsrfToken } from './apiClient';

export function uploadLearningFile(file, { inline = false, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/learning/files${inline ? '?inline=1' : ''}`);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-CSRF-Token', getCsrfToken());
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new ApiError(xhr.response?.message || `上传失败（${xhr.status}），请重试。`, xhr.status, xhr.response));
    };
    xhr.onerror = () => reject(new ApiError('上传中断，请检查网络后重试。', 0, null));
    xhr.onabort = () => reject(new ApiError('上传已取消。', 0, null));
    const body = new FormData(); body.append('file', file); xhr.send(body);
  });
}
