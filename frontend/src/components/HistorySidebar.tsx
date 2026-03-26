/**
 * History Sidebar — Secondary sidebar to the right of the main nav sidebar.
 *
 * Shows expandable panels for: Previous Chats, Tasks, Plans, Reminders, Feedback.
 * Each panel loads data on expand and renders a compact list.
 */

import { useState, useCallback } from "react";
import {
  Button,
  Spinner,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Badge,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Delete20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../services/api";
import type { Session, Task, TaskPlan, Reminder, FeedbackItem } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface HistorySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLoadSession: (sessionId: string) => void;
  onNavigate: (viewId: string) => void;
  activeSessionId?: string | null;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "260px",
    minHeight: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1),
    transition: "width 200ms ease",
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
  content: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  panelContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "240px",
    overflowY: "auto",
    ...shorthands.padding("0", "4px", "8px"),
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    backgroundColor: "transparent",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    width: "100%",
    textAlign: "left" as const,
    ...shorthands.border("none"),
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  itemTitle: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemDate: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  empty: {
    ...shorthands.padding("8px", "12px"),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function HistorySidebar({
  collapsed,
  onToggle,
  onLoadSession,
  onNavigate,
  activeSessionId,
}: HistorySidebarProps) {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  // Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  // Loading state per panel
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const loadPanel = useCallback(
    async (key: string) => {
      setLoadingKey(key);
      try {
        const token = await getAccessToken();
        switch (key) {
          case "chats": {
            const list = await apiClient.listSessions(token);
            setSessions(list);
            break;
          }
          case "tasks": {
            const data = await apiClient.getTasks(token);
            setTasks(data.tasks);
            break;
          }
          case "plans": {
            const list = await apiClient.listTaskPlans(token);
            setPlans(list);
            break;
          }
          case "reminders": {
            const list = await apiClient.listReminders(token);
            setReminders(list);
            break;
          }
          case "feedback": {
            const list = await apiClient.listFeedback(token);
            setFeedback(list);
            break;
          }
        }
      } catch (err) {
        console.error(`Load ${key} failed:`, err);
      } finally {
        setLoadingKey(null);
      }
    },
    [getAccessToken],
  );

  const handleToggle = useCallback(
    (_: unknown, data: { openItems: string[] }) => {
      // Load data for newly opened panels
      for (const key of data.openItems) {
        loadPanel(key);
      }
    },
    [loadPanel],
  );

  const deleteSession = useCallback(
    async (sid: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const token = await getAccessToken();
        await apiClient.deleteSession(sid, token);
        setSessions((prev) => prev.filter((s) => s.id !== sid));
      } catch (err) {
        console.error("Delete session failed:", err);
      }
    },
    [getAccessToken],
  );

  if (collapsed) {
    return (
      <div className={`${styles.root} ${styles.rootCollapsed}`}>
        <div className={styles.toggleRow}>
          <Button
            appearance="subtle"
            icon={<ChevronRight20Regular />}
            onClick={onToggle}
            aria-label="Expand history sidebar"
            size="small"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.toggleRow}>
        <Button
          appearance="subtle"
          icon={<ChevronLeft20Regular />}
          onClick={onToggle}
          aria-label="Collapse history sidebar"
          size="small"
        />
      </div>

      <div className={styles.content}>
        <Accordion multiple collapsible onToggle={handleToggle as any}>
          {/* Previous Chats */}
          <AccordionItem value="chats">
            <AccordionHeader size="small">Previous Chats</AccordionHeader>
            <AccordionPanel>
              <div className={styles.panelContent}>
                {loadingKey === "chats" ? (
                  <Spinner size="tiny" label="Loading..." />
                ) : sessions.length === 0 ? (
                  <div className={styles.empty}>No previous chats</div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      className={`${styles.item} ${activeSessionId === s.id ? styles.itemActive : ""}`}
                      onClick={() => onLoadSession(s.id)}
                    >
                      <span className={styles.itemTitle}>{s.title || "Untitled"}</span>
                      <span className={styles.itemDate}>{formatDate(s.updatedAt || s.createdAt)}</span>
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        size="small"
                        onClick={(e) => deleteSession(s.id, e)}
                        aria-label="Delete chat"
                      />
                    </button>
                  ))
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Tasks */}
          <AccordionItem value="tasks">
            <AccordionHeader size="small">Tasks</AccordionHeader>
            <AccordionPanel>
              <div className={styles.panelContent}>
                {loadingKey === "tasks" ? (
                  <Spinner size="tiny" label="Loading..." />
                ) : tasks.length === 0 ? (
                  <div className={styles.empty}>No tasks</div>
                ) : (
                  tasks.map((t) => (
                    <button
                      key={t.id}
                      className={styles.item}
                      onClick={() => onNavigate("feature5")}
                    >
                      <span className={styles.itemTitle}>{t.title}</span>
                      <Badge
                        size="small"
                        color={t.status === "completed" ? "success" : "informative"}
                        appearance="filled"
                      >
                        {t.status}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Plans */}
          <AccordionItem value="plans">
            <AccordionHeader size="small">Plans</AccordionHeader>
            <AccordionPanel>
              <div className={styles.panelContent}>
                {loadingKey === "plans" ? (
                  <Spinner size="tiny" label="Loading..." />
                ) : plans.length === 0 ? (
                  <div className={styles.empty}>No plans</div>
                ) : (
                  plans.map((p) => (
                    <button
                      key={p.id}
                      className={styles.item}
                      onClick={() => onNavigate("feature5")}
                    >
                      <span className={styles.itemTitle}>{p.goal}</span>
                      <span className={styles.itemDate}>{formatDate(p.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Reminders */}
          <AccordionItem value="reminders">
            <AccordionHeader size="small">Reminders</AccordionHeader>
            <AccordionPanel>
              <div className={styles.panelContent}>
                {loadingKey === "reminders" ? (
                  <Spinner size="tiny" label="Loading..." />
                ) : reminders.length === 0 ? (
                  <div className={styles.empty}>No reminders</div>
                ) : (
                  reminders.map((r) => (
                    <button
                      key={r.id}
                      className={styles.item}
                      onClick={() => onNavigate("feature3")}
                    >
                      <span className={styles.itemTitle}>{r.title}</span>
                      <Badge
                        size="small"
                        color={r.status === "completed" ? "success" : "warning"}
                        appearance="filled"
                      >
                        {r.status}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* Feedback */}
          <AccordionItem value="feedback">
            <AccordionHeader size="small">Feedback</AccordionHeader>
            <AccordionPanel>
              <div className={styles.panelContent}>
                {loadingKey === "feedback" ? (
                  <Spinner size="tiny" label="Loading..." />
                ) : feedback.length === 0 ? (
                  <div className={styles.empty}>No feedback</div>
                ) : (
                  feedback.map((f) => (
                    <button
                      key={f.id}
                      className={styles.item}
                      onClick={() => onNavigate("feedback")}
                    >
                      <span className={styles.itemTitle}>
                        {"★".repeat(f.rating)} {f.category}
                      </span>
                      <span className={styles.itemDate}>{formatDate(f.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
