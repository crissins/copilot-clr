/**
 * Feature 5 — Task Decomposer
 *
 * AI-powered task decomposition for neurodiverse users. Takes a complex goal
 * and breaks it into numbered, time-boxed sub-tasks with priority, duration,
 * and focus tips. Uses calm, supportive language (RAI requirement).
 *
 * Backend: POST /api/tasks/decompose, GET/PATCH/DELETE /api/tasks/plans/*
 */

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  CardHeader,
  Text,
  Badge,
  Checkbox,
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
} from "@fluentui/react-components";
import {
  Delete24Regular,
  Trophy24Regular,
  Clock24Regular,
  Info24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { TaskPlan, TaskStep } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "800px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  inputSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  inputRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  goalInput: {
    flexGrow: 1,
  },
  stepCard: {
    ...shorthands.padding("16px"),
    ...shorthands.margin("0"),
  },
  stepHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    justifyContent: "space-between",
  },
  stepLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexGrow: 1,
  },
  stepMeta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  focusTip: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    ...shorthands.padding("8px", "12px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("6px"),
    marginTop: "8px",
  },
  completedStep: {
    opacity: 0.6,
    textDecoration: "line-through",
  },
  explanation: {
    ...shorthands.padding("12px", "16px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("8px"),
    fontStyle: "italic",
  },
  progressBar: {
    width: "100%",
    height: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("4px"),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.borderRadius("4px"),
    transition: "width 0.3s ease",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planActions: {
    display: "flex",
    gap: "8px",
  },
  historyItem: {
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  emptyState: {
    textAlign: "center" as const,
    ...shorthands.padding("40px"),
    color: tokens.colorNeutralForeground3,
  },
});

const PRIORITY_COLOR: Record<string, "important" | "informative" | "subtle"> = {
  high: "important",
  medium: "informative",
  low: "subtle",
};

export function Feature5Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [goal, setGoal] = useState("");
  const [readingLevel, setReadingLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | null>(null);
  const [history, setHistory] = useState<TaskPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
      try {
        const token = await getToken();
        const updated = await apiClient.toggleStep(
          currentPlan.id,
          stepId,
          completed,
          token
        );
        setCurrentPlan(updated);
        setHistory((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      } catch {
        setError("Could not update step. Please try again.");
      }
    },
    [currentPlan, getToken]
  );

  const handleDeletePlan = useCallback(
    async (planId: string) => {
      try {
        const token = await getToken();
        await apiClient.deleteTaskPlan(planId, token);
        setHistory((prev) => prev.filter((p) => p.id !== planId));
        if (currentPlan?.id === planId) setCurrentPlan(null);
      } catch {
        setError("Could not delete plan.");
      }
    },
    [currentPlan, getToken]
  );

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
    [getToken]
  );

  const completedCount =
    currentPlan?.steps.filter((s) => s.completed).length ?? 0;
  const totalSteps = currentPlan?.steps.length ?? 0;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const totalMinutes =
    currentPlan?.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0;
  const remainingMinutes =
    currentPlan?.steps
      .filter((s) => !s.completed)
      .reduce((sum, s) => sum + s.estimatedMinutes, 0) ?? 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Text size={700} weight="bold">
          Task Decomposer
        </Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Break a complex goal into clear, time-boxed steps. Take it one piece
          at a time — no rush.
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

      {/* Input */}
      <div className={styles.inputSection}>
        <Textarea
          className={styles.goalInput}
          placeholder="Describe your goal… e.g. 'Write a 2-page essay on climate change'"
          value={goal}
          onChange={(_, data) => setGoal(data.value)}
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
            appearance="primary"
            onClick={handleDecompose}
            disabled={loading || !goal.trim()}
            icon={loading ? <Spinner size="tiny" /> : undefined}
          >
            {loading ? "Breaking it down…" : "Break it down"}
          </Button>
          <Button
            appearance="subtle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Hide history" : "History"}
          </Button>
        </div>
      </div>

      <Divider />

      {/* History panel */}
      {showHistory && (
        <div>
          <Text size={500} weight="semibold">
            Past Plans
          </Text>
          {history.length === 0 ? (
            <div className={styles.emptyState}>
              <Text>No plans yet. Decompose a goal to get started.</Text>
            </div>
          ) : (
            history.map((plan) => (
              <Card
                key={plan.id}
                className={styles.historyItem}
                style={{ marginTop: 8 }}
              >
                <CardHeader
                  header={
                    <Text weight="semibold" truncate wrap={false}>
                      {plan.goal}
                    </Text>
                  }
                  description={
                    <Text size={200}>
                      {plan.steps.length} steps ·{" "}
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </Text>
                  }
                  action={
                    <div className={styles.planActions}>
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => handleLoadPlan(plan.id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<Delete24Regular />}
                        onClick={() => handleDeletePlan(plan.id)}
                      />
                    </div>
                  }
                />
              </Card>
            ))
          )}
          <Divider style={{ marginTop: 16 }} />
        </div>
      )}

      {/* Current plan */}
      {currentPlan && (
        <div>
          {/* Plan header + progress */}
          <div className={styles.planHeader}>
            <div>
              <Text size={500} weight="semibold">
                {currentPlan.goal}
              </Text>
              <div className={styles.stepMeta} style={{ marginTop: 4 }}>
                <Badge appearance="outline" icon={<Trophy24Regular />}>
                  {completedCount}/{totalSteps} done
                </Badge>
                <Badge appearance="outline" icon={<Clock24Regular />}>
                  ~{remainingMinutes} min left of {totalMinutes} min
                </Badge>
              </div>
            </div>
            <div className={styles.planActions}>
              <Tooltip content="Delete this plan" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  onClick={() => handleDeletePlan(currentPlan.id)}
                />
              </Tooltip>
            </div>
          </div>

          {/* Progress bar */}
          <div className={styles.progressBar} style={{ marginTop: 12 }}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Steps */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {currentPlan.steps.map((step: TaskStep, idx: number) => (
              <Card key={step.id} className={styles.stepCard}>
                <div className={styles.stepHeader}>
                  <div className={styles.stepLeft}>
                    <Checkbox
                      checked={step.completed}
                      onChange={(_, data) =>
                        handleToggleStep(step.id, !!data.checked)
                      }
                    />
                    <div>
                      <Text
                        weight="semibold"
                        className={step.completed ? styles.completedStep : ""}
                      >
                        {idx + 1}. {step.title}
                      </Text>
                      <div className={styles.stepMeta}>
                        <Badge
                          size="small"
                          color={PRIORITY_COLOR[step.priority] ?? "informative"}
                        >
                          {step.priority}
                        </Badge>
                        <Badge size="small" appearance="outline" icon={<Clock24Regular />}>
                          {step.estimatedMinutes} min
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                {step.focusTip && (
                  <div className={styles.focusTip}>
                    <Info24Regular />
                    <Text size={200}>{step.focusTip}</Text>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Explanation */}
          {currentPlan.explanation && (
            <div className={styles.explanation} style={{ marginTop: 16 }}>
              <Text size={200}>
                <strong>Why this breakdown:</strong> {currentPlan.explanation}
              </Text>
            </div>
          )}

          {/* All done celebration */}
          {completedCount === totalSteps && totalSteps > 0 && (
            <MessageBar intent="success" style={{ marginTop: 16 }}>
              <MessageBarBody>
                <MessageBarTitle>All done!</MessageBarTitle>
                Great work — you completed every step. Take a moment to feel
                good about what you achieved.
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}

      {/* Empty state */}
      {!currentPlan && !showHistory && (
        <div className={styles.emptyState}>
          <Text size={400}>
            Type a goal above and press "Break it down" to get started.
          </Text>
        </div>
      )}
    </div>
  );
}
