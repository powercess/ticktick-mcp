# The public Open API vs the private web API

TickTick ships two unrelated HTTP surfaces. This server uses the **private** one
because the public one is far smaller.

## Public Open API — `developer.ticktick.com/docs`

- Base: `https://api.ticktick.com/open/v1` (+ `/oauth/*`).
- Auth: `Authorization: Bearer <token>` — OAuth2, or a personal API token created
  in the web app (Settings → Account → API Token).
- Documented, stable, ~50 endpoints. The doc contains **no** `/api/v2` path.
- Covers: tasks (CRUD, move, assign, batch, completed, filter, search, undone,
  comments), projects (+ group, column, members), tags, focus, countdown, habit,
  preferences.

Representative endpoints:

```
GET    /open/v1/project
GET    /open/v1/project/{projectId}/data
GET    /open/v1/project/{projectId}/task/{taskId}
POST   /open/v1/task
POST   /open/v1/task/{taskId}
POST   /open/v1/task/batch
POST   /open/v1/task/completed
POST   /open/v1/project/{projectId}/task/{taskId}/complete
DELETE /open/v1/project/{projectId}/task/{taskId}
GET    /open/v1/tag
GET    /open/v1/habit
POST   /open/v1/preference
```

Notable fields the Open API documents that the web bundle also uses: `parentId`
for subtasks, `items[]` checklist, `repeatFrom` (`0` original date, `1` completion
date, `2` calendar). A `parentId` of `""` removes the parent relationship.

## Private web API — `/api/v2`, `/api/v3`

- Base: `https://api.ticktick.com/api/v2` (+ `/api/v3`, `/pub/api/*`).
- Auth: the web session cookie + `x-csrftoken` on writes.
- Undocumented, changes with the web app, **~164 usable endpoints** on a real
  account (measured).
- Covers everything the web app does: full offline sync via
  `/api/v3/batch/check/{checkPoint}`, trash, batch writers, calendar binding,
  statistics, notifications, search, templates, countdowns.

## Which to use

| Need | Surface |
|---|---|
| Long-lived token, small stable surface | Open API (`/open/v1`) |
| Trash, search, sync checkpoint, habits, calendar, exact web parity | Private web API (this server) |

If TickTick ever documents the endpoints this server relies on, that documentation
belongs in this file.
