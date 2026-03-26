import { useState, useEffect, useRef, useCallback } from "react";
import { Text } from "@fluentui/react-components";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import "./onboarding.css";

interface LanguageSelectorProps {
  onSelect: (language: string) => void;
  onSkip?: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English", hello: "Hello", subtitle: "Please choose your language", voice: "en-US-JennyNeural", lang: "en-US" },
  { code: "es", label: "Español", hello: "Hola", subtitle: "Escoge tu idioma", voice: "es-ES-ElviraNeural", lang: "es-ES" },
  { code: "it", label: "Italiano", hello: "Ciao", subtitle: "Scegli la tua lingua", voice: "it-IT-ElsaNeural", lang: "it-IT" },
  { code: "pt", label: "Português", hello: "Olá", subtitle: "Escolha seu idioma", voice: "pt-BR-FranciscaNeural", lang: "pt-BR" },
  { code: "de", label: "Deutsch", hello: "Hallo", subtitle: "Wähle deine Sprache", voice: "de-DE-KatjaNeural", lang: "de-DE" },
  { code: "ja", label: "日本語", hello: "こんにちは", subtitle: "言語を選択してください", voice: "ja-JP-NanamiNeural", lang: "ja-JP" },
];

// Duration (ms) each greeting is shown / spoken before transitioning
const GREETING_DURATION_MS = 1800;
// Fade-out starts this many ms before the next greeting
const FADE_MS = 400;

export function LanguageSelector({ onSelect, onSkip }: LanguageSelectorProps) {
  const { getAccessToken } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  // Start visual cycling — keeps a ref in sync so the audio callback can read it
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        indexRef.current = (indexRef.current + 1) % LANGUAGES.length;
        setCurrentIndex(indexRef.current);
        setVisible(true);
      }, FADE_MS);
    }, GREETING_DURATION_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Build SSML where each language greeting is spoken by its native voice,
  // with a <break> between each to align with the visual cycling cadence.
  const playGreeting = useCallback(async () => {
    if (hasPlayed) return;
    setHasPlayed(true);

    // Each voice block: set xml:lang per language so the Speech Service
    // renders text with native pronunciation, not English fallback.
    const voiceBlocks = LANGUAGES.map(
      (l) =>
        `  <voice name="${l.voice}" xml:lang="${l.lang}">\n` +
        `    <prosody rate="medium">${l.hello}.</prosody>\n` +
        `    <break time="300ms"/>\n` +
        `    <prosody rate="medium">${l.subtitle}.</prosody>\n` +
        `    <break time="400ms"/>\n` +
        `  </voice>`
    ).join("\n");

    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">\n` +
      voiceBlocks +
      `\n</speak>`;

    try {
      const token = await getAccessToken();
      const blob = await apiClient.synthesizeOnboardingSsml(ssml, token);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Sync visual cycling to audio start: reset index and restart interval
      if (intervalRef.current) clearInterval(intervalRef.current);
      indexRef.current = 0;
      setCurrentIndex(0);
      setVisible(true);

      intervalRef.current = setInterval(() => {
        setVisible(false);
        setTimeout(() => {
          indexRef.current = (indexRef.current + 1) % LANGUAGES.length;
          setCurrentIndex(indexRef.current);
          setVisible(true);
        }, FADE_MS);
      }, GREETING_DURATION_MS);

      audio.play().catch(() => {});
    } catch {
      // TTS unavailable — visual cycling continues silently
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
      {onSkip && (
        <button
          className="lang-skip-btn"
          onClick={() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }
            onSkip();
          }}
          aria-label="Skip onboarding"
        >
          Skip →
        </button>
      )}
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
