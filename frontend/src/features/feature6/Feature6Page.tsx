/**
 * Feature 6 — Accessibility Hub
 *
 * Shows adaptive insights: how the system is learning and adjusting to the
 * user's patterns, usage stats, personalised suggestions, and reading-level
 * trends. Demonstrates the "adapts over time" challenge requirement.
 *
 * Backend: GET /api/insights
 */

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  Text,
  Badge,
  Spinner,
  Divider,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  PersonVoice24Regular,
  ArrowClockwise24Regular,
  LightbulbFilament24Regular,
  Settings24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { UserInsights, NeurodiverseSettings } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useSharedSettings } from "../../hooks/SettingsContext";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    overflowY: "auto",
    height: "100%",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "12px",
  },
  statCard: {
    ...shorthands.padding("16px"),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    textAlign: "center" as const,
  },
  statValue: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorBrandForeground1,
  },
  suggestionCard: {
    ...shorthands.padding("14px", "16px"),
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  readingLevels: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  empty: {
    textAlign: "center" as const,
    ...shorthands.padding("40px"),
    color: tokens.colorNeutralForeground3,
  },
});

// ── Hardcoded suggestions based on user preferences ──────────────────────────

function getSuggestionsFromSettings(s: NeurodiverseSettings): string[] {
  const tips: string[] = [];

  // Dyslexia-specific
  if (s.dyslexiaFont) {
    tips.push("Try Voice Live for hands-free audio conversations — great for reducing reading strain.");
    tips.push("Use the Immersive Reader's dyslexia features: syllabification, line focus, and picture dictionary.");
    tips.push("Set a slower voice speed so responses are easier to follow when read aloud.");
  }

  // Reading level based
  if (s.readingLevel === "simple") {
    tips.push("The Document Simplifier can rewrite any uploaded PDF at Grade 2 level — try uploading a complex document.");
    tips.push("Enable auto-read responses so you can listen instead of reading.");
  } else if (s.readingLevel === "moderate") {
    tips.push("Try the Immersive Reader for longer responses — it adds line focus and picture dictionary support.");
  }

  // Format preferences
  if (s.preferredFormat === "bullets" || s.preferredFormat === "steps") {
    tips.push("Ask the assistant to break down tasks — the Task Decomposer creates time-boxed step-by-step plans.");
  }

  // Visual preferences
  if (s.colorOverlay && s.colorOverlay !== "none") {
    tips.push("Your color overlay is active. The Immersive Reader also supports custom themes for comfortable reading.");
  }
  if (s.reducedMotion) {
    tips.push("Reduced motion is on — all animations are minimised for a calmer experience.");
  }

  // Voice preferences
  if (s.autoReadResponses) {
    tips.push("Auto-read is enabled. Try the Immersive Reader's read-aloud for longer content with adjustable speed.");
  }

  // Focus preferences
  if (s.focusTimerMinutes && s.focusTimerMinutes <= 15) {
    tips.push("Short focus sessions work well with the Task Decomposer — break big goals into small steps.");
  }
  if (s.focusTimerMinutes && s.focusTimerMinutes >= 45) {
    tips.push("Long focus sessions are great — remember to use break reminders to stay fresh.");
  }

  // General tips if we have very few
  if (tips.length < 3) {
    tips.push("Upload a document and ask the assistant to simplify it at your preferred reading level.");
  }
  if (tips.length < 3) {
    tips.push("Star important conversations from the chat sidebar for quick access later.");
  }

  return tips;
}

function getReadingLevelLabel(level: string): string {
  const map: Record<string, string> = {
    simple: "Simple (Grade 2–5)",
    moderate: "Moderate (Grade 5–8)",
    advanced: "Advanced (Grade 8–12)",
  };
  return map[level] || level;
}

interface Feature6PageProps {
  onStartOnboarding?: () => void;
}

export function Feature6Page({ onStartOnboarding }: Feature6PageProps) {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { settings } = useSharedSettings();

  const hasCompletedOnboarding = !!settings?.updatedAt;

  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const data = await apiClient.getInsights(token);
      setInsights(data);
    } catch {
      setError("Could not load insights. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <PersonVoice24Regular />
          <Text size={600} weight="bold">Accessibility Hub</Text>
        </div>
        <Button appearance="subtle" icon={<ArrowClockwise24Regular />} onClick={loadInsights} aria-label="Refresh" />
      </div>
      <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
        See how the system is adapting to your preferences. The more you use it, the
        better it understands your needs and offers personalised suggestions.
      </Text>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loading ? (
        <Spinner label="Gathering your insights..." />
      ) : !insights ? (
        <div className={styles.empty}><Text>No data yet. Start using the app to see insights here.</Text></div>
      ) : (
        <>
          {/* Usage Stats */}
          <div>
            <Text size={500} weight="semibold">Your Usage</Text>
            <div className={styles.statsGrid} style={{ marginTop: 8 }}>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalSessions}</span>
                <Text size={200}>Sessions</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalMessages}</span>
                <Text size={200}>Messages</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalTokensUsed.toLocaleString()}</span>
                <Text size={200}>Tokens Used</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalTaskPlans}</span>
                <Text size={200}>Task Plans</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.completedSteps}</span>
                <Text size={200}>Steps Completed</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{Math.round(insights.completionRate)}%</span>
                <Text size={200}>Completion Rate</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalUploads}</span>
                <Text size={200}>Documents</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.totalAdaptations}</span>
                <Text size={200}>Adaptations</Text>
              </Card>
              <Card className={styles.statCard}>
                <span className={styles.statValue}>{insights.wordsSaved.toLocaleString()}</span>
                <Text size={200}>Words Saved</Text>
              </Card>
            </div>
          </div>

          <Divider />

          {/* Reading Level Preferences */}
          <div>
            <Text size={500} weight="semibold">Reading Level Preferences</Text>
            <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
              The system tracks which reading levels you use most to adjust its default behavior.
            </Text>
            {!hasCompletedOnboarding && !insights.preferredReadingLevel ? (
              <div style={{ marginTop: 12 }}>
                <Text block size={300} style={{ marginBottom: 8 }}>
                  Set up your preferences to see personalised reading level recommendations.
                </Text>
                {onStartOnboarding && (
                  <Button appearance="primary" icon={<Settings24Regular />} onClick={onStartOnboarding}>
                    Set Up Preferences
                  </Button>
                )}
              </div>
            ) : (
              <>
                {(settings?.readingLevel || insights.preferredReadingLevel) && (
                  <div style={{ marginTop: 8 }}>
                    <Text size={300}>
                      Preferred level:{" "}
                      <Badge appearance="filled" color="brand">
                        {getReadingLevelLabel(insights.preferredReadingLevel || settings?.readingLevel || "moderate")}
                      </Badge>
                    </Text>
                  </div>
                )}
                {settings?.preferredFormat && (
                  <div style={{ marginTop: 6 }}>
                    <Text size={300}>
                      Format: <Badge appearance="outline">{settings.preferredFormat}</Badge>
                    </Text>
                  </div>
                )}
                {settings?.responseLengthPreference && (
                  <div style={{ marginTop: 6 }}>
                    <Text size={300}>
                      Length: <Badge appearance="outline">{settings.responseLengthPreference}</Badge>
                    </Text>
                  </div>
                )}
                {insights.readingLevelsUsed && Object.keys(insights.readingLevelsUsed).length > 0 && (
                  <div className={styles.readingLevels} style={{ marginTop: 8 }}>
                    {Object.entries(insights.readingLevelsUsed).map(([level, count]) => (
                      <Badge key={level} appearance="outline" size="large">
                        {level}: {count} {count === 1 ? "use" : "uses"}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <Divider />

          {/* Personalised Suggestions */}
          <div>
            <Text size={500} weight="semibold">Personalised Suggestions</Text>
            <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
              {hasCompletedOnboarding
                ? "Based on your preferences and usage, here are suggestions to get more from the assistant."
                : "Complete the onboarding to receive personalised suggestions tailored to your needs."}
            </Text>
            {!hasCompletedOnboarding && !insights.suggestions.length ? (
              <div style={{ marginTop: 12 }}>
                {onStartOnboarding && (
                  <Button appearance="primary" icon={<Settings24Regular />} onClick={onStartOnboarding}>
                    Set Up Preferences
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: 8 }}>
                {/* Show settings-based suggestions first, then any from backend */}
                {settings && hasCompletedOnboarding && getSuggestionsFromSettings(settings).map((s, i) => (
                  <div key={`pref-${i}`} className={styles.suggestionCard}>
                    <LightbulbFilament24Regular style={{ flexShrink: 0, color: tokens.colorBrandForeground1 }} />
                    <Text size={300}>{s}</Text>
                  </div>
                ))}
                {insights.suggestions.map((s, i) => (
                  <div key={`api-${i}`} className={styles.suggestionCard}>
                    <LightbulbFilament24Regular style={{ flexShrink: 0, color: tokens.colorBrandForeground1 }} />
                    <Text size={300}>{s}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
