import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

interface Props {
  text: string;
  lang?: string;
}

export function TTSButton({ text, lang }: Props) {
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

  return (
    <button
      onClick={handleClick}
      className="btn-icon"
      aria-label={ttsState === "playing" ? "Pause reading" : ttsState === "paused" ? "Resume reading" : "Read aloud"}
      title={ttsState === "playing" ? "Pause" : ttsState === "paused" ? "Resume" : "Read aloud (Text-to-Speech)"}
    >
      {ttsState === "playing" ? "\u23F8" : ttsState === "paused" ? "\u25B6" : "\uD83D\uDD0A"}
    </button>
  );
}
