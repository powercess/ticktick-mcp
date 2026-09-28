import { http, currentUser, type RequestOptions } from "./client.js";

/** Project id of the signed-in user's inbox: `inbox<userId>`. */
export async function inboxId(options: RequestOptions = {}): Promise<string> {
  const user = await currentUser(options);
  return user.inboxId || `inbox${user.userId}`;
}

// --- sync ------------------------------------------------------------------

export interface SyncCheckResult {
  checkPoint: number;
  syncTaskBean?: {
    update?: unknown[];
    add?: unknown[];
    delete?: { taskId: string; projectId: string }[];
    empty?: boolean;
  };
  projectProfiles?: unknown[];
  tags?: unknown[];
}

/**
 * Offline-first delta pull. `checkPoint=0` returns the full snapshot; pass the
 * `checkPoint` from a previous response for an incremental pull.
 */
export function syncCheck(checkPoint: number | string = 0, options: RequestOptions = {}) {
  return http.get<SyncCheckResult>(`/api/v3/batch/check/${checkPoint}`, options);
}

// --- projects --------------------------------------------------------------

export function listProjects(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/projects", options);
}

/**
 * There is no `GET /api/v2/project/{id}` on the private API (it answers 405), so
 * a single project is read out of the full list.
 */
export async function getProject(projectId: string, options: RequestOptions = {}) {
  const projects = await http.get<Array<{ id: string }>>("/api/v2/projects", options);
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`no project with id ${projectId}`);
  return project;
}

export function createProject(
  body: { name: string; color?: string; viewMode?: string; kind?: string },
  options: RequestOptions = {},
) {
  return http.post<unknown>("/api/v2/project", body, options);
}

/**
 * Update requires the *full* project object — a partial body is rejected with
 * `no_project_permission` — so the current project is fetched and merged first.
 */
export async function updateProject(
  projectId: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
) {
  const current = (await getProject(projectId, options)) as Record<string, unknown>;
  return http.put<unknown>(`/api/v2/project/${projectId}`, { ...current, ...body }, options);
}

export function deleteProject(projectId: string, options: RequestOptions = {}) {
  return http.delete<unknown>(`/api/v2/project/${projectId}`, undefined, options);
}

// --- tasks -----------------------------------------------------------------

export function listProjectTasks(projectId: string, options: RequestOptions = {}) {
  return http.get<unknown[]>(`/api/v2/project/${projectId}/tasks`, options);
}

export function getTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  return http.get<unknown>(`/api/v2/task/${taskId}`, {
    ...options,
    query: { projectId },
  });
}

export interface TaskInput {
  title?: string;
  projectId?: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  sortOrder?: number;
  parentId?: string;
  tags?: string[];
  items?: unknown[];
}

export function createTask(body: TaskInput & { title: string; projectId: string }, options: RequestOptions = {}) {
  return http.post<unknown>("/api/v2/task", body, options);
}

/** Update is a POST to `/task/{id}` with `{ id, projectId }` plus changed fields. */
export function updateTask(
  taskId: string,
  projectId: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
) {
  return http.post<unknown>(`/api/v2/task/${taskId}`, { id: taskId, projectId, ...body }, options);
}

export function completeTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  return updateTask(taskId, projectId, { status: 2 }, options);
}

export function uncompleteTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  return updateTask(taskId, projectId, { status: 0 }, options);
}

/** Move a task to another project (sets `projectId` on the task). */
export function moveTask(
  taskId: string,
  fromProjectId: string,
  toProjectId: string,
  options: RequestOptions = {},
) {
  return http.post<unknown>(`/api/v2/task/${taskId}`, {
    id: taskId,
    projectId: toProjectId,
    fromProjectId,
  }, options);
}

/** Soft-delete: moves the task to the trash. */
export function deleteTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  return http.delete<unknown>("/api/v2/task", [{ taskId, projectId }], options);
}

/** Hard-delete: permanently removes a task (must be trashed first). */
export function deleteTaskForever(taskId: string, projectId: string, options: RequestOptions = {}) {
  return http.delete<unknown>(
    "/api/v2/task",
    [{ taskId, projectId }],
    { ...options, query: { deleteforever: true } },
  );
}

export function listCompletedTasks(
  args: { projectId?: string; from?: string; to?: string; limit?: number; allProjects?: boolean },
  options: RequestOptions = {},
) {
  const base = args.allProjects
    ? "/api/v2/project/all/completedInAll/"
    : `/api/v2/project/${args.projectId ?? ""}/completed/`;
  return http.get<unknown[]>(base, {
    ...options,
    query: { from: args.from, to: args.to, limit: args.limit },
  });
}

export function listTrash(
  args: { limit?: number; type?: number } = {},
  options: RequestOptions = {},
) {
  return http.get<unknown>("/api/v2/project/all/trash/page", {
    ...options,
    query: { limit: args.limit ?? 50, type: args.type ?? 1 },
  });
}

export function restoreFromTrash(body: unknown, options: RequestOptions = {}) {
  return http.post<unknown>("/api/v2/trash/restore", body, options);
}

export function cleanTrash(options: RequestOptions = {}) {
  return http.delete<unknown>("/api/v2/trash/cleanUp", undefined, options);
}

/** Batch write: add/update/delete many tasks in one call. Gated on some accounts (403). */
export function batchTasks(
  body: { add?: unknown[]; update?: unknown[]; delete?: unknown[] },
  options: RequestOptions = {},
) {
  return http.post<unknown>("/api/v2/batch/task", body, options);
}

// --- tags ------------------------------------------------------------------

export function listTags(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/tags", options);
}

export function renameTag(name: string, newName: string, options: RequestOptions = {}) {
  return http.put<unknown>("/api/v2/tag/rename", { name, newName }, options);
}

export function mergeTag(name: string, toName: string, options: RequestOptions = {}) {
  return http.put<unknown>("/api/v2/tag/merge", { name, toName }, options);
}

export function deleteTag(name: string, options: RequestOptions = {}) {
  return http.delete<unknown>("/api/v2/tag/delete", { name }, options);
}

// --- columns ---------------------------------------------------------------

export function listColumns(from = 0, options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/column", { ...options, query: { from } });
}

export function listProjectColumns(projectId: string, options: RequestOptions = {}) {
  return http.get<unknown>(`/api/v2/column/project/${projectId}`, options);
}

export function createColumn(body: Record<string, unknown>, options: RequestOptions = {}) {
  return http.post<unknown>("/api/v2/column", body, options);
}

// --- habits ----------------------------------------------------------------

export function listHabits(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/habits", options);
}

export function listHabitSections(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/habitSections", options);
}

export function queryHabitCheckins(body: unknown, options: RequestOptions = {}) {
  return http.post<unknown>("/api/v2/habitCheckins/query", body, options);
}

// --- calendar --------------------------------------------------------------

export function listCalendarAccounts(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/calendar/third/accounts", options);
}

export function listCalendarSubscriptions(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/calendar/subscription", options);
}

export function listCalendarBoundEvents(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/calendar/bind/events/all", options);
}

export function listArchivedEvents(options: RequestOptions = {}) {
  return http.get<unknown[]>("/api/v2/calendar/archivedEvent", options);
}

// --- misc reads ------------------------------------------------------------

export function searchAll(query: string, options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/search/all", { ...options, query: { query } });
}

export function getUserProfile(options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/user/profile", options);
}

export function getPreferencesExt(options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/user/preferences/ext", options);
}

export function listTemplates(options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/templates", options);
}

export function listCountdowns(options: RequestOptions = {}) {
  return http.get<unknown>("/api/v2/countdown/list", options);
}
