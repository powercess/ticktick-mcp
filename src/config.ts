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

export interface Auth {
  site: Site;
  /** Full `Cookie:` header value. */
  cookie: string;
  /** `t=` cookie value, when known separately. */
  token?: string;
  /** `_csrf_token` value; also sent as `x-csrftoken` on writes. */
  csrfToken?: string;
  /** `ap_user_id` cookie value. */
  userId?: string;
}

export interface CredentialsFile {
  site?: Site;
  cookie?: string;
  token?: string;
  csrfToken?: string;
  userId?: string;
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
 * Builds the effective auth from, in order of precedence: explicit arguments,
 * environment variables, then `~/.ticktick-mcp/credentials.json`.
 */
export function resolveAuth(override: Partial<Auth> = {}): Auth {
  const file = readCredentialsFile() ?? {};
  const site = (override.site ??
    (process.env.TICKTICK_SITE as Site | undefined) ??
    file.site ??
    "ticktick") as Site;

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

  return { site, cookie: cookie ?? "", token, csrfToken, userId };
}

export function requireAuth(override: Partial<Auth> = {}): Auth {
  const auth = resolveAuth(override);
  if (!auth.cookie) {
    throw new Error(
      "No TickTick credentials. Set TICKTICK_COOKIE (or TICKTICK_TOKEN), or write " +
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
