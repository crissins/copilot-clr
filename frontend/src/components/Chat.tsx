import { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  Textarea,
  Spinner,
  Toolbar,
  ToolbarButton,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Add24Regular,
  DocumentArrowUp24Regular,
} from "@fluentui/react-icons";
import { apiClient, type Message } from "../services/api";
import { MessageList } from "./MessageList";
import { FileUpload } from "./FileUpload";
import { useAuth } from "../hooks/useAuth";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    maxWidth: "800px",
    margin: "0 auto",
    width: "100%",
    height: "100%",
  },
  toolbar: {
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
    justifyContent: "flex-end",
    ...shorthands.padding("4px", "12px"),
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    ...shorthands.padding("16px"),
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  textarea: {
    flex: 1,
    resize: "none",
    minHeight: "44px",
    maxHeight: "120px",
  },
  sendBtn: {
    flexShrink: 0,
    minWidth: "44px",
    height: "44px",
  },
  welcome: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    gap: "12px",
    ...shorthands.padding("48px", "24px"),
  },
  welcomeTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "8px",
  },
  welcomeBody: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "480px",
  },
});

export function Chat() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

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

      if (!sessionId) setSessionId(response.sessionId);

      setMessages((prev) => [
        ...prev,
        {
          id: response.message.id,
          sessionId: response.sessionId,
          role: "assistant",
          content: response.message.content,
          createdAt: response.message.createdAt,
        },
      ]);
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: sessionId || "",
          role: "assistant",
          content: "Something went wrong. Please try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, sessionId, getAccessToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <Toolbar className={styles.toolbar} aria-label="Chat toolbar">
        <FileUpload />
        <ToolbarButton
          icon={<Add24Regular />}
          onClick={handleNewChat}
          aria-label="Start new chat"
        >
          New Chat
        </ToolbarButton>
      </Toolbar>

      {/* Message area */}
      <div className={styles.messageArea} role="log" aria-live="polite" aria-label="Chat messages">
        {isEmpty ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeTitle}>Welcome to CognitiveClear</div>
            <div className={styles.welcomeBody}>
              I help reduce cognitive load by breaking down complex tasks,
              simplifying documents, and adapting to your accessibility
              preferences. Try asking me to simplify something, or upload a
              document to chat with it.
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            sessionId={sessionId}
          />
        )}
      </div>

      {/* Input row */}
      <div className={styles.inputRow}>
        <Textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={(_, d) => setInput(d.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          disabled={isLoading}
          resize="none"
          aria-label="Message input"
        />
        <Button
          className={styles.sendBtn}
          appearance="primary"
          icon={isLoading ? <Spinner size="tiny" /> : <Send24Regular />}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          shape="circular"
        />
      </div>
    </div>
  );
}
