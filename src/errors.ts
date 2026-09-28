/** Error thrown for any non-2xx TickTick response, carrying the parsed body. */
export class TickTickError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "TickTickError";
  }
}

/** The private API answers unknown routes with the web app's HTML 404 page. */
export function isNotFoundPage(body: string): boolean {
  return (
    body.startsWith("<!DOCTYPE") ||
    body.startsWith("<!doctype") ||
    body.includes("<title>Page not found")
  );
}

export function formatError(error: unknown): string {
  if (error instanceof TickTickError) {
    if (error.status === 401) {
      return `Not signed in (401). The session cookie is missing or expired — refresh TICKTICK_COOKIE.`;
    }
    if (error.status === 403 && error.code === "access_forbidden") {
      return `Forbidden (403): this account cannot use that endpoint (batch writes are gated per account).`;
    }
    return `${error.status}${error.code ? ` ${error.code}` : ""}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
