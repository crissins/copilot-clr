import { useState, useCallback, useRef, useEffect } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { Speaker224Regular, Pause24Regular, Play24Regular } from "@fluentui/react-icons";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

interface Props {
  text: string;
  lang?: string;
  size?: "small" | "medium" | "large";
}

export function TTSButton({ text, lang, size = "small" }: Props) {
  const { getAccessToken } = useAuth();
  const { language } = useI18n();
  const [ttsState, setTtsState] = useState<"idle" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveLang = lang || language || "en";

  // Listen for global pause-all-tts event (dispatched when Immersive Reader opens)
  useEffect(() => {
    const handlePause = () => {
      if (audioRef.current && ttsState === "playing") {
        audioRef.current.pause();
        setTtsState("paused");
      }
    };
    window.addEventListener("pause-all-tts", handlePause);
    return () => window.removeEventListener("pause-all-tts", handlePause);
  }, [ttsState]);

  const handleClick = useCallback(async () => {
    if (ttsState === "playing") {
      if (audioRef.current) audioRef.current.pause();
      setTtsState("paused");
      return;
    }

    if (ttsState === "paused" && audioRef.current) {
      await audioRef.current.play();
      setTtsState("playing");
      return;
    }

    if (!text) return;
    setTtsState("playing");
    try {
      const token = await getAccessToken();
      const blob = await apiClient.textToSpeech(text, token, effectiveLang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsState("idle");
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setTtsState("idle");
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setTtsState("idle");
    }
  }, [text, ttsState, getAccessToken, effectiveLang]);

  const label = ttsState === "playing" ? "Pause reading" : ttsState === "paused" ? "Resume reading" : "Read aloud";
  const icon = ttsState === "playing" ? <Pause24Regular /> : ttsState === "paused" ? <Play24Regular /> : <Speaker224Regular />;

  return (
    <Tooltip content={label} relationship="label">
      <Button
        appearance="subtle"
        size={size}
        icon={icon}
        onClick={handleClick}
        aria-label={label}
      />
    </Tooltip>
  );
}
