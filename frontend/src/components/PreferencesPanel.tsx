import { useState, useEffect, useCallback } from "react";
import { apiClient, type UserPreferences } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesPanel({ isOpen, onClose }: Props) {
  const { getAccessToken } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const data = await apiClient.getPreferences(token);
      setPrefs(data);
    } catch {
      setPrefs(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (isOpen) loadPrefs();
  }, [isOpen, loadPrefs]);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      const updated = await apiClient.updatePreferences(prefs, token);
      setPrefs(updated);
      onClose();
    } catch (err) {
      console.error("Save prefs failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="prefs-overlay" role="dialog" aria-label="Accessibility Preferences">
      <div className="prefs-panel">
        <div className="prefs-header">
          <h2>Accessibility Preferences</h2>
          <button onClick={onClose} className="btn-secondary" aria-label="Close">X</button>
        </div>

        {prefs && (
          <div className="prefs-form">
            <label>
              Reading Level
              <select
                value={prefs.readingLevel}
                onChange={(e) => setPrefs({ ...prefs, readingLevel: e.target.value })}
              >
                <option value="Grade 2">Grade 2 (Very Easy)</option>
                <option value="Grade 5">Grade 5 (Easy)</option>
                <option value="Grade 8">Grade 8 (Standard)</option>
                <option value="Grade 12">Grade 12 (Advanced)</option>
              </select>
            </label>

            <label>
              Preferred Format
              <select
                value={prefs.preferredFormat}
                onChange={(e) => setPrefs({ ...prefs, preferredFormat: e.target.value })}
              >
                <option value="bullet points">Bullet Points</option>
                <option value="numbered steps">Numbered Steps</option>
                <option value="paragraphs">Paragraphs</option>
                <option value="table">Table</option>
              </select>
            </label>

            <label>
              Voice Speed
              <select
                value={prefs.voiceSpeed}
                onChange={(e) => setPrefs({ ...prefs, voiceSpeed: e.target.value })}
              >
                <option value="0.75">Slow (0.75x)</option>
                <option value="1.0">Normal (1.0x)</option>
                <option value="1.25">Slightly Fast (1.25x)</option>
              </select>
            </label>

            <label>
              Font Size
              <select
                value={prefs.fontSize}
                onChange={(e) => setPrefs({ ...prefs, fontSize: e.target.value })}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="x-large">Extra Large</option>
              </select>
            </label>

            <label className="prefs-checkbox">
              <input
                type="checkbox"
                checked={prefs.highContrast}
                onChange={(e) => setPrefs({ ...prefs, highContrast: e.target.checked })}
              />
              High Contrast Mode
            </label>

            <label>
              Theme
              <select
                value={prefs.theme}
                onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}
              >
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
