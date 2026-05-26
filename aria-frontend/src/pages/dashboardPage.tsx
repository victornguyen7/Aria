import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import type { Task } from "../types";
import "../styles/dashboardPage.css";

const priorityColors: Record<string, string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const fetchTasks = async (signal?: AbortSignal) => {
    try {
      const res = await api.get("/tasks/", { signal });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      // Ignore aborted requests (component unmounted)
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;

      const status = err?.response?.status;
      // Only logout on auth failure
      if (status === 401 || status === 403) {
        logout();
        return;
      }

      // For transient errors, show empty state but keep logged in
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      logout();
      return;
    }

    const controller = new AbortController();
    fetchTasks(controller.signal);

    return () => controller.abort();
  }, []);

  const toggleStatus = async (task: Task) => {
    if (togglingId === task.id) return; // Prevent double-submit

    const nextStatus = task.status === "done" ? "todo" : "done";
    try {
      setTogglingId(task.id);
      await api.put(`/tasks/${task.id}`, { status: nextStatus });
      await fetchTasks();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) logout();
      // Otherwise silently fail and let user retry
    } finally {
      setTogglingId(null);
    }
  };

  const now = useMemo(() => new Date(), [tasks.length]); // Refresh reference after fetches

  const overdue = useMemo(
    () =>
      tasks.filter(
        (t) => t.due_date && new Date(t.due_date) < now && t.status !== "done"
      ),
    [tasks, now]
  );

  const upcoming = useMemo(
    () =>
      tasks.filter(
        (t) => t.status !== "done" && (!t.due_date || new Date(t.due_date) >= now)
      ),
    [tasks, now]
  );

  const done = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        {/* LEFT SIDEBAR */}
        <aside className="dashboard-sidebar-left">
          <div className="dashboard-header">
            <h1>Good morning ✦</h1>
            <p>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="dashboard-stats">
            <div className={`stat-card overdue`}>
              <div className="stat-label">Overdue</div>
              <p className="stat-count">{overdue.length}</p>
            </div>
            <div className={`stat-card upcoming`}>
              <div className="stat-label">Upcoming</div>
              <p className="stat-count">{upcoming.length}</p>
            </div>
            <div className={`stat-card done`}>
              <div className="stat-label">Done</div>
              <p className="stat-count">{done.length}</p>
            </div>
          </div>

          <button onClick={logout} className="logout-btn">
            Log out
          </button>
        </aside>

        {/* CENTER SECTION - TASKS */}
        <main className="dashboard-main">
          {/* Overdue Tasks */}
          {overdue.length > 0 && (
            <div className="tasks-container">
              <h2 className="tasks-section-title overdue">Overdue</h2>
              <ul className="task-list">
                {overdue.map((task) => (
                  <li key={task.id} className={`task-item ${task.status === "done" ? "done" : ""}`}>
                    <button
                      onClick={() => toggleStatus(task)}
                      disabled={togglingId === task.id}
                      className={`task-checkbox ${task.status === "done" ? "checked" : ""}`}
                    >
                      {task.status === "done" && (
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="task-content">
                      <p className="task-title">{task.title}</p>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                    </div>
                    <div className="task-meta">
                      {task.due_date && (
                        <span className="task-date">{formatDate(task.due_date)}</span>
                      )}
                      <span className={`task-priority ${priorityColors[task.priority] ?? "medium"}`}>
                        {task.priority ?? "medium"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upcoming Tasks */}
          {upcoming.length > 0 && (
            <div className="tasks-container">
              <h2 className="tasks-section-title upcoming">Upcoming</h2>
              <ul className="task-list">
                {upcoming.map((task) => (
                  <li key={task.id} className={`task-item ${task.status === "done" ? "done" : ""}`}>
                    <button
                      onClick={() => toggleStatus(task)}
                      disabled={togglingId === task.id}
                      className={`task-checkbox ${task.status === "done" ? "checked" : ""}`}
                    >
                      {task.status === "done" && (
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="task-content">
                      <p className="task-title">{task.title}</p>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                    </div>
                    <div className="task-meta">
                      {task.due_date && (
                        <span className="task-date">{formatDate(task.due_date)}</span>
                      )}
                      <span className={`task-priority ${priorityColors[task.priority] ?? "medium"}`}>
                        {task.priority ?? "medium"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Done Tasks */}
          {done.length > 0 && (
            <div className="tasks-container">
              <h2 className="tasks-section-title done">Done</h2>
              <ul className="task-list">
                {done.map((task) => (
                  <li key={task.id} className={`task-item ${task.status === "done" ? "done" : ""}`}>
                    <button
                      onClick={() => toggleStatus(task)}
                      disabled={togglingId === task.id}
                      className={`task-checkbox ${task.status === "done" ? "checked" : ""}`}
                    >
                      {task.status === "done" && (
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="task-content">
                      <p className="task-title">{task.title}</p>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                    </div>
                    <div className="task-meta">
                      {task.due_date && (
                        <span className="task-date">{formatDate(task.due_date)}</span>
                      )}
                      <span className={`task-priority ${priorityColors[task.priority] ?? "medium"}`}>
                        {task.priority ?? "medium"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overdue.length === 0 && upcoming.length === 0 && done.length === 0 && (
            <div className="tasks-container">
              <div className="empty-state">
                <p>No tasks yet. Start by creating one!</p>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="dashboard-sidebar-right">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Quick Info</h3>
            <div className="sidebar-content">
              <p>
                You have <strong>{overdue.length}</strong> overdue task{overdue.length !== 1 ? "s" : ""}.
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                Keep up with <strong>{upcoming.length}</strong> upcoming task{upcoming.length !== 1 ? "s" : ""}!
              </p>
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">Quick Filters</h3>
            <div className="quick-filters">
              <button className="filter-btn">My Tasks</button>
              <button className="filter-btn">This Week</button>
              <button className="filter-btn">This Month</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
