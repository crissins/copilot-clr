import { useState, useEffect, useCallback, useRef } from "react";
import {
  Button,
  Text,
  ProgressBar,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Play24Regular,
  Pause24Regular,
  Dismiss24Regular,
  Timer24Regular,
} from "@fluentui/react-icons";

interface Props {
  /** Duration in minutes */
  duration?: number;
  onComplete?: () => void;
  onDismiss?: () => void;
}

const PRESET_DURATIONS = [5, 10, 15, 25];

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("16px", "20px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    maxWidth: "320px",
    width: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  timerIcon: {
    color: tokens.colorBrandForeground1,
  },
  presetRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  presetBtn: {
    minWidth: "48px",
  },
  visualContainer: {
    position: "relative",
    width: "120px",
    height: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // Growing tree metaphor — a circle that fills up gently
  treeRing: {
    position: "absolute",
    width: "100%",
    height: "100%",
    ...shorthands.borderRadius("50%"),
    ...shorthands.border("4px", "solid", tokens.colorNeutralStroke1),
    transition: "border-color 300ms ease",
  },
  treeRingActive: {
    ...shorthands.border("4px", "solid", tokens.colorPaletteGreenBorder2),
  },
  treeFill: {
    position: "absolute",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorPaletteGreenBackground2,
    transition: "all 1s ease",
    opacity: 0.35,
  },
  timeDisplay: {
    zIndex: 1,
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    fontVariantNumeric: "tabular-nums",
  },
  controls: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
  },
  encouragement: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
    textAlign: "center",
    minHeight: "20px",
  },
});

const ENCOURAGEMENTS = [
  "You're doing great. Keep going at your own pace.",
  "One step at a time. You've got this.",
  "Nice focus! Take a breath if you need one.",
  "Steady progress is still progress.",
  "You're building momentum. Well done!",
];

export function FocusTimer({ duration, onComplete, onDismiss }: Props) {
  const styles = useStyles();

  const [selectedMinutes, setSelectedMinutes] = useState(duration ?? 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [encouragement, setEncouragement] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEncouragementRef = useRef(0);

  const totalSeconds = selectedMinutes * 60;
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  const displayMin = Math.floor(elapsedSeconds / 60);
  const displaySec = elapsedSeconds % 60;

  // Count-up timer (less anxiety than countdown per guidance)
  useEffect(() => {
    if (isRunning && selectedMinutes > 0) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Show encouragement every 25% milestone
          const quarter = Math.floor(totalSeconds / 4);
          if (quarter > 0 && next % quarter === 0 && next < totalSeconds) {
            const idx = Math.floor(next / quarter) - 1;
            setEncouragement(
              ENCOURAGEMENTS[idx % ENCOURAGEMENTS.length]
            );
            lastEncouragementRef.current = next;
          }
          if (next >= totalSeconds) {
            setEncouragement("Well done! You completed your focus session.");
            onComplete?.();
            return totalSeconds;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, selectedMinutes, totalSeconds, onComplete]);

  // Stop when complete
  useEffect(() => {
    if (elapsedSeconds >= totalSeconds && totalSeconds > 0) {
      setIsRunning(false);
    }
  }, [elapsedSeconds, totalSeconds]);

  const togglePause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handlePreset = useCallback((mins: number) => {
    setSelectedMinutes(mins);
    setElapsedSeconds(0);
    setIsRunning(false);
    setEncouragement("");
  }, []);

  const handleDismiss = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onDismiss?.();
  }, [onDismiss]);

  // Tree-fill size based on progress
  const fillSize = Math.min(progress * 100, 100);

  const isComplete = elapsedSeconds >= totalSeconds && totalSeconds > 0;
  const hasStarted = selectedMinutes > 0;

  return (
    <div className={styles.root} role="timer" aria-label="Focus timer">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Timer24Regular className={styles.timerIcon} />
          <Text weight="semibold" size={300}>
            Focus Timer
          </Text>
        </div>
        <Tooltip content="Hide timer" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={handleDismiss}
            aria-label="Hide timer"
          />
        </Tooltip>
      </div>

      {/* Presets */}
      {!isRunning && !isComplete && (
        <div className={styles.presetRow}>
          {PRESET_DURATIONS.map((m) => (
            <Button
              key={m}
              className={styles.presetBtn}
              appearance={selectedMinutes === m ? "primary" : "outline"}
              size="small"
              onClick={() => handlePreset(m)}
            >
              {m}m
            </Button>
          ))}
        </div>
      )}

      {/* Visual — growing circle (tree metaphor) */}
      {hasStarted && (
        <div className={styles.visualContainer}>
          <div
            className={mergeClasses(
              styles.treeRing,
              isRunning && styles.treeRingActive
            )}
          />
          <div
            className={styles.treeFill}
            style={{
              width: `${fillSize}%`,
              height: `${fillSize}%`,
            }}
          />
          <Text className={styles.timeDisplay}>
            {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")}
          </Text>
        </div>
      )}

      {/* Progress bar — gentle, non-intrusive */}
      {hasStarted && (
        <ProgressBar
          className={styles.progressBar}
          value={progress}
          color={isComplete ? "success" : "brand"}
          thickness="large"
          aria-label={`${Math.round(progress * 100)}% of focus time elapsed`}
        />
      )}

      {/* Controls */}
      {hasStarted && !isComplete && (
        <div className={styles.controls}>
          <Button
            appearance="primary"
            icon={isRunning ? <Pause24Regular /> : <Play24Regular />}
            onClick={togglePause}
            aria-label={isRunning ? "Pause timer" : "Start timer"}
          >
            {isRunning ? "Pause" : "Start"}
          </Button>
        </div>
      )}

      {isComplete && (
        <Button appearance="primary" onClick={() => handlePreset(selectedMinutes)}>
          Start another session
        </Button>
      )}

      {/* Encouragement — calm, supportive feedback */}
      {encouragement && (
        <Text
          size={200}
          className={styles.encouragement}
          aria-live="polite"
        >
          {encouragement}
        </Text>
      )}
    </div>
  );
}
