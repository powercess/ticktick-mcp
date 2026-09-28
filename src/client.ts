import { API_HOSTS, requireAuth, type Auth, type Site } from "./config.js";
import { TickTickError, isNotFoundPage } from "./errors.js";

export interface RequestOptions {
  /** Site to target; defaults to the resolved credentials' site. */
  site?: Site;
  method?: string;
  /** Query string parameters; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON request body. */
  body?: unknown;
  /** Per-call auth override (e.g. an API token passed by the caller). */
  auth?: Partial<Auth>;
}

/** Headers the web app always sends. Kept minimal and non-identifying. */
function baseHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
  };
}

function buildUrl(site: Site, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_HOSTS[site]);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Calls the private web API with the resolved session cookie.
 *
 * Writes additionally send `x-csrftoken`, which the server requires; without it
 * the API answers 403. A non-2xx response throws a {@link TickTickError}.
 */
export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const auth = requireAuth(options.auth);
  const site = options.site ?? auth.site;
  const headers: Record<string, string> = {
    ...baseHeaders(),
    cookie: auth.cookie,
    origin: new URL(API_HOSTS[site]).origin,
    referer: `${new URL(API_HOSTS[site]).origin}/`,
  };
  if (auth.csrfToken) headers["x-csrftoken"] = auth.csrfToken;
  if (auth.userId) headers["ap-user-id"] = auth.userId;

  const response = await fetch(buildUrl(site, path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();

  if (!response.ok) {
    if (isNotFoundPage(text)) {
      throw new TickTickError(`no such endpoint: ${path}`, 404, "not_found", text);
    }
    let code: string | undefined;
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as {
        errorCode?: string;
        errorMessage?: string;
        error?: string;
        error_description?: string;
      };
      code = parsed.errorCode ?? parsed.error;
      message = parsed.errorMessage ?? parsed.error_description ?? message;
    } catch {
      /* non-JSON error body: keep the raw text */
    }
    throw new TickTickError(message, response.status, code, text);
  }

  if (text.length === 0) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Convenience wrappers used by the tool modules. */
export const http = {
  get: <T>(path: string, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "DELETE", body }),
};

/** Reads the signed-in user's id and inbox id, used to resolve the inbox. */
export async function currentUser(options: RequestOptions = {}): Promise<{
  userId: string;
  inboxId: string;
  username?: string;
}> {
  const status = await http.get<{
    userId: string;
    inboxId: string;
    username?: string;
  }>("/api/v2/user/status", options);
  return status;
}
