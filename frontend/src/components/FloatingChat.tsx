/**
 * FloatingChat — Mini chat window that appears when Immersive Reader is open.
 *
 * Listens for "immersive-reader-opened" / "immersive-reader-closed" global events.
 * Renders a floating action button (FAB) in the bottom-right corner. Clicking it
 * expands a compact chat panel so the user can keep talking to the bot while reading.
 *
 * Uses a very high z-index (100001) to float above the IR SDK overlay (~1000).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  Textarea,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Chat24Regular,
  Dismiss24Regular,
  Send24Regular,
  ChevronDown24Regular,
} from "@fluentui/react-icons";
import { apiClient, type Message } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useImmersiveReader } from "../hooks/useImmersiveReader";

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  fab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 100001,
    width: "56px",
    height: "56px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  panel: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 100001,
    width: "360px",
    height: "440px",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius("12px"),
    boxShadow: tokens.shadow28,
    ...shorthands.overflow("hidden"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("10px", "14px"),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    flexShrink: 0,
  },
  headerActions: {
    display: "flex",
    gap: "4px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    ...shorthands.padding("10px", "12px"),
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: "center",
    ...shorthands.padding("16px"),
  },
  bubble: {
    maxWidth: "85%",
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius("10px"),
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    wordBreak: "break-word",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "6px",
    ...shorthands.padding("8px", "10px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    resize: "none",
    minHeight: "36px",
    maxHeight: "80px",
    fontSize: tokens.fontSizeBase200,
  },
});

// ── Component ───────────────────────────────────────────────────────────────

export function FloatingChat() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { launch: launchIR, close: closeIR } = useImmersiveReader();
  const [irOpen, setIrOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for IR lifecycle events
  useEffect(() => {
    const onOpen = () => setIrOpen(true);
    const onClose = () => {
      setIrOpen(false);
      setExpanded(false);
    };
    window.addEventListener("immersive-reader-opened", onOpen);
    window.addEventListener("immersive-reader-closed", onClose);
    return () => {
      window.removeEventListener("immersive-reader-opened", onOpen);
      window.removeEventListener("immersive-reader-closed", onClose);
    };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when expanded
  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

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

      const assistantContent = response.message.content;

      setMessages((prev) => [
        ...prev,
        {
          id: response.message.id,
          sessionId: response.sessionId,
          role: "assistant",
          content: assistantContent,
          createdAt: response.message.createdAt,
        },
      ]);

      // Push the assistant's answer into the Immersive Reader with auto read-aloud
      try {
        closeIR();
        await launchIR("Copilot CLR Response", assistantContent);
      } catch {
        // IR relaunch is best-effort; don't block the chat flow
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: sessionId || "",
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, sessionId, getAccessToken, closeIR, launchIR]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render anything when IR is not open
  if (!irOpen) return null;

  // Collapsed state — show FAB
  if (!expanded) {
    return (
      <button
        className={styles.fab}
        onClick={() => setExpanded(true)}
        aria-label="Open chat while reading"
        title="Chat with assistant"
      >
        <Chat24Regular />
      </button>
    );
  }

  // Expanded state — show mini chat panel
  return (
    <div className={styles.panel} role="complementary" aria-label="Floating chat">
      {/* Header */}
      <div className={styles.header}>
        <span>💬 Chat</span>
        <div className={styles.headerActions}>
          <Button
            appearance="subtle"
            icon={<ChevronDown24Regular />}
            size="small"
            onClick={() => setExpanded(false)}
            aria-label="Minimize chat"
            style={{ color: "inherit" }}
          />
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            size="small"
            onClick={() => { setExpanded(false); }}
            aria-label="Close chat"
            style={{ color: "inherit" }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            Ask me anything while you read!<br />
            I'm here to help explain or discuss the content.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.assistantBubble}`}
            >
              {msg.content}
            </div>
          ))
        )}
        {isLoading && (
          <div className={`${styles.bubble} ${styles.assistantBubble}`}>
            <Spinner size="tiny" label="Thinking…" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputRow}>
        <Textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={(_, d) => setInput(d.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          disabled={isLoading}
          resize="none"
          aria-label="Chat message input"
        />
        <Button
          appearance="primary"
          icon={isLoading ? <Spinner size="tiny" /> : <Send24Regular />}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          shape="circular"
          size="small"
          style={{ minWidth: "36px", height: "36px" }}
        />
      </div>
    </div>
  );
}
