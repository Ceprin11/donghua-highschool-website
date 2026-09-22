import { base44 } from "@/api/base44Client";

// Centralized content access layer. Public pages call only these helpers,
// never the Base44 SDK directly, so the platform adapter can be swapped on migration.

const PUBLISHED = { status: "published" };

export async function getSiteSettings() {
  const list = await base44.entities.SiteSettings.filter(PUBLISHED, "-updated_date", 1);
  return list && list.length ? list[0] : null;
}

export async function getTeacherProfile() {
  const list = await base44.entities.TeacherProfile.filter(PUBLISHED, "-updated_date", 1);
  if (!list || !list.length) return null;
  const t = list[0];
  if (!t.visible) return null;
  return t;
}

export async function getCourseThemes() {
  return await base44.entities.CourseTheme.filter(PUBLISHED, "sort_order", 100);
}

export async function getExperiments() {
  return await base44.entities.Experiment.filter(PUBLISHED, "sort_order", 100);
}

export async function getExperimentBySlug(slug) {
  const list = await base44.entities.Experiment.filter({ slug, status: "published" }, "-updated_date", 1);
  return list && list.length ? list[0] : null;
}

export async function getPresetsForExperiment(slug) {
  return await base44.entities.ExperimentPreset.filter(
    { experiment_slug: slug, status: "published" }, "sort_order", 50
  );
}

export async function getQuizForExperiment(slug) {
  return await base44.entities.QuizQuestion.filter(
    { experiment_slug: slug, status: "published" }, "sort_order", 50
  );
}

export async function getStudentWorks() {
  return await base44.entities.StudentWork.filter({ status: "published" }, "sort_order", 100);
}

export async function getWorkBySlug(slug) {
  const list = await base44.entities.StudentWork.filter({ slug, status: "published" }, "-updated_date", 1);
  return list && list.length ? list[0] : null;
}

export async function getTeachingActivities() {
  return await base44.entities.TeachingActivity.filter({ status: "published" }, "sort_order", 50);
}

export async function getMediaUrl(assetId, fallbackUrl) {
  if (!assetId) return fallbackUrl || "";
  try {
    const list = await base44.entities.MediaAsset.filter({ _id: assetId }, "-updated_date", 1);
    return list && list.length ? list[0].file_url : fallbackUrl || "";
  } catch {
    return fallbackUrl || "";
  }
}

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
};