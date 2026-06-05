import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/chatPage.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm ARIA, your personal academic assistant. Ask me anything about your tasks, schedule, or what you should focus on today.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Token check — redirect to login if JWT is missing
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("No authentication token found. Redirecting to login...");
      navigate("/");
      return;
    }

    const userMessage: Message = { role: "user", content: input };
    
    // Filter empty messages from history — AI doesn't see blank assistant placeholder
    const history = messages
      .filter((msg) => msg.content.trim() !== "")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    // Add user message and loading placeholder
    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      { role: "assistant", content: "" },
    ]);
    
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: input, history }),
        }
      );

      // Token check — handle 401 Unauthorized (token expired/invalid mid-session)
      if (response.status === 401) {
        console.warn("Authentication token expired. Redirecting to login...");
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body!.getReader();
      // stream: true for proper multi-byte character handling
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Buffer handling — accumulate partial chunks with stream: true for multi-byte chars
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove "data: " prefix
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + parsed.content,
                  };
                  return updated;
                });
              }
            } catch (e) {
              console.error("Error parsing message chunk:", e, "Data:", data);
            }
          }
        }
      }

      // Process any remaining buffer (final chunk)
      if (buffer.trim().startsWith("data: ")) {
        const data = buffer.trim().slice(6);
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...lastMessage,
                  content: lastMessage.content + parsed.content,
                };
                return updated;
              });
            }
          } catch (e) {
            console.error("Error parsing final message chunk:", e, "Data:", data);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Sorry, something went wrong. Please try again. Make sure you're logged in and the API is running.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-page-container">
      <button onClick={() => navigate("/dashboard")} className="return-btn-top-left">
        ← Dashboard
      </button>

      <div className="chat-header">
        <h1>ARIA - Academic Assistant</h1>
        <p>Your AI-powered study companion</p>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`message message-${msg.role} animate-slide-up`}
            style={{ animationDelay: `${idx * 0.03}s`, animationFillMode: "both" }}
          >
            <div className="message-avatar">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="message-content">
              <p>{msg.content || (loading && idx === messages.length - 1 ? "Thinking..." : "")}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ARIA anything about your tasks, schedule, or study tips... (Shift+Enter for new line)"
            disabled={loading}
            className="chat-textarea"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="send-button"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
