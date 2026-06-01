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

const priorityColors = {
  high: "text-red-500 font-bold",
  medium: "text-red-500 font-bold",
  low: "text-red-500 font-bold",
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/"; return; }
    fetchTasks();
    fetchBriefing();
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
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 dashboard-container">

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-2xl font-semibold">Good morning ✦</h1>
            <p className="text-gray-400 text-sm mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/chat")}
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Chat with ARIA
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              + New task
            </button>
            <button
              onClick={() => { localStorage.removeItem("token"); window.location.href = "/"; }}
              className="text-sm text-gray-500 hover:text-white transition"
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
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                  A
                </div>
                <p className="text-indigo-400 text-sm font-medium">ARIA's daily briefing</p>
              </div>
              {loadingBriefing ? (
                <div className="flex flex-col gap-2">
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3" />
                </div>
              ) : briefing ? (
                <div className="text-gray-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{briefing.summary}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Could not load briefing.</p>
              )}
            </div>

            {/* Focus task */}
            {briefing?.focus_task && (
              <div className="dashboard-block">
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-2">
                  Today's focus
                </p>
                <p className="text-white font-medium">{briefing.focus_task.title}</p>
                {briefing.focus_task.description && (
                  <p className="text-gray-400 text-sm mt-1">{briefing.focus_task.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <span className={`text-xs font-semibold ${priorityColors[briefing.focus_task.priority]}`}>
                    {briefing.focus_task.priority}
                  </span>
                  {briefing.focus_task.due_date && (
                    <span className="text-xs text-gray-500">
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
              { label: "Done", count: done.length, color: "text-green-400" },
            ].map((s) => (
              <div key={s.label} className="dashboard-block">
                <p className={`text-3xl font-semibold ${s.color}`}>{s.count}</p>
                <p className="text-gray-500 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Task sections */}
        <div className="mt-16 space-y-8">
          {[
            { label: "Overdue", items: overdue, accent: "text-red-400" },
            { label: "Upcoming", items: upcoming, accent: "text-white" },
            { label: "Done", items: done, accent: "text-gray-500" },
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
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.due_date && (
                          <span className={`text-xs ${
                            isOverdue
                              ? "text-red-400 font-semibold"
                              : "text-gray-500"
                          }`}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
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
