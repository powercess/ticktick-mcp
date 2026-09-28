import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { credentialsPath, requireAuth, resolveAuth, writeCredentialsFile } from "../dist/config.js";

/** Isolated home so tests never touch a real ~/.ticktick-mcp. */
const HOME = mkdtempSync(join(tmpdir(), "ttmcp-cfg-"));
process.env.TICKTICK_MCP_HOME = HOME;
for (const key of [
  "TICKTICK_COOKIE",
  "TICKTICK_TOKEN",
  "TICKTICK_CSRF_TOKEN",
  "TICKTICK_USER_ID",
  "TICKTICK_SITE",
]) {
  delete process.env[key];
}

test("credentialsPath honours TICKTICK_MCP_HOME", () => {
  assert.equal(credentialsPath(), join(HOME, "credentials.json"));
});

test("requireAuth explains how to supply credentials when none exist", () => {
  assert.equal(resolveAuth().cookie, "");
  assert.throws(() => requireAuth(), /No TickTick credentials/);
});

test("a raw cookie is parsed for csrf token and user id", () => {
  process.env.TICKTICK_COOKIE = "t=session; _csrf_token=csrf-value; ap_user_id=42";
  const auth = resolveAuth();
  assert.equal(auth.cookie, "t=session; _csrf_token=csrf-value; ap_user_id=42");
  assert.equal(auth.csrfToken, "csrf-value");
  assert.equal(auth.userId, "42");
  assert.equal(auth.site, "ticktick");
});

test("a cookie is assembled from separate token pieces", () => {
  delete process.env.TICKTICK_COOKIE;
  process.env.TICKTICK_TOKEN = "session";
  process.env.TICKTICK_CSRF_TOKEN = "csrf-value";
  process.env.TICKTICK_USER_ID = "42";
  const auth = resolveAuth();
  assert.equal(auth.cookie, "t=session; _csrf_token=csrf-value; ap_user_id=42");
  delete process.env.TICKTICK_TOKEN;
  delete process.env.TICKTICK_CSRF_TOKEN;
  delete process.env.TICKTICK_USER_ID;
});

test("an explicit override wins over the environment", () => {
  process.env.TICKTICK_COOKIE = "t=from-env";
  const auth = resolveAuth({ cookie: "t=from-arg", site: "dida365" });
  assert.equal(auth.cookie, "t=from-arg");
  assert.equal(auth.site, "dida365");
  delete process.env.TICKTICK_COOKIE;
});

test("credentials written to disk are read back when the environment is empty", () => {
  const path = writeCredentialsFile({ cookie: "t=stored; ap_user_id=7", site: "dida365" });
  assert.equal(path, join(HOME, "credentials.json"));
  const auth = resolveAuth();
  assert.equal(auth.cookie, "t=stored; ap_user_id=7");
  assert.equal(auth.userId, "7");
  assert.equal(auth.site, "dida365");
});
