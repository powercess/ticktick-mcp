import { http, currentUser, type RequestOptions } from "./client.js";
import { resolveAuth, type AuthMode } from "./config.js";

/** Resolves the effective mode: explicit per-call override, then the credential. */
function activeMode(options: RequestOptions): AuthMode {
  return options.mode ?? resolveAuth(options.auth).mode;
}

/**
 * Throws when an operation has no Open API equivalent, so callers get a clear
 * message instead of a cryptic 404 from an endpoint the token cannot reach.
 */
function requireWeb(tool: string, options: RequestOptions): void {
  if (activeMode(options) === "openapi") {
    throw new Error(
      `\`${tool}\` uses the private web API and is not available in API-token mode. ` +
        "Set TICKTICK_COOKIE to a web session to enable it.",
    );
  }
}

/** Picks the path for the active auth mode. */
function pickPath(
  options: RequestOptions,
  web: string,
  openapi: string,
): string {
  return activeMode(options) === "openapi" ? openapi : web;
}

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
 *
 * Web mode only — the Open API has no equivalent.
 */
export function syncCheck(checkPoint: number | string = 0, options: RequestOptions = {}) {
  requireWeb("sync_check", options);
  return http.get<SyncCheckResult>(`/api/v3/batch/check/${checkPoint}`, options);
}

// --- projects --------------------------------------------------------------

export function listProjects(options: RequestOptions = {}) {
  return http.get<unknown[]>(
    pickPath(options, "/api/v2/projects", "/open/v1/project"),
    options,
  );
}

/**
 * Web mode has no `GET /api/v2/project/{id}` (it answers 405), so a single
 * project is read out of the full list. Open API mode has a direct GET.
 */
export async function getProject(projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.get<unknown>(`/open/v1/project/${projectId}`, options);
  }
  const projects = await http.get<Array<{ id: string }>>("/api/v2/projects", options);
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`no project with id ${projectId}`);
  return project;
}

export function getProjectWithData(projectId: string, options: RequestOptions = {}) {
  return http.get<unknown>(
    pickPath(options, `/api/v2/project/${projectId}/data`, `/open/v1/project/${projectId}/data`),
    options,
  );
}

export function createProject(
  body: { name: string; color?: string; viewMode?: string; kind?: string },
  options: RequestOptions = {},
) {
  return http.post<unknown>(
    pickPath(options, "/api/v2/project", "/open/v1/project"),
    body,
    options,
  );
}

/**
 * Web mode requires the *full* project object — a partial body is rejected with
 * `no_project_permission` — so the current project is fetched and merged first.
 * Open API mode accepts a partial body directly.
 */
export async function updateProject(
  projectId: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
) {
  if (activeMode(options) === "openapi") {
    return http.put<unknown>(`/open/v1/project/${projectId}`, body, options);
  }
  const current = (await getProject(projectId, options)) as Record<string, unknown>;
  return http.put<unknown>(`/api/v2/project/${projectId}`, { ...current, ...body }, options);
}

export function deleteProject(projectId: string, options: RequestOptions = {}) {
  return http.delete<unknown>(
    pickPath(options, `/api/v2/project/${projectId}`, `/open/v1/project/${projectId}`),
    undefined,
    options,
  );
}

/** Project members — Open API only. */
export function listProjectMembers(projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`list_project_members` is only available in API-token mode.");
  }
  return http.get<unknown>(`/open/v1/project/${projectId}/members`, options);
}

// --- tasks -----------------------------------------------------------------

export function listProjectTasks(projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    // Open API returns tasks inside the project-data envelope.
    return http.get<{ tasks?: unknown[] }>(`/open/v1/project/${projectId}/data`, options)
      .then((d: { tasks?: unknown[] }) => d.tasks ?? []);
  }
  return http.get<unknown[]>(`/api/v2/project/${projectId}/tasks`, options);
}

export function getTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  return http.get<unknown>(
    pickPath(
      options,
      `/api/v2/task/${taskId}`,
      `/open/v1/project/${projectId}/task/${taskId}`,
    ),
    { ...options, query: activeMode(options) === "openapi" ? undefined : { projectId } },
  );
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
  return http.post<unknown>(
    pickPath(options, "/api/v2/task", "/open/v1/task"),
    body,
    options,
  );
}

export function updateTask(
  taskId: string,
  projectId: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
) {
  if (activeMode(options) === "openapi") {
    return http.post<unknown>(`/open/v1/task/${taskId}`, { id: taskId, projectId, ...body }, options);
  }
  return http.post<unknown>(`/api/v2/task/${taskId}`, { id: taskId, projectId, ...body }, options);
}

export function completeTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.post<unknown>(`/open/v1/project/${projectId}/task/${taskId}/complete`, undefined, options);
  }
  return updateTask(taskId, projectId, { status: 2 }, options);
}

export function uncompleteTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.post<unknown>(`/open/v1/task/${taskId}`, { id: taskId, projectId, status: 0 }, options);
  }
  return updateTask(taskId, projectId, { status: 0 }, options);
}

export function moveTask(
  taskId: string,
  fromProjectId: string,
  toProjectId: string,
  options: RequestOptions = {},
) {
  if (activeMode(options) === "openapi") {
    return http.post<unknown>("/open/v1/task/move", { taskId, fromProjectId, toProjectId }, options);
  }
  return http.post<unknown>(`/api/v2/task/${taskId}`, {
    id: taskId,
    projectId: toProjectId,
    fromProjectId,
  }, options);
}

export function deleteTask(taskId: string, projectId: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.delete<unknown>(`/open/v1/project/${projectId}/task/${taskId}`, undefined, options);
  }
  return http.delete<unknown>("/api/v2/task", [{ taskId, projectId }], options);
}

export function deleteTaskForever(taskId: string, projectId: string, options: RequestOptions = {}) {
  requireWeb("delete_task {forever}", options);
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
  if (activeMode(options) === "openapi") {
    return http.post<unknown>("/open/v1/task/completed", {
      projectIds: args.projectId ? [args.projectId] : undefined,
      startDate: args.from,
      endDate: args.to,
    }, options);
  }
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
  requireWeb("list_trash", options);
  return http.get<unknown>("/api/v2/project/all/trash/page", {
    ...options,
    query: { limit: args.limit ?? 50, type: args.type ?? 1 },
  });
}

export function restoreFromTrash(body: unknown, options: RequestOptions = {}) {
  requireWeb("restore_task", options);
  return http.post<unknown>("/api/v2/trash/restore", body, options);
}

export function cleanTrash(options: RequestOptions = {}) {
  requireWeb("clean_trash", options);
  return http.delete<unknown>("/api/v2/trash/cleanUp", undefined, options);
}

export function batchTasks(
  body: { add?: unknown[]; update?: unknown[]; delete?: unknown[] },
  options: RequestOptions = {},
) {
  const path = pickPath(options, "/api/v2/batch/task", "/open/v1/task/batch");
  if (activeMode(options) === "openapi") {
    // The Open API batch endpoint has no `delete` — route deletes individually.
    const { delete: del, ...rest } = body;
    if (del?.length) {
      throw new Error("`batch_tasks` delete is not supported in API-token mode. Use delete_task per task.");
    }
    return http.post<unknown>(path, rest, options);
  }
  return http.post<unknown>(path, body, options);
}

// --- tags ------------------------------------------------------------------

export function listTags(options: RequestOptions = {}) {
  return http.get<unknown[]>(
    pickPath(options, "/api/v2/tags", "/open/v1/tag"),
    options,
  );
}

export function createTag(body: { name?: string; label?: string; sortOrder?: number }, options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`create_tag` is only available in API-token mode. Use the web app or tag/rename in web mode.");
  }
  return http.post<unknown>("/open/v1/tag", body, options);
}

export function renameTag(name: string, newName: string, options: RequestOptions = {}) {
  requireWeb("rename_tag", options);
  return http.put<unknown>("/api/v2/tag/rename", { name, newName }, options);
}

export function mergeTag(name: string, toName: string, options: RequestOptions = {}) {
  requireWeb("merge_tags", options);
  return http.put<unknown>("/api/v2/tag/merge", { name, toName }, options);
}

export function deleteTag(name: string, options: RequestOptions = {}) {
  requireWeb("delete_tag", options);
  return http.delete<unknown>("/api/v2/tag/delete", { name }, options);
}

// --- columns ---------------------------------------------------------------

export function listColumns(projectId: string | undefined, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    if (!projectId) {
      throw new Error("`list_columns` without a projectId is web-mode only. Pass a projectId.");
    }
    return http.get<unknown>(`/open/v1/project/${projectId}/column`, options);
  }
  return projectId
    ? http.get<unknown>(`/api/v2/column/project/${projectId}`, options)
    : http.get<unknown>("/api/v2/column", { ...options, query: { from: 0 } });
}

export function createColumn(projectId: string, body: { name: string; sortOrder?: number }, options: RequestOptions = {}) {
  return http.post<unknown>(
    pickPath(options, "/api/v2/column", `/open/v1/project/${projectId}/column`),
    body,
    options,
  );
}

export function updateColumn(
  projectId: string,
  columnId: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`update_column` is only available in API-token mode.");
  }
  return http.post<unknown>(`/open/v1/project/${projectId}/column/${columnId}`, body, options);
}

// --- habits ----------------------------------------------------------------

export function listHabits(options: RequestOptions = {}) {
  return http.get<unknown[]>(
    pickPath(options, "/api/v2/habits", "/open/v1/habit"),
    options,
  );
}

export function getHabit(habitId: string, options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`get_habit` is only available in API-token mode.");
  }
  return http.get<unknown>(`/open/v1/habit/${habitId}`, options);
}

export function listHabitSections(options: RequestOptions = {}) {
  return http.get<unknown[]>(
    pickPath(options, "/api/v2/habitSections", "/open/v1/habit/sections"),
    options,
  );
}

export function queryHabitCheckins(body: unknown, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.get<unknown>("/open/v1/habit/checkins", options);
  }
  return http.post<unknown>("/api/v2/habitCheckins/query", body, options);
}

// --- focus / pomodoro --------------------------------------------------------

export function listFocus(options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`list_focus` is only available in API-token mode.");
  }
  return http.get<unknown>("/open/v1/focus", options);
}

export function createFocus(body: Record<string, unknown>, options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`create_focus` is only available in API-token mode.");
  }
  return http.post<unknown>("/open/v1/focus", body, options);
}

// --- calendar / countdown ---------------------------------------------------

export function listCalendarAccounts(options: RequestOptions = {}) {
  requireWeb("list_calendar_accounts", options);
  return http.get<unknown[]>("/api/v2/calendar/third/accounts", options);
}

export function listCalendarSubscriptions(options: RequestOptions = {}) {
  requireWeb("list_calendar_subscriptions", options);
  return http.get<unknown[]>("/api/v2/calendar/subscription", options);
}

export function listCalendarBoundEvents(options: RequestOptions = {}) {
  requireWeb("list_calendar_events", options);
  return http.get<unknown[]>("/api/v2/calendar/bind/events/all", options);
}

export function listCountdowns(options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.get<unknown>("/open/v1/countdown", options);
  }
  return http.get<unknown>("/api/v2/countdown/list", options);
}

// --- misc reads ------------------------------------------------------------

export function searchAll(query: string, options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    return http.post<unknown>("/open/v1/task/search", { query }, options);
  }
  return http.get<unknown>("/api/v2/search/all", { ...options, query: { query } });
}

/**
 * `/user/profile` carries the display fields but **no** user id — that lives on
 * `/user/status`. Merge both so callers get one object with `userId`/`inboxId`.
 * Open API mode returns the preference (time zone) instead — the profile and
 * status endpoints are web-only.
 */
export async function getUserProfile(options: RequestOptions = {}) {
  if (activeMode(options) === "openapi") {
    const preference = await http.post<{ timeZone?: string }>("/open/v1/preference", undefined, options);
    return { ...preference, source: "openapi" };
  }
  const [profile, status] = await Promise.all([
    http.get<Record<string, unknown>>("/api/v2/user/profile", options),
    currentUser(options),
  ]);
  return { ...profile, userId: status.userId, inboxId: status.inboxId };
}

export function getPreferencesExt(options: RequestOptions = {}) {
  requireWeb("get_preferences", options);
  return http.get<unknown>("/api/v2/user/preferences/ext", options);
}

export function listTemplates(options: RequestOptions = {}) {
  requireWeb("list_templates", options);
  return http.get<unknown>("/api/v2/templates", options);
}

/** Project groups — Open API only. */
export function listProjectGroups(options: RequestOptions = {}) {
  if (activeMode(options) !== "openapi") {
    throw new Error("`list_project_groups` is only available in API-token mode.");
  }
  return http.get<unknown>("/open/v1/project/group", options);
}
