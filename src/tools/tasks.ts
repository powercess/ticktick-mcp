import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as api from "../api.js";
import { guard } from "./helpers.js";

const taskFields = {
  content: z.string().optional().describe("Task content (rich text)"),
  desc: z.string().optional().describe("Checklist description"),
  isAllDay: z.boolean().optional().describe("All-day task"),
  startDate: z.string().optional().describe(`Start date, "yyyy-MM-dd'T'HH:mm:ssZ" e.g. "2026-01-31T03:00:00+0000"`),
  dueDate: z.string().optional().describe(`Due date, "yyyy-MM-dd'T'HH:mm:ssZ"`),
  timeZone: z.string().optional().describe('IANA time zone, e.g. "Asia/Shanghai"'),
  reminders: z.array(z.string()).optional().describe('Reminder triggers, e.g. ["TRIGGER:P0DT9H0M0S"]'),
  repeatFlag: z.string().optional().describe('RFC 5545 recurrence, e.g. "RRULE:FREQ=DAILY;INTERVAL=1"'),
  priority: z.number().int().optional().describe("Priority: 0 none, 1 low, 3 medium, 5 high"),
  sortOrder: z.number().optional().describe("Sort order within the project"),
  parentId: z.string().optional().describe("Parent task id, to nest as a subtask"),
  tags: z.array(z.string()).optional().describe("Tag names"),
  items: z.array(z.record(z.unknown())).optional().describe("Checklist items (subtasks)"),
};

export function registerTaskTools(server: McpServer) {
  server.registerTool(
    "list_tasks",
    {
      description:
        "Lists the tasks in a project. Use `projectId: \"inbox\"` to target the signed-in user's inbox.",
      inputSchema: {
        projectId: z.string().describe('Project id, or "inbox"'),
        includeCompleted: z.boolean().optional().describe("Include completed tasks (default false)"),
      },
    },
    ({ projectId, includeCompleted }) =>
      guard(async () => {
        const pid = projectId === "inbox" ? await api.inboxId() : projectId;
        const tasks = (await api.listProjectTasks(pid)) as Array<{ status?: number }>;
        return includeCompleted ? tasks : tasks.filter((t) => t.status !== 2);
      }),
  );

  server.registerTool(
    "get_task",
    {
      description: "Gets a single task by id.",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
      },
    },
    ({ taskId, projectId }) =>
      guard(async () => api.getTask(taskId, projectId === "inbox" ? await api.inboxId() : projectId)),
  );

  server.registerTool(
    "create_task",
    {
      description: "Creates a task in a project.",
      inputSchema: {
        title: z.string().describe("Task title"),
        projectId: z.string().describe('Project id, or "inbox"'),
        ...taskFields,
      },
    },
    ({ projectId, ...rest }) =>
      guard(async () =>
        api.createTask({ projectId: projectId === "inbox" ? await api.inboxId() : projectId, ...rest } as never),
      ),
  );

  server.registerTool(
    "update_task",
    {
      description: "Updates fields on an existing task. Only the supplied fields change.",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
        title: z.string().optional().describe("Task title"),
        ...taskFields,
      },
    },
    ({ taskId, projectId, ...fields }) =>
      guard(async () =>
        api.updateTask(taskId, projectId === "inbox" ? await api.inboxId() : projectId, fields),
      ),
  );

  server.registerTool(
    "complete_task",
    {
      description: "Marks a task as completed (status=2).",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
      },
    },
    ({ taskId, projectId }) =>
      guard(async () => api.completeTask(taskId, projectId === "inbox" ? await api.inboxId() : projectId)),
  );

  server.registerTool(
    "uncomplete_task",
    {
      description: "Reopens a completed task (status=0).",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
      },
    },
    ({ taskId, projectId }) =>
      guard(async () => api.uncompleteTask(taskId, projectId === "inbox" ? await api.inboxId() : projectId)),
  );

  server.registerTool(
    "delete_task",
    {
      description:
        "Deletes a task. By default it moves to the trash; set `forever: true` to permanently delete it (must already be trashed).",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
        forever: z.boolean().optional().describe("Permanently delete instead of moving to trash"),
      },
    },
    ({ taskId, projectId, forever }) =>
      guard(async () => {
        const pid = projectId === "inbox" ? await api.inboxId() : projectId;
        return forever ? api.deleteTaskForever(taskId, pid) : api.deleteTask(taskId, pid);
      }),
  );

  server.registerTool(
    "move_task",
    {
      description: "Moves a task from one project to another.",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        fromProjectId: z.string().describe("Current project id"),
        toProjectId: z.string().describe('Destination project id, or "inbox"'),
      },
    },
    ({ taskId, fromProjectId, toProjectId }) =>
      guard(async () =>
        api.moveTask(taskId, fromProjectId, toProjectId === "inbox" ? await api.inboxId() : toProjectId),
      ),
  );

  server.registerTool(
    "list_completed_tasks",
    {
      description: "Lists completed tasks within a date range, for one project or across all projects.",
      inputSchema: {
        projectId: z.string().optional().describe('Project id, or "inbox" (ignored when allProjects=true)'),
        allProjects: z.boolean().optional().describe("Across all projects (default false)"),
        from: z.string().optional().describe('Start, "yyyy-MM-dd HH:mm:ss" (e.g. "2026-01-01 00:00:00")'),
        to: z.string().optional().describe('End, "yyyy-MM-dd HH:mm:ss"'),
        limit: z.number().int().optional().describe("Max results (default 100)"),
      },
    },
    ({ projectId, allProjects, ...range }) =>
      guard(async () =>
        api.listCompletedTasks({
          ...range,
          allProjects,
          projectId: projectId ? (projectId === "inbox" ? await api.inboxId() : projectId) : undefined,
        }),
      ),
  );

  server.registerTool(
    "list_trash",
    {
      description: "Lists trashed tasks.",
      inputSchema: {
        limit: z.number().int().optional().describe("Max results (default 50)"),
        type: z.number().int().optional().describe("Trash item type (default 1 = task)"),
      },
    },
    (args) => guard(() => api.listTrash(args)),
  );

  server.registerTool(
    "restore_task",
    {
      description: "Restores a task from the trash.",
      inputSchema: {
        taskId: z.string().describe("Task id"),
        projectId: z.string().describe('Project id, or "inbox"'),
      },
    },
    ({ taskId, projectId }) =>
      guard(async () =>
        api.restoreFromTrash([
          { taskId, projectId: projectId === "inbox" ? await api.inboxId() : projectId },
        ]),
      ),
  );

  server.registerTool(
    "batch_tasks",
    {
      description:
        "Creates, updates and/or deletes many tasks in one request. Note: some accounts are gated and receive 403 for batch writes.",
      inputSchema: {
        add: z.array(z.record(z.unknown())).optional().describe("Tasks to create"),
        update: z.array(z.record(z.unknown())).optional().describe("Tasks to update"),
        delete: z.array(z.record(z.unknown())).optional().describe("Tasks to delete, as { taskId, projectId }"),
      },
    },
    (body) => guard(() => api.batchTasks(body)),
  );

  server.registerTool(
    "search_tasks",
    {
      description: "Full-text search across tasks, comments and other content.",
      inputSchema: { query: z.string().describe("Search text") },
    },
    ({ query }) => guard(() => api.searchAll(query)),
  );
}
