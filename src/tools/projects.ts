import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as api from "../api.js";
import { guard } from "./helpers.js";

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    { description: "Lists all projects (lists) for the signed-in user. Works in both cookie and API-token mode.", inputSchema: {} },
    () => guard(() => api.listProjects()),
  );

  server.registerTool(
    "get_project",
    {
      description: "Gets a single project by id.",
      inputSchema: { projectId: z.string().describe("Project id") },
    },
    ({ projectId }) => guard(() => api.getProject(projectId)),
  );

  server.registerTool(
    "get_project_with_data",
    {
      description: "Gets a project with its tasks and columns.",
      inputSchema: { projectId: z.string().describe("Project id") },
    },
    ({ projectId }) => guard(() => api.getProjectWithData(projectId)),
  );

  server.registerTool(
    "create_project",
    {
      description: "Creates a project (list).",
      inputSchema: {
        name: z.string().describe("Project name"),
        color: z.string().optional().describe('Hex color, e.g. "#4772FA"'),
        viewMode: z.enum(["list", "kanban", "timeline"]).optional().describe("View mode"),
        kind: z.enum(["TASK", "NOTE"]).optional().describe("Project kind"),
      },
    },
    (body) => guard(() => api.createProject(body)),
  );

  server.registerTool(
    "update_project",
    {
      description: "Updates a project's name, color, view mode or kind.",
      inputSchema: {
        projectId: z.string().describe("Project id"),
        name: z.string().optional().describe("Project name"),
        color: z.string().optional().describe("Hex color"),
        sortOrder: z.number().optional().describe("Sort order"),
        viewMode: z.enum(["list", "kanban", "timeline"]).optional().describe("View mode"),
        kind: z.enum(["TASK", "NOTE"]).optional().describe("Project kind"),
        closed: z.boolean().optional().describe("Close the project"),
      },
    },
    ({ projectId, ...fields }) => guard(() => api.updateProject(projectId, fields)),
  );

  server.registerTool(
    "delete_project",
    {
      description: "Deletes a project. This is destructive and not reversible.",
      inputSchema: { projectId: z.string().describe("Project id") },
    },
    ({ projectId }) => guard(() => api.deleteProject(projectId)),
  );

  server.registerTool(
    "list_tags",
    { description: "Lists all tags. Works in both modes.", inputSchema: {} },
    () => guard(() => api.listTags()),
  );

  server.registerTool(
    "rename_tag",
    {
      description: "Renames a tag. Web mode only.",
      inputSchema: {
        name: z.string().describe("Current tag name"),
        newName: z.string().describe("New tag name"),
      },
    },
    ({ name, newName }) => guard(() => api.renameTag(name, newName)),
  );

  server.registerTool(
    "merge_tags",
    {
      description: "Merges one tag into another. Web mode only.",
      inputSchema: {
        name: z.string().describe("Tag to merge from"),
        toName: z.string().describe("Tag to merge into"),
      },
    },
    ({ name, toName }) => guard(() => api.mergeTag(name, toName)),
  );

  server.registerTool(
    "delete_tag",
    {
      description: "Deletes a tag. Web mode only.",
      inputSchema: { name: z.string().describe("Tag name") },
    },
    ({ name }) => guard(() => api.deleteTag(name)),
  );

  server.registerTool(
    "list_columns",
    {
      description: "Lists kanban columns for a project (or all columns in web mode).",
      inputSchema: { projectId: z.string().optional().describe("Project id; omit for all columns (web mode)") },
    },
    ({ projectId }) => guard(() => api.listColumns(projectId)),
  );
}
