/**
 * Feature 7 — Speech Assistant (Copilot-style, Mental Health & Cognition informed)
 *
 * Design principles applied from Microsoft Inclusive Design guidance:
 *  - AI Assistants: suggestion chips, positive feedback, user stays in control
 *  - Timers: count-UP focus timer, pause, gentle metaphor, hide option
 *  - Content: scannable with headings, bullet points, clear next steps
 *  - Color: cool/muted palette, no alarming reds
 *  - Loading: explain what's happening, estimated progress
 *  - Wayfinding: always clear what options exist, single primary action
 *  - Pop-ups: non-intrusive calm notifications
 *  - Motion: gentle voice visualizer, no jarring animations
 *  - Confirmation: celebrate completed tasks
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Text,
  Spinner,
  Textarea,
  Avatar,
  Badge,
  Tooltip,
  Divider,
  Select,
  Label,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Mic24Regular,
  MicOff24Regular,
  Speaker224Regular,
  Stop24Regular,
  ArrowReset24Regular,
  Send24Regular,
  Timer24Regular,
  BotSparkle24Regular,
  Person24Regular,
  Keyboard24Regular,
  Settings24Regular,
  ImmersiveReader24Regular,
} from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk";
import { apiClient } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useImmersiveReader } from "../../hooks/useImmersiveReader";
import { ImmersiveReaderSettingsPanel } from "../../components/ImmersiveReaderSettingsPanel";
import { SuggestionChips } from "./SuggestionChips";
import { FocusTimer } from "./FocusTimer";
import { TaskBreakdown, type TaskStep } from "./TaskBreakdown";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { CalmNotification } from "./CalmNotification";

// ── Types ──────────────────────────────────────────────────────────────────

interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  tasks?: TaskStep[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Try to extract structured tasks from assistant markdown response */
function extractTasks(text: string): TaskStep[] | undefined {
  // Matches numbered lists like "1. **Title** — detail (~5 min)" or "1. Title (5 min)"
  const stepRegex =
    /^\s*(\d+)\.\s+\*{0,2}(.+?)\*{0,2}\s*(?:[-—–]\s*(.+?))?\s*(?:\(~?(\d+\s*min(?:utes?)?)\))?\s*$/gm;
  const steps: TaskStep[] = [];
  let match;
  while ((match = stepRegex.exec(text)) !== null) {
    steps.push({
      id: crypto.randomUUID(),
      title: match[2].trim(),
      detail: match[3]?.trim(),
      timeEstimate: match[4]?.trim(),
      completed: false,
    });
  }
  return steps.length >= 2 ? steps : undefined;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // Copilot-style centered content column
  contentColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    maxWidth: "960px",
    width: "100%",
    margin: "0 auto",
    overflow: "hidden",
  },

  // ── Welcome / empty state ──
  welcomeArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    ...shorthands.padding("32px", "24px"),
    textAlign: "center",
  },
  welcomeIcon: {
    width: "72px",
    height: "72px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "32px",
  },
  welcomeTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  welcomeBody: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    color: tokens.colorNeutralForeground3,
    maxWidth: "480px",
  },

  // ── Conversation area ──
  conversationArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    ...shorthands.padding("16px", "16px", "8px"),
    scrollBehavior: "smooth",
  },

  // ── Message bubbles ──
  messageRow: {
    display: "flex",
    gap: "10px",
    maxWidth: "88%",
    animationDuration: "300ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "translateY(8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
  },
  userRow: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  assistantRow: {
    alignSelf: "flex-start",
  },
  bubbleContent: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  bubble: {
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    lineHeight: tokens.lineHeightBase400,
    wordBreak: "break-word",
    fontSize: tokens.fontSizeBase300,
  },
  userBubble: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    borderBottomRightRadius: tokens.borderRadiusSmall,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    borderBottomLeftRadius: tokens.borderRadiusSmall,
    // Markdown styling
    "& p": { ...shorthands.margin("0", "0", "8px", "0") },
    "& p:last-child": { marginBottom: "0" },
    "& ul, & ol": { paddingLeft: "20px", marginTop: "4px", marginBottom: "8px" },
    "& li": { marginBottom: "2px" },
    "& h1, & h2, & h3": { marginTop: "12px", marginBottom: "4px" },
    "& code": {
      backgroundColor: tokens.colorNeutralBackground1,
      ...shorthands.padding("1px", "4px"),
      ...shorthands.borderRadius(tokens.borderRadiusSmall),
      fontSize: "0.9em",
      fontFamily: "monospace",
    },
    "& pre": {
      backgroundColor: tokens.colorNeutralBackground1,
      ...shorthands.padding("10px"),
      ...shorthands.borderRadius(tokens.borderRadiusMedium),
      overflowX: "auto",
    },
    "& strong": { fontWeight: tokens.fontWeightSemibold },
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  time: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  assistantActions: {
    display: "flex",
    gap: "2px",
    marginLeft: "auto",
  },

  // ── Task breakdown inline ──
  taskArea: {
    ...shorthands.padding("8px", "0", "4px", "42px"),
  },

  // ── Notification bar ──
  notificationBar: {
    ...shorthands.padding("0", "16px"),
  },

  // ── Thinking indicator ──
  thinkingRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    alignSelf: "flex-start",
    ...shorthands.padding("8px", "0"),
  },
  thinkingBubble: {
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorNeutralBackground3,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    borderBottomLeftRadius: tokens.borderRadiusSmall,
  },
  thinkingText: {
    fontStyle: "italic",
  },

  // ── Bottom input / controls area ──
  bottomArea: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    ...shorthands.padding("12px", "16px", "16px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
  },

  // ── Input row (Copilot-style) ──
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    ...shorthands.padding("4px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    transition: "border-color 200ms ease",
    ":focus-within": {
      ...shorthands.border("1px", "solid", tokens.colorBrandStroke1),
      boxShadow: `0 0 0 1px ${tokens.colorBrandStroke1}`,
    },
  },
  textarea: {
    flex: 1,
    resize: "none",
    minHeight: "40px",
    maxHeight: "100px",
    ...shorthands.border("none"),
    backgroundColor: "transparent",
    fontSize: tokens.fontSizeBase300,
    "& textarea": {
      ...shorthands.border("none"),
      ...shorthands.padding("8px", "12px"),
    },
  },
  inputActions: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    ...shorthands.padding("4px"),
  },

  // ── Control bar (voice) ──
  controlBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  recordBtn: {
    width: "56px",
    height: "56px",
    ...shorthands.borderRadius("50%"),
    transition: "all 200ms ease",
  },
  recordBtnActive: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
  },
  controlHelper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  // ── Status text ──
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "24px",
    color: tokens.colorNeutralForeground3,
  },

  // ── Focus timer sidebar ──
  timerContainer: {
    display: "flex",
    justifyContent: "center",
    ...shorthands.padding("8px", "0"),
  },

  // ── Mode toggle row ──
  modeToggle: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    ...shorthands.padding("4px", "0"),
  },
  settingsPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    flexWrap: "wrap",
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    animationDuration: "200ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, maxHeight: "0px" },
      to: { opacity: 1, maxHeight: "60px" },
    },
  },
  settingsField: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
});

// ── Component ──────────────────────────────────────────────────────────────

export function Feature7Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  // Conversation state
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("Tap the microphone or type a message to begin.");
  const [textInput, setTextInput] = useState("");

  // UI state
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [showTimer, setShowTimer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "encouragement" | "tip" } | null>(null);
  const [taskSteps, setTaskSteps] = useState<Map<string, TaskStep[]>>(new Map());

  // Speech settings
  const [voiceName, setVoiceName] = useState("en-US-JennyNeural");
  const [speechRate, setSpeechRate] = useState("slow");

  // Immersive Reader
  const { settings: irSettings, updateSettings: updateIRSettings, launch: launchIR, isOpen: irIsOpen } = useImmersiveReader();
  const [showIRSettings, setShowIRSettings] = useState(false);

  // Refs
  const recognizerRef = useRef<speechSdk.SpeechRecognizer | null>(null);
  const transcriptRef = useRef<string>("");
  const transcriptSentRef = useRef<boolean>(false);
  const backendTokenRef = useRef<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref to always hold the latest processTranscription, avoiding stale closures
  // in startRecording/stopRecording callbacks.
  const processTranscriptionRef = useRef<(text: string, token: string | null) => Promise<void>>();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // ── STT via browser Speech SDK ─────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setStatus("Connecting to speech service...");
      transcriptRef.current = "";
      transcriptSentRef.current = false;

      const backendToken = await getAccessToken();
      backendTokenRef.current = backendToken;
      const { authToken, region } = await apiClient.getSpeechToken(backendToken);

      const speechConfig = speechSdk.SpeechConfig.fromAuthorizationToken(
        authToken,
        region
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = speechSdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // Accumulate final recognized phrases
      recognizer.recognized = (_sender, e) => {
        if (
          e.result.reason === speechSdk.ResultReason.RecognizedSpeech &&
          e.result.text
        ) {
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current} ${e.result.text}`
            : e.result.text;
          setStatus(`Heard: "${transcriptRef.current.slice(-80)}..." — tap stop when done.`);
        }
      };

      // Show interim feedback while speaking
      recognizer.recognizing = (_sender, e) => {
        if (e.result.text) {
          const soFar = transcriptRef.current
            ? `${transcriptRef.current} ${e.result.text}`
            : e.result.text;
          setStatus(`Listening: "${soFar.slice(-80)}..."`);
        }
      };

      recognizer.canceled = (_sender, e) => {
        if (e.reason === speechSdk.CancellationReason.Error) {
          console.error("Speech recognition canceled:", e.errorDetails);
          if (recognizerRef.current) {
            recognizerRef.current = null;
            try { recognizer.close(); } catch { /* already disposed */ }
          }
          setIsRecording(false);
          const details = e.errorDetails || "";
          if (details.includes("1006") || details.includes("WebSocket")) {
            setStatus("Couldn't connect to the speech service. Check your connection and try again.");
          } else if (details.includes("401") || details.includes("Unauthorized")) {
            setStatus("Speech authorization expired. Please try again.");
          } else {
            setStatus("Something interrupted the connection. Tap the microphone to try again.");
          }
        } else {
          // EndOfStream or other non-error cancellation — clean up
          if (recognizerRef.current) {
            recognizerRef.current = null;
            try { recognizer.close(); } catch { /* already disposed */ }
          }
          setIsRecording(false);
          const text = transcriptRef.current.trim();
          if (text && !transcriptSentRef.current) {
            transcriptSentRef.current = true;
            processTranscriptionRef.current?.(text, backendTokenRef.current);
          } else if (!text) {
            setStatus("I didn't catch that. No worries — try again when you're ready.");
          }
        }
      };

      recognizer.sessionStopped = () => {
        // Session ended (e.g. service timeout) — process whatever we have
        if (recognizerRef.current) {
          recognizerRef.current = null;
          try { recognizer.close(); } catch { /* already disposed */ }
        }
        setIsRecording(false);
        const text = transcriptRef.current.trim();
        if (text && !transcriptSentRef.current) {
          transcriptSentRef.current = true;
          processTranscriptionRef.current?.(text, backendTokenRef.current);
        } else if (!text) {
          setStatus("I didn't catch that. No worries — try again when you're ready.");
        }
      };

      await recognizer.startContinuousRecognitionAsync();
      setStatus("Listening... speak naturally, then tap stop when you're done.");
    } catch (err: unknown) {
      setIsRecording(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowedError") || msg.includes("getUserMedia")) {
        setStatus("Microphone access is needed. Check your browser permissions and try again.");
      } else if (msg.includes("503") || msg.includes("Speech token") || msg.includes("502")) {
        setStatus("The speech service is temporarily unavailable. Please try again in a moment.");
      } else {
        setStatus(`Something went wrong: ${msg}. Tap the microphone to try again.`);
      }
    }
  }, [getAccessToken]);

  const stopRecording = useCallback(() => {
    const rec = recognizerRef.current;
    if (rec) {
      recognizerRef.current = null;
      rec.stopContinuousRecognitionAsync(
        () => {
          try { rec.close(); } catch { /* already disposed */ }
          setIsRecording(false);
          const text = transcriptRef.current.trim();
          if (text && !transcriptSentRef.current) {
            transcriptSentRef.current = true;
            processTranscriptionRef.current?.(text, backendTokenRef.current);
          } else if (!text) {
            setStatus("I didn't catch that. No worries — try again when you're ready.");
          }
        },
        (err) => {
          console.error("Stop recognition error:", err);
          try { rec.close(); } catch { /* already disposed */ }
          setIsRecording(false);
          const text = transcriptRef.current.trim();
          if (text && !transcriptSentRef.current) {
            transcriptSentRef.current = true;
            processTranscriptionRef.current?.(text, backendTokenRef.current);
          } else if (!text) {
            setStatus("I didn't catch that. No worries — try again when you're ready.");
          }
        }
      );
    } else {
      setIsRecording(false);
    }
  }, []);

  // ── Send text message ──────────────────────────────────────────────────

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isProcessing) return;
    setTextInput("");
    const token = await getAccessToken();
    await processTranscription(text, token);
    textareaRef.current?.focus();
  }, [textInput, isProcessing, getAccessToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  // ── Process user input → Agent → TTS ───────────────────────────────────

  const processTranscription = useCallback(
    async (text: string, token: string | null) => {
      setIsProcessing(true);

      const userTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: new Date().toISOString(),
      };
      setConversation((prev) => [...prev, userTurn]);
      scrollToBottom();

      setStatus("Taking a moment to think clearly...");
      try {
        const agentResponse = await apiClient.speechChat(text, sessionId, token);

        // Track session for conversation continuity
        if (agentResponse.sessionId && agentResponse.sessionId !== sessionId) {
          setSessionId(agentResponse.sessionId);
        }

        const assistantText = agentResponse.message.content;
        const tasks = extractTasks(assistantText);

        const assistantTurn: ConversationTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: assistantText,
          timestamp: new Date().toISOString(),
          tasks,
        };
        setConversation((prev) => [...prev, assistantTurn]);

        // Store tasks for interactive tracking
        if (tasks) {
          setTaskSteps((prev) => new Map(prev).set(assistantTurn.id, tasks));
        }

        scrollToBottom();

        // Play TTS automatically in both modes
        setStatus("Reading the response aloud...");
        if (agentResponse.audio_base64) {
          await playBase64Audio(agentResponse.audio_base64);
        } else {
          await speakText(assistantText, token, voiceName, speechRate);
        }

        setStatus("Ready for your next question. Take your time.");

        // Occasional encouragement (every 4 messages)
        const turnCount = conversation.length + 2;
        if (turnCount > 0 && turnCount % 4 === 0) {
          setNotification({
            message: "You're making great progress. Keep going at your own pace!",
            type: "encouragement",
          });
        }
      } catch {
        setStatus("That didn't work out. No worries — please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [scrollToBottom, sessionId, inputMode, conversation.length, voiceName, speechRate],
  );

  // Keep the ref in sync so voice callbacks always call the latest version
  useEffect(() => {
    processTranscriptionRef.current = processTranscription;
  }, [processTranscription]);

  // ── Audio playback ────────────────────────────────────────────────────

  const playBase64Audio = useCallback(async (base64Audio: string) => {
    try {
      setIsSpeaking(true);
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.play();
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const speakText = useCallback(async (text: string, token: string | null, voice?: string, rate?: string) => {
    try {
      setIsSpeaking(true);
      const audioBlob = await apiClient.speechSynthesize(text, token, voice, rate);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.play();
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const replayTurn = useCallback(
    async (text: string) => {
      if (isSpeaking || isProcessing) return;
      const token = await getAccessToken();
      setStatus("Reading aloud...");
      await speakText(text, token, voiceName, speechRate);
      setStatus("Ready for your next question. Take your time.");
    },
    [isSpeaking, isProcessing, getAccessToken, speakText, voiceName, speechRate],
  );

  const clearConversation = useCallback(() => {
    setConversation([]);
    setSessionId(null);
    setTaskSteps(new Map());
    setStatus("Tap the microphone or type a message to begin.");
    stopSpeaking();
    setNotification(null);
  }, [stopSpeaking]);

  const handleSuggestion = useCallback(
    async (prompt: string) => {
      if (isProcessing) return;
      const token = await getAccessToken();
      await processTranscription(prompt, token);
    },
    [isProcessing, getAccessToken, processTranscription],
  );

  const handleToggleTask = useCallback(
    (turnId: string, stepId: string) => {
      setTaskSteps((prev) => {
        const updated = new Map(prev);
        const steps = updated.get(turnId);
        if (!steps) return prev;
        const newSteps = steps.map((s) =>
          s.id === stepId ? { ...s, completed: !s.completed } : s
        );
        updated.set(turnId, newSteps);

        // Check if all done — show encouragement
        if (newSteps.every((s) => s.completed)) {
          setNotification({
            message: "All steps completed! Wonderful job.",
            type: "encouragement",
          });
        }
        return updated;
      });
    },
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────

  const disabled = isProcessing || isSpeaking;
  const isEmpty = conversation.length === 0 && !isProcessing;

  return (
    <div className={styles.page}>
      <div className={styles.contentColumn}>
        {/* ── Empty / welcome state ──────────────────────────────────── */}
        {isEmpty ? (
          <div className={styles.welcomeArea}>
            <div className={styles.welcomeIcon}>
              <BotSparkle24Regular />
            </div>
            <Text className={styles.welcomeTitle}>Speech Assistant</Text>
            <Text className={styles.welcomeBody}>
              I'm here to help simplify things. Speak or type your question and
              I'll break it down into clear, manageable steps. There's no rush
              — go at your own pace.
            </Text>
            <SuggestionChips onSelect={handleSuggestion} disabled={disabled} />
          </div>
        ) : (
          <>
            {/* ── Conversation ─────────────────────────────────────────── */}
            <div className={styles.conversationArea}>
              {conversation.map((turn) => (
                <div key={turn.id}>
                  {/* Message bubble */}
                  <div
                    className={mergeClasses(
                      styles.messageRow,
                      turn.role === "user" ? styles.userRow : styles.assistantRow
                    )}
                  >
                    <Avatar
                      icon={
                        turn.role === "user" ? (
                          <Person24Regular />
                        ) : (
                          <BotSparkle24Regular />
                        )
                      }
                      color={turn.role === "user" ? "dark-red" : "brand"}
                      size={32}
                      aria-hidden
                    />

                    <div className={styles.bubbleContent}>
                      <div
                        className={mergeClasses(
                          styles.bubble,
                          turn.role === "user"
                            ? styles.userBubble
                            : styles.assistantBubble
                        )}
                      >
                        {turn.role === "user" ? (
                          <Text>{turn.text}</Text>
                        ) : (
                          <ReactMarkdown>{turn.text}</ReactMarkdown>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className={styles.messageMeta}>
                        <span className={styles.time}>
                          {new Date(turn.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {turn.role === "assistant" && (
                          <>
                            <Tooltip
                              content="This response was generated by AI"
                              relationship="label"
                            >
                              <Badge
                                appearance="tint"
                                color="informative"
                                size="small"
                              >
                                AI-generated
                              </Badge>
                            </Tooltip>
                            <div className={styles.assistantActions}>
                              <Tooltip content="Read aloud" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<Speaker224Regular />}
                                  disabled={disabled}
                                  onClick={() => replayTurn(turn.text)}
                                  aria-label="Read this response aloud"
                                />
                              </Tooltip>
                              <Tooltip content="Immersive Reader" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<ImmersiveReader24Regular />}
                                  disabled={irIsOpen}
                                  onClick={() => launchIR("Speech Assistant", turn.text)}
                                  aria-label="Open in Immersive Reader"
                                />
                              </Tooltip>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline task breakdown if response contains steps */}
                  {turn.role === "assistant" && taskSteps.get(turn.id) && (
                    <div className={styles.taskArea}>
                      <TaskBreakdown
                        steps={taskSteps.get(turn.id)!}
                        onToggleStep={(stepId) =>
                          handleToggleTask(turn.id, stepId)
                        }
                        title="Your steps"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {isProcessing && (
                <div className={styles.thinkingRow}>
                  <Avatar
                    icon={<BotSparkle24Regular />}
                    color="brand"
                    size={32}
                    aria-hidden
                  />
                  <div className={styles.thinkingBubble}>
                    <Spinner size="tiny" aria-hidden />
                    <Text className={styles.thinkingText}>
                      Taking a moment to think clearly...
                    </Text>
                  </div>
                </div>
              )}

              <div ref={conversationEndRef} aria-hidden />
            </div>

            {/* Calm notification banner */}
            {notification && (
              <div className={styles.notificationBar}>
                <CalmNotification
                  message={notification.message}
                  type={notification.type}
                  onDismiss={() => setNotification(null)}
                />
              </div>
            )}
          </>
        )}

        {/* ── Focus timer (toggle) ──────────────────────────────────── */}
        {showTimer && (
          <div className={styles.timerContainer}>
            <FocusTimer
              onComplete={() =>
                setNotification({
                  message: "Focus session complete. Great work! Take a break if you need one.",
                  type: "encouragement",
                })
              }
              onDismiss={() => setShowTimer(false)}
            />
          </div>
        )}

        {/* ── Bottom input area ────────────────────────────────────── */}
        <div className={styles.bottomArea}>
          {/* Status */}
          <div className={styles.statusBar} aria-live="polite">
            <VoiceVisualizer isActive={isRecording} isSpeaking={isSpeaking} />
            <Text size={200}>{status}</Text>
          </div>

          {/* Mode toggle */}
          <div className={styles.modeToggle}>
            <Tooltip content="Voice mode" relationship="label">
              <Button
                appearance={inputMode === "voice" ? "primary" : "subtle"}
                size="small"
                icon={<Mic24Regular />}
                onClick={() => setInputMode("voice")}
                aria-label="Switch to voice input"
                aria-pressed={inputMode === "voice"}
              />
            </Tooltip>
            <Tooltip content="Type mode" relationship="label">
              <Button
                appearance={inputMode === "text" ? "primary" : "subtle"}
                size="small"
                icon={<Keyboard24Regular />}
                onClick={() => {
                  setInputMode("text");
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }}
                aria-label="Switch to text input"
                aria-pressed={inputMode === "text"}
              />
            </Tooltip>
            <Divider vertical style={{ height: "24px" }} />
            <Tooltip content={showTimer ? "Hide focus timer" : "Show focus timer"} relationship="label">
              <Button
                appearance={showTimer ? "primary" : "subtle"}
                size="small"
                icon={<Timer24Regular />}
                onClick={() => setShowTimer(!showTimer)}
                aria-label={showTimer ? "Hide focus timer" : "Show focus timer"}
                aria-pressed={showTimer}
              />
            </Tooltip>
            <Tooltip content="Clear conversation" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<ArrowReset24Regular />}
                disabled={conversation.length === 0 || disabled}
                onClick={clearConversation}
                aria-label="Start over"
              />
            </Tooltip>
            <Tooltip content={showSettings ? "Hide voice settings" : "Voice settings"} relationship="label">
              <Button
                appearance={showSettings ? "primary" : "subtle"}
                size="small"
                icon={<Settings24Regular />}
                onClick={() => setShowSettings(!showSettings)}
                aria-label={showSettings ? "Hide voice settings" : "Voice settings"}
                aria-pressed={showSettings}
              />
            </Tooltip>
            <Tooltip content={showIRSettings ? "Hide reader settings" : "Immersive Reader settings"} relationship="label">
              <Button
                appearance={showIRSettings ? "primary" : "subtle"}
                size="small"
                icon={<ImmersiveReader24Regular />}
                onClick={() => setShowIRSettings(!showIRSettings)}
                aria-label={showIRSettings ? "Hide Immersive Reader settings" : "Immersive Reader settings"}
                aria-pressed={showIRSettings}
              />
            </Tooltip>
          </div>

          {/* Voice settings panel */}
          {showSettings && (
            <div className={styles.settingsPanel}>
              <div className={styles.settingsField}>
                <Label size="small" htmlFor="voice-select">Voice</Label>
                <Select
                  id="voice-select"
                  size="small"
                  value={voiceName}
                  onChange={(_, d) => setVoiceName(d.value)}
                >
                  <option value="en-US-JennyNeural">Jenny (calm, warm)</option>
                  <option value="en-US-AriaNeural">Aria (friendly)</option>
                  <option value="en-US-GuyNeural">Guy (relaxed)</option>
                  <option value="en-US-SaraNeural">Sara (gentle)</option>
                  <option value="en-US-DavisNeural">Davis (steady)</option>
                  <option value="en-US-JaneNeural">Jane (soothing)</option>
                  <option value="en-US-JasonNeural">Jason (clear)</option>
                  <option value="en-US-TonyNeural">Tony (composed)</option>
                </Select>
              </div>
              <div className={styles.settingsField}>
                <Label size="small" htmlFor="rate-select">Speed</Label>
                <Select
                  id="rate-select"
                  size="small"
                  value={speechRate}
                  onChange={(_, d) => setSpeechRate(d.value)}
                >
                  <option value="x-slow">Very Slow</option>
                  <option value="slow">Slow</option>
                  <option value="medium">Medium</option>
                  <option value="default">Normal</option>
                  <option value="fast">Fast</option>
                </Select>
              </div>
            </div>
          )}

          {/* Immersive Reader settings panel */}
          {showIRSettings && (
            <ImmersiveReaderSettingsPanel
              settings={irSettings}
              onChange={updateIRSettings}
            />
          )}

          {/* Input area — voice or text */}
          {inputMode === "voice" ? (
            <div className={styles.controlBar}>
              {isSpeaking ? (
                <Tooltip content="Stop speaking" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<MicOff24Regular />}
                    onClick={stopSpeaking}
                    aria-label="Stop speaking"
                  />
                </Tooltip>
              ) : (
                <div style={{ width: 32 }} aria-hidden />
              )}

              <Button
                className={mergeClasses(
                  styles.recordBtn,
                  isRecording && styles.recordBtnActive
                )}
                shape="circular"
                appearance={isRecording ? "primary" : "secondary"}
                icon={isRecording ? <Stop24Regular /> : <Mic24Regular />}
                disabled={isProcessing}
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              />

              <div style={{ width: 32 }} aria-hidden />
            </div>
          ) : (
            <div className={styles.inputRow}>
              <Textarea
                ref={textareaRef}
                className={styles.textarea}
                value={textInput}
                onChange={(_, d) => setTextInput(d.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                disabled={isProcessing}
                resize="none"
                aria-label="Message input"
              />
              <div className={styles.inputActions}>
                <Tooltip content="Send message" relationship="label">
                  <Button
                    appearance="primary"
                    shape="circular"
                    icon={<Send24Regular />}
                    disabled={!textInput.trim() || isProcessing}
                    onClick={handleTextSend}
                    aria-label="Send message"
                  />
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
