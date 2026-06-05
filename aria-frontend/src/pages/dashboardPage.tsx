import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Task } from "../types";
import AddTaskModal from "../components/addTaskModal";
import TodayTimeline from "../components/todayTimeline";
import ReactMarkdown from "react-markdown";
import "../styles/dashboardPage.css";

interface Briefing {
  summary: string;
  focus_task: Task | null;
  overdue_count: number;
  upcoming_count: number;
  today_events: { id: string; title: string; start_time: string; end_time?: string }[];
  top_tasks: Task[];
  generated_at: string;
}

const priorityPill = {
  high: "pill pill-high",
  medium: "pill pill-medium",
  low: "pill pill-low",
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [canvasSyncing, setCanvasSyncing] = useState(false);
  const [canvasSyncResult, setCanvasSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/"; return; }

    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleConnected(true);
      window.history.replaceState({}, "", "/dashboard");
    }

    fetchTasks();
    fetchBriefing();
    checkCalendarStatus();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/");
      setTasks(res.data);
    } catch {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
  };

  const fetchBriefing = async () => {
    try {
      const res = await api.get("/briefing/");
      setBriefing(res.data);
    } catch {
      console.error("Failed to load briefing");
    } finally {
      setLoadingBriefing(false);
    }
  };

  const checkCalendarStatus = async () => {
    try {
      const res = await api.get("/calendar/status");
      setGoogleConnected(res.data.connected);
    } catch {
      // silently fail — not critical
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      const res = await api.get("/auth/google/authorize");
      window.location.href = res.data.auth_url;
    } catch {
      console.error("Failed to start Google OAuth");
    }
  };

  const syncCanvas = async () => {
    setCanvasSyncing(true);
    try {
      await api.post("/canvas/sync/courses");
      await api.post("/canvas/sync/assignments");
      fetchTasks();
      fetchBriefing();
      setCanvasSyncResult("Canvas synced");
      setTimeout(() => setCanvasSyncResult(null), 3000);
    } catch {
      console.error("Canvas sync failed");
      setCanvasSyncResult("Sync failed");
    } finally {
      setCanvasSyncing(false);
    }
  };

  const syncCalendar = async () => {
    setCalendarSyncing(true);
    try {
      await api.get("/calendar/sync");
      fetchBriefing();
    } catch {
      console.error("Calendar sync failed");
    } finally {
      setCalendarSyncing(false);
    }
  };

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";
    await api.put(`/tasks/${task.id}`, { status: nextStatus });
    fetchTasks();
  };

  const formatDate = (iso?: string | Date | null) =>
    iso ? new Date(iso as any).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
  );
  const upcoming = tasks.filter(
    (t) => t.status !== "done" && (!t.due_date || new Date(t.due_date) >= new Date())
  );
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto px-4 py-10 dashboard-container">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Good morning ✦</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => (window.location.href = "/chat")} className="btn-ghost">
              Chat with ARIA
            </button>
            {googleConnected ? (
              <button onClick={syncCalendar} disabled={calendarSyncing} className="btn-cal-sync">
                {calendarSyncing ? "Syncing…" : "↻ Sync Calendar"}
              </button>
            ) : (
              <button onClick={connectGoogleCalendar} className="btn-cal-connect">
                Connect Google Calendar
              </button>
            )}
            <button onClick={syncCanvas} disabled={canvasSyncing} className="btn-cal-sync">
              {canvasSyncing ? "Syncing…" : canvasSyncResult ?? "↻ Sync Canvas"}
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              + New task
            </button>
            <button
              onClick={() => { localStorage.removeItem("token"); window.location.href = "/"; }}
              className="text-sm transition"
              style={{ color: "var(--text-dim)" }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Left Column - Briefing & Focus */}
          <div className="col-span-2 space-y-6">

            {/* AI Briefing card */}
            <div className="dashboard-block">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ background: "var(--accent)" }}
                >
                  A
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>ARIA's daily briefing</p>
              </div>
              {loadingBriefing ? (
                <div className="flex flex-col gap-2">
                  <div className="h-4 rounded animate-pulse w-3/4" style={{ background: "var(--surface-2)" }} />
                  <div className="h-4 rounded animate-pulse w-full" style={{ background: "var(--surface-2)" }} />
                  <div className="h-4 rounded animate-pulse w-2/3" style={{ background: "var(--surface-2)" }} />
                </div>
              ) : briefing ? (
                <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none" style={{ color: "var(--text-muted)" }}>
                  <ReactMarkdown>{briefing.summary}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>Could not load briefing.</p>
              )}
            </div>

            {/* Focus task */}
            {briefing?.focus_task && (
              <div className="dashboard-block">
                <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
                  Today's focus
                </p>
                <p className="text-white font-medium">{briefing.focus_task.title}</p>
                {briefing.focus_task.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{briefing.focus_task.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={priorityPill[briefing.focus_task.priority]}>
                    {briefing.focus_task.priority}
                  </span>
                  {briefing.focus_task.due_date && (
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                      Due {formatDate(briefing.focus_task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Today's Timeline */}
            {briefing && (
              <TodayTimeline 
                events={briefing.today_events || []} 
                tasks={tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString())}
              />
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-4">
            {[
              { label: "Overdue", count: overdue.length, color: "text-red-400" },
              { label: "Upcoming", count: upcoming.length, color: "text-blue-400" },
              { label: "Done", count: done.length, color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <p className={`text-3xl font-semibold ${s.color}`}>{s.count}</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Task sections */}
        <div className="mt-16 space-y-8">
          {[
            { label: "Overdue", items: overdue, accent: "text-red-400" },
            { label: "Upcoming", items: upcoming, accent: "text-white" },
            { label: "Done", items: done, accent: "text-slate-500" },
          ].map(({ label, items, accent }) =>
            items.length > 0 ? (
              <div key={label}>
                <p className={`text-xs font-medium uppercase tracking-widest mb-3 ${accent}`}>
                  {label}
                </p>
                <div className="flex flex-col gap-2">
                  {items.map((task) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                    return (
                    <div
                      key={task.id}
                      className={`task-item flex items-start gap-3 ${isOverdue ? "overdue" : ""}`}
                    >
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                          task.status === "done"
                            ? "bg-green-500 border-green-500"
                            : isOverdue
                            ? "checkbox-overdue bg-red-500/20 border-red-500"
                            : "border-gray-600 hover:border-green-500"
                        }`}
                      >
                        {task.status === "done" && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-500" : "text-white"}`}>
                            {task.title}
                          </p>
                          {isOverdue && (
                            <span className="overdue-badge">
                              overdue
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>{task.description}</p>
                        )}
                        {task.grade_max != null && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                            Grade:{" "}
                            <span style={{ color: "var(--text-muted)" }}>
                              {task.grade_earned != null
                                ? `${task.grade_earned} / ${task.grade_max}`
                                : `— / ${task.grade_max}`}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.due_date && (
                          <span className={`text-xs ${isOverdue ? "text-red-400 font-semibold" : ""}`}
                            style={!isOverdue ? { color: "var(--text-dim)" } : undefined}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        <span className={priorityPill[task.priority]}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>

      {showModal && (
        <AddTaskModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            fetchTasks();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
