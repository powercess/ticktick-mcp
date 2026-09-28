import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as api from "../api.js";
import { guard } from "./helpers.js";

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "get_current_user",
    { description: "Gets the signed-in user's id, inbox id, plan and registration info.", inputSchema: {} },
    () => guard(() => api.getUserProfile()),
  );

  server.registerTool(
    "sync_check",
    {
      description:
        "Offline-first delta pull of the whole account: tasks, projects, tags and columns. " +
        "Pass checkPoint=0 for a full snapshot, then reuse the returned checkPoint for incremental pulls.",
      inputSchema: {
        checkPoint: z.number().optional().describe("Last checkPoint from a previous call (default 0 = full snapshot)"),
      },
    },
    ({ checkPoint }) => guard(() => api.syncCheck(checkPoint ?? 0)),
  );

  server.registerTool(
    "get_preferences",
    { description: "Gets user preferences (matrix rules, quick-add, etc.).", inputSchema: {} },
    () => guard(() => api.getPreferencesExt()),
  );

  server.registerTool(
    "list_templates",
    { description: "Lists task templates.", inputSchema: {} },
    () => guard(() => api.listTemplates()),
  );

  server.registerTool(
    "list_countdowns",
    { description: "Lists countdowns (倒数日).", inputSchema: {} },
    () => guard(() => api.listCountdowns()),
  );

  server.registerTool(
    "list_habits",
    { description: "Lists habits.", inputSchema: {} },
    () => guard(() => api.listHabits()),
  );

  server.registerTool(
    "list_habit_sections",
    { description: "Lists habit sections (groups).", inputSchema: {} },
    () => guard(() => api.listHabitSections()),
  );

  server.registerTool(
    "query_habit_checkins",
    {
      description: "Queries habit check-in records over a date range.",
      inputSchema: {
        habitIds: z.array(z.string()).describe("Habit ids"),
        from: z.string().describe("Start date, e.g. \"2026-01-01\""),
        to: z.string().describe("End date, e.g. \"2026-12-31\""),
      },
    },
    (body) => guard(() => api.queryHabitCheckins(body)),
  );

  server.registerTool(
    "list_calendar_accounts",
    { description: "Lists connected third-party calendar accounts.", inputSchema: {} },
    () => guard(() => api.listCalendarAccounts()),
  );

  server.registerTool(
    "list_calendar_subscriptions",
    { description: "Lists calendar subscriptions.", inputSchema: {} },
    () => guard(() => api.listCalendarSubscriptions()),
  );

  server.registerTool(
    "list_calendar_events",
    { description: "Lists events bound from connected calendars.", inputSchema: {} },
    () => guard(() => api.listCalendarBoundEvents()),
  );
}
