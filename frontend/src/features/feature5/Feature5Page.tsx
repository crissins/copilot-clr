/**
 * Feature 5 — Task Decomposer
 *
 * Users paste a complex goal and the AI breaks it into numbered, time-boxed
 * sub-tasks with priority, duration, and focus tips. Results render as an
 * interactive checklist. Task state persists across sessions via Cosmos DB.
 *
 * RAI: Language is calm and supportive. Agent explains decomposition choices.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Textarea,
  Spinner,
  Text,
  Badge,
  Checkbox,
  Card,
  Tooltip,
  Divider,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Delete24Regular,
  Clock24Regular,
  Info24Regular,
  Alert24Regular,
  Lightbulb24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  ArrowClockwise24Regular,
} from "@fluentui/react-icons";
import { apiClient, type TaskPlan, type TaskStep } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    maxWidth: "860px",
    margin: "0 auto",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    ...shorthands.padding("20px", "24px", "12px"),
    flexShrink: 0,
  },
  title: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "4px",
  },
  subtitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase300,
  },
  inputSection: {
    ...shorthands.padding("0", "24px", "16px"),
    flexShrink: 0,
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    minHeight: "60px",
    maxHeight: "120px",
    resize: "none",
  },
  sendBtn: {
    flexShrink: 0,
    height: "44px",
    minWidth: "140px",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    ...shorthands.padding("0", "24px", "24px"),
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    ...shorthands.padding("40px"),
    color: tokens.colorNeutralForeground3,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    gap: "8px",
    ...shorthands.padding("48px", "24px"),
  },
  taskCard: {
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  taskCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "8px",
  },
  goalText: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    flex: 1,
  },
  taskActions: {
    display: "flex",
    gap: "4px",
    flexShrink: 0,
  },
  progressRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  progressBar: {
    flex: 1,
    height: "6px",
    ...shorthands.borderRadius("3px"),
    backgroundColor: tokens.colorNeutralBackground5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    ...shorthands.borderRadius("3px"),
    backgroundColor: tokens.colorBrandBackground,
    transition: "width 300ms ease",
  },
  progressText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  stepList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "400px",
    overflowY: "auto",
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    ...shorthands.padding("10px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    transition: "background-color 200ms ease, opacity 200ms ease",
  },
  stepItemCompleted: {
    opacity: 0.7,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  stepContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  stepTitle: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
  },
  stepTitleCompleted: {
    textDecoration: "line-through",
    color: tokens.colorNeutralForeground3,
  },
  stepMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  focusTip: {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
    ...shorthands.padding("4px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorBrandBackground2,
    marginTop: "4px",
  },
  explanationBox: {
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding("8px", "0"),
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  totalTime: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    ...shorthands.padding("8px", "0"),
  },
});

// ── Priority badge helper ───────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const colorMap: Record<string, "danger" | "warning" | "success"> = {
    high: "danger",
    medium: "warning",
    low: "success",
  };
  return (
    <Badge
      size="small"
      color={colorMap[priority] ?? "informative"}
      appearance="filled"
    >
      {priority}
    </Badge>
  );
}

// ── Step item component ─────────────────────────────────────────────────────

interface StepItemProps {
  step: TaskStep;
  stepNumber: number;
  onToggle: (stepId: string, completed: boolean) => void;
  disabled: boolean;
}

function StepItem({ step, stepNumber, onToggle, disabled }: StepItemProps) {
  const styles = useStyles();
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className={mergeClasses(
        styles.stepItem,
        step.completed && styles.stepItemCompleted
      )}
    >
      <Checkbox
        checked={step.completed}
        onChange={() => onToggle(step.id, !step.completed)}
        disabled={disabled}
        aria-label={`Step ${stepNumber}: ${step.title}`}
      />
      <div className={styles.stepContent}>
        <Text
          className={mergeClasses(
            styles.stepTitle,
            step.completed && styles.stepTitleCompleted
          )}
        >
          {stepNumber}. {step.title}
        </Text>
        <div className={styles.stepMeta}>
          <span className={styles.metaItem}>
            <Clock24Regular style={{ width: 14, height: 14 }} />
            {step.estimatedMinutes} min
          </span>
          <PriorityBadge priority={step.priority} />
          <Tooltip content={showTip ? "Hide focus tip" : "Show focus tip"} relationship="label">
            <Button
              disabled={step.completed}
              appearance="subtle"
              size="small"
              icon={<Lightbulb24Regular />}
              onClick={() => setShowTip(!showTip)}
              aria-label="Toggle focus tip"
              style={{ minWidth: "auto", padding: "2px 4px" }}
            />
          </Tooltip>
        </div>
        {showTip && (
          <div className={styles.focusTip}>
            <Lightbulb24Regular style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
            {step.focusTip}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task plan card component ────────────────────────────────────────────────

interface TaskPlanCardProps {
  plan: TaskPlan;
  onToggleStep: (taskId: string, stepId: string, completed: boolean) => void;
  onDelete: (taskId: string) => void;
  isUpdating: boolean;
}

function TaskPlanCard({ plan, onToggleStep, onDelete, isUpdating }: TaskPlanCardProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);

  const completedCount = plan.steps.filter((s) => s.completed).length;
  const totalCount = plan.steps.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const totalMinutes = plan.steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const remainingMinutes = plan.steps
    .filter((s) => !s.completed)
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return (
    <Card className={styles.taskCard}>
      <div className={styles.taskCardHeader}>
        <Text className={styles.goalText}>{plan.goal}</Text>
        <div className={styles.taskActions}>
          {plan.explanation && (
            <Tooltip content="Why was it split this way?" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Info24Regular />}
                onClick={() => setShowExplanation(!showExplanation)}
                aria-label="Show decomposition explanation"
              />
            </Tooltip>
          )}
          <Tooltip content={expanded ? "Collapse steps" : "Expand steps"} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={expanded ? <ChevronUp24Regular /> : <ChevronDown24Regular />}
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse steps" : "Expand steps"}
            />
          </Tooltip>
          <Tooltip content="Delete this plan" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete24Regular />}
              onClick={() => onDelete(plan.id)}
              aria-label="Delete task plan"
            />
          </Tooltip>
        </div>
      </div>

      {/* Progress bar */}
      {expanded && (
        <div className={styles.progressRow}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <Text className={styles.progressText}>
            {completedCount}/{totalCount} done
          </Text>
        </div>
      )}

      {/* Time estimate */}
      {expanded && (
        <div className={styles.totalTime}>
          <Clock24Regular style={{ width: 16, height: 16 }} />
          {remainingMinutes > 0 ? (
            <span>About {remainingMinutes} min remaining (total: {totalMinutes} min)</span>
          ) : (
            <span>All steps completed! Total was {totalMinutes} min</span>
          )}
        </div>
      )}

      {/* Explanation */}
      {showExplanation && plan.explanation && (
        <div className={styles.explanationBox}>
          <Info24Regular style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <span>{plan.explanation}</span>
        </div>
      )}

      {/* Steps */}
      {expanded && (
        <div className={styles.stepList}>
          {plan.steps.map((step, idx) => (
            <StepItem
              key={step.id}
              step={step}
              stepNumber={idx + 1}
              onToggle={(stepId, completed) => onToggleStep(plan.id, stepId, completed)}
              disabled={isUpdating}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main page component ─────────────────────────────────────────────────────

export function Feature5Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const [goalInput, setGoalInput] = useState("");
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [taskPlans, setTaskPlans] = useState<TaskPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load existing task plans on mount
  const loadPlans = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const plans = await apiClient.listTaskPlans(token);
      setTaskPlans(plans);
    } catch (err) {
      console.error("Failed to load task plans:", err);
    } finally {
      setIsLoadingPlans(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleDecompose = useCallback(async () => {
    const goal = goalInput.trim();
    if (!goal || isDecomposing) return;

    setError(null);
    setIsDecomposing(true);

    try {
      const token = await getAccessToken();
      const response = await apiClient.decomposeTask(goal, "", token);
      setTaskPlans((prev) => [response.task, ...prev]);
      setGoalInput("");
    } catch (err) {
      console.error("Decompose failed:", err);
      setError(
        "Something went wrong while breaking down your goal. Please try again."
      );
    } finally {
      setIsDecomposing(false);
    }
  }, [goalInput, isDecomposing, getAccessToken]);

  const handleToggleStep = useCallback(
    async (taskId: string, stepId: string, completed: boolean) => {
      setIsUpdating(true);
      try {
        const token = await getAccessToken();
        const updatedTask = await apiClient.toggleStep(taskId, stepId, completed, token);
        setTaskPlans((prev) =>
          prev.map((p) => (p.id === taskId ? updatedTask : p))
        );
      } catch (err) {
        console.error("Toggle step failed:", err);
      } finally {
        setIsUpdating(false);
      }
    },
    [getAccessToken]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        const token = await getAccessToken();
        await apiClient.deleteTaskPlan(taskId, token);
        setTaskPlans((prev) => prev.filter((p) => p.id !== taskId));
      } catch (err) {
        console.error("Delete task plan failed:", err);
      }
    },
    [getAccessToken]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleDecompose();
    }
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Text className={styles.title}>Task Decomposer</Text>
        <br />
        <Text className={styles.subtitle}>
          Paste a complex goal and let the AI break it into clear, time-boxed
          steps you can check off one by one. Take your time — there is no rush.
        </Text>
      </div>

      {/* Input section */}
      <div className={styles.inputSection}>
        <div className={styles.inputRow}>
          <Textarea
            className={styles.textarea}
            value={goalInput}
            onChange={(_, d) => setGoalInput(d.value)}
            onKeyDown={handleKeyDown}
            placeholder='Describe your goal, e.g. "Set up my tax return" or "Organize my study schedule for next week"'
            disabled={isDecomposing}
            resize="none"
            aria-label="Goal input"
          />
          <Button
            className={styles.sendBtn}
            appearance="primary"
            icon={isDecomposing ? <Spinner size="tiny" /> : <Send24Regular />}
            onClick={handleDecompose}
            disabled={!goalInput.trim() || isDecomposing}
          >
            {isDecomposing ? "Breaking down..." : "Break it down"}
          </Button>
        </div>
        {error && (
          <Text
            style={{
              color: tokens.colorPaletteRedForeground1,
              fontSize: tokens.fontSizeBase200,
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Alert24Regular style={{ width: 14, height: 14 }} />
            {error}
          </Text>
        )}
      </div>

      <Divider style={{ maxHeight: 10}} />

      {/* Content area */}
      <div className={styles.content}>
        {isDecomposing && (
          <div className={styles.loadingBox}>
            <Spinner size="medium" />
            <Text>
              Breaking your goal into clear steps... This may take a moment.
            </Text>
          </div>
        )}

        {isLoadingPlans && !isDecomposing && (
          <div className={styles.loadingBox}>
            <Spinner size="small" />
            <Text>Loading your task plans...</Text>
          </div>
        )}

        {!isLoadingPlans && !isDecomposing && taskPlans.length === 0 && (
          <div className={styles.emptyState}>
            <Text style={{ fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold }}>
              No task plans yet
            </Text>
            <Text>
              Enter a complex goal above and the AI will break it into
              manageable, time-boxed steps for you.
            </Text>
          </div>
        )}

        {!isLoadingPlans && taskPlans.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>
                Your Task Plans ({taskPlans.length})
              </Text>
              <Tooltip content="Refresh plans" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ArrowClockwise24Regular />}
                  onClick={loadPlans}
                  aria-label="Refresh task plans"
                />
              </Tooltip>
            </div>
            {taskPlans.map((plan) => (
              <TaskPlanCard
                key={plan.id}
                plan={plan}
                onToggleStep={handleToggleStep}
                onDelete={handleDelete}
                isUpdating={isUpdating}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
