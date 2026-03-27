/**
 * ContentActionToolbar — Reusable toolbar with Immersive Reader, Read Aloud,
 * and Report buttons for any content output.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Button,
  Tooltip,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Textarea,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  ImmersiveReader24Regular,
  Speaker224Regular,
  Pause24Regular,
  Play24Regular,
  Flag24Regular,
  Checkmark24Regular,
} from "@fluentui/react-icons";
import { useImmersiveReader } from "../hooks/useImmersiveReader";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

interface ContentActionToolbarProps {
  /** The plain text content for TTS and Immersive Reader */
  text: string;
  /** Title for Immersive Reader */
  title?: string;
  /** Optional message/content ID for reporting */
  messageId?: string;
  /** Optional session ID for reporting */
  sessionId?: string;
  /** MIME type for immersive reader (e.g. "text/html") */
  mimeType?: string;
  /** Compact mode (smaller buttons) */
  compact?: boolean;
}

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
    ...shorthands.padding("4px", "0"),
  },
  reportTextarea: {
    width: "100%",
    minHeight: "80px",
  },
  reported: {
    color: tokens.colorPaletteGreenForeground1,
  },
});

export function ContentActionToolbar({
  text,
  title = "Content",
  messageId,
  sessionId,
  mimeType,
  compact = false,
}: ContentActionToolbarProps) {
  const styles = useStyles();
  const { launch, isOpen: irIsOpen } = useImmersiveReader();
  const { getAccessToken } = useAuth();
  const { language } = useI18n();

  const [ttsState, setTtsState] = useState<"idle" | "playing" | "paused">("idle");
  const [reported, setReported] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleImmersiveReader = useCallback(async () => {
    if (irIsOpen || !text) return;
    await launch(title, text, mimeType);
  }, [launch, irIsOpen, title, text, mimeType]);

  // Pause TTS when Immersive Reader opens
  useEffect(() => {
    if (irIsOpen && ttsState === "playing" && audioRef.current) {
      audioRef.current.pause();
      setTtsState("paused");
    }
  }, [irIsOpen, ttsState]);

  const handleReadAloud = useCallback(async () => {
    if (ttsState === "playing") {
      // Pause current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setTtsState("paused");
      return;
    }

    if (ttsState === "paused" && audioRef.current) {
      // Resume playback
      await audioRef.current.play();
      setTtsState("playing");
      return;
    }

    if (!text) return;
    setTtsState("playing");
    try {
      const token = await getAccessToken();
      const blob = await apiClient.speechSynthesize(text.slice(0, 5000), token, undefined, undefined, language || "en");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setTtsState("idle");
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setTtsState("idle");
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setTtsState("idle");
    }
  }, [text, ttsState, getAccessToken, language]);

  const handleReport = useCallback(async () => {
    if (!messageId || !sessionId || !reportReason.trim()) return;
    try {
      const token = await getAccessToken();
      await apiClient.reportMessage(messageId, sessionId, reportReason.trim(), token);
      setReported(true);
      setReportOpen(false);
      setReportReason("");
    } catch {
      // Best-effort
    }
  }, [messageId, sessionId, reportReason, getAccessToken]);

  const btnSize = compact ? "small" : "medium";
  const btnAppearance = "subtle" as const;

  return (
    <div className={styles.toolbar}>
      <Tooltip content="Open in Immersive Reader" relationship="label">
        <Button
          size={btnSize}
          appearance={btnAppearance}
          icon={<ImmersiveReader24Regular />}
          disabled={irIsOpen || !text}
          onClick={handleImmersiveReader}
          aria-label="Open in Immersive Reader"
        />
      </Tooltip>

      <Tooltip content={ttsState === "playing" ? "Pause reading" : ttsState === "paused" ? "Resume reading" : "Read aloud"} relationship="label">
        <Button
          size={btnSize}
          appearance={btnAppearance}
          icon={ttsState === "playing" ? <Pause24Regular /> : ttsState === "paused" ? <Play24Regular /> : <Speaker224Regular />}
          disabled={!text}
          onClick={handleReadAloud}
          aria-label={ttsState === "playing" ? "Pause reading" : ttsState === "paused" ? "Resume reading" : "Read aloud"}
        />
      </Tooltip>

      {messageId && sessionId && (
        <Dialog open={reportOpen} onOpenChange={(_, d) => setReportOpen(d.open)}>
          <DialogTrigger disableButtonEnhancement>
            <Tooltip content={reported ? "Reported" : "Report this content"} relationship="label">
              <Button
                size={btnSize}
                appearance={btnAppearance}
                icon={reported ? <Checkmark24Regular /> : <Flag24Regular />}
                disabled={reported}
                aria-label={reported ? "Reported" : "Report this content"}
                className={reported ? styles.reported : undefined}
              />
            </Tooltip>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Report Content</DialogTitle>
              <DialogContent>
                <p>Help us improve. Let us know what's wrong with this response.</p>
                <Textarea
                  className={styles.reportTextarea}
                  placeholder="What seems wrong? (e.g., inaccurate, offensive, unsafe)"
                  value={reportReason}
                  onChange={(_, d) => setReportReason(d.value)}
                />
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  disabled={!reportReason.trim()}
                  onClick={handleReport}
                >
                  Submit Report
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
