import { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  Textarea,
  Spinner,
  Toolbar,
  ToolbarButton,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Add24Regular,
  Mic24Regular,
  MicOff24Regular,
  TasksApp24Regular,
} from "@fluentui/react-icons";
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk";
import { apiClient, type Message } from "../services/api";
import { MessageList } from "./MessageList";
import { FileUpload } from "./FileUpload";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";
import { useSharedSettings } from "../hooks/SettingsContext";

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

export function Chat({ loadSessionId, onSessionLoaded }: {
  loadSessionId?: string | null;
  onSessionLoaded?: () => void;
}) {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { t } = useI18n();
  const { settings } = useSharedSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showDecomposer, setShowDecomposer] = useState(false);
  const [decomposerGoal, setDecomposerGoal] = useState("");
  const [decomposerLoading, setDecomposerLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<speechSdk.SpeechRecognizer | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load session from history sidebar
  useEffect(() => {
    if (!loadSessionId) return;
    (async () => {
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        const detail = await apiClient.getSession(loadSessionId, token);
        setSessionId(loadSessionId);
        setMessages(detail.messages);
      } catch (err) {
        console.error("Load session failed:", err);
      } finally {
        setIsLoading(false);
        onSessionLoaded?.();
        textareaRef.current?.focus();
      }
    })();
  }, [loadSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const toggleMic = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      const rec = recognizerRef.current;
      if (rec) {
        recognizerRef.current = null;
        rec.stopContinuousRecognitionAsync(
          () => { try { rec.close(); } catch { /* */ } },
          () => { try { rec.close(); } catch { /* */ } },
        );
      }
      setIsRecording(false);
      return;
    }

    // Start recording
    try {
      setIsRecording(true);
      const token = await getAccessToken();
      const { authToken, region } = await apiClient.getSpeechToken(token);
      const speechConfig = speechSdk.SpeechConfig.fromAuthorizationToken(authToken, region);
      speechConfig.speechRecognitionLanguage = settings?.language === "en" ? "en-US"
        : settings?.language === "es" ? "es-ES"
        : settings?.language === "it" ? "it-IT"
        : settings?.language === "pt" ? "pt-BR"
        : settings?.language === "de" ? "de-DE"
        : settings?.language === "ja" ? "ja-JP"
        : "en-US";
      const audioConfig = speechSdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognized = (_s, e) => {
        if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech && e.result.text) {
          setInput((prev) => prev ? `${prev} ${e.result.text}` : e.result.text);
        }
      };

      recognizer.canceled = () => {
        setIsRecording(false);
        if (recognizerRef.current) {
          recognizerRef.current = null;
          try { recognizer.close(); } catch { /* */ }
        }
      };

      recognizer.sessionStopped = () => {
        setIsRecording(false);
        if (recognizerRef.current) {
          recognizerRef.current = null;
          try { recognizer.close(); } catch { /* */ }
        }
      };

      await recognizer.startContinuousRecognitionAsync();
    } catch (err) {
      console.error("Mic start failed:", err);
      setIsRecording(false);
    }
  }, [isRecording, getAccessToken, settings?.language]);

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
    setUploadedFiles([]);
    setShowDecomposer(false);
    setDecomposerGoal("");
    textareaRef.current?.focus();
  };

  const handleDecompose = useCallback(async () => {
    const goal = decomposerGoal.trim();
    if (!goal || decomposerLoading) return;
    setDecomposerLoading(true);
    try {
      const token = await getAccessToken();
      const res = await apiClient.decomposeTask(goal, "", token);
      const plan = res.task;
      // Format plan as a rich message in chat
      const totalMinutes = plan.steps.reduce((sum: number, s: { estimatedMinutes: number }) => sum + s.estimatedMinutes, 0);
      let content = `## 📋 Task Plan: ${plan.goal}\n\n`;
      content += `**${plan.steps.length} steps** · ~${totalMinutes} min total\n\n`;
      plan.steps.forEach((step: { title: string; estimatedMinutes: number; priority: string; focusTip?: string }, idx: number) => {
        content += `### ${idx + 1}. ${step.title}\n`;
        content += `⏱ ${step.estimatedMinutes} min · Priority: ${step.priority}\n`;
        if (step.focusTip) content += `💡 *${step.focusTip}*\n`;
        content += `\n`;
      });
      if (plan.explanation) {
        content += `---\n**Why this breakdown:** ${plan.explanation}\n`;
      }
      content += `\n✅ *Plan saved — view and track progress in the Task Decomposer page.*`;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: sessionId || "",
          role: "user",
          content: `Break down this goal: ${goal}`,
          createdAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          sessionId: sessionId || "",
          role: "assistant",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDecomposerGoal("");
      setShowDecomposer(false);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: sessionId || "",
          role: "assistant",
          content: "Something went wrong while breaking down the task. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setDecomposerLoading(false);
    }
  }, [decomposerGoal, decomposerLoading, getAccessToken, sessionId]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <Toolbar className={styles.toolbar} aria-label="Chat toolbar">
        <ToolbarButton
          icon={<Add24Regular />}
          onClick={handleNewChat}
          aria-label={t.chat.newChat}
        >
          {t.chat.newChat}
        </ToolbarButton>
        <ToolbarButton
          icon={<TasksApp24Regular />}
          onClick={() => setShowDecomposer(!showDecomposer)}
          aria-label="Break down a task"
        >
          Break it down
        </ToolbarButton>
      </Toolbar>

      {/* Inline task decomposer panel */}
      {showDecomposer && (
        <div style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
          padding: "12px 16px",
          backgroundColor: tokens.colorNeutralBackground3,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        }}>
          <Textarea
            style={{ flex: 1, minHeight: "40px" }}
            placeholder="Describe a goal… e.g. 'Write a 2-page essay on climate change'"
            value={decomposerGoal}
            onChange={(_, d) => setDecomposerGoal(d.value)}
            disabled={decomposerLoading}
            resize="none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleDecompose();
              }
            }}
          />
          <Button
            appearance="primary"
            onClick={handleDecompose}
            disabled={decomposerLoading || !decomposerGoal.trim()}
            icon={decomposerLoading ? <Spinner size="tiny" /> : <TasksApp24Regular />}
          >
            {decomposerLoading ? "Breaking down…" : "Break it down"}
          </Button>
          <Button
            appearance="subtle"
            onClick={() => { setShowDecomposer(false); setDecomposerGoal(""); }}
          >
            Cancel
          </Button>
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
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "6px" }}>
          {uploadedFiles.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              fontSize: "12px",
              color: tokens.colorNeutralForeground3,
            }}>
              {uploadedFiles.map((f, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: tokens.colorNeutralBackground4,
                    borderRadius: "4px",
                    padding: "2px 8px",
                  }}
                >
                  📎 {f}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <FileUpload onUploadComplete={(filename) => setUploadedFiles((prev) => [...prev, filename])} />
            <Tooltip content="Talk and I'll write it down for you" relationship="label" positioning="above">
              <Button
                appearance={isRecording ? "primary" : "subtle"}
                icon={isRecording ? <MicOff24Regular /> : <Mic24Regular />}
                onClick={toggleMic}
                disabled={isLoading}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
                shape="circular"
                style={{ flexShrink: 0, minWidth: "44px", height: "44px" }}
              />
            </Tooltip>
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
            <Tooltip content="Send your message" relationship="label" positioning="above">
              <Button
                className={styles.sendBtn}
                appearance="primary"
                icon={isLoading ? <Spinner size="tiny" /> : <Send24Regular />}
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label={t.chat.send}
                shape="circular"
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
