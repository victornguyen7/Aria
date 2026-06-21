interface Event {
  id: string;
  title: string;
  start_time: string | Date;
  end_time?: string | Date;
}

interface Task {
  id: string;
  title: string;
  due_date?: string | Date;
  priority: string;
  status: string;
}

interface Props {
  events: Event[];
  tasks: Task[];
}

export default function TodayTimeline({ events, tasks }: Props) {
  const now = new Date();

  // Combine events and due tasks into timeline items
  const items = [
    ...events.map((e) => ({
      id: `event-${e.id}`,
      title: e.title,
      time: new Date(e.start_time),
      endTime: e.end_time ? new Date(e.end_time) : null,
      type: "event" as const,
    })),
    ...tasks
      .filter((t) => t.due_date && new Date(t.due_date).toDateString() === now.toDateString())
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        time: new Date(t.due_date!),
        endTime: null,
        type: "task" as const,
        priority: t.priority,
        status: t.status,
      })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const isPast = (date: Date) => date < now;

  if (items.length === 0) {
    return (
      <div className="dashboard-block text-center">
        <p className="text-gray-500 text-sm">Nothing scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-block">
      <h3 className="text-sm font-semibold text-white mb-4">Today's Timeline</h3>
      <div className="flex flex-col gap-0">
        {items.map((item, i) => (
          <div key={item.id} className="flex gap-4">
            {/* Time column */}
            <div className="w-16 flex-shrink-0 text-right">
              <p className={`text-xs pt-0.5 ${isPast(item.time) ? "text-gray-600" : "text-gray-400"}`}>
                {formatTime(item.time)}
              </p>
            </div>

            {/* Line + dot column */}
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                item.type === "event"
                  ? isPast(item.time) ? "bg-gray-700" : "bg-indigo-500"
                  : item.priority === "high"
                  ? isPast(item.time) ? "bg-gray-700" : "bg-red-500"
                  : isPast(item.time) ? "bg-gray-700" : "bg-yellow-500"
              }`} />
              {i < items.length - 1 && (
                <div className="w-px flex-1 bg-gray-800 my-1 min-h-6" />
              )}
            </div>

            {/* Content column */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${
                  isPast(item.time) ? "text-gray-600" : "text-white"
                } ${item.type === "task" && item.status === "done" ? "line-through" : ""}`}>
                  {item.title}
                </p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  item.type === "event"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "bg-gray-800 text-gray-400"
                }`}>
                  {item.type === "event" ? "event" : "due"}
                </span>
              </div>
              {item.type === "event" && item.endTime && (
                <p className="text-xs text-gray-600 mt-0.5">
                  until {formatTime(item.endTime)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
