import { useState, useEffect, useRef, useCallback } from "react";
import { Text } from "@fluentui/react-components";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import "./onboarding.css";

interface LanguageSelectorProps {
  onSelect: (language: string) => void;
}

const LANGUAGES = [
  { code: "en", label: "English", hello: "Hello", subtitle: "Please choose your language", voice: "en-US-JennyNeural" },
  { code: "es", label: "Español", hello: "Hola", subtitle: "Escoge tu idioma", voice: "es-ES-ElviraNeural" },
  { code: "it", label: "Italiano", hello: "Ciao", subtitle: "Scegli la tua lingua", voice: "it-IT-ElsaNeural" },
  { code: "pt", label: "Português", hello: "Olá", subtitle: "Escolha seu idioma", voice: "pt-BR-FranciscaNeural" },
  { code: "de", label: "Deutsch", hello: "Hallo", subtitle: "Wähle deine Sprache", voice: "de-DE-KatjaNeural" },
  { code: "ja", label: "日本語", hello: "こんにちは", subtitle: "言語を選択してください", voice: "ja-JP-NanamiNeural" },
];

export function LanguageSelector({ onSelect }: LanguageSelectorProps) {
  const { getAccessToken } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle through languages
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % LANGUAGES.length);
        setVisible(true);
      }, 800);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Play multilingual SSML greeting once on mount
  const playGreeting = useCallback(async () => {
    if (hasPlayed) return;
    setHasPlayed(true);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
${LANGUAGES.map(
  (l) =>
    `  <voice name="${l.voice}"><prosody rate="slow">${l.hello}. ${l.subtitle}.</prosody></voice>`
).join("\n")}
</speak>`;

    try {
      const token = await getAccessToken();
      const blob = await apiClient.synthesizeOnboardingSsml(ssml, token);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // TTS unavailable — continue silently
    }
  }, [getAccessToken, hasPlayed]);

  useEffect(() => {
    playGreeting();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playGreeting]);

  const current = LANGUAGES[currentIndex];

  return (
    <div className="lang-selector" role="region" aria-label="Language selection">
      <div className={`lang-hello ${visible ? "visible" : "hidden"}`} aria-live="polite">
        {current.hello}
      </div>
      <div className={`lang-subtitle ${visible ? "visible" : "hidden"}`}>
        {current.subtitle}
      </div>

      <Text size={400} style={{ opacity: 0.5, marginBottom: 8 }}>
        Choose your preferred language
      </Text>

      <div className="lang-grid" role="radiogroup" aria-label="Language options">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            className="lang-btn"
            onClick={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
              }
              onSelect(lang.code);
            }}
            role="radio"
            aria-checked={false}
            aria-label={lang.label}
          >
            <div style={{ fontWeight: 600 }}>{lang.hello}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{lang.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
