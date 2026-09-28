# TickTick web — reverse-engineering findings

Session against the **2026 web bundle** (`ticktick.com/webapp`). Kept here so no
progress is lost. All commands were run locally; values shown are **protocol
facts, not credentials** — account ids, project ids, task ids and cookies are
redacted to `<accountId>`, `<projectId>`, `<taskId>`, `<session>`.

Status board: the private API is mapped and the server implements the common
read/write surface. ~164 endpoints are usable on a real account; 68 reads were
verified 2xx, 84 writes verified to exist, 42 probed and confirmed absent.

## 1. Hosts

| Purpose | Host |
|---|---|
| Private business API | `https://api.ticktick.com` (CN: `api.dida365.com`) |
| App entry | `https://ticktick.com/webapp/#p/<projectId>/tasks` |
| Push (WebSocket) | `wss://wss.ticktick.com/web` |
| Analytics | `https://xapi.ticktick.com/datacollect/event/push` |
| Frontend assets | `https://d107mjio2rjf74.cloudfront.net/web/static/build/...` |
| Sentry | `https://s.ticktick.com/api/3/envelope/` |

Base-path constants, read from the bundle:

```
API_HOST_V2      = https://<host>/api/v2
API_HOST_V3      = https://<host>/api/v3
API_HOST_V1      = https://<host>/api/v1
API_HOST_V1_PUB  = https://<host>/pub/api/v1
API_HOST_V2_PUB  = https://<host>/pub/api/v2
API_HOST_V4      = https://<host>/api/v4
AI_API_HOST_V2   = https://<host>/ai/api/v2
```

## 2. Authentication

- Session cookie: `t=<session>` (HttpOnly), plus `_csrf_token=<value>` and
  `ap_user_id=<accountId>`.
- **Writes require the header `x-csrftoken: <_csrf_token value>`.** Without it
  the API answers `403`.
- Unauthenticated: `GET /api/v2/user/status` → `401 {"errorCode":"user_not_sign_on"}`,
  and `/webapp/` answers a server-side `302` back to `/`.
- `projectId` of the inbox is `inbox<accountId>`.
- Headers the web app always sends: `x-csrftoken`, `x-device` (JSON device blob),
  `x-tz`, `hl`, `traceid`, `origin`, `referer`.

## 3. Discovery method

1. **Capture** — drove a logged-in `ticktick.com/webapp` and recorded real
   requests (all to `api.ticktick.com/api/v2/...`).
2. **Static extraction** — downloaded and de-minified the live app bundles
   (`web.ap-*.js`, `tt_commons`, `tt_modules`, `tt_libs`, `vendor`,
   `runtime-web`, ~20 MB) and pulled every path literal and `.get/.post/.put/.delete`
   call: 335 raw patterns.
3. **Live probing** — called each candidate against `api.ticktick.com` with the
   session cookie. The discriminator: **unknown routes return the web app's HTML
   "Page not found" page; known routes return JSON.** For write-only routes a
   `GET` returns `405`/`500` (route exists) versus the HTML 404 (absent).

## 4. Availability (measured)

| Category | Count |
|---|---|
| Reads returning 2xx | 68 |
| Reads existing but non-2xx (403/405/500) | 12 |
| Write routes existing (correct method, non-404) | 84 |
| **Usable total** | **~164** |
| Confirmed absent (404) | 42 |

## 5. Core endpoints

### Sync (the backbone)

```
GET /api/v3/batch/check/0                 full snapshot
GET /api/v3/batch/check/{checkPoint}      incremental delta
```

Response: `{ checkPoint, syncTaskBean: { update[], add[], delete[], empty },
projectProfiles[], tags[] }`. The frontend only pulls through this endpoint; it
writes through `/api/v2/task` and `/api/v2/batch/task`.

### Tasks

```
GET    /api/v2/project/{projectId}/tasks
GET    /api/v2/task/{taskId}?projectId={projectId}
POST   /api/v2/task                        create
POST   /api/v2/task/{taskId}               update (body needs { id, projectId })
DELETE /api/v2/task                        body [{ taskId, projectId }]  (trash)
DELETE /api/v2/task?deleteforever=true     body [{ taskId, projectId }]  (hard)
GET    /api/v2/project/{projectId}/completed/?from=&to=&limit=
GET    /api/v2/project/all/completedInAll/?from=&to=&limit=
GET    /api/v2/project/all/trash/page?limit=50&type=1
POST   /api/v2/trash/restore
```

- `status`: `0` normal, `2` completed (also `-1` abandoned in the Open API).
- Completion is `POST /api/v2/task/{id}` with `{ id, projectId, status: 2 }`.
- `DELETE /api/v2/task` **without** a body → `500 unknown_exception`; the body
  must be a JSON **array** of `{ taskId, projectId }`.
- `POST /api/v2/batch/task` is the batch writer (`{ add, update, delete }`) but is
  **gated per account** — one test account returned `403 access_forbidden` while
  `/api/v2/batch/project` and `/api/v2/batch/tag` returned 200.

Task fields (observed): `id, projectId, sortOrder, title, content, desc,
startDate, dueDate, timeZone, isAllDay, isFloating, reminders[], repeatFlag
(RRULE), repeatFrom, exDate[], priority (0/1/3/5), status, items[] (subtasks),
tags[], kind (TEXT), etag, modifiedTime, createdTime, deleted, columnId`.

### Projects

```
GET    /api/v2/projects
POST   /api/v2/project
PUT    /api/v2/project/{projectId}          ← full object required
DELETE /api/v2/project/{projectId}
POST   /api/v2/batch/project
```

Two traps:

- There is **no** `GET /api/v2/project/{projectId}` — it answers `405`. Read the
  full list and filter.
- `PUT /api/v2/project/{projectId}` with a **partial** body returns
  `500 no_project_permission`. Sending the **complete** project object (fetched
  from `/projects` and merged) returns 200. The server does this merge itself.

### Tags, columns, habits, calendar

```
GET  /api/v2/tags                    PUT /api/v2/tag/{rename,merge}   DELETE /api/v2/tag/delete
GET  /api/v2/column?from=0           GET /api/v2/column/project/{projectId}
GET  /api/v2/habits                  GET /api/v2/habitSections
POST /api/v2/habitCheckins/query
GET  /api/v2/calendar/{third/accounts,subscription,bind/events/all,archivedEvent}
GET  /api/v2/countdown/list          GET /api/v2/templates
```

## 6. Absent under `/api/v2` (live on other hosts)

`/ai/api/v2` and `/api/v4` are separate services reached with a **different**
auth context; from the web session they are not available:

```
/ai/api/v2/...        AI chat, task recommend, voice summary, chatmind
/api/v4/...           (e.g. some collaboration flows)
```

Also confirmed 404 under `/api/v2`: `user/geoInfo`, `user-settings/privacy`,
`project/{id}/data`, `task/activity/{id}`, `course/*`, `conversations`,
`wechat/qrcode-url`, `account/changeBind/*`, `payment/team`, `team` (bare).

## 7. The public Open API is a different surface

`developer.ticktick.com/docs/openapi.md` documents only `/oauth/*` and
`/open/v1/*` — **zero** occurrences of `/api/v2`. It is Bearer-authenticated and
stable but small. Details and a per-endpoint comparison:
[docs/open-api.md](docs/open-api.md).

## 8. Open questions

- The WebSocket push protocol (`wss://wss.ticktick.com/web`) was observed but not
  decoded — the server uses the `sync_check` poll instead.
- Which accounts are gated out of `batch/task` (and why) is unknown; the gating
  rule was not found in the bundle.
- The exact merge semantics of `PUT /project/{id}` (which fields are honoured)
  were not exhaustively probed.
