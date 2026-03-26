import { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  Textarea,
  Spinner,
  Toolbar,
  ToolbarButton,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Add24Regular,
  Delete24Regular,
  History24Regular,
} from "@fluentui/react-icons";
import { apiClient, type Message, type Session } from "../services/api";
import { MessageList } from "./MessageList";
import { FileUpload } from "./FileUpload";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

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
  sessionPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
    maxHeight: "220px",
    overflowY: "auto",
  },
  sessionPanelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  sessionItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    backgroundColor: "transparent",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  sessionItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  sessionTitle: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase200,
  },
  sessionDate: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
});

export function Chat() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Session list state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

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
          content: t.chat.errorGeneric,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, sessionId, getAccessToken, t.chat.errorGeneric]);

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

  // Load previous sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const token = await getAccessToken();
      const list = await apiClient.listSessions(token);
      setSessions(list);
    } catch (err) {
      console.error("Load sessions failed:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [getAccessToken]);

  const toggleSessions = useCallback(() => {
    const next = !showSessions;
    setShowSessions(next);
    if (next) loadSessions();
  }, [showSessions, loadSessions]);

  // Load a previous session
  const loadSession = useCallback(async (sid: string) => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const detail = await apiClient.getSession(sid, token);
      setSessionId(sid);
      setMessages(detail.messages);
      setShowSessions(false);
    } catch (err) {
      console.error("Load session failed:", err);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [getAccessToken]);

  // Delete a session
  const deleteSession = useCallback(async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getAccessToken();
      await apiClient.deleteSession(sid, token);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (sessionId === sid) handleNewChat();
    } catch (err) {
      console.error("Delete session failed:", err);
    }
  }, [getAccessToken, sessionId]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <Toolbar className={styles.toolbar} aria-label="Chat toolbar">
        <FileUpload />
        <ToolbarButton
          icon={<History24Regular />}
          onClick={toggleSessions}
          aria-label={t.chat.previousChats}
        >
          {t.chat.previousChats}
        </ToolbarButton>
        <ToolbarButton
          icon={<Add24Regular />}
          onClick={handleNewChat}
          aria-label={t.chat.newChat}
        >
          {t.chat.newChat}
        </ToolbarButton>
      </Toolbar>

      {/* Session list panel */}
      {showSessions && (
        <div className={styles.sessionPanel}>
          <div className={styles.sessionPanelHeader}>
            <Text size={300} weight="semibold">{t.chat.previousChats}</Text>
          </div>
          {sessionsLoading ? (
            <Text size={200}>{t.chat.loadingSessions}</Text>
          ) : sessions.length === 0 ? (
            <Text size={200} style={{ opacity: 0.6 }}>{t.chat.noSessions}</Text>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`${styles.sessionItem} ${sessionId === s.id ? styles.sessionItemActive : ""}`}
                onClick={() => loadSession(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && loadSession(s.id)}
              >
                <span className={styles.sessionTitle}>{s.title || "Untitled"}</span>
                <span className={styles.sessionDate}>
                  {new Date(s.updatedAt || s.createdAt).toLocaleDateString()}
                </span>
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  size="small"
                  onClick={(e) => deleteSession(s.id, e)}
                  aria-label={t.chat.deleteSession}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Message area */}
      <div className={styles.messageArea} role="log" aria-live="polite" aria-label="Chat messages">
        {isEmpty ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeTitle}>{t.chat.welcomeTitle}</div>
            <div className={styles.welcomeBody}>{t.chat.welcomeBody}</div>
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
          placeholder={t.chat.placeholder}
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
          aria-label={t.chat.send}
          shape="circular"
        />
      </div>
    </div>
  );
}
