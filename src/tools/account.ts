import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as api from "../api.js";
import { guard } from "./helpers.js";

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "get_current_user",
    {
      description:
        "Gets the signed-in user's profile. In web mode returns id, inbox id, plan and registration info; " +
        "in API-token mode returns the account time zone preference.",
      inputSchema: {},
    },
    () => guard(() => api.getUserProfile()),
  );

  server.registerTool(
    "sync_check",
    {
      description:
        "Offline-first delta pull of the whole account (web mode only): tasks, projects, tags and columns. " +
        "Pass checkPoint=0 for a full snapshot, then reuse the returned checkPoint for incremental pulls.",
      inputSchema: {
        checkPoint: z.number().optional().describe("Last checkPoint from a previous call (default 0 = full snapshot)"),
      },
    },
    ({ checkPoint }) => guard(() => api.syncCheck(checkPoint ?? 0)),
  );

  server.registerTool(
    "get_preferences",
    { description: "Gets user preferences (matrix rules, quick-add, etc.). Web mode only.", inputSchema: {} },
    () => guard(() => api.getPreferencesExt()),
  );

  server.registerTool(
    "list_templates",
    { description: "Lists task templates. Web mode only.", inputSchema: {} },
    () => guard(() => api.listTemplates()),
  );

  server.registerTool(
    "list_countdowns",
    { description: "Lists countdowns. Works in both modes.", inputSchema: {} },
    () => guard(() => api.listCountdowns()),
  );

  server.registerTool(
    "list_habits",
    { description: "Lists habits. Works in both modes.", inputSchema: {} },
    () => guard(() => api.listHabits()),
  );

  server.registerTool(
    "list_habit_sections",
    { description: "Lists habit sections (groups). Works in both modes.", inputSchema: {} },
    () => guard(() => api.listHabitSections()),
  );

  server.registerTool(
    "query_habit_checkins",
    {
      description: "Queries habit check-in records. Web mode takes { habitIds, from, to }; API-token mode takes no args.",
      inputSchema: {
        habitIds: z.array(z.string()).optional().describe("Habit ids (web mode)"),
        from: z.string().optional().describe("Start date (web mode)"),
        to: z.string().optional().describe("End date (web mode)"),
      },
    },
    (body) => guard(() => api.queryHabitCheckins(body)),
  );

  server.registerTool(
    "list_calendar_accounts",
    { description: "Lists connected third-party calendar accounts. Web mode only.", inputSchema: {} },
    () => guard(() => api.listCalendarAccounts()),
  );

  server.registerTool(
    "list_calendar_subscriptions",
    { description: "Lists calendar subscriptions. Web mode only.", inputSchema: {} },
    () => guard(() => api.listCalendarSubscriptions()),
  );

  server.registerTool(
    "list_calendar_events",
    { description: "Lists events bound from connected calendars. Web mode only.", inputSchema: {} },
    () => guard(() => api.listCalendarBoundEvents()),
  );

  server.registerTool(
    "list_project_groups",
    { description: "Lists project groups. API-token mode only.", inputSchema: {} },
    () => guard(() => api.listProjectGroups()),
  );

  server.registerTool(
    "list_focus",
    { description: "Lists focus (pomodoro) records. API-token mode only.", inputSchema: {} },
    () => guard(() => api.listFocus()),
  );

  server.registerTool(
    "create_focus",
    {
      description: "Creates a focus (pomodoro) record. API-token mode only.",
      inputSchema: { body: z.record(z.unknown()).describe("Focus record fields") },
    },
    (args) => guard(() => api.createFocus(args.body)),
  );
}
