/**
 * Feature 5 — Task Decomposer
 *
 * AI-powered task decomposition for neurodiverse users. Takes a complex goal
 * and breaks it into numbered, time-boxed sub-tasks with priority, duration,
 * and focus tips. Uses calm, supportive language (RAI requirement).
 *
 * Features: Read Aloud per step, Immersive Reader per step (auto-advance on
 * close), floating contextual chat, beautiful card-based layout.
 *
 * Backend: POST /api/tasks/decompose, GET/PATCH/DELETE /api/tasks/plans/*
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Text,
  Badge,
  Spinner,
  Textarea,
  Select,
  Tooltip,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Delete24Regular,
  Save24Regular,
  Trophy16Regular,
  Clock16Regular,
  Info24Regular,
  Sparkle24Regular,
  History24Regular,
  Dismiss24Regular,
  ArrowRight24Regular,
  ArrowRight16Regular,
  CheckmarkCircle24Regular,
  Chat24Regular,
  Send24Regular,
  ChevronDown24Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { TaskPlan, TaskStep, Message } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { TTSButton } from "../../components/TTSButton";
import { ImmersiveReaderButton } from "../../components/ImmersiveReaderButton";

// ── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  scrollArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxWidth: "780px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("32px", "24px", "100px"),
    width: "100%",
  },

  // ── Hero header ──
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center",
    ...shorthands.padding("12px", "0", "4px"),
  },
  heroIcon: {
    width: "56px",
    height: "56px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "24px",
  },
  heroTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase600,
  },
  heroSubtitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "520px",
  },

  // ── Input card ──
  inputCard: {
    ...shorthands.padding("20px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  goalInput: {
    flex: 1,
    minWidth: "200px",
  },
  breakBtn: {
    height: "40px",
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    fontWeight: tokens.fontWeightSemibold,
  },

  // ── Plan card ──
  planCard: {
    ...shorthands.padding("24px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  planInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
    minWidth: 0,
  },
  planGoal: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase500,
  },
  statRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  // ── Progress ──
  progressTrack: {
    width: "100%",
    height: "6px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("3px"),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    ...shorthands.borderRadius("3px"),
    backgroundColor: tokens.colorBrandBackground,
    transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
  progressFillDone: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
  },

  // ── Step cards ──
  stepList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  stepCard: {
    ...shorthands.padding("0"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
    transition: "all 200ms ease",
    ":hover": {
      boxShadow: tokens.shadow4,
      ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1Hover),
    },
  },
  stepCardCurrent: {
    ...shorthands.border("1px", "solid", tokens.colorBrandStroke1),
    boxShadow: `0 0 0 1px ${tokens.colorBrandStroke1}`,
    ":hover": {
      ...shorthands.border("1px", "solid", tokens.colorBrandStroke1),
      boxShadow: `0 0 0 1px ${tokens.colorBrandStroke1}`,
    },
  },
  stepCardDone: {
    opacity: 0.75,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  stepInner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    ...shorthands.padding("14px", "16px"),
  },
  stepNumber: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    flexShrink: 0,
    marginTop: "2px",
    transition: "all 200ms ease",
  },
  stepNumberDone: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  stepNumberCurrent: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: `0 0 0 3px ${tokens.colorBrandBackground2}`,
  },
  stepBody: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
    minWidth: 0,
  },
  stepTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  stepTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
  },
  stepTitleDone: {
    textDecorationLine: "line-through",
    color: tokens.colorNeutralForeground3,
  },
  stepActions: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    flexShrink: 0,
  },
  stepMeta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "2px",
  },
  focusTip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("10px", "16px"),
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomLeftRadius: tokens.borderRadiusLarge,
    borderBottomRightRadius: tokens.borderRadiusLarge,
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
  },
  focusTipIcon: {
    color: tokens.colorPaletteYellowForeground1,
    flexShrink: 0,
  },

  // ── Next step nudge ──
  nextNudge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    animationDuration: "400ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "translateY(8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
  },

  // ── Explanation ──
  explanation: {
    ...shorthands.padding("14px", "18px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground2,
  },

  // ── History ──
  historyCard: {
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    cursor: "pointer",
    transition: "background 150ms ease",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  historyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },

  // ── Empty state ──
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("48px", "24px"),
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },

  // ── Celebration ──
  celebration: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("16px", "20px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    backgroundColor: tokens.colorPaletteGreenBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteGreenBorder1),
    animationDuration: "500ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "scale(0.95)" },
      to: { opacity: 1, transform: "scale(1)" },
    },
  },
  celebrationIcon: {
    width: "40px",
    height: "40px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // ── Floating chat ──
  chatFab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 1000,
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
    ...shorthands.border("none"),
    transition: "transform 150ms ease, box-shadow 150ms ease",
    ":hover": {
      transform: "scale(1.05)",
      boxShadow: tokens.shadow28,
    },
  },
  chatPanel: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 1000,
    width: "380px",
    height: "480px",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius("16px"),
    boxShadow: tokens.shadow28,
    ...shorthands.overflow("hidden"),
    animationDuration: "250ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "translateY(16px) scale(0.95)" },
      to: { opacity: 1, transform: "translateY(0) scale(1)" },
    },
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("12px", "16px"),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    flexShrink: 0,
  },
  chatHeaderActions: {
    display: "flex",
    gap: "4px",
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    ...shorthands.padding("12px", "14px"),
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  chatEmpty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: "center",
    ...shorthands.padding("20px"),
    gap: "8px",
    lineHeight: tokens.lineHeightBase300,
  },
  chatBubble: {
    maxWidth: "85%",
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius("12px"),
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    wordBreak: "break-word",
  },
  chatUserBubble: {
    alignSelf: "flex-end",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  chatAssistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  chatInputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "6px",
    ...shorthands.padding("10px", "12px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
    flexShrink: 0,
  },
  chatTextarea: {
    flex: 1,
    resize: "none",
    minHeight: "36px",
    maxHeight: "80px",
    fontSize: tokens.fontSizeBase200,
  },
});

const PRIORITY_COLOR: Record<string, "important" | "informative" | "subtle"> = {
  high: "important",
  medium: "informative",
  low: "subtle",
};

const PRIORITY_ICON: Record<string, JSX.Element> = {
  high: <ArrowUp16Regular />,
  medium: <ArrowRight16Regular />,
  low: <ArrowDown16Regular />,
};

// ── Component ──────────────────────────────────────────────────────────────

export function Feature5Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  // Plan state
  const [goal, setGoal] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | null>(null);
  const [history, setHistory] = useState<TaskPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Next-step nudge after Immersive Reader closes
  const [nextNudge, setNextNudge] = useState<string | null>(null);

  // Floating chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  const getToken = useCallback(async (): Promise<string | null> => getAccessToken(), [getAccessToken]);

  // Load history on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const plans = await apiClient.listTaskPlans(token);
        if (!cancelled) setHistory(plans);
      } catch {
        // Silently ignore — history is optional
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Focus chat textarea when opened
  useEffect(() => {
    if (chatOpen) chatTextareaRef.current?.focus();
  }, [chatOpen]);

  const handleDecompose = useCallback(async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await apiClient.decomposeTask(goal.trim(), readingLevel, token);
      setCurrentPlan(res.task);
      setHistory((prev) => [res.task, ...prev]);
      setGoal("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [goal, readingLevel, getToken]);

  const handleToggleStep = useCallback(
    async (stepId: string, completed: boolean) => {
      if (!currentPlan) return;
      // Optimistic local update — works even if API is unreachable
      const updatedSteps = currentPlan.steps.map((s) =>
        s.id === stepId ? { ...s, completed, completedAt: completed ? new Date().toISOString() : null } : s,
      );
      const updatedPlan = { ...currentPlan, steps: updatedSteps };
      setCurrentPlan(updatedPlan);
      setHistory((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));
      // Best-effort sync to backend
      try {
        const token = await getToken();
        await apiClient.toggleStep(currentPlan.id, stepId, completed, token);
      } catch {
        // Local state is already updated; no error shown
      }
    },
    [currentPlan, getToken],
  );

  const handleDeletePlan = useCallback(
    async (planId: string) => {
      // Optimistic local delete
      setHistory((prev) => prev.filter((p) => p.id !== planId));
      if (currentPlan?.id === planId) setCurrentPlan(null);
      // Best-effort sync to backend
      try {
        const token = await getToken();
        await apiClient.deleteTaskPlan(planId, token);
      } catch {
        // Already removed locally
      }
    },
    [currentPlan, getToken],
  );

  const handleSavePlan = useCallback(async () => {
    if (!currentPlan) return;
    try {
      const token = await getToken();
      await apiClient.saveTaskPlan(currentPlan.goal, currentPlan.steps, token);
      setError(null);
      // Brief success feedback
      setNextNudge("Plan saved! You can find it in Past Plans.");
      setTimeout(() => setNextNudge(null), 4000);
    } catch {
      setError("Could not save plan. Please try again.");
    }
  }, [currentPlan, getToken]);

  const handleLoadPlan = useCallback(
    async (planId: string) => {
      try {
        const token = await getToken();
        const plan = await apiClient.getTaskPlan(planId, token);
        setCurrentPlan(plan);
        setShowHistory(false);
      } catch {
        setError("Could not load plan.");
      }
    },
    [getToken],
  );

  // Build text for TTS / IR for a single step
  const buildStepText = (step: TaskStep, idx: number) => {
    let text = `Step ${idx + 1}. ${step.title}.`;
    if (step.focusTip) text += ` Tip: ${step.focusTip}`;
    text += ` Estimated time: ${step.estimatedMinutes} minutes.`;
    return text;
  };

  // When IR closes on a step, nudge user toward next step
  const handleIRClose = useCallback(
    (stepIdx: number) => {
      if (!currentPlan) return;
      const nextIdx = stepIdx + 1;
      if (nextIdx < currentPlan.steps.length) {
        const nextStep = currentPlan.steps[nextIdx];
        setNextNudge(`Ready for the next one? Step ${nextIdx + 1}: ${nextStep.title}`);
        // Auto-dismiss after 6 seconds
        setTimeout(() => setNextNudge(null), 6000);
      } else {
        setNextNudge("That was the last step. You've got this!");
        setTimeout(() => setNextNudge(null), 5000);
      }
    },
    [currentPlan],
  );

  // ── Floating chat ──────────────────────────────────────────────────────

  const buildChatContext = useCallback(() => {
    if (!currentPlan) return "";
    const completed = currentPlan.steps.filter((s) => s.completed).length;
    let ctx = `[Context: The user is working on the task "${currentPlan.goal}" decomposed into ${currentPlan.steps.length} steps (${completed} completed). Steps: `;
    ctx += currentPlan.steps.map((s, i) => `${i + 1}. ${s.title} (${s.completed ? "done" : "pending"}, ${s.estimatedMinutes}min)`).join("; ");
    ctx += "]";
    return ctx;
  }, [currentPlan]);

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: chatSessionId || "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const token = await getToken();
      // Prepend task context to the first message of each session
      const contextPrefix = !chatSessionId ? buildChatContext() + "\n\n" : "";
      const response = await apiClient.sendMessage(contextPrefix + text, chatSessionId, token);
      if (!chatSessionId) setChatSessionId(response.sessionId);

      setChatMessages((prev) => [
        ...prev,
        {
          id: response.message.id,
          sessionId: response.sessionId,
          role: "assistant",
          content: response.message.content,
          createdAt: response.message.createdAt,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sessionId: chatSessionId || "",
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
      chatTextareaRef.current?.focus();
    }
  }, [chatInput, chatLoading, chatSessionId, getToken, buildChatContext]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────

  const completedCount = currentPlan?.steps.filter((s) => s.completed).length ?? 0;
  const totalSteps = currentPlan?.steps.length ?? 0;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const allDone = completedCount === totalSteps && totalSteps > 0;
  const totalMinutes = currentPlan?.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0;
  const remainingMinutes = currentPlan?.steps.filter((s) => !s.completed).reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0;
  const currentStepIdx = currentPlan?.steps.findIndex((s) => !s.completed) ?? -1;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.scrollArea}>
        <div className={styles.container}>
          {/* Hero header */}
          <div className={styles.hero}>
            <div className={styles.heroIcon}>
              <Sparkle24Regular />
            </div>
            <Text className={styles.heroTitle}>Task Decomposer</Text>
            <Text className={styles.heroSubtitle}>
              Break a complex goal into clear, time-boxed steps. Take it one
              piece at a time — no rush.
            </Text>
          </div>

          {/* Error banner */}
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>
                <MessageBarTitle>Something went wrong</MessageBarTitle>
                {error}
              </MessageBarBody>
            </MessageBar>
          )}

          {/* Input card */}
          <div className={styles.inputCard}>
            <Textarea
              className={styles.goalInput}
              placeholder="Describe your goal… e.g. 'Write a 2-page essay on climate change'"
              value={goal}
              onChange={(_, data) => setGoal(data.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDecompose(); }
              }}
              resize="vertical"
              disabled={loading}
            />
            <div className={styles.inputRow}>
              <Select
                value={readingLevel}
                onChange={(_, data) => setReadingLevel(data.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">Reading level (auto)</option>
                <option value="3">Grade 3</option>
                <option value="5">Grade 5</option>
                <option value="8">Grade 8</option>
                <option value="10">Grade 10</option>
              </Select>
              <Button
                className={styles.breakBtn}
                appearance="primary"
                onClick={handleDecompose}
                disabled={loading || !goal.trim()}
                icon={loading ? <Spinner size="tiny" /> : <Sparkle24Regular />}
              >
                {loading ? "Breaking it down…" : "Break it down"}
              </Button>
              <Tooltip content={showHistory ? "Hide history" : "Past plans"} relationship="label">
                <Button
                  appearance={showHistory ? "primary" : "subtle"}
                  icon={<History24Regular />}
                  onClick={() => setShowHistory(!showHistory)}
                  aria-label={showHistory ? "Hide history" : "Show past plans"}
                />
              </Tooltip>
            </div>
          </div>

          {/* History */}
          {showHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text size={400} weight="semibold">Past Plans</Text>
              {history.length === 0 ? (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  No plans yet. Decompose a goal to get started.
                </Text>
              ) : (
                history.map((plan) => (
                  <div key={plan.id} className={styles.historyCard} onClick={() => handleLoadPlan(plan.id)}>
                    <div className={styles.historyRow}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text weight="semibold" truncate wrap={false} style={{ display: "block" }}>
                          {plan.goal}
                        </Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          {plan.steps.length} steps · {new Date(plan.createdAt).toLocaleDateString()}
                        </Text>
                      </div>
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<Delete24Regular />}
                        onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                        aria-label="Delete plan"
                      />
                    </div>
                  </div>
                ))
              )}
              <Divider />
            </div>
          )}

          {/* Current plan */}
          {currentPlan && (
            <div className={styles.planCard}>
              {/* Plan header */}
              <div className={styles.planHeader}>
                <div className={styles.planInfo}>
                  <Text className={styles.planGoal}>{currentPlan.goal}</Text>
                  <div className={styles.statRow}>
                    <Badge appearance="outline" size="medium" icon={<Trophy16Regular />} color={allDone ? "success" : "informative"}>
                      {completedCount}/{totalSteps} done
                    </Badge>
                    <Badge appearance="outline" size="medium" icon={<Clock16Regular />}>
                      ~{remainingMinutes} min left of {totalMinutes}
                    </Badge>
                  </div>
                </div>
                <Tooltip content="Save this plan" relationship="label">
                  <Button appearance="subtle" icon={<Save24Regular />} onClick={handleSavePlan} />
                </Tooltip>
                <Tooltip content="Delete this plan" relationship="label">
                  <Button appearance="subtle" icon={<Delete24Regular />} onClick={() => handleDeletePlan(currentPlan.id)} />
                </Tooltip>
              </div>

              {/* Progress bar */}
              <div className={styles.progressTrack}>
                <div
                  className={mergeClasses(styles.progressFill, allDone && styles.progressFillDone)}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Next step nudge */}
              {nextNudge && (
                <div className={styles.nextNudge} role="status" aria-live="polite">
                  <ArrowRight24Regular />
                  <Text size={300} weight="semibold">{nextNudge}</Text>
                  <Button
                    appearance="transparent"
                    size="small"
                    icon={<Dismiss24Regular />}
                    onClick={() => setNextNudge(null)}
                    aria-label="Dismiss"
                    style={{ color: "inherit" }}
                  />
                </div>
              )}

              {/* Steps */}
              <div className={styles.stepList}>
                {currentPlan.steps.map((step: TaskStep, idx: number) => {
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={mergeClasses(
                        styles.stepCard,
                        isCurrent && styles.stepCardCurrent,
                        step.completed && styles.stepCardDone,
                      )}
                    >
                      <div className={styles.stepInner}>
                        {/* Step number / checkbox */}
                        <button
                          className={mergeClasses(
                            styles.stepNumber,
                            step.completed && styles.stepNumberDone,
                            isCurrent && !step.completed && styles.stepNumberCurrent,
                          )}
                          onClick={() => handleToggleStep(step.id, !step.completed)}
                          aria-label={step.completed ? `Step ${idx + 1} done. Undo?` : `Mark step ${idx + 1} complete`}
                          style={{ cursor: "pointer", border: "none" }}
                        >
                          {step.completed ? <CheckmarkCircle24Regular /> : idx + 1}
                        </button>

                        {/* Step body */}
                        <div className={styles.stepBody}>
                          <div className={styles.stepTitleRow}>
                            <Text className={mergeClasses(styles.stepTitle, step.completed && styles.stepTitleDone)}>
                              {step.title}
                            </Text>
                            <div className={styles.stepActions}>
                              <TTSButton text={buildStepText(step, idx)} size="small" />
                              <ImmersiveReaderButton
                                title={`Step ${idx + 1}: ${step.title}`}
                                text={buildStepText(step, idx)}
                                size="small"
                                onClose={() => handleIRClose(idx)}
                              />
                            </div>
                          </div>
                          <div className={styles.stepMeta}>
                            <Badge size="small" color={PRIORITY_COLOR[step.priority] ?? "informative"} icon={PRIORITY_ICON[step.priority]}>
                              {step.priority}
                            </Badge>
                            <Badge size="small" appearance="outline" icon={<Clock16Regular />}>
                              {step.estimatedMinutes} min
                            </Badge>
                            {isCurrent && !step.completed && (
                              <Badge size="small" appearance="filled" color="brand">
                                current
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Focus tip */}
                      {step.focusTip && !step.completed && (
                        <div className={styles.focusTip}>
                          <Info24Regular className={styles.focusTipIcon} />
                          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                            {step.focusTip}
                          </Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              {currentPlan.explanation && (
                <div className={styles.explanation}>
                  <Text size={200}>
                    <strong>Why this breakdown:</strong> {currentPlan.explanation}
                  </Text>
                </div>
              )}

              {/* Celebration */}
              {allDone && (
                <div className={styles.celebration}>
                  <div className={styles.celebrationIcon}>
                    <CheckmarkCircle24Regular />
                  </div>
                  <div>
                    <Text size={400} weight="semibold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                      All done!
                    </Text>
                    <br />
                    <Text size={200} style={{ color: tokens.colorPaletteGreenForeground2 }}>
                      Great work — you completed every step. Take a moment to feel good about what you achieved.
                    </Text>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!currentPlan && !showHistory && (
            <div className={styles.emptyState}>
              <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>
                No active plan
              </Text>
              <Text size={300}>
                Type a goal above and press "Break it down" to get started.
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating chat ──────────────────────────────────────────────── */}
      {!chatOpen ? (
        <button
          className={styles.chatFab}
          onClick={() => setChatOpen(true)}
          aria-label="Open chat assistant"
          title="Ask the assistant about your tasks"
        >
          <Chat24Regular />
        </button>
      ) : (
        <div className={styles.chatPanel} role="complementary" aria-label="Task chat assistant">
          {/* Header */}
          <div className={styles.chatHeader}>
            <span>Chat about your tasks</span>
            <div className={styles.chatHeaderActions}>
              <Button
                appearance="subtle"
                icon={<ChevronDown24Regular />}
                size="small"
                onClick={() => setChatOpen(false)}
                aria-label="Minimize chat"
                style={{ color: "inherit" }}
              />
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                size="small"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                style={{ color: "inherit" }}
              />
            </div>
          </div>

          {/* Messages */}
          <div className={styles.chatMessages}>
            {chatMessages.length === 0 ? (
              <div className={styles.chatEmpty}>
                <Chat24Regular style={{ fontSize: "24px", opacity: 0.5 }} />
                <span>
                  Ask me anything about your tasks!<br />
                  I know what you're working on and can help explain steps, suggest tips, or just chat.
                </span>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={mergeClasses(
                    styles.chatBubble,
                    msg.role === "user" ? styles.chatUserBubble : styles.chatAssistantBubble,
                  )}
                >
                  {msg.content}
                </div>
              ))
            )}
            {chatLoading && (
              <div className={mergeClasses(styles.chatBubble, styles.chatAssistantBubble)}>
                <Spinner size="tiny" label="Thinking…" />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className={styles.chatInputRow}>
            <Textarea
              ref={chatTextareaRef}
              className={styles.chatTextarea}
              value={chatInput}
              onChange={(_, d) => setChatInput(d.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Ask about a step…"
              disabled={chatLoading}
              resize="none"
              aria-label="Chat message"
            />
            <Button
              appearance="primary"
              icon={chatLoading ? <Spinner size="tiny" /> : <Send24Regular />}
              onClick={handleChatSend}
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send"
              shape="circular"
              size="small"
              style={{ minWidth: "36px", height: "36px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
