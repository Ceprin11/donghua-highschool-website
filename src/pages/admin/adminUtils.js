export function envelopePayload(record) {
  return record?.draft || record?.published || record?.payload || record?.data || record || {};
}

export function withEnvelope(record) {
  return { ...envelopePayload(record), id: record?.id || envelopePayload(record).id, status: record?.status || envelopePayload(record).status || "draft", draft: record?.draft, published: record?.published };
}

export function linesToArray(value) {
  return Array.isArray(value) ? value : String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

export function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : String(value || "");
}

export function contentError(error) {
  if (error?.status === 401 || error?.status === 403) return new Error("登录已过期，请重新登录后台。");
  return error;
}
