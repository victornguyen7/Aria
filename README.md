# ARIA — Academic & Routine Intelligence Assistant

Aria is a student productivity app: an AI study partner that tracks tasks and events, detects scheduling conflicts, and surfaces daily priorities. It's a two-part monorepo:

- **`aria-backend/`** — FastAPI + SQLAlchemy + SQLite, with an LLM layer (Groq) for chat and daily briefings.
- **`aria-frontend/`** — React 19 + TypeScript + Vite + Tailwind CSS v4.

The frontend (dev server on `:5173`) talks to the backend (`:8080`) over REST plus a streaming SSE chat endpoint.

## Features

- **Task & event tracking** — create, edit, and delete tasks (with priority, status, due date/time, and optional grade tracking) and events, scoped per user.
- **AI chat** — a streaming chat assistant (`/chat/stream`) whose responses are grounded in the user's real tasks/events via an injected context block.
- **Daily briefing** — a structured summary (greeting, focus task, heads up, motivational quote) rendered on the dashboard, backed by an LLM-generated summary.
- **Conflict detection** — flags scheduling conflicts (task due during an event, task due too close to an event, overdue high-priority tasks) up to 7 days out.
- **Google Calendar sync** — OAuth-based connection that pulls the next 7 days of Google Calendar events into the same `events` table used by the rest of the app.

## Getting started

### Backend (run from `aria-backend/`)

```bash
source .venv/bin/activate
pip install -r requirements.txt         # install/sync dependencies
uvicorn main:app --reload --port 8080   # serve API; auto-creates tables on startup
python seed.py                          # WIPES all tables, then seeds a test user + sample data
```

`seed.py` deletes every user/task/event and recreates a known login: `test@example.com` / `TestPass123!`. There is no migration tooling — a schema change requires dropping the database (or re-running `seed.py`).

### Frontend (run from `aria-frontend/`)

```bash
npm install
npm run dev       # Vite dev server on :5173
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run preview
```

## Environment

Configuration is centralized in `aria-backend/config.py`, which loads `.env.local` first, then falls back to `.env`.

| Key | Notes |
|---|---|
| `DATABASE_URL` | Defaults to `sqlite:///./aria.db`; rewritten to `postgresql+psycopg2://` on Railway. |
| `SECRET_KEY` | JWT signing secret. **Required.** |
| `GROQ_API_KEY` | **Required.** Used by `/chat` and `/briefing`. |
| `GROQ_MODEL` | Optional, defaults to `llama-3.3-70b-versatile`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth 2.0 credentials for Google Calendar sync. |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL, default `http://localhost:8080/auth/google/callback`. |
| `ENVIRONMENT` | `development` (default) or `production`. |
| `FRONTEND_URL` / `FRONTEND_ORIGIN` | Used for redirects and CORS in production. |

The frontend reads `VITE_API_URL` (the backend base URL) via `import.meta.env`.

## Architecture

- `main.py` mounts seven routers: `auth`, `tasks`, `events`, `chat`, `briefing`, `google`, `calendar`.
- **Auth** is JWT-based (Argon2/bcrypt password hashing); every task/event query is scoped by `user_id`.
- **The LLM layer** (`services/context.py` → `services/prompt.py` → `routers/chat.py` / `routers/briefing.py`) builds a text context block from the user's real data before calling Groq, so responses are grounded rather than generic.
- **Conflict detection** (`services/conflict.py`) scans the next 7 days for scheduling conflicts and feeds the top 3 into the daily briefing.
- **Google Calendar integration** (`routers/google.py`, `routers/calendar.py`) is in progress: OAuth connect/callback and a 7-day sync endpoint are wired; token refresh is not yet implemented.

See [CLAUDE.md](CLAUDE.md) for a detailed architecture reference, including model/data patterns and frontend structure.

## Status

Currently in progress: Google Calendar timezone handling in the sync endpoint (`aria-backend/routers/calendar.py`) and briefing event filtering (`aria-backend/routers/briefing.py`) are being refined so that in-progress events aren't dropped from "today's schedule."
