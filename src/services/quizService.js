import { createAdminContent, deleteAdminContent, listAdminContent, publishAdminContent, unpublishAdminContent, updateAdminContent } from "./adminService";

const KIND = "quizzes";
export const listQuizzesAdmin = () => listAdminContent(KIND);
export const createQuiz = (payload) => createAdminContent(KIND, payload);
export const updateQuiz = (id, payload) => updateAdminContent(KIND, id, payload);
export const publishQuiz = (id) => publishAdminContent(KIND, id);
export const unpublishQuiz = (id) => unpublishAdminContent(KIND, id);
export const deleteQuiz = (id) => deleteAdminContent(KIND, id);
