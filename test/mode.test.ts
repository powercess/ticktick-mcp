import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveAuth } from "../src/config.ts";
import { syncCheck, listProjects } from "../src/api.ts";

// Isolated home + a clean env so each test controls its own credential shape.
const HOME = mkdtempSync(join(tmpdir(), "ttmcp-mode-"));
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

test("a tp_ token resolves to openapi mode", () => {
  process.env.TICKTICK_API_TOKEN = "tp_abc123";
  const auth = resolveAuth();
  expect(auth.mode).toBe("openapi");
  expect(auth.apiToken).toBe("tp_abc123");
  delete process.env.TICKTICK_API_TOKEN;
});

test("a cookie resolves to web mode", () => {
  process.env.TICKTICK_COOKIE = "t=session; _csrf_token=csrf; ap_user_id=1";
  const auth = resolveAuth();
  expect(auth.mode).toBe("web");
  delete process.env.TICKTICK_COOKIE;
});

test("an explicit TICKTICK_MODE overrides shape detection", () => {
  process.env.TICKTICK_COOKIE = "t=session";
  process.env.TICKTICK_API_TOKEN = "tp_token";
  process.env.TICKTICK_MODE = "openapi";
  expect(resolveAuth().mode).toBe("openapi");
  process.env.TICKTICK_MODE = "web";
  expect(resolveAuth().mode).toBe("web");
  delete process.env.TICKTICK_MODE;
  delete process.env.TICKTICK_API_TOKEN;
  delete process.env.TICKTICK_COOKIE;
});

test("web-only tools are rejected in openapi mode", () => {
  process.env.TICKTICK_API_TOKEN = "tp_abc123";
  expect(() => syncCheck(0)).toThrow(/private web API/);
  delete process.env.TICKTICK_API_TOKEN;
});

test("list_projects resolves to the right path per mode", async () => {
  const original = globalThis.fetch;
  let requestedPath = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedPath = String(input);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  process.env.TICKTICK_API_TOKEN = "tp_abc123";
  await listProjects();
  expect(requestedPath).toContain("/open/v1/project");

  delete process.env.TICKTICK_API_TOKEN;
  process.env.TICKTICK_COOKIE = "t=x; ap_user_id=1";
  await listProjects();
  expect(requestedPath).toContain("/api/v2/projects");

  globalThis.fetch = original;
  delete process.env.TICKTICK_COOKIE;
});
