/**
 * Feedback Page — Submit and view user feedback.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  Text,
  Textarea,
  Select,
  Spinner,
  Badge,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import { Send24Regular } from "@fluentui/react-icons";
import { apiClient } from "../services/api";
import type { FeedbackItem } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxWidth: "1100px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    height: "100%",
    overflow: "hidden",
  },
  layout: {
    display: "flex",
    gap: "24px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    "@media (max-width: 768px)": {
      flexDirection: "column",
    },
  },
  formColumn: {
    flex: "0 0 360px",
    flexShrink: 0,
    "@media (max-width: 768px)": {
      flex: "none",
    },
  },
  historyColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
    minHeight: 0,
    maxHeight: "100%",
  },
  formCard: {
    ...shorthands.padding("20px"),
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  ratingRow: {
    display: "flex",
    gap: "4px",
  },
  starBtn: {
    minWidth: "36px",
    height: "36px",
    fontSize: "20px",
    cursor: "pointer",
    ...shorthands.padding("0"),
  },
  row: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  historyCard: {
    ...shorthands.padding("12px", "16px"),
  },
  historyMeta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "6px",
  },
  empty: {
    textAlign: "center" as const,
    ...shorthands.padding("32px"),
    color: tokens.colorNeutralForeground3,
  },
});

const CATEGORIES = ["general", "accessibility", "performance", "feature_request", "bug"];

export function FeedbackPage() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { t } = useI18n();

  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const items = await apiClient.listFeedback(token);
      setHistory(items);
    } catch {
      // ignore — history is optional
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = useCallback(async () => {
    if (!comment.trim() && !rating) return;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const item = await apiClient.submitFeedback(
        { comment: comment.trim(), rating, category },
        token,
      );
      setHistory((prev) => [item, ...prev]);
      setComment("");
      setRating(0);
      setCategory("general");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error("Feedback submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [comment, rating, category, getAccessToken]);

  return (
    <div className={styles.container}>
      <Text size={600} weight="bold">{t.feedback.title}</Text>
      <Text size={300} style={{ opacity: 0.7 }}>{t.feedback.subtitle}</Text>

      <div className={styles.layout}>
      {/* Left — Submit form */}
      <div className={styles.formColumn}>
      <Card className={styles.formCard}>
        <Text weight="semibold">{t.feedback.rateExperience}</Text>
        <div className={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Button
              key={v}
              className={styles.starBtn}
              appearance={v <= rating ? "primary" : "outline"}
              onClick={() => setRating(v)}
              aria-label={`${v} star${v > 1 ? "s" : ""}`}
            >
              ★
            </Button>
          ))}
        </div>

        <div className={styles.row}>
          <div style={{ flex: 1 }}>
            <Text size={200} style={{ marginBottom: 4, display: "block" }}>{t.feedback.category}</Text>
            <Select value={category} onChange={(_, d) => setCategory(d.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.feedback.categories[c as keyof typeof t.feedback.categories] || c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Textarea
          placeholder={t.feedback.placeholder}
          value={comment}
          onChange={(_, d) => setComment(d.value)}
          rows={4}
          maxLength={2000}
        />

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Button
            appearance="primary"
            icon={<Send24Regular />}
            onClick={handleSubmit}
            disabled={submitting || (!comment.trim() && !rating)}
          >
            {submitting ? t.feedback.submitting : t.feedback.submit}
          </Button>
          {submitted && (
            <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
              {t.feedback.thankYou}
            </Text>
          )}
        </div>
      </Card>
      </div>

      {/* Right — History */}
      <div className={styles.historyColumn}>
      <Text size={500} weight="semibold">{t.feedback.history}</Text>
      {loading ? (
        <Spinner label={t.feedback.loading} />
      ) : history.length === 0 ? (
        <div className={styles.empty}>
          <Text size={300}>{t.feedback.noFeedback}</Text>
        </div>
      ) : (
        history.map((item) => (
          <Card key={item.id} className={styles.historyCard}>
            {item.comment && <Text>{item.comment}</Text>}
            <div className={styles.historyMeta}>
              {item.rating > 0 && (
                <Badge appearance="tint" color="brand">
                  {"★".repeat(item.rating)}
                </Badge>
              )}
              <Badge appearance="outline">{item.category}</Badge>
              <Text size={100} style={{ opacity: 0.5 }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </div>
          </Card>
        ))
      )}
      </div>
      </div>
    </div>
  );
}
