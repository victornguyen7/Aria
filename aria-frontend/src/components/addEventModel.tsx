import { useState } from "react";
import api from "../api/axios";
import type { Event } from "../types";

interface addEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (event: Event) => void;
}

export default function AddEventModal({ isOpen, onClose, onCreated }: addEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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
      const response = await api.post("/events", {
        title,
        description: description || undefined,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        end_time: endTime ? new Date(endTime).toISOString() : undefined
      });
      onCreated(response.data);
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
    } catch (error) {
      setError("Error creating event. Please try again.");
      console.error("Error creating event:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`modal ${isOpen ? "is-open" : ""}`}>
      <div className="modal-content animate-scale-in">
        <h2>Create Event</h2>
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
          />
          <input
            type="datetime-local"
            placeholder="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <input
            type="datetime-local"
            placeholder="End Time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Event"}
          </button>
        </form>
        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}