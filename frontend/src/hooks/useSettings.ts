import { useState, useEffect, useCallback } from "react";
import { apiClient, type NeurodiverseSettings } from "../services/api";
import { useAuth } from "./useAuth";

export function useSettings() {
  const { getAccessToken } = useAuth();
  const [settings, setSettings] = useState<NeurodiverseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const data = await apiClient.getSettings(token);
      setSettings(data);
    } catch (err) {
      setError("Failed to load settings");
      console.error("Load settings failed:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadSettings();
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
