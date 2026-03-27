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
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { UserInsights } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "900px",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
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

export function Feature6Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

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
            {insights.preferredReadingLevel && (
              <div style={{ marginTop: 8 }}>
                <Text size={300}>
                  Preferred level: <Badge appearance="filled" color="brand">{insights.preferredReadingLevel}</Badge>
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
          </div>

          <Divider />

          {/* Personalised Suggestions */}
          <div>
            <Text size={500} weight="semibold">Personalised Suggestions</Text>
            <Text block size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
              Based on your usage patterns, here are some suggestions to get more from the assistant.
            </Text>
            {insights.suggestions.length === 0 ? (
              <div className={styles.empty}><Text>Keep using the app — suggestions will appear here.</Text></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: 8 }}>
                {insights.suggestions.map((s, i) => (
                  <div key={i} className={styles.suggestionCard}>
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
