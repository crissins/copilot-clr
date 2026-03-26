/**
 * Smart Context Sidebar — replaces the old accordion-based HistorySidebar.
 *
 * Three sections:
 * 1. Top: "What are you working on?" mini-prompt that routes intents
 * 2. Middle: Up to 3 active-context cards (task, reminder, document)
 * 3. Bottom: Collapsed "Recent" history list
 *
 * Design principles:
 * - Push relevant context TO the user, don't make them hunt
 * - Minimal cognitive load — colored borders, single actions, no categories
 * - Inclusive: high-contrast safe, keyboard-navigable, screen-reader labeled
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Button,
  Input,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Send20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Delete20Regular,
  Open20Regular,
  TasksApp20Regular,
  Alert20Regular,
  Document20Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../services/api";
import type { Session, TaskPlan, Reminder, ContentItem } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

/* ─── Props ────────────────────────────────────────────────────────────── */

interface SmartContextSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLoadSession: (sessionId: string) => void;
  onNavigate: (viewId: string) => void;
  activeSessionId?: string | null;
  /** Fire a chat message from the mini-prompt */
  onSendPrompt?: (text: string) => void;
}

/* ─── Styles ───────────────────────────────────────────────────────────── */

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "280px",
    minHeight: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1),
    transitionProperty: "width",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
    flexShrink: 0,
    overflowY: "auto",
    overflowX: "hidden",
  },
  rootCollapsed: {
    width: "36px",
    overflow: "hidden",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "flex-end",
    ...shorthands.padding("8px", "6px", "4px"),
  },

  /* ── Top: mini-prompt ───────────────────────────────────────────── */
  promptSection: {
    ...shorthands.padding("12px", "12px", "8px"),
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  promptLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  promptRow: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  promptInput: {
    flex: 1,
  },

  /* ── Middle: context cards ──────────────────────────────────────── */
  cardsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    ...shorthands.padding("4px", "12px", "8px"),
    flex: 1,
  },
  cardsSectionLabel: {
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    ...shorthands.padding("0", "0", "2px"),
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    ...shorthands.padding("10px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: "pointer",
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderTopWidth: "0",
    borderRightWidth: "0",
    borderBottomWidth: "0",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":focus-visible": {
      ...shorthands.outline("2px", "solid", tokens.colorStrokeFocus2),
      outlineOffset: "1px",
    },
  },
  cardTask: {
    borderLeftColor: "#107C10", // green — active task
  },
  cardReminder: {
    borderLeftColor: "#CA5010", // amber — due soon
  },
  cardDocument: {
    borderLeftColor: "#0078D4", // blue — document
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  cardIcon: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  cardIconTask: { color: "#107C10" },
  cardIconReminder: { color: "#CA5010" },
  cardIconDocument: { color: "#0078D4" },
  cardTitle: {
    flex: 1,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardAction: {
    flexShrink: 0,
  },
  cardSubtitle: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingLeft: "26px", // align with title (icon width + gap)
  },
  emptyState: {
    ...shorthands.padding("16px", "12px"),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    textAlign: "center" as const,
  },

  /* ── Bottom: recent history ─────────────────────────────────────── */
  recentSection: {
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    display: "flex",
    flexDirection: "column",
  },
  recentToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("8px", "12px"),
    cursor: "pointer",
    backgroundColor: "transparent",
    ...shorthands.border("none"),
    width: "100%",
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  recentList: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    ...shorthands.padding("0", "8px", "8px"),
    maxHeight: "200px",
    overflowY: "auto",
  },
  recentItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    backgroundColor: "transparent",
    ...shorthands.border("none"),
    width: "100%",
    textAlign: "left" as const,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  recentItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  recentItemTitle: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  recentItemDate: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
});

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(d: string): string {
  const diff = new Date(d).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return formatShortDate(d);
}

/** Simple intent router for mini-prompt text */
function detectIntent(text: string): "reminder" | "task" | "chat" {
  const lower = text.toLowerCase();
  if (/\bremind\b|\balarm\b|\btimer\b|\bin \d+ min/.test(lower)) return "reminder";
  if (/\bstep|break.?down|decompos|task|plan\b/.test(lower)) return "task";
  return "chat";
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function SmartContextSidebar({
  collapsed,
  onToggle,
  onLoadSession,
  onNavigate,
  activeSessionId,
  onSendPrompt,
}: SmartContextSidebarProps) {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { t } = useI18n();

  // Mini-prompt
  const [promptText, setPromptText] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Context cards data
  const [activeTask, setActiveTask] = useState<TaskPlan | null>(null);
  const [nextReminder, setNextReminder] = useState<Reminder | null>(null);
  const [lastDoc, setLastDoc] = useState<ContentItem | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  // Recent section
  const [recentOpen, setRecentOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  /* ── Fetch active context on mount ───────────────────────────────── */
  useEffect(() => {
    if (collapsed) return;
    let cancelled = false;

    async function fetchContext() {
      setContextLoading(true);
      try {
        const token = await getAccessToken();

        // Fetch all three in parallel
        const [plans, reminders, docs] = await Promise.all([
          apiClient.listTaskPlans(token).catch(() => [] as TaskPlan[]),
          apiClient.listReminders(token, "pending").catch(() => [] as Reminder[]),
          apiClient.listContent(token).catch(() => [] as ContentItem[]),
        ]);

        if (cancelled) return;

        // Active task: most recent plan with incomplete steps
        const activePlan = plans.find((p) =>
          p.steps?.some((s) => !s.completed),
        ) ?? null;
        setActiveTask(activePlan);

        // Next reminder: soonest pending reminder
        const now = Date.now();
        const upcoming = reminders
          .filter((r) => r.status === "pending" && new Date(r.scheduledTime).getTime() > now)
          .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
        setNextReminder(upcoming[0] ?? null);

        // Last uploaded document: most recent by createdAt
        const sorted = [...docs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setLastDoc(sorted[0] ?? null);
      } catch {
        // Silently fail — cards just won't show
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    }

    fetchContext();
    // Refresh every 60 seconds
    const interval = setInterval(fetchContext, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [collapsed, getAccessToken]);

  /* ── Load recent chats when expanded ─────────────────────────────── */
  useEffect(() => {
    if (!recentOpen) return;
    let cancelled = false;

    async function loadSessions() {
      setSessionsLoading(true);
      try {
        const token = await getAccessToken();
        const list = await apiClient.listSessions(token);
        if (!cancelled) setSessions(list.slice(0, 10));
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }
    loadSessions();
    return () => { cancelled = true; };
  }, [recentOpen, getAccessToken]);

  /* ── Mini-prompt submit ──────────────────────────────────────────── */
  const handlePromptSubmit = useCallback(async () => {
    const text = promptText.trim();
    if (!text || promptBusy) return;

    const intent = detectIntent(text);
    setPromptBusy(true);

    try {
      switch (intent) {
        case "reminder":
          // Navigate to Reminders page and let user complete there
          onNavigate("feature3");
          break;
        case "task":
          // Navigate to Task Decomposer
          onNavigate("feature5");
          break;
        case "chat":
        default:
          if (onSendPrompt) {
            onSendPrompt(text);
          } else {
            // Navigate to chat view — the prompt text stays in the user's head
            onNavigate("chat");
          }
          break;
      }
      setPromptText("");
    } finally {
      setPromptBusy(false);
    }
  }, [promptText, promptBusy, onNavigate, onSendPrompt]);

  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handlePromptSubmit();
      }
    },
    [handlePromptSubmit],
  );

  /* ── Delete session ──────────────────────────────────────────────── */
  const deleteSession = useCallback(
    async (sid: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const token = await getAccessToken();
        await apiClient.deleteSession(sid, token);
        setSessions((prev) => prev.filter((s) => s.id !== sid));
      } catch {
        // fail silently
      }
    },
    [getAccessToken],
  );

  /* ── Collapsed state ─────────────────────────────────────────────── */
  if (collapsed) {
    return (
      <div className={mergeClasses(styles.root, styles.rootCollapsed)}>
        <div className={styles.toggleRow}>
          <Tooltip content={t.contextSidebar?.expand ?? "Show context"} relationship="label" positioning="after">
            <Button
              appearance="subtle"
              icon={<ChevronRight20Regular />}
              onClick={onToggle}
              aria-label={t.contextSidebar?.expand ?? "Show context panel"}
              size="small"
            />
          </Tooltip>
        </div>
      </div>
    );
  }

  const hasCards = !!activeTask || !!nextReminder || !!lastDoc;
  const completedSteps = activeTask?.steps?.filter((s) => s.completed).length ?? 0;
  const totalSteps = activeTask?.steps?.length ?? 0;

  return (
    <div className={styles.root} role="complementary" aria-label={t.contextSidebar?.ariaLabel ?? "Context panel"}>
      {/* Toggle */}
      <div className={styles.toggleRow}>
        <Tooltip content={t.contextSidebar?.collapse ?? "Hide context"} relationship="label" positioning="after">
          <Button
            appearance="subtle"
            icon={<ChevronLeft20Regular />}
            onClick={onToggle}
            aria-label={t.contextSidebar?.collapse ?? "Hide context panel"}
            size="small"
          />
        </Tooltip>
      </div>

      {/* ── Top: Mini-prompt ─────────────────────────────────────── */}
      <div className={styles.promptSection}>
        <Text className={styles.promptLabel}>
          {t.contextSidebar?.promptLabel ?? "What are you working on?"}
        </Text>
        <div className={styles.promptRow}>
          <Input
            ref={inputRef}
            className={styles.promptInput}
            size="small"
            placeholder={t.contextSidebar?.promptPlaceholder ?? "e.g. remind me in 30 min…"}
            value={promptText}
            onChange={(_, d) => setPromptText(d.value)}
            onKeyDown={handlePromptKeyDown}
            aria-label={t.contextSidebar?.promptLabel ?? "Quick action prompt"}
            disabled={promptBusy}
          />
          <Tooltip content={t.chat?.send ?? "Send"} relationship="label">
            <Button
              appearance="subtle"
              icon={promptBusy ? <Spinner size="tiny" /> : <Send20Regular />}
              onClick={handlePromptSubmit}
              disabled={!promptText.trim() || promptBusy}
              aria-label={t.chat?.send ?? "Send"}
              size="small"
            />
          </Tooltip>
        </div>
      </div>

      {/* ── Middle: Active Context Cards ─────────────────────────── */}
      <div className={styles.cardsSection}>
        {contextLoading ? (
          <div className={styles.emptyState}>
            <Spinner size="tiny" label={t.contextSidebar?.loading ?? "Loading…"} />
          </div>
        ) : !hasCards ? (
          <div className={styles.emptyState}>
            {t.contextSidebar?.noActiveItems ?? "All clear — nothing in progress"}
          </div>
        ) : (
          <>
            <Text className={styles.cardsSectionLabel}>
              {t.contextSidebar?.activeNow ?? "Active now"}
            </Text>

            {/* Task Plan card */}
            {activeTask && (
              <button
                className={mergeClasses(styles.card, styles.cardTask)}
                onClick={() => onNavigate("feature5")}
                aria-label={`Active task: ${activeTask.goal}`}
              >
                <div className={styles.cardHeader}>
                  <span className={mergeClasses(styles.cardIcon, styles.cardIconTask)}>
                    <TasksApp20Regular />
                  </span>
                  <span className={styles.cardTitle}>{activeTask.goal}</span>
                  <span className={styles.cardAction}>
                    <Open20Regular />
                  </span>
                </div>
                <span className={styles.cardSubtitle}>
                  {completedSteps}/{totalSteps} steps done
                </span>
              </button>
            )}

            {/* Reminder card */}
            {nextReminder && (
              <button
                className={mergeClasses(styles.card, styles.cardReminder)}
                onClick={() => onNavigate("feature3")}
                aria-label={`Reminder: ${nextReminder.title}, ${formatRelativeTime(nextReminder.scheduledTime)}`}
              >
                <div className={styles.cardHeader}>
                  <span className={mergeClasses(styles.cardIcon, styles.cardIconReminder)}>
                    <Alert20Regular />
                  </span>
                  <span className={styles.cardTitle}>{nextReminder.title}</span>
                  <span className={styles.cardAction}>
                    <Open20Regular />
                  </span>
                </div>
                <span className={styles.cardSubtitle}>
                  {formatRelativeTime(nextReminder.scheduledTime)}
                </span>
              </button>
            )}

            {/* Document card */}
            {lastDoc && (
              <button
                className={mergeClasses(styles.card, styles.cardDocument)}
                onClick={() => onNavigate("feature1")}
                aria-label={`Document: ${lastDoc.filename}`}
              >
                <div className={styles.cardHeader}>
                  <span className={mergeClasses(styles.cardIcon, styles.cardIconDocument)}>
                    <Document20Regular />
                  </span>
                  <span className={styles.cardTitle}>{lastDoc.filename}</span>
                  <span className={styles.cardAction}>
                    <Open20Regular />
                  </span>
                </div>
                <span className={styles.cardSubtitle}>
                  {lastDoc.chunkCount} chunks · {formatShortDate(lastDoc.createdAt)}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Bottom: Collapsed Recent ─────────────────────────────── */}
      <div className={styles.recentSection}>
        <button
          className={styles.recentToggle}
          onClick={() => setRecentOpen(!recentOpen)}
          aria-expanded={recentOpen}
          aria-controls="smart-sidebar-recent"
        >
          <span>{t.contextSidebar?.recent ?? "Recent"}</span>
          {recentOpen ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
        </button>

        {recentOpen && (
          <div id="smart-sidebar-recent" className={styles.recentList} role="list">
            {sessionsLoading ? (
              <Spinner size="tiny" label={t.chat?.loadingSessions ?? "Loading…"} />
            ) : sessions.length === 0 ? (
              <div className={styles.emptyState}>{t.chat?.noSessions ?? "No recent chats"}</div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  role="listitem"
                  className={mergeClasses(
                    styles.recentItem,
                    activeSessionId === s.id && styles.recentItemActive,
                  )}
                  onClick={() => onLoadSession(s.id)}
                >
                  <span className={styles.recentItemTitle}>{s.title || "Untitled"}</span>
                  <span className={styles.recentItemDate}>
                    {formatShortDate(s.updatedAt || s.createdAt)}
                  </span>
                  <Button
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    size="small"
                    onClick={(e) => deleteSession(s.id, e)}
                    aria-label={t.chat?.deleteSession ?? "Delete chat"}
                  />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
