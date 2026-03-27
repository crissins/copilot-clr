/**
 * Feature 3 — Reminders & Focus
 *
 * Create, view, and manage reminders with gentle nudges for staying on track.
 * Includes an integrated focus timer for time-boxed work sessions.
 *
 * Backend: POST/GET /api/reminders, PUT/DELETE /api/reminders/{id}
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Card,
  Text,
  Badge,
  Spinner,
  Input,
  Textarea,
  Select,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  Timer24Regular,
  Add24Regular,
  Delete24Regular,
  Checkmark24Regular,
  PlayCircle24Regular,
  PauseCircle24Regular,
  ArrowReset24Regular,
  Alert24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { Reminder } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "1100px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    overflowY: "auto",
    height: "100%",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  topRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
  section: {
    display: "flex", flexDirection: "column", gap: "12px",
    ...shorthands.padding("20px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
  },
  formRow: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" },
  reminderCard: { ...shorthands.padding("16px"), position: "relative" as const },
  reminderRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
  },
  reminderLeft: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  reminderActions: { display: "flex", gap: "4px", flexShrink: 0 },
  timerSection: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
    ...shorthands.padding("24px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
  },
  timerDisplay: {
    fontSize: "48px",
    fontWeight: tokens.fontWeightBold,
    fontVariantNumeric: "tabular-nums",
    color: tokens.colorBrandForeground1,
  },
  timerControls: { display: "flex", gap: "12px" },
  timerPresets: { display: "flex", gap: "8px", flexWrap: "wrap" },
  empty: {
    textAlign: "center" as const,
    ...shorthands.padding("24px"),
    color: tokens.colorNeutralForeground3,
  },
  metaBadges: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" },
});

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function Feature3Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  // ── Reminders state ──
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [channel, setChannel] = useState("push");
  const [recurring, setRecurring] = useState("");

  // ── Focus timer state ──
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState(25);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load reminders
  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const items = await apiClient.listReminders(token);
      setReminders(Array.isArray(items) ? items : []);
    } catch {
      setError("Could not load reminders.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => { loadReminders(); }, [loadReminders]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            // Gentle notification when timer ends
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Focus session complete!", {
                body: "Great work! Take a short break before your next session.",
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerSeconds]);

  // Create reminder
  const handleCreate = useCallback(async () => {
    if (!title.trim() || !scheduledTime) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getAccessToken();
      await apiClient.createReminder(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          scheduledTime,
          channel,
          recurring: recurring || undefined,
        },
        token,
      );
      setSuccessMsg("Reminder created! You will be gently reminded at the scheduled time.");
      setTitle("");
      setDescription("");
      setScheduledTime("");
      setRecurring("");
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create reminder.");
    } finally {
      setCreating(false);
    }
  }, [title, description, scheduledTime, channel, recurring, getAccessToken, loadReminders]);

  // Complete reminder
  const handleComplete = useCallback(async (id: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.updateReminder(id, { status: "completed" } as Partial<Reminder>, token);
      setSuccessMsg("Reminder marked complete. Well done!");
      await loadReminders();
    } catch {
      setError("Could not update reminder.");
    }
  }, [getAccessToken, loadReminders]);

  // Delete reminder
  const handleDelete = useCallback(async (id: string) => {
    try {
      const token = await getAccessToken();
      await apiClient.deleteReminder(id, token);
      await loadReminders();
    } catch {
      setError("Could not delete reminder.");
    }
  }, [getAccessToken, loadReminders]);

  // Timer helpers
  const startTimer = () => {
    if (timerSeconds === 0) setTimerSeconds(timerPreset * 60);
    setTimerRunning(true);
    // Request notification permission on first start
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };
  const pauseTimer = () => setTimerRunning(false);
  const resetTimer = () => { setTimerRunning(false); setTimerSeconds(timerPreset * 60); };
  const setPreset = (mins: number) => { setTimerPreset(mins); setTimerSeconds(mins * 60); setTimerRunning(false); };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Timer24Regular />
          <Text size={600} weight="bold">Reminders & Focus</Text>
        </div>
      </div>
      <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
        Set gentle reminders, manage your schedule, and use the focus timer to
        stay on track without feeling overwhelmed. Everything here is optional
        — use only what helps you.
      </Text>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody><MessageBarTitle>Oops</MessageBarTitle>{error}</MessageBarBody>
        </MessageBar>
      )}
      {successMsg && (
        <MessageBar intent="success">
          <MessageBarBody><MessageBarTitle>Done</MessageBarTitle>{successMsg}</MessageBarBody>
        </MessageBar>
      )}

      {/* Timer + Reminder form side by side */}
      <div className={styles.topRow}>
        {/* Focus Timer */}
        <div className={styles.timerSection}>
          <Text size={500} weight="semibold">Focus Timer</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Short, timed work sessions can help you stay focused. Pick a duration and press Start.
          </Text>
          <div className={styles.timerPresets}>
            {[5, 10, 15, 25, 45].map((m) => (
              <Button
                key={m}
                appearance={timerPreset === m ? "primary" : "outline"}
                size="small"
                onClick={() => setPreset(m)}
              >
                {m} min
              </Button>
            ))}
          </div>
          <div className={styles.timerDisplay}>{formatTimer(timerSeconds)}</div>
          <div className={styles.timerControls}>
            {!timerRunning ? (
              <Button appearance="primary" icon={<PlayCircle24Regular />} onClick={startTimer}>
                {timerSeconds === 0 ? "Restart" : "Start"}
              </Button>
            ) : (
              <Button appearance="secondary" icon={<PauseCircle24Regular />} onClick={pauseTimer}>
                Pause
              </Button>
            )}
            <Button appearance="subtle" icon={<ArrowReset24Regular />} onClick={resetTimer}>
              Reset
            </Button>
          </div>
          {timerSeconds === 0 && (
            <MessageBar intent="success" style={{ maxWidth: 400 }}>
              <MessageBarBody>Session complete — great work! Take a short break.</MessageBarBody>
            </MessageBar>
          )}
        </div>

        {/* Create Reminder */}
        <div className={styles.section}>
          <Text size={500} weight="semibold">New Reminder</Text>
          <div className={styles.formRow}>
            <Input
              placeholder="What would you like to be reminded about?"
              value={title}
              onChange={(_, d) => setTitle(d.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                backgroundColor: tokens.colorNeutralBackground1,
                color: tokens.colorNeutralForeground1,
              }}
            />
          </div>
          <Textarea
            placeholder="Optional: add more details (keep it simple!)"
            value={description}
            onChange={(_, d) => setDescription(d.value)}
            rows={2}
          />
          <div className={styles.formRow}>
            <Select value={channel} onChange={(_, d) => setChannel(d.value)} style={{ minWidth: 140 }}>
              <option value="push">Push notification</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </Select>
            <Select value={recurring} onChange={(_, d) => setRecurring(d.value)} style={{ minWidth: 140 }}>
              <option value="">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Weekdays</option>
            </Select>
            <Button
              appearance="primary"
              icon={creating ? <Spinner size="tiny" /> : <Add24Regular />}
              onClick={handleCreate}
              disabled={creating || !title.trim() || !scheduledTime}
            >
              {creating ? "Creating..." : "Add Reminder"}
            </Button>
          </div>
        </div>
      </div>

      <Divider />

      {/* Reminder list */}
      <div>
        <Text size={500} weight="semibold">Your Reminders</Text>
        {loading ? (
          <Spinner label="Loading reminders..." style={{ marginTop: 16 }} />
        ) : reminders.length === 0 ? (
          <div className={styles.empty}>
            <Alert24Regular style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
            <Text>No reminders yet. Create one above to get started.</Text>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: 8 }}>
            {reminders.map((r) => (
              <Card key={r.id} className={styles.reminderCard}>
                <div className={styles.reminderRow}>
                  <div className={styles.reminderLeft}>
                    <Text weight="semibold">{r.title}</Text>
                    {r.description && <Text size={200}>{r.description}</Text>}
                    <div className={styles.metaBadges}>
                      <Badge appearance="outline" size="small">
                        {new Date(r.scheduledTime).toLocaleString()}
                      </Badge>
                      <Badge appearance="tint" color="brand" size="small">{r.channel}</Badge>
                      {r.recurring && (
                        <Badge appearance="tint" color="informative" size="small">{r.recurring}</Badge>
                      )}
                      <Badge
                        appearance="filled"
                        color={r.status === "completed" ? "success" : r.status === "active" ? "brand" : "warning"}
                        size="small"
                      >
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                  <div className={styles.reminderActions}>
                    {r.status !== "completed" && (
                      <Button
                        appearance="subtle"
                        icon={<Checkmark24Regular />}
                        title="Mark complete"
                        onClick={() => handleComplete(r.id)}
                      />
                    )}
                    <Button
                      appearance="subtle"
                      icon={<Delete24Regular />}
                      title="Delete"
                      onClick={() => handleDelete(r.id)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
