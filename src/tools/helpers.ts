import { formatError } from "../errors.js";

/** Standard successful MCP tool result: pretty-printed JSON payload. */
export function ok(payload: unknown) {
  // Mutating endpoints answer 200 with an empty body; MCP requires text content.
  const value = payload === undefined ? { ok: true } : payload;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/** Standard failed MCP tool result: `{ error }` with `isError`. */
export function fail(error: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }, null, 2) }],
  };
}

/** Wraps a tool body so any thrown error becomes a `fail(...)` result. */
export async function guard(body: () => Promise<unknown>) {
  try {
    return ok(await body());
  } catch (error) {
    return fail(error);
  }
}
