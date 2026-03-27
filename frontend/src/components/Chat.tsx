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
  Mic24Regular,
  MicOff24Regular,
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
    textareaRef.current?.focus();
  };

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
      </Toolbar>

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
        <FileUpload />
        <Button
          appearance={isRecording ? "primary" : "subtle"}
          icon={isRecording ? <MicOff24Regular /> : <Mic24Regular />}
          onClick={toggleMic}
          disabled={isLoading}
          aria-label={isRecording ? "Stop recording" : "Start voice input"}
          shape="circular"
          style={{ flexShrink: 0, minWidth: "44px", height: "44px" }}
        />
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
