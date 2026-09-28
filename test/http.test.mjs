import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TICKTICK_MCP_HOME = mkdtempSync(join(tmpdir(), "ttmcp-http-"));

import { TickTickError } from "../dist/errors.js";

/**
 * The client reads its credentials at call time, so the module can be imported
 * once. Only the credential-independent paths are exercised here — a live
 * request needs a real session cookie and belongs to the smoke script.
 */
test("a missing cookie fails before any network call", async () => {
  const { http } = await import("../dist/client.js");
  await assert.rejects(() => http.get("/api/v2/projects"), /No TickTick credentials/);
});

test("TickTickError carries status and code", () => {
  const error = new TickTickError("boom", 403, "access_forbidden", "{}");
  assert.equal(error.status, 403);
  assert.equal(error.code, "access_forbidden");
  assert.equal(error.name, "TickTickError");
});
