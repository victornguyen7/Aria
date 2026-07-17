import { useState } from "react";
import api from "../api/axios";
import type { Task } from "../types";

interface addTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export default function AddTaskModal({ isOpen, onClose, onCreated }: addTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    if (!title) {
      setError("Title is required");
      return;
    }
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/tasks", {
        title,
        description: description || undefined,
        due_date: dueDate
          ? new Date(`${dueDate}T${dueTime || "23:59"}:00`).toISOString()
          : undefined,
        priority,
        status: "todo"
      });
      onCreated(response.data);
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setPriority("medium");
    } catch (error) {
      setError("Error creating task. Please try again.");
      console.error("Error creating task:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`modal ${isOpen ? "is-open" : ""}`}>
      <div className="modal-content animate-scale-in">
        <h2>Create Task</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Task"}
          </button>
        </form>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
