import { useEffect, useRef } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";

interface Props {
  isActive: boolean;
  isSpeaking?: boolean;
}

const BAR_COUNT = 5;

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    height: "32px",
    ...shorthands.padding("0", "8px"),
  },
  bar: {
    width: "4px",
    ...shorthands.borderRadius("2px"),
    transition: "height 150ms ease, background-color 300ms ease",
  },
});

export function VoiceVisualizer({ isActive, isSpeaking }: Props) {
  const styles = useStyles();
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive && !isSpeaking) {
      // Reset to idle
      barsRef.current.forEach((bar) => {
        if (bar) {
          bar.style.height = "4px";
          bar.style.backgroundColor = tokens.colorNeutralStroke1;
        }
      });
      return;
    }

    let running = true;
    const color = isSpeaking
      ? tokens.colorPaletteGreenBorder2
      : tokens.colorBrandStroke1;

    const animate = () => {
      if (!running) return;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        // Gentle wave animation — each bar offset in phase
        const time = Date.now() / 400 + i * 0.7;
        const height = 6 + Math.sin(time) * 10 + Math.random() * 2;
        bar.style.height = `${Math.max(4, height)}px`;
        bar.style.backgroundColor = color;
      });
      frameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, isSpeaking]);

  return (
    <div
      className={styles.root}
      role="img"
      aria-label={
        isActive
          ? "Listening to your voice"
          : isSpeaking
          ? "Assistant is speaking"
          : "Voice inactive"
      }
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className={styles.bar}
          style={{
            height: "4px",
            backgroundColor: tokens.colorNeutralStroke1,
          }}
        />
      ))}
    </div>
  );
}
