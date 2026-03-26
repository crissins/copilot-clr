import { useState } from "react";
import {
  Text,
  Badge,
  Button,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ChevronDown24Regular,
  ChevronUp24Regular,
} from "@fluentui/react-icons";

export interface TaskStep {
  id: string;
  title: string;
  detail?: string;
  timeEstimate?: string;
  completed: boolean;
}

interface Props {
  steps: TaskStep[];
  onToggleStep: (stepId: string) => void;
  title?: string;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    width: "100%",
    maxWidth: "480px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("4px", "0", "8px"),
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  progressText: {
    color: tokens.colorNeutralForeground3,
  },
  stepList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    ...shorthands.padding("10px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    transition: "background 150ms ease",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  stepCompleted: {
    opacity: 0.7,
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    lineHeight: tokens.lineHeightBase300,
  },
  stepTitleDone: {
    textDecorationLine: "line-through",
    color: tokens.colorNeutralForeground3,
  },
  stepDetail: {
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  timeBadge: {
    flexShrink: 0,
    marginTop: "2px",
  },
  stepNumber: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    flexShrink: 0,
    marginTop: "2px",
  },
  stepNumberDone: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  celebration: {
    textAlign: "center",
    ...shorthands.padding("12px"),
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  expandBtn: {
    alignSelf: "center",
  },
});

export function TaskBreakdown({ steps, onToggleStep, title }: Props) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);

  const completedCount = steps.filter((s) => s.completed).length;
  const allDone = completedCount === steps.length && steps.length > 0;

  // Find current step (first incomplete)
  const currentIndex = steps.findIndex((s) => !s.completed);

  return (
    <div className={styles.root} role="list" aria-label={title ?? "Task steps"}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Text weight="semibold" size={300}>
            {title ?? "Your steps"}
          </Text>
          <Text size={200} className={styles.progressText}>
            {completedCount}/{steps.length} completed
          </Text>
        </div>
        <Button
          className={styles.expandBtn}
          appearance="subtle"
          size="small"
          icon={expanded ? <ChevronUp24Regular /> : <ChevronDown24Regular />}
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse steps" : "Expand steps"}
        />
      </div>

      {/* Steps */}
      {expanded && (
        <div className={styles.stepList}>
          {steps.map((step, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={step.id}
                className={mergeClasses(
                  styles.stepItem,
                  step.completed && styles.stepCompleted
                )}
                role="listitem"
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* Step number / check */}
                <button
                  className={mergeClasses(
                    styles.stepNumber,
                    step.completed && styles.stepNumberDone
                  )}
                  onClick={() => onToggleStep(step.id)}
                  aria-label={
                    step.completed
                      ? `Step ${idx + 1} completed: ${step.title}. Click to undo.`
                      : `Mark step ${idx + 1} complete: ${step.title}`
                  }
                  style={{
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  {step.completed ? "✓" : idx + 1}
                </button>

                {/* Content */}
                <div className={styles.stepContent}>
                  <Text
                    size={300}
                    className={mergeClasses(
                      styles.stepTitle,
                      step.completed && styles.stepTitleDone
                    )}
                    weight={isCurrent ? "semibold" : "regular"}
                  >
                    {step.title}
                  </Text>
                  {step.detail && !step.completed && (
                    <Text size={200} className={styles.stepDetail}>
                      {step.detail}
                    </Text>
                  )}
                </div>

                {/* Time estimate */}
                {step.timeEstimate && (
                  <Badge
                    className={styles.timeBadge}
                    appearance="outline"
                    color={step.completed ? "success" : "informative"}
                    size="small"
                  >
                    {step.timeEstimate}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Celebration */}
      {allDone && (
        <Text className={styles.celebration} aria-live="polite">
           All steps completed. Great work!
        </Text>
      )}
    </div>
  );
}
