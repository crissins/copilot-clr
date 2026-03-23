import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, type NeurodiverseSettings } from "../services/api";
import { useAuth } from "./useAuth";

const DEFAULT_SETTINGS: NeurodiverseSettings = {
  id: "",
  userId: "",
  readingLevel: "Grade 5",
  preferredFormat: "bullet points",
  voiceSpeed: "1.0",
  fontSize: "medium",
  highContrast: false,
  theme: "system",
  language: "en",
  fontFamily: "default",
  lineSpacing: "normal",
  reducedMotion: false,
  focusTimerMinutes: 25,
  breakReminderMinutes: 5,
  notificationStyle: "calm",
  responseLengthPreference: "medium",
  dyslexiaFont: false,
  colorOverlay: "none",
  autoReadResponses: false,
  preferredVoice: "default",
  textAlignment: "left",
};

export function useSettings() {
  const { getAccessToken } = useAuth();
  const [settings, setSettings] = useState<NeurodiverseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const data = await apiClient.getSettings(token, controller.signal);
      clearTimeout(timeout);
      setSettings(data);
    } catch (err) {
      console.error("Load settings failed:", err);
      // Fall back to defaults so the page always renders
      if (!settings) {
        setSettings({ ...DEFAULT_SETTINGS });
      }
      setError("Failed to load settings — using defaults");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadSettings();
    }
  }, [loadSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<NeurodiverseSettings>) => {
      setSaving(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const merged = { ...settings, ...updates };
        const updated = await apiClient.updateSettings(merged, token);
        setSettings(updated);
        return updated;
      } catch (err) {
        setError("Failed to save settings");
        console.error("Save settings failed:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [getAccessToken, settings],
  );

  return { settings, loading, saving, error, updateSettings, reload: loadSettings };
}
