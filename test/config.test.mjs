import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { credentialsPath, requireAuth, resolveAuth, writeCredentialsFile } from "../dist/config.js";
import { resolveMode } from "../dist/config.js";

const HOME = mkdtempSync(join(tmpdir(), "ttmcp-cfg-"));
process.env.TICKTICK_MCP_HOME = HOME;
for (const key of [
  "TICKTICK_COOKIE",
  "TICKTICK_TOKEN",
  "TICKTICK_CSRF_TOKEN",
  "TICKTICK_USER_ID",
  "TICKTICK_API_TOKEN",
  "TICKTICK_MODE",
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
  assert.equal(auth.mode, "web");
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

test("a tp_ token resolves to openapi mode", () => {
  // Clear the credentials file left by a prior test so shape detection
  // only sees the environment.
  rmSync(credentialsPath(), { force: true });
  process.env.TICKTICK_API_TOKEN = "tp_abc123";
  const auth = resolveAuth();
  assert.equal(auth.mode, "openapi");
  assert.equal(auth.apiToken, "tp_abc123");
  delete process.env.TICKTICK_API_TOKEN;
});

test("an explicit TICKTICK_MODE overrides shape detection", () => {
  process.env.TICKTICK_COOKIE = "t=session";
  process.env.TICKTICK_API_TOKEN = "tp_token";
  process.env.TICKTICK_MODE = "openapi";
  assert.equal(resolveAuth().mode, "openapi");
  process.env.TICKTICK_MODE = "web";
  assert.equal(resolveAuth().mode, "web");
  delete process.env.TICKTICK_MODE;
  delete process.env.TICKTICK_API_TOKEN;
  delete process.env.TICKTICK_COOKIE;
});

test("resolveMode auto-detects from credential shape", () => {
  assert.equal(resolveMode({ cookie: "t=x" }), "web");
  assert.equal(resolveMode({ apiToken: "tp_x" }), "openapi");
  assert.equal(resolveMode({ cookie: "t=x", apiToken: "tp_x" }), "web");
  assert.equal(resolveMode({ mode: "openapi", cookie: "t=x" }), "openapi");
});
