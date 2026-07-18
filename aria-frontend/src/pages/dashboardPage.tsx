import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Task } from "../types";
import type { Event } from "../types";
import AddTaskModal from "../components/addTaskModal";
import AddEventModal from "../components/addEventModel";
import TodayTimeline from "../components/todayTimeline";
import ReactMarkdown from "react-markdown";
import {
  BriefingSkeleton,
  FocusTaskSkeleton,
  TaskListSkeleton,
  SkeletonLine,
} from "../components/Skeleton";
import { useToast, ToastContainer } from "../components/Toast";
import "../styles/dashboardPage.css";

interface Conflict {
  type: "due_during_event" | "due_before_event" | "overdue_high_priority";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  task: { id: number; title: string; due_date: string; priority: string };
  event: { id: number; title: string; start_time: string; end_time: string } | null;
}

interface Briefing {
  summary: string;
  focus_task: Task | null;
  focus_event: Event | null;
  conflicts: Conflict[];
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
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const { errorToast, successToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/"; return; }

    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleConnected(true);
      window.history.replaceState({}, "", "/dashboard");
    }

    fetchTasks();
    fetchEvents();
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
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await api.get("/events/");
      setEvents(res.data);
    } catch {
      localStorage.removeItem("token");
      window.location.href = "/";
    } finally {
      setLoadingTasks(false);
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

  const syncCalendar = async () => {
    setCalendarSyncing(true);
    try {
      await api.get("/calendar/sync");
      fetchBriefing();
      successToast("Calendar synced successfully");
    } catch {
      errorToast("Calendar sync failed. Please try again.");
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div
        className="dashboard-container animate-fade-in"
        style={{ maxWidth: "64rem", margin: "0 auto", paddingTop: "2.5rem", paddingBottom: "2.5rem" }}
      >

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: "2.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>Good morning ✦</h1>
            <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center" style={{ gap: "0.75rem" }}>
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
            <button onClick={() => setShowModal(true)} className="btn-primary">
              + New task
            </button>
            <button onClick={() => setShowEventModal(true)} className="btn-outline">
              + New event
            </button>
            <button
              onClick={() => { localStorage.removeItem("token"); window.location.href = "/"; }}
              style={{ fontSize: "0.875rem", color: "var(--text-dim)", transition: "color 0.18s ease" }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3" style={{ gap: "1.5rem", marginBottom: "3rem" }}>
          {/* Left Column - Briefing & Focus */}
          <div className="col-span-2 flex flex-col" style={{ gap: "1.5rem" }}>

            {/* AI Briefing card */}
            {loadingBriefing ? (
              <BriefingSkeleton />
            ) : briefing ? (
              <div className="dashboard-block animate-slide-up">
                <div className="flex items-center" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 24, height: 24, borderRadius: "9999px", background: "var(--accent)", color: "var(--text)", fontSize: "0.75rem", fontWeight: 600 }}
                  >
                    A
                  </div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--info)" }}>ARIA's daily briefing</p>
                </div>
                <div className="prose prose-invert prose-sm" style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--text-muted)", maxWidth: "none" }}>
                  <ReactMarkdown>{briefing.summary}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>Could not load briefing.</p>
            )}

            {/* Focus task */}
            {loadingBriefing ? (
              <FocusTaskSkeleton />
            ) : briefing?.focus_task ? (
              <div className="dashboard-block animate-slide-up" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", color: "var(--info)" }}>
                  Today's focus
                </p>
                <p style={{ fontWeight: 500, color: "var(--text)" }}>{briefing.focus_task.title}</p>
                {briefing.focus_task.description && (
                  <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>{briefing.focus_task.description}</p>
                )}
                <div className="flex items-center" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
                  <span className={priorityPill[briefing.focus_task.priority]}>
                    {briefing.focus_task.priority}
                  </span>
                  {briefing.focus_task.due_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      Due {formatDate(briefing.focus_task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Conflicts */}
            {briefing && briefing.conflicts && briefing.conflicts.length > 0 && (
              <div className="dashboard-block">
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", color: "var(--text-muted)" }}>
                  ⚠ Conflicts
                </p>
                <div className="flex flex-col" style={{ gap: "0.5rem" }}>
                  {briefing.conflicts.map((c, i) => {
                    const severityColor: Record<string, string> = {
                      critical: "var(--error)",
                      high: "var(--warning)",
                      medium: "var(--text-muted)",
                      low: "var(--text-dim)",
                    };
                    const dot = severityColor[c.severity] ?? "var(--text-dim)";
                    return (
                      <div
                        key={i}
                        className="flex items-start"
                        style={{
                          gap: "0.75rem",
                          padding: "0.625rem 0.75rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                        }}
                      >
                        <span
                          className="flex-shrink-0"
                          style={{ width: 8, height: 8, marginTop: 6, borderRadius: "9999px", background: dot }}
                        />
                        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{c.message}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today's Timeline */}
            {briefing && (
              <TodayTimeline
                events={events.filter(
                  (e) => new Date(e.start_time).toDateString() === new Date().toDateString()
                )}
                tasks={tasks.filter((t) => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString())}
              />
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="flex flex-col" style={{ gap: "1rem" }}>
            {[
              { label: "Overdue", count: overdue.length, color: "var(--error)" },
              { label: "Upcoming", count: upcoming.length, color: "var(--info)" },
              { label: "Done", count: done.length, color: "var(--success)" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="stat-card animate-scale-in"
                style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}
              >
                <p style={{ color: s.color, fontSize: "1.875rem", fontWeight: 600, letterSpacing: "-0.02em" }}>{s.count}</p>
                <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--text-dim)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Task sections */}
        <div className="flex flex-col" style={{ marginTop: "4rem", gap: "2rem" }}>
          {loadingTasks ? (
            <div>
              <SkeletonLine className="mb-3" style={{ height: "0.75rem", width: "5rem" }} />
              <TaskListSkeleton />
            </div>
          ) : (
          <>
          {[
            { label: "Overdue", items: overdue, accent: "var(--error)" },
            { label: "Upcoming", items: upcoming, accent: "var(--text)" },
            { label: "Done", items: done, accent: "var(--text-dim)" },
          ].map(({ label, items, accent }) =>
            items.length > 0 ? (
              <div key={label}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem", color: accent }}>
                  {label}
                </p>
                <div className="flex flex-col" style={{ gap: "0.5rem" }}>
                  {items.map((task) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                    return (
                    <div
                      key={task.id}
                      className={`task-item flex items-start gap-3 cursor-default ${isOverdue ? "overdue" : ""}`}
                    >
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`task-checkbox mt-0.5 ${
                          task.status === "done" ? "done" : isOverdue ? "is-overdue" : ""
                        }`}
                      >
                        {task.status === "done" && (
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${task.status === "done" ? "line-through" : ""}`}
                            style={{ color: task.status === "done" ? "var(--text-dim)" : "var(--text)" }}
                          >
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
                          <span
                            className="text-xs"
                            style={{ color: isOverdue ? "var(--error)" : "var(--text-dim)", fontWeight: isOverdue ? 600 : 400 }}
                          >
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        <span className={priorityPill[task.priority]}>
                          {task.priority}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm("Are you sure you want to delete this task?")) return;
                            try {
                              await api.delete(`/tasks/${task.id}`);
                              fetchTasks();
                              fetchBriefing();
                              successToast("Task deleted successfully");
                            } catch {
                              errorToast("Failed to delete task. Please try again.");
                            }
                          }}
                          className="task-delete-btn"
                        >
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
          </>
          )}
        </div>
      </div>

      {showModal && (
        <AddTaskModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            fetchTasks();
            fetchBriefing();
            setShowModal(false);
            successToast("Task created successfully");
          }}
        />
      )}

      {showEventModal && (
        <AddEventModal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          onCreated={() => {
            fetchEvents();
            fetchBriefing();
            setShowEventModal(false);
            successToast("Event created successfully");
          }}
        />
      )}

      <ToastContainer />
    </div>
  );
}
