import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";

interface TimerState {
  seconds: number;
  running: boolean;
  preset: number;
  finished: boolean;
}

interface TimerContextValue {
  seconds: number;
  running: boolean;
  preset: number;
  finished: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setPreset: (minutes: number) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function playBellSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(830, ctx.currentTime);
    osc.frequency.setValueAtTime(830, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(830, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.6);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);

    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>({
    seconds: 25 * 60,
    running: false,
    preset: 25,
    finished: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.running && state.seconds > 0) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.seconds <= 1) {
            playBellSound();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Focus session complete!", {
                body: "Great work! Take a short break before your next session.",
              });
            }
            return { ...prev, seconds: 0, running: false, finished: true };
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.running, state.seconds]);

  const start = useCallback(() => {
    setState((prev) => (prev.seconds > 0 ? { ...prev, running: true, finished: false } : prev));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, running: false }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, seconds: prev.preset * 60, running: false, finished: false }));
  }, []);

  const setPreset = useCallback((minutes: number) => {
    setState({ seconds: minutes * 60, running: false, preset: minutes, finished: false });
  }, []);

  return (
    <TimerContext.Provider value={{ ...state, start, pause, reset, setPreset }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be inside TimerProvider");
  return ctx;
}
