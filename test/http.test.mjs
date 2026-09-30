import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TICKTICK_MCP_HOME = mkdtempSync(join(tmpdir(), "ttmcp-http-"));
delete process.env.TICKTICK_COOKIE;
delete process.env.TICKTICK_TOKEN;
delete process.env.TICKTICK_API_TOKEN;

import { http } from "../dist/client.js";
import { TickTickError } from "../dist/errors.js";

test("a missing cookie fails before any network call", async () => {
  await assert.rejects(() => http.get("/api/v2/projects"), /No TickTick credentials/);
});

test("TickTickError carries status and code", () => {
  const error = new TickTickError("boom", 403, "access_forbidden", "{}");
  assert.equal(error.status, 403);
  assert.equal(error.code, "access_forbidden");
  assert.equal(error.name, "TickTickError");
});
