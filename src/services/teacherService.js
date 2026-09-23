import { adminPayload, getAdminContent, listAdminContent, updateAdminContent, publishAdminContent, unpublishAdminContent } from "./adminService";

const KIND = "teacher";
const ID = "teacher";

export async function getTeacherDraft() {
  const envelope = await getAdminContent(KIND, ID);
  return { envelope, payload: adminPayload(envelope) };
}

export async function listTeacherDrafts() {
  return listAdminContent(KIND);
}

export async function saveTeacher(payload) {
  return updateAdminContent(KIND, ID, payload);
}

export const publishTeacher = () => publishAdminContent(KIND, ID);
export const unpublishTeacher = () => unpublishAdminContent(KIND, ID);
