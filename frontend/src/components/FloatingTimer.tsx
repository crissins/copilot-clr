import {
  makeStyles,
  tokens,
  shorthands,
  Button,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import {
  Play24Regular,
  Pause24Regular,
  ArrowReset24Regular,
  Dismiss16Regular,
  Timer24Regular,
} from "@fluentui/react-icons";
import { useTimer } from "../hooks/TimerContext";

const useStyles = makeStyles({
  container: {
    position: "fixed",
    bottom: "90px",
    right: "24px",
    zIndex: 10001,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    ...shorthands.borderRadius("24px"),
    ...shorthands.padding("8px", "16px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    transition: "all 200ms ease",
  },
  time: {
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    fontSize: "18px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorBrandForeground1,
    minWidth: "60px",
    textAlign: "center" as const,
  },
  finished: {
    color: tokens.colorPaletteGreenForeground1,
  },
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function FloatingTimer() {
  const styles = useStyles();
  const timer = useTimer();

  // Only show when timer is running, paused mid-session, or just finished
  const isActive = timer.running || timer.seconds < timer.preset * 60;
  if (!isActive && !timer.finished) return null;

  return (
    <div className={styles.container}>
      <Timer24Regular />
      <Text className={`${styles.time} ${timer.finished ? styles.finished : ""}`}>
        {timer.finished ? "Done!" : formatTime(timer.seconds)}
      </Text>
      {timer.finished ? (
        <Tooltip content="Reset timer" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowReset24Regular />}
            onClick={timer.reset}
          />
        </Tooltip>
      ) : timer.running ? (
        <Tooltip content="Pause" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Pause24Regular />}
            onClick={timer.pause}
          />
        </Tooltip>
      ) : (
        <>
          <Tooltip content="Resume" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<Play24Regular />}
              onClick={timer.start}
            />
          </Tooltip>
          <Tooltip content="Reset" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowReset24Regular />}
              onClick={timer.reset}
            />
          </Tooltip>
        </>
      )}
      <Tooltip content="Dismiss" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<Dismiss16Regular />}
          onClick={timer.reset}
        />
      </Tooltip>
    </div>
  );
}
