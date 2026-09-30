# ticktick-mcp

MCP server for **TickTick / 滴答清单** (and **Dida365 / 滴答清单 CN**), built on
the **private web API** — the same endpoints the web app at `ticktick.com/webapp`
calls — not the small public Open API. The outcome of a reverse-engineering
session against the 2026 web bundle (full findings:
[docs/reverse-engineering.md](docs/reverse-engineering.md)).

TypeScript + Node.js (`@modelcontextprotocol/sdk`), stdio transport, no native
dependencies. Auth is a browser session cookie, so the server sees exactly what
the signed-in web app sees: every project, task, tag, habit and calendar.

## Why not the Open API

TickTick publishes `/open/v1` (see [docs/open-api.md](docs/open-api.md)). It is
Bearer-authenticated, stable, and tiny — no tags, no search, no habits, no
calendar, no trash, no batch delete. The private `/api/v2` + `/api/v3` surface
this server uses has **~164 usable endpoints** on a real account (measured — see
the findings doc). The trade-off is honesty: those endpoints are undocumented and
move with the web app.

## Tools

34 tools. Every one below was exercised against a live account during development.

| Tool | What it does |
|---|---|
| `list_tasks` | Tasks in a project (`projectId: "inbox"` resolves the inbox) |
| `get_task` | A single task by id |
| `create_task` | Create a task (title, dates, priority, tags, recurrence, subtasks) |
| `update_task` | Patch fields on a task |
| `complete_task` / `uncomplete_task` | Set status 2 / 0 |
| `delete_task` | Trash a task, or `forever: true` to hard-delete |
| `move_task` | Move a task between projects |
| `list_completed_tasks` | Completed tasks by date range, one project or all |
| `list_trash` / `restore_task` | Trash listing and restore |
| `batch_tasks` | Add/update/delete many tasks at once¹ |
| `search_tasks` | Full-text search |
| `list_projects` / `get_project` | Projects (lists) |
| `create_project` / `update_project` / `delete_project` | Project lifecycle |
| `list_tags` / `rename_tag` / `merge_tags` / `delete_tag` | Tags |
| `list_columns` | Kanban columns |
| `get_current_user` | Profile: id, inbox id, plan |
| `sync_check` | Offline-first delta pull of the whole account |
| `get_preferences` | User preferences |
| `list_templates` / `list_countdowns` | Templates, countdowns |
| `list_habits` / `list_habit_sections` / `query_habit_checkins` | Habits |
| `list_calendar_accounts` / `list_calendar_subscriptions` / `list_calendar_events` | Calendars |

¹ Some accounts are gated: `POST /api/v2/batch/task` answers `403 access_forbidden`.
The tool reports that plainly instead of hiding it.

## Install

```bash
npm install -g @powercess/ticktick-mcp     # or: npx @powercess/ticktick-mcp
```

From a source checkout:

```bash
npm install
npm run build
npm test                                   # hermetic unit tests, no credentials
node scripts/smoke-client.mjs list_projects '{}'
```

Configure as an MCP server:

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "npx",
      "args": ["-y", "@powercess/ticktick-mcp"],
      "env": {
        "TICKTICK_COOKIE": "t=<session cookie>; _csrf_token=<csrf>; ap_user_id=<id>"
      }
    }
  }
}
```

## Authentication

Two credential types, auto-detected from shape — no mode flag needed:

| Credential | Env var | API surface | Tools |
|---|---|---|---|
| **Web session cookie** | `TICKTICK_COOKIE` | private `/api/v2` + `/api/v3` | **all 36** |
| **Personal API token** (`tp_…`) | `TICKTICK_API_TOKEN` | official `/open/v1` | ~28 (stable subset) |

Precedence: tool argument → environment → `~/.ticktick-mcp/credentials.json`.

### Web session cookie (full feature set)

Grab it from a logged-in browser — DevTools → Network → any `api.ticktick.com`
request → Request Headers → `cookie` — and pass the whole value.

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "npx",
      "args": ["-y", "@powercess/ticktick-mcp"],
      "env": {
        "TICKTICK_COOKIE": "t=<session cookie>; _csrf_token=<csrf>; ap_user_id=<id>"
      }
    }
  }
}
```

### Personal API token (no cookie, stable)

Create one in the web app: **Settings → Account → API Token → Create**. Long-lived,
no 2FA prompt, no browser required.

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "npx",
      "args": ["-y", "@powercess/ticktick-mcp"],
      "env": {
        "TICKTICK_API_TOKEN": "tp_<your token>"
      }
    }
  }
}
```

Token mode covers projects, tasks (CRUD, complete, move, batch, completed,
search), tags, columns, habits, focus, countdowns and project groups — about
28 of the 36 tools. Web-only tools (sync_check, trash, templates, calendar,
preferences, tag rename/merge/delete) return a clear error explaining that a
cookie session is needed.

See [docs/authentication.md](docs/authentication.md) for the full walkthrough,
Dida365 setup and every supported input.

## Layout

```
src/config.ts      credential resolution (env → file), site selection
src/client.ts      HTTP client: cookie + x-csrftoken, JSON, typed errors
src/api.ts         endpoint functions (sync, projects, tasks, tags, habits, calendar)
src/errors.ts      TickTickError + human-readable formatting
src/tools/*.ts     MCP tool surface (tasks, projects, account)
src/index.ts       server bootstrap
scripts/           smoke-client.mjs
test/              node:test suites (hermetic)
docs/              reverse-engineering findings, auth guide, Open API notes
```

## Limitations (honest)

- **Undocumented and unstable.** These endpoints are what the web app happens to
  call today; TickTick can change them without notice. The `sync_check` checkpoint
  format and the `x-csrftoken` requirement are reverse-engineered, not promised.
- **Session cookies expire.** There is no OAuth refresh here — when the cookie
  dies, refresh it by hand. (The official Open API is the right choice if you
  need long-lived tokens.)
- **Batch writes are account-gated.** `batch_tasks` may 403 on your account.
- **Not every endpoint is wired.** ~164 are usable; the tools cover the common
  read/write surface. Rarer ones (team collaboration, calendar OAuth handshakes,
  MFA, account merge) are deliberately out of scope — see the findings doc.
- **A few endpoints need a full object, not a patch.** `update_project` merges the
  current project before writing for exactly this reason.
- **No rate-limit handling.** TickTick may throttle; the server surfaces the error.

## Privacy

The session cookie is a live credential for the whole account. It lives in
`~/.ticktick-mcp/credentials.json` (mode `0600`, gitignored) or the environment,
never in the package directory. Captured traffic, cookies and account ids are
never committed. Revoke by logging out of the web app (or rotating the session).

## License

MIT
