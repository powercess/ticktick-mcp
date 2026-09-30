import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TICKTICK_MCP_HOME = mkdtempSync(join(tmpdir(), "ttmcp-http-"));
delete process.env.TICKTICK_COOKIE;
delete process.env.TICKTICK_TOKEN;
delete process.env.TICKTICK_API_TOKEN;

import { http } from "../src/client.ts";
import { TickTickError } from "../src/errors.ts";

test("a missing cookie fails before any network call", async () => {
  await expect(http.get("/api/v2/projects")).rejects.toThrow(/No TickTick credentials/);
});

test("TickTickError carries status and code", () => {
  const error = new TickTickError("boom", 403, "access_forbidden", "{}");
  expect(error.status).toBe(403);
  expect(error.code).toBe("access_forbidden");
  expect(error.name).toBe("TickTickError");
});
