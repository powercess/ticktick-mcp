# Authentication

Two credential types, auto-detected from shape — no mode flag needed:

| Credential | Env var | API surface | Tools |
|---|---|---|---|
| **Web session cookie** | `TICKTICK_COOKIE` | private `/api/v2` + `/api/v3` | all 36 |
| **Personal API token** (`tp_…`) | `TICKTICK_API_TOKEN` | official `/open/v1` | ~28 (stable subset) |

## Option A: Personal API token (recommended)

Create once, long-lived, no browser session to expire:

1. Open <https://ticktick.com/webapp/> → avatar → **Settings → Account → API Token**.
2. Click **Create**, copy the `tp_…` value.

```bash
export TICKTICK_API_TOKEN='tp_<your token>'
```

This authenticates against the official `/open/v1` surface with
`Authorization: Bearer`. Covers projects, tasks (CRUD, complete, move, batch,
completed, search), tags, columns, habits, focus, countdowns and project
groups. Web-only tools (sync_check, trash, templates, calendar, preferences,
tag rename/merge/delete) return a descriptive error.

## Option B: Web session cookie (full feature set)

Grab it from a logged-in browser — DevTools → Network → any `api.ticktick.com`
request → Request Headers → `cookie` — and pass the whole value:

   ```
   t=<session>; _csrf_token=<csrf>; ap_user_id=<accountId>; AWSALB=...; AWSALBCORS=...
   ```

The three parts that matter are `t`, `_csrf_token` and `ap_user_id`. The AWS
load-balancer cookies can be dropped.

## Supply it

Precedence: **tool argument → environment → credentials file.**

### Environment (simplest)

```bash
export TICKTICK_COOKIE='t=<session>; _csrf_token=<csrf>; ap_user_id=<accountId>'
```

Or the pieces separately — the server assembles the header:

```bash
export TICKTICK_TOKEN='<session>'
export TICKTICK_CSRF_TOKEN='<csrf>'
export TICKTICK_USER_ID='<accountId>'
```

### Credentials file

`~/.ticktick-mcp/credentials.json` (mode `0600`, written by
`TICKTICK_MCP_HOME` override):

```json
{
  "site": "ticktick",
  "cookie": "t=<session>; _csrf_token=<csrf>; ap_user_id=<accountId>"
}
```

### Dida365 (滴答清单 CN)

Set `TICKTICK_SITE=dida365` (or `"site": "dida365"` in the file). The cookie
comes from `dida365.com/webapp`; every path is identical, only the host differs
(`api.dida365.com`).

## Writes need the CSRF token

Every non-GET request must carry `x-csrftoken: <_csrf_token value>`, which the
server sends automatically when the CSRF token is known (from the cookie or
`TICKTICK_CSRF_TOKEN`). A write without it returns `403`.

## Errors

| Symptom | Meaning | Fix |
|---|---|---|
| `401 user_not_sign_on` | Cookie missing/expired | Grab a fresh `cookie` from the browser |
| `403 access_forbidden` | Endpoint gated for the account (e.g. `batch/task`) | Use the per-item tool instead |
| `500 no_project_permission` | Partial body on `PUT /project/{id}` | The server merges the full object — report if it still fails |
| `404` with an HTML body | Endpoint does not exist on this host | Not every documented-looking path exists; see the findings doc |

## Security

The cookie is a full-account credential. Keep it out of the package tree, out of
git, and out of shell history where practical. Revoke it by signing out of the
web app (or changing your password), which invalidates the `t` session.
