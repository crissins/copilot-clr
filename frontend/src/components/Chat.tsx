import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient, type Message } from "../services/api";
import { MessageList } from "./MessageList";
import { useAuth } from "../hooks/useAuth";

export function Chat() {
  const { getAccessToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    // Optimistic: show user message immediately
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: sessionId || "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const token = await getAccessToken();
      const response = await apiClient.sendMessage(text, sessionId, token);

      if (!sessionId) {
        setSessionId(response.sessionId);
      }

      const assistantMsg: Message = {
        id: response.message.id,
        sessionId: response.sessionId,
        role: "assistant",
        content: response.message.content,
        createdAt: response.message.createdAt,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Send failed:", err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: sessionId || "",
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, sessionId, getAccessToken]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="chat-container">
      <div className="chat-toolbar">
        <button onClick={handleNewChat} className="btn-secondary">
          + New Chat
        </button>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />

      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          disabled={isLoading}
          rows={1}
          className="chat-input"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="btn-send"
          aria-label="Send message"
        >
          {isLoading ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
