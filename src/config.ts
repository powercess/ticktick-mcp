import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where the credentials file lives. Defaults to `~/.ticktick-mcp`, override with
 * `TICKTICK_MCP_HOME`. Kept out of the package tree so a checkout never contains
 * a live session cookie.
 */
export function credentialsPath(): string {
  const dir = process.env.TICKTICK_MCP_HOME || join(homedir(), ".ticktick-mcp");
  return join(dir, "credentials.json");
}

/** Sites that share the same private web API, only the host differs. */
export type Site = "ticktick" | "dida365";

/**
 * Which API surface the credential authenticates against.
 *
 * - `web`     — the signed-in browser session (`t` cookie + `_csrf_token`); the
 *   full private surface (`/api/v2`, `/api/v3`), every tool.
 * - `openapi` — the official Open API personal token (`tp_…`); Bearer auth, the
 *   documented `/open/v1` surface only. Stable, no cookie, but a smaller set of
 *   tools is available.
 */
export type AuthMode = "web" | "openapi";

export interface Auth {
  site: Site;
  mode: AuthMode;
  /** Full `Cookie:` header value (web mode). */
  cookie: string;
  /** `t=` cookie value, when known separately (web mode). */
  token?: string;
  /** `_csrf_token` value; also sent as `x-csrftoken` on writes (web mode). */
  csrfToken?: string;
  /** `ap_user_id` cookie value (web mode). */
  userId?: string;
  /** Personal API token, e.g. `tp_…` (openapi mode). Sent as `Bearer`. */
  apiToken?: string;
}

export interface CredentialsFile {
  site?: Site;
  cookie?: string;
  token?: string;
  csrfToken?: string;
  userId?: string;
  apiToken?: string;
  /** Overrides auto-detection when both a cookie and a token are configured. */
  mode?: AuthMode;
}

export function readCredentialsFile(): CredentialsFile | undefined {
  const path = credentialsPath();
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CredentialsFile;
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

export function writeCredentialsFile(credentials: CredentialsFile): string {
  const path = credentialsPath();
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  return path;
}

/**
 * Resolves the effective auth mode. A personal API token (`tp_…` or any token
 * that is not a `Cookie:` header) selects `openapi`; anything else is `web`.
 * `mode` can be pinned explicitly for accounts that hold both.
 */
export function resolveMode(credentials: CredentialsFile): AuthMode {
  if (credentials.mode) return credentials.mode;
  if (credentials.apiToken && !credentials.cookie && !credentials.token) return "openapi";
  if (credentials.cookie || credentials.token) return "web";
  return "openapi";
}

/**
 * Builds the effective auth from, in order of precedence: explicit arguments,
 * environment variables, then `~/.ticktick-mcp/credentials.json`.
 *
 * Open API mode accepts `TICKTICK_API_TOKEN` (a `tp_…` personal token) and talks
 * to `/open/v1` with `Authorization: Bearer`. Web mode accepts the session
 * cookie and talks to `/api/v2` with `x-csrftoken` on writes.
 */
export function resolveAuth(override: Partial<Auth> = {}): Auth {
  const file = readCredentialsFile() ?? {};
  const site = (override.site ??
    (process.env.TICKTICK_SITE as Site | undefined) ??
    file.site ??
    "ticktick") as Site;

  const apiToken =
    override.apiToken ??
    process.env.TICKTICK_API_TOKEN ??
    file.apiToken ??
    undefined;

  const rawCookie =
    override.cookie ?? process.env.TICKTICK_COOKIE ?? file.cookie ?? undefined;
  const token =
    override.token ?? process.env.TICKTICK_TOKEN ?? file.token ?? undefined;
  const csrfToken =
    override.csrfToken ??
    process.env.TICKTICK_CSRF_TOKEN ??
    file.csrfToken ??
    rawCookie?.match(/(?:^|;\s*)_csrf_token=([^;]*)/)?.[1];
  const userId =
    override.userId ??
    process.env.TICKTICK_USER_ID ??
    file.userId ??
    rawCookie?.match(/(?:^|;\s*)ap_user_id=([^;]*)/)?.[1];

  // Assemble a Cookie header from whatever pieces are available.
  let cookie = rawCookie;
  if (!cookie) {
    const parts: string[] = [];
    if (token) parts.push(`t=${token}`);
    if (csrfToken) parts.push(`_csrf_token=${csrfToken}`);
    if (userId) parts.push(`ap_user_id=${userId}`);
    if (parts.length > 0) cookie = parts.join("; ");
  }

  const mode = (override.mode ??
    process.env.TICKTICK_MODE as AuthMode | undefined ??
    file.mode ??
    resolveMode({ cookie, token, apiToken, site })) as AuthMode;

  return { site, mode, cookie: cookie ?? "", token, csrfToken, userId, apiToken };
}

export function requireAuth(override: Partial<Auth> = {}): Auth {
  const auth = resolveAuth(override);
  const hasWeb = Boolean(auth.cookie);
  const hasOpenApi = Boolean(auth.apiToken);
  if (!hasWeb && !hasOpenApi) {
    throw new Error(
      "No TickTick credentials. Set TICKTICK_COOKIE (web session), " +
        "TICKTICK_API_TOKEN (personal API token), or write " +
        `${credentialsPath()}. See docs/authentication.md.`,
    );
  }
  return auth;
}

export const API_HOSTS: Record<Site, string> = {
  ticktick: "https://api.ticktick.com",
  dida365: "https://api.dida365.com",
};

export const WEB_HOSTS: Record<Site, string> = {
  ticktick: "https://ticktick.com",
  dida365: "https://dida365.com",
};
