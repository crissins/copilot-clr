import { useEffect, useState } from "react";
import {
  Text,
  Button,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import { Dismiss16Regular } from "@fluentui/react-icons";

export type NotificationType = "encouragement" | "tip" | "reminder";

interface Props {
  message: string;
  type?: NotificationType;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    ...shorthands.padding("10px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    animationDuration: "400ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "translateY(8px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
  },
  encouragement: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteGreenBorder1),
  },
  tip: {
    backgroundColor: tokens.colorPaletteBlueBorderActive,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.border("1px", "solid", tokens.colorPaletteBlueBorderActive),
  },
  reminder: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground2,
    ...shorthands.border("1px", "solid", tokens.colorPaletteYellowBorder1),
  },
  messageText: {
    flex: 1,
  },
  dismissBtn: {
    flexShrink: 0,
    minWidth: "auto",
    height: "auto",
    ...shorthands.padding("2px"),
  },
  exiting: {
    animationDuration: "300ms",
    animationTimingFunction: "ease-in",
    animationName: {
      from: { opacity: 1, transform: "translateY(0)" },
      to: { opacity: 0, transform: "translateY(-8px)" },
    },
    animationFillMode: "forwards",
  },
});

export function CalmNotification({
  message,
  type = "encouragement",
  autoDismissMs = 6000,
  onDismiss,
}: Props) {
  const styles = useStyles();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss?.(), 300);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss?.(), 300);
  };

  const typeStyle =
    type === "tip"
      ? styles.tip
      : type === "reminder"
      ? styles.reminder
      : styles.encouragement;

  return (
    <div
      className={mergeClasses(styles.root, typeStyle, exiting && styles.exiting)}
      role="status"
      aria-live="polite"
    >
      <Text className={styles.messageText}>{message}</Text>
      <Button
        className={styles.dismissBtn}
        appearance="subtle"
        size="small"
        icon={<Dismiss16Regular />}
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      />
    </div>
  );
}
