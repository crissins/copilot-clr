import { useEffect, useRef, useCallback } from "react";
import { useSharedSettings } from "./SettingsContext";

/**
 * Manages focus timer and break reminder notifications.
 * - Shows a break reminder notification every `breakReminderMinutes`.
 * - Shows a focus timer notification after `focusTimerMinutes`.
 * - Notification style affects the visual approach (calm / standard / prominent).
 */
export function useFocusTimer() {
  const { settings } = useSharedSettings();
  const breakIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showNotification = useCallback(
    (title: string, body: string) => {
      const style = settings?.notificationStyle || "calm";

      // Try native Notification API first
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          silent: style === "calm",
          tag: title, // prevent duplicates
        });
        return;
      }

      // Fallback: visually-styled toast
      const toast = document.createElement("div");
      toast.setAttribute("role", "alert");
      toast.setAttribute("aria-live", style === "prominent" ? "assertive" : "polite");
      Object.assign(toast.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "99999",
        padding: "16px 24px",
        borderRadius: "8px",
        fontSize: "var(--user-font-size, 16px)",
        fontFamily: "var(--user-font-family, inherit)",
        maxWidth: "360px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        background: style === "prominent" ? "#0078d4" : "#333",
        color: "#fff",
        opacity: "0",
        transition: "opacity 0.3s",
      });
      toast.innerHTML = `<strong>${title}</strong><br/>${body}`;
      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });

      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
      }, style === "prominent" ? 8000 : 5000);
    },
    [settings?.notificationStyle],
  );

  useEffect(() => {
    // Request notification permission on mount (non-blocking)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Clear previous timers
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);

    if (!settings) return;

    const breakMs = (settings.breakReminderMinutes || 5) * 60 * 1000;
    const focusMs = (settings.focusTimerMinutes || 25) * 60 * 1000;

    // Break reminder — repeating
    breakIntervalRef.current = setInterval(() => {
      showNotification(
        "Time for a break! 🧘",
        `You've been working for ${settings.breakReminderMinutes} minutes. Stretch, breathe, or grab some water.`,
      );
    }, breakMs);

    // Focus timer — one-shot
    focusTimeoutRef.current = setTimeout(() => {
      showNotification(
        "Focus session complete! 🎉",
        `Great job staying focused for ${settings.focusTimerMinutes} minutes!`,
      );
    }, focusMs);

    return () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, [
    settings?.breakReminderMinutes,
    settings?.focusTimerMinutes,
    settings?.notificationStyle,
    showNotification,
  ]);
}
