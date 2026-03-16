import { useState, useCallback } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
  messageId: string;
  sessionId: string;
}

export function ReportButton({ messageId, sessionId }: Props) {
  const { getAccessToken } = useAuth();
  const [reported, setReported] = useState(false);

  const handleReport = useCallback(async () => {
    if (reported) return;
    const reason = window.prompt("Why are you reporting this response? (optional)") ?? "";
    try {
      const token = await getAccessToken();
      await apiClient.reportMessage(messageId, sessionId, reason, token);
      setReported(true);
    } catch (err) {
      console.error("Report failed:", err);
    }
  }, [messageId, sessionId, reported, getAccessToken]);

  return (
    <button
      onClick={handleReport}
      disabled={reported}
      className="btn-icon btn-report"
      aria-label={reported ? "Reported" : "Report this response"}
      title="Report this response"
    >
      {reported ? "\u2713" : "\u26A0"}
    </button>
  );
}
