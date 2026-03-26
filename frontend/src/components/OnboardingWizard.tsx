import { useState, useRef, useCallback, useEffect } from "react";
import { Button, Text, Switch, Slider } from "@fluentui/react-components";
import {
  Checkmark24Regular,
  ArrowRight24Regular,
  ArrowLeft24Regular,
  Speaker224Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../hooks/useSettings";
import type { NeurodiverseSettings } from "../services/api";
import { getI18n, LANG_VOICES } from "./onboardingI18n";
import "./onboarding.css";

interface OnboardingWizardProps {
  language: string;
  onComplete: () => void;
  onSkip?: () => void;
}

// ── Step keys (order matters) ────────────────────────────────────────────────

const STEP_KEYS = [
  "readingLevel",
  "preferredFormat",
  "responseLength",
  "fontDisplay",
  "colorTheme",
  "visualExtras",
  "voiceSpeed",
  "preferredVoice",
  "focusTimer",
] as const;

const VOICES = [
  { value: "en-US-JennyNeural", label: "Jenny (warm)" },
  { value: "en-US-AriaNeural", label: "Aria (friendly)" },
  { value: "en-US-GuyNeural", label: "Guy (steady)" },
  { value: "en-US-DavisNeural", label: "Davis (gentle)" },
];

// ── Speaking indicator ───────────────────────────────────────────────────────

function SpeakingIndicator() {
  return (
    <span className="speaking-indicator" aria-label="Speaking">
      <span /><span /><span /><span />
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingWizard({ language, onComplete, onSkip }: OnboardingWizardProps) {
  const { getAccessToken } = useAuth();
  const { updateSettings } = useSettings();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakIdRef = useRef(0);

  const t = getI18n(language);
  const ttsVoice = LANG_VOICES[language] || LANG_VOICES.en;

  // Stop any currently playing audio and cancel in-flight speak calls
  const stopSpeaking = useCallback(() => {
    speakIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  // Collected selections
  const [selections, setSelections] = useState<Partial<NeurodiverseSettings>>({
    language,
    readingLevel: "moderate",
    preferredFormat: "mixed",
    responseLengthPreference: "medium",
    fontSize: "medium",
    dyslexiaFont: false,
    theme: "light",
    colorOverlay: "none",
    reducedMotion: false,
    lineSpacing: "normal",
    voiceSpeed: "medium",
    preferredVoice: "en-US-JennyNeural",
    focusTimerMinutes: 25,
    breakReminderMinutes: 5,
    autoReadResponses: true,
  });

  const set = useCallback(
    (key: string, value: unknown) =>
      setSelections((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Get narration text for a given step index
  const getNarration = useCallback(
    (idx: number): string => {
      const key = STEP_KEYS[idx];
      const stepT = t.steps[key as keyof typeof t.steps];
      return stepT?.narration ?? "";
    },
    [t],
  );

  // Speak narration for current step using the chosen language voice
  const speak = useCallback(
    async (text: string) => {
      stopSpeaking();
      const id = speakIdRef.current;
      setSpeaking(true);
      try {
        const token = await getAccessToken();
        if (speakIdRef.current !== id) return; // cancelled
        const blob = await apiClient.speechSynthesize(text, token, ttsVoice, "medium", language);
        if (speakIdRef.current !== id) return; // cancelled
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.play().catch(() => setSpeaking(false));
      } catch {
        if (speakIdRef.current === id) setSpeaking(false);
      }
    },
    [getAccessToken, ttsVoice, stopSpeaking],
  );

  // Auto-narrate when step changes
  useEffect(() => {
    if (!done && step < STEP_KEYS.length) {
      speak(getNarration(step));
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done]);

  const goNext = useCallback(() => {
    stopSpeaking();
    if (step >= STEP_KEYS.length - 1) {
      setExiting(true);
      setTimeout(async () => {
        try {
          await updateSettings(selections);
        } catch {
          // settings save failed — continue anyway
        }
        setDone(true);
        speak(t.doneSubtitle);
      }, 400);
      return;
    }
    setExiting(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setExiting(false);
    }, 400);
  }, [step, selections, updateSettings, speak, stopSpeaking, t.doneSubtitle]);

  const goBack = useCallback(() => {
    if (step <= 0) return;
    stopSpeaking();
    setExiting(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setExiting(false);
    }, 400);
  }, [step, stopSpeaking]);

  // ── Done screen ──

  if (done) {
    return (
      <div className="onboarding">
        <div className="onboarding-card done-card" role="status">
          <div className="done-emoji">🎉</div>
          <Text size={800} weight="bold" block style={{ marginBottom: 12 }}>
            {t.doneTitle}
          </Text>
          <Text size={400} block style={{ marginBottom: 24, opacity: 0.7 }}>
            {t.doneSubtitle}
          </Text>
          <Button appearance="primary" size="large" onClick={onComplete}>
            {t.letsGo}
          </Button>
        </div>
      </div>
    );
  }

  // ── Step content ──

  const stepKey = STEP_KEYS[step];
  const narration = getNarration(step);
  const progress = ((step + 1) / STEP_KEYS.length) * 100;

  // Helper to render chip options
  const renderChips = (
    options: Record<string, string>,
    selKey: keyof NeurodiverseSettings,
  ) => (
    <div className="option-grid">
      {Object.entries(options).map(([value, label]) => (
        <button
          key={value}
          className={`option-chip ${selections[selKey] === value ? "selected" : ""}`}
          onClick={() => set(selKey, value)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="onboarding">
      {/* Progress */}
      <div className="onboarding-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <Text size={200} style={{ opacity: 0.5, marginBottom: 8 }}>
        {t.stepOf(step + 1, STEP_KEYS.length)}
      </Text>

      <div className={`onboarding-card onboarding-step ${exiting ? "exiting" : ""}`}>
        {/* Narration */}
        <div className="narrator-text">
          {narration}
          {speaking && <SpeakingIndicator />}
        </div>

        {/* Replay button */}
        <Button
          appearance="subtle"
          icon={<Speaker224Regular />}
          onClick={() => speak(narration)}
          aria-label={t.replay}
          style={{ marginBottom: 20 }}
        >
          {t.replay}
        </Button>

        {/* Step-specific options */}
        {stepKey === "readingLevel" && renderChips(t.steps.readingLevel.options, "readingLevel")}

        {stepKey === "preferredFormat" && renderChips(t.steps.preferredFormat.options, "preferredFormat")}

        {stepKey === "responseLength" && renderChips(t.steps.responseLength.options, "responseLengthPreference")}

        {stepKey === "fontDisplay" && (
          <>
            {renderChips(t.steps.fontDisplay.options, "fontSize")}
            <div className="toggle-row">
              <span className="toggle-label">{t.steps.fontDisplay.dyslexiaToggle}</span>
              <Switch
                checked={!!selections.dyslexiaFont}
                onChange={(_, data) => set("dyslexiaFont", data.checked)}
              />
            </div>
          </>
        )}

        {stepKey === "colorTheme" && renderChips(t.steps.colorTheme.options, "theme")}

        {stepKey === "visualExtras" && (
          <>
            <Text size={300} style={{ display: "block", marginBottom: 16, opacity: 0.6 }}>
              {t.steps.visualExtras.overlayLabel}
            </Text>
            {renderChips(t.steps.visualExtras.options, "colorOverlay")}
            <div className="toggle-row">
              <span className="toggle-label">{t.steps.visualExtras.reduceMotion}</span>
              <Switch
                checked={!!selections.reducedMotion}
                onChange={(_, data) => set("reducedMotion", data.checked)}
              />
            </div>
            <div className="toggle-row">
              <span className="toggle-label">{t.steps.visualExtras.widerSpacing}</span>
              <Switch
                checked={selections.lineSpacing === "wide"}
                onChange={(_, data) => set("lineSpacing", data.checked ? "wide" : "normal")}
              />
            </div>
          </>
        )}

        {stepKey === "voiceSpeed" && (
          <div className="slider-section">
            <label htmlFor="voice-speed">{t.steps.voiceSpeed.label}</label>
            <Slider
              id="voice-speed"
              min={0}
              max={2}
              step={1}
              value={["slow", "medium", "fast"].indexOf(selections.voiceSpeed as string)}
              onChange={(_, data) =>
                set("voiceSpeed", ["slow", "medium", "fast"][data.value])
              }
            />
            <div className="slider-value">
              {t.steps.voiceSpeed.options[selections.voiceSpeed as string] ?? selections.voiceSpeed}
            </div>
          </div>
        )}

        {stepKey === "preferredVoice" && (
          <div className="option-grid">
            {VOICES.map((o) => (
              <button
                key={o.value}
                className={`option-chip ${selections.preferredVoice === o.value ? "selected" : ""}`}
                onClick={() => set("preferredVoice", o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {stepKey === "focusTimer" && (
          <>
            <div className="slider-section">
              <label htmlFor="focus-timer">{t.steps.focusTimer.workLabel}</label>
              <Slider
                id="focus-timer"
                min={5}
                max={60}
                step={5}
                value={selections.focusTimerMinutes as number}
                onChange={(_, data) => set("focusTimerMinutes", data.value)}
              />
              <div className="slider-value">{selections.focusTimerMinutes} {t.steps.focusTimer.minSuffix}</div>
            </div>
            <div className="slider-section">
              <label htmlFor="break-timer">{t.steps.focusTimer.breakLabel}</label>
              <Slider
                id="break-timer"
                min={1}
                max={15}
                step={1}
                value={selections.breakReminderMinutes as number}
                onChange={(_, data) => set("breakReminderMinutes", data.value)}
              />
              <div className="slider-value">{selections.breakReminderMinutes} {t.steps.focusTimer.minSuffix}</div>
            </div>
            <div className="toggle-row">
              <span className="toggle-label">{t.steps.focusTimer.autoRead}</span>
              <Switch
                checked={!!selections.autoReadResponses}
                onChange={(_, data) => set("autoReadResponses", data.checked)}
              />
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="step-nav">
          {step > 0 && (
            <Button
              appearance="subtle"
              icon={<ArrowLeft24Regular />}
              onClick={goBack}
            >
              {t.back}
            </Button>
          )}
          <Button
            appearance="primary"
            icon={step < STEP_KEYS.length - 1 ? <ArrowRight24Regular /> : <Checkmark24Regular />}
            iconPosition="after"
            onClick={goNext}
          >
            {step < STEP_KEYS.length - 1 ? t.next : t.finish}
          </Button>
          {onSkip && (
            <Button
              appearance="subtle"
              onClick={() => {
                stopSpeaking();
                onSkip();
              }}
              style={{ marginLeft: "auto" }}
            >
              {t.skip} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
