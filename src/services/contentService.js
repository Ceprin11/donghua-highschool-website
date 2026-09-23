import { mediaUrl, request, unwrapList, unwrapPayload } from "./apiClient";

async function list(kind) {
  const data = await request(`/api/content/${encodeURIComponent(kind)}`);
  return unwrapList(data);
}

async function bySlug(kind, slug) {
  try {
    const data = await request(`/api/content/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`);
    return unwrapPayload(data);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export const getSiteSettings = () => bySlug("settings", "site");
export const getTeacherProfile = async () => {
  const teacher = await bySlug("teacher", "teacher");
  return teacher && teacher.visible === false ? null : teacher;
};
export const getCourseThemes = () => list("themes");
export const getExperiments = () => list("experiments");
export const getExperimentBySlug = (slug) => bySlug("experiments", slug);
export const getPresetsForExperiment = async (slug) => {
  const records = await list("presets");
  return records.filter((item) => item.experiment_slug === slug);
};
export const getQuizForExperiment = async (slug) => {
  const records = await list("quizzes");
  return records.filter((item) => item.experiment_slug === slug);
};
export const getStudentWorks = () => list("works");
export const getWorkBySlug = (slug) => bySlug("works", slug);
export const getTeachingActivities = () => list("activities");
export const getMediaUrl = (assetId, fallbackUrl = "") => mediaUrl(assetId, fallbackUrl);

export const contentService = {
  getSiteSettings,
  getTeacherProfile,
  getCourseThemes,
  getExperiments,
  getExperimentBySlug,
  getPresetsForExperiment,
  getQuizForExperiment,
  getStudentWorks,
  getWorkBySlug,
  getTeachingActivities,
  getMediaUrl,
};
/**
 * @typedef {Object} SiteSettings
 * @property {string} [site_name]
 * @property {string[]} [school_names]
 * @property {string} [hero_title]
 * @property {string} [hero_description]
 * @property {string} [hero_media_asset_id]
 * @property {string} [hero_media_url]
 * @property {string} [project_intro]
 * @property {string} [about_text]
 * @property {string[]} [teaching_features]
 * @property {string} [contact_email]
 * @property {string[]} [featured_experiment_slugs]
 * @property {string[]} [featured_work_slugs]
 * @property {{themes?: boolean, teacher?: boolean, experiments?: boolean, works?: boolean, activities?: boolean}} [section_visibility]
 */
