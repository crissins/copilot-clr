import { useState, useCallback } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
  text: string;
}

export function TTSButton({ text }: Props) {
  const { getAccessToken } = useAuth();
  const [playing, setPlaying] = useState(false);

  const handlePlay = useCallback(async () => {
    if (playing || !text) return;
    setPlaying(true);
    try {
      const token = await getAccessToken();
      const blob = await apiClient.textToSpeech(text, token);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }, [text, playing, getAccessToken]);

  return (
    <button
      onClick={handlePlay}
      disabled={playing}
      className="btn-icon"
      aria-label={playing ? "Playing audio" : "Read aloud"}
      title="Read aloud (Text-to-Speech)"
    >
      {playing ? "\u23F8" : "\uD83D\uDD0A"}
    </button>
  );
}
