# Planning — Aria → "Second Self": Cross-Platform Autonomous Digital Twin

## 0. TL;DR

Aria today is a web app: a FastAPI + SQLite backend with a Groq-backed chat/briefing layer, and a React + Vite frontend. This plan describes how to evolve it into **Second Self** — a native desktop application (macOS **and** Windows) that runs an autonomous "digital twin" of the user: a chatbot that knows how they write and what they're working on, and that can act on their behalf via computer use, browser automation, and MCP connectors.

Yes, it's possible. The realistic path is to keep Aria's backend largely intact as the "brain + memory" service, replace the browser frontend with a native desktop shell (Tauri), and add a new **agent runtime** layer for autonomous action. The hardest, most platform-specific part — running the twin as a *parallel OS session you can watch live* — is feasible on macOS (Fast User Switching + VNC) but has no clean Windows equivalent and should be treated as a macOS-only "advanced mode," with Windows getting a sandboxed-window agent instead.

---

## 1. Scope

### In scope (Full Second Self vision)
- Native desktop app for **macOS** and **Windows**, downloadable and signed/notarized.
- Conversational chatbot ("talk to your twin") with streaming responses, carried over from Aria's existing `/chat/stream`.
- **Voice/style fingerprint**: learn how the user writes from emails, files, and social text, and write in their style.
- **Memory layer**: episodic + behavioral + semantic memory persisted across sessions.
- **MCP connectors**: Google (Calendar/Gmail), Notion, Slack — reusing Aria's existing Google OAuth work as the template.
- **Autonomous action**: computer use (control apps/desktop) and browser use (fast web automation with cookie-based auth).
- **Live observability**: the user can watch and take over the twin in real time.
- **Onboarding** that bootstraps the twin from public data + local files quickly.

### Out of scope (for v1)
- Reinforcement-learning self-improvement loop (HEX/Prime Intellect) — keep as a "What's next" item.
- Mobile apps.
- Multi-user / team twins.
- Anything requiring kernel extensions or disabling OS security (SIP, etc.).

### Platform parity decision
| Capability | macOS | Windows |
|---|---|---|
| Native shell, chat, memory, MCP, voice | ✅ Full | ✅ Full |
| Browser-use automation | ✅ | ✅ |
| Computer use (GUI control) | ✅ AppleScript + accessibility | ✅ UIAutomation / pywinauto |
| **Parallel watched session** | ✅ Fast User Switching + VNC | ⚠️ No clean equivalent → use a dedicated **sandboxed window / second desktop (WinSta/Desktop)** or a local VM, no live-VNC-of-another-login |

This asymmetry is the single most important architectural constraint and is called out again in §3.4.

---

## 2. What it does (user-facing)

1. **Onboard**: user signs in (Auth0 or Aria's existing JWT auth), grants scoped permissions (files, Google, etc.), and the twin scrapes public + local signals to build an initial profile and style fingerprint.
2. **Chat**: user talks to the twin in a desktop window (notch/pill UI on Mac, system-tray panel on Windows). The twin answers using Aria's data-injected prompt (tasks/events/courses/calendar) plus the new memory + style layers.
3. **Delegate**: user asks the twin to *do* something ("reply to these emails," "fill out this form," "summarize my Notion and post to Slack"). The twin plans, then executes via browser use / computer use / MCP, writing in the user's voice.
4. **Watch & take over**: a live view shows what the twin is doing; the user can pause, correct, or take the wheel.
5. **Remember**: every interaction updates memory so the twin gets more personal over time.

---

## 3. Architecture

### 3.1 High-level components
```
┌──────────────────────────────────────────────────────────────┐
│  Desktop App (Tauri shell)                                     │
│  ┌────────────────────────┐   ┌──────────────────────────┐    │
│  │ UI (reuse React front- │   │ Live view (twin's screen │    │
│  │ end: chat, dashboard)  │   │ / actions stream)        │    │
│  └───────────┬────────────┘   └────────────┬─────────────┘    │
└──────────────┼──────────────────────────────┼─────────────────┘
               │ local IPC / REST / SSE        │ MJPEG / WebRTC
┌──────────────▼──────────────────────────────▼─────────────────┐
│  Local Agent Service  (FastAPI — evolved Aria backend)         │
│                                                                │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Brain    │ │ Memory layer │ │ Style/voice│ │ Connectors │  │
│  │ (LLM +   │ │ (episodic/   │ │ fingerprint│ │ (MCP:      │  │
│  │ Agent SDK│ │ semantic +   │ │ profile    │ │ Google/    │  │
│  │ loop)    │ │ vector DB)   │ │            │ │ Notion/Slack)│ │
│  └────┬─────┘ └──────────────┘ └────────────┘ └────────────┘  │
│       │                                                        │
│  ┌────▼───────────────── Action Runtime ──────────────────┐   │
│  │ Browser use (browser-use CLI + cookie clone)           │   │
│  │ Computer use (Anthropic computer-use API → OS adapter) │   │
│  │   macOS adapter: AppleScript/PyAutoGUI/Quartz          │   │
│  │   Windows adapter: pywinauto/UIAutomation/pyautogui    │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
               │ persistence
        ┌──────▼────────────────────────────┐
        │ SQLite/Postgres (Aria data)        │
        │ Vector store (memory embeddings)   │
        │ Encrypted secrets vault (tokens)   │
        └────────────────────────────────────┘
```

### 3.2 Reuse from current Aria
- **Backend brain stays**: keep FastAPI, the router structure, `services/context.py`, `services/prompt.py`, `routers/chat.py` streaming. The data-injection pattern (inject real tasks/events/courses into the prompt) becomes one of several context sources.
- **Auth**: keep JWT for the local service; optionally front it with Auth0 for cloud identity. The existing Google OAuth flow in `routers/google.py` / `routers/calendar.py` is the **template** for all MCP connectors.
- **Frontend**: the React app (chat/dashboard pages, axios instance, toast/skeleton components) is repackaged inside the desktop shell rather than served in a browser tab.
- **Swap the LLM**: the chat layer currently calls Groq. For agentic action, move the core loop to the **Claude Agent SDK** (tool use, computer use). Groq can remain for cheap, fast non-agent chat; Claude handles planning + computer/browser use.

### 3.3 New components to build
- **Desktop shell** — Tauri (Rust core + webview) chosen over Electron for smaller binaries, lower memory, and easier code signing on both OSes. Hosts the existing React UI in a webview and spawns/manages the local agent service as a sidecar.
- **Agent runtime** — a supervised loop (Claude Agent SDK) that: receives a goal → plans → calls tools (MCP, browser-use, computer-use) → observes → repeats, with a human-in-the-loop gate for risky actions.
- **OS adapter layer** — a thin interface (`act.click()`, `act.type()`, `act.screenshot()`, `act.open_app()`) with two implementations (mac/win) so the agent code is platform-agnostic.
- **Memory service** — embeddings + a local vector store (e.g., SQLite-VSS / Chroma / LanceDB) with three namespaces: episodic (events), behavioral (preferences/patterns), semantic (facts about the user). Summaries are written back after each session.
- **Style/voice fingerprint** — a profile built from writing samples (emails, files, tweets) → stored as a style spec + few-shot exemplars injected into the system prompt; optional ElevenLabs voice for audio.
- **Live view streamer** — captures the twin's activity and streams it to the UI.
- **Secrets vault** — OS keychain (macOS Keychain / Windows Credential Manager) for tokens; never store `client_secret` in the DB (Aria already follows this).

### 3.4 The "parallel watched session" — the hard part
The Second Self differentiator is running the twin *on your own machine* under a security boundary, watchable live.

- **macOS path (advanced mode)**: create/use a second user account; launch the agent in that session via **Fast User Switching**; stream its screen back to the primary session with a **VNC server (TigerVNC/Vine) + a custom MJPEG stream** (as the inspiration project did). Pros: real isolation, real computer use. Cons: complex setup, login/permission friction, fragile.
- **Windows path**: Windows has no Fast-User-Switching-with-live-VNC story that's friendly. Options, in order of preference:
  1. **Second desktop / window station** (Win32 `CreateDesktop`) — isolates input but limited app support.
  2. **Local lightweight VM** (Hyper-V/WSL2-GUI) the twin operates inside, streamed back via RDP/MJPEG.
  3. **Sandboxed foreground window** — simplest; the twin drives a dedicated automation browser + scoped apps in the user's own session with explicit guardrails (no true isolation, but lowest friction).
- **Recommendation for v1**: ship the **sandboxed/scoped** model on both OSes first (browser-use + MCP cover ~80% of useful tasks and need no parallel session). Add macOS parallel-session "advanced mode" as a follow-on once the core is stable. This avoids blocking the whole product on the most brittle piece.

### 3.5 Data flow for an autonomous task
```
User goal ─▶ Brain plans (Claude Agent SDK)
          ─▶ Pulls context: Aria data + memory + style profile
          ─▶ Emits tool calls:
               • MCP (read Gmail/Notion/Slack)
               • browser-use (navigate/click/fill, cloned cookies)
               • computer-use → OS adapter (click/type/screenshot)
          ─▶ Risky step? → human-in-the-loop confirm in UI
          ─▶ Live view streams progress
          ─▶ Result + summary written to memory
```

---

## 4. What to build — phased roadmap

**Phase 0 — Foundation (refactor, no new features)**
- Move secrets to OS keychain; remove SQLite-only assumptions; confirm Postgres path.
- Add a vector store and a `memory` module (schema + write/read API).
- Introduce the OS adapter interface with stub mac/win implementations.

**Phase 1 — Desktop shell (cross-platform parity)**
- Wrap the React frontend in Tauri; bundle the FastAPI backend as a sidecar.
- Reproduce chat + dashboard natively; system tray / menu-bar presence.
- Code-sign + notarize (macOS) and sign (Windows); produce installers.
- *Expected result*: Aria runs as a native chatbot app on both OSes, talking to a local backend.

**Phase 2 — Memory + voice fingerprint**
- Build the style fingerprint from uploaded writing samples; inject into the system prompt.
- Wire episodic/semantic/behavioral memory into `build_user_context` alongside Aria data.
- *Expected result*: the twin answers in the user's voice and remembers prior sessions.

**Phase 3 — Connectors (MCP)**
- Generalize Aria's Google OAuth pattern into a connector framework; add Notion + Slack MCP.
- Add token-refresh logic (currently a known gap in Aria's Google integration).
- *Expected result*: the twin can read/write across Google, Notion, Slack.

**Phase 4 — Action runtime**
- Move the core loop to the Claude Agent SDK; add browser-use (with cookie cloning) and computer-use via the OS adapter.
- Add the human-in-the-loop confirmation gate and an action audit log.
- *Expected result*: the twin completes real delegated tasks (draft + send email, fill forms, cross-app workflows).

**Phase 5 — Live view + (macOS) parallel session**
- Build the MJPEG/WebRTC live-view streamer; add pause/take-over controls.
- Implement macOS Fast-User-Switching advanced mode; Windows sandboxed/second-desktop mode.
- *Expected result*: user watches and can interrupt the twin in real time.

**Phase 6 — Onboarding + polish**
- Fast onboarding (public-data + local-file profiling, permission grants).
- Animations, notch/pill UI, optional ElevenLabs voice.

**Phase 7 (future) — RL feedback loop, expanded connectors, cloud sync.**

---

## 5. How to implement — concrete notes

- **Shell**: `tauri` with the React build as the webview asset; spawn the Python backend via Tauri's sidecar feature (bundle a PyInstaller-frozen FastAPI so users need no Python).
- **Agent loop**: Claude Agent SDK as the orchestrator. Define tools as typed functions; route computer-use through the OS adapter so one agent codebase serves both platforms.
- **Browser use**: integrate `browser-use` CLI; clone cookies from the user's real browser profile for authenticated automation (scope and encrypt these).
- **Computer use**: Anthropic computer-use API for vision+action planning; execution via PyAutoGUI/Quartz/AppleScript (mac) and pywinauto/UIAutomation (win).
- **Memory**: store embeddings locally (LanceDB/Chroma/SQLite-VSS). After each session, summarize and upsert into the three namespaces; retrieve top-k relevant memories per turn and inject into the prompt.
- **Style fingerprint**: extract tone/length/vocab features + keep N representative exemplars; build a "write as the user" instruction block. Re-use Aria's prompt-assembly pattern in `services/prompt.py`.
- **Connectors**: keep the `routers/google.py` flow as the reference; for each new connector store tokens in the keychain, scope every query by `user_id`, and add refresh logic.
- **Live view**: reuse the inspiration project's custom MJPEG stream + VNC for macOS advanced mode; WebRTC is the cleaner long-term choice.
- **Security**: explicit per-action permission scopes, an action audit log, a kill switch, and human confirmation for irreversible actions (send, delete, pay).

---

## 6. Key risks & mitigations
- **Windows has no parallel-watched-session parity** → ship sandboxed mode on both OSes first; treat mac parallel session as advanced mode (§3.4).
- **VNC/MJPEG setup is brittle** (the inspiration team's #1 pain) → defer to Phase 5; don't block core value on it.
- **Cookie cloning + permissions are fragile** → encrypt, scope narrowly, and re-prompt on failure.
- **Autonomous actions are risky** → human-in-the-loop gate + audit log + kill switch from day one.
- **Schema migrations**: Aria currently has no migration tooling (drops DB on schema change). Adopt Alembic before adding memory/connector tables — this is now mandatory, not optional.
- **Integration drift** (the inspiration team's lesson): agree API shapes and test frontend↔backend early; organize env vars from day one.

---

## 7. Expected end result
A signed, downloadable desktop app for macOS and Windows where a user can chat with a personalized twin that knows their data, writes in their voice, remembers across sessions, connects to Google/Notion/Slack, and — with explicit permission and live oversight — autonomously completes real tasks on their behalf. The current Aria web app becomes the brain-and-memory service inside it; the browser UI becomes a native shell; and a new agent runtime turns "an assistant that tells you what to do" into "a second self that does it for you."

---
*Generated as a planning document. The cross-platform conversion is feasible; the autonomous-action and live-parallel-session pieces are the high-effort, high-risk parts and are sequenced last for that reason.*
