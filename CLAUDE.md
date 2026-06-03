# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Aria (ARIA — Academic & Routine Intelligence Assistant) is a student productivity app: an AI study partner that tracks tasks, events, and courses and surfaces priorities. It's a two-part monorepo:

- `aria-backend/` — FastAPI + SQLAlchemy + SQLite, with an LLM layer (Groq) for chat and daily briefings.
- `aria-frontend/` — React 19 + TypeScript + Vite + Tailwind CSS v4.

The frontend (dev server on `:5173`) talks to the backend (`:8080`) over REST + a streaming SSE chat endpoint.

## Commands

### Backend (run from `aria-backend/`)
A `.venv` is committed-adjacent; activate it before running Python.
```bash
source .venv/bin/activate
uvicorn main:app --reload --port 8080   # serve API; auto-creates tables on startup
python seed.py                          # WIPES all tables, then seeds a test user + sample data
```
`seed.py` deletes every user/task/event/course and recreates a known login: `test@example.com` / `TestPass123!`. There is no migration tool — `Base.metadata.create_all` in `main.py` creates tables but does not alter existing ones, so a schema change requires dropping `aria.db` (or running `seed.py`).

There is no test runner configured. `test_groq.py` and `test_login.py` are standalone scripts (`python test_login.py`), not a pytest suite.

### Frontend (run from `aria-frontend/`)
```bash
npm install
npm run dev       # Vite dev server on :5173
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run preview
```

## Environment

Backend reads `.env.local` first, then falls back to `.env` (see `database.py`). Required keys:
- `DATABASE_URL` (default `sqlite:///./aria.db`)
- `SECRET_KEY` — JWT signing secret (defaults to an insecure fallback if unset)
- `GROQ_API_KEY` — required for `/chat` and `/briefing`
- `GROQ_MODEL` — optional, defaults to `llama-3.3-70b-versatile`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth 2.0 client credentials from a Google Cloud project, for the Google Calendar integration (see below)
- `GOOGLE_REDIRECT_URI` — the OAuth callback URL registered in that project (must match the authorized redirect URI exactly)

Frontend reads `VITE_API_URL` (the backend base URL) via `import.meta.env`.

> **Dependencies are not pinned in a file.** There is no `requirements.txt` / `pyproject.toml`; packages live only in the committed-adjacent `.venv`. The Google libraries (`google-api-python-client`, `google-auth`, `google-auth-oauthlib`, `google-auth-httplib2`) are already installed there. If you add an import, install it into `.venv` — nothing else tracks it.

## Architecture

### Backend request flow
`main.py` wires CORS (locked to `http://localhost:5173`) and mounts seven routers, each a `prefix`-scoped `APIRouter`: `auth`, `tasks`, `events`, `courses`, `chat`, `briefing`, `google`.

- **Auth** (`routers/auth.py`, `models/auth.py`): JWT bearer tokens. Login uses FastAPI's `OAuth2PasswordRequestForm` where the `username` field is treated as the (lowercased) email. Passwords hashed with Argon2 (bcrypt fallback) via passlib. `get_current_user` is the dependency every protected route depends on — it decodes the JWT `sub` (email) and loads the `User`.
- **Data ownership**: tasks/events/courses are always filtered by `user_id == current_user.id`. Follow this pattern for any new per-user query or mutation.

### The LLM layer — this is the heart of the app
The AI features don't call the model with raw user input alone; they inject the student's real data:

1. `services/context.py` → `build_user_context(user, db)` queries the user's tasks/events/courses and formats them into a plain-text "STUDENT DATA" block (overdue / upcoming / done tasks, upcoming events, courses).
2. `services/prompt.py` → `build_system_prompt(context)` wraps that block in ARIA's persona + rules.
3. `routers/chat.py` sends `[system_prompt, ...history[-10:], user_message]` to Groq. `/chat/stream` streams SSE chunks (`data: {"content": ...}\n\n`); `/chat/message` returns the full response.
4. `routers/briefing.py` (`GET /briefing/`) is separate: it builds its own one-off prompt for a structured daily briefing (GREETING/FOCUS/HEADS UP/MOTIVATION) and returns both the LLM `summary` and structured JSON (focus_task, counts, today's events, top tasks) for the dashboard to render.

`score_priority` / `get_priority_tasks` in `services/context.py` is the ranking algorithm (priority weight + due-date proximity + in-progress bonus) used to pick the focus task and top tasks. Tune scoring here, not in the routers.

### Google Calendar integration (in progress)
The app is being wired to pull a student's Google Calendar into the same `events` table the rest of the app reads from, so calendar entries flow into context/briefing alongside manually-created data.

**What is wired:**
- **`routers/google.py`** — mounted at `/auth/google`. Two endpoints:
  - `GET /auth/google/authorize` — requires JWT auth, returns `{"auth_url": "..."}` for the frontend to redirect the user to Google consent.
  - `GET /auth/google/callback` — Google redirects here after consent; fetches tokens, stores them as JSON in `User.google_tokens`, then redirects to `http://localhost:5173/dashboard?google=connected`.
- **`User.google_tokens`** (`Text`, nullable) — stores the per-user OAuth token bundle as a JSON string (`token`, `refresh_token`, `token_uri`, `client_id`, `scopes`). This is a schema change: existing `aria.db` files lack the column and must be dropped or `seed.py` re-run.
- **`OAUTHLIB_INSECURE_TRANSPORT=1`** — set in `main.py` at startup to allow HTTP during local dev. Must be removed or gated on an env var before any non-local deployment.

**What is not yet wired:**
- No endpoint to actually fetch and sync Google Calendar events into the `events` table.
- No token refresh logic — stored tokens will expire and need to be refreshed via `google.oauth2.credentials.Credentials.refresh()`.

**Key patterns to follow when building the sync endpoint:**
- Re-read `User.google_tokens`, deserialize, and reconstruct `google.oauth2.credentials.Credentials` from the stored fields plus `GOOGLE_CLIENT_SECRET` from env (do not store `client_secret` in the DB).
- Put calendar fetch/normalize logic in `services/` (not the router).
- Write synced events with `source="google_calendar"` and filter by `source` when reconciling so re-syncs don't duplicate or clobber user-entered events.
- Scope every query by `user_id == current_user.id`.

**`source` provenance column**: `event` carries a `source` string, default `"manual"`, set to `"google_calendar"` for synced rows. Always stamp `source` on writes and filter by it when reconciling synced vs. manual data.

### Models
SQLAlchemy models live in `models/` with **lowercase class names** (`task`, `event`, `course`) except `User`. `task` has `priority` and `status` Python enums (`low/medium/high`, `todo/in_progress/done`). Note that context/briefing code sometimes compares `task.status` against `status.x.value` (the string) and sometimes against the enum — be consistent with the surrounding code when editing. `event` has a `source` column (`"manual"` / `"google_calendar"`) for the Google Calendar integration above; the frontend `Event` type in `src/types/index.ts` mirrors it.

### Frontend
- `src/App.tsx` — React Router with a `ProtectedRoute` that gates `/dashboard` and `/chat` on a `token` in `localStorage`; `/` is the auth page.
- `src/api/axios.ts` — shared axios instance; a request interceptor attaches `Authorization: Bearer <token>` from `localStorage` automatically. Use this instance for all API calls.
- `src/types/index.ts` — `Task` / `Event` / `Course` interfaces mirroring the backend models.
- Pages: `authPage`, `dashboardPage`, `chatPage`; per-page CSS in `src/styles/`. Tailwind v4 is configured via `@tailwindcss/postcss`.
