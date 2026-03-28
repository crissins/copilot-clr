/**
 * useImmersiveReader — Hook for Immersive Reader SDK state and preferences.
 *
 * Manages IR settings (read-aloud voice/speed, display options, translation,
 * grammar, cookie policy) and persists them in localStorage. Exposes a
 * `launch()` function that loads the SDK once and opens the reader with the
 * current settings applied.
 */

import { useState, useCallback } from "react";
import { launchAsync, close as irClose, CookiePolicy } from "@microsoft/immersive-reader-sdk";
import { apiClient } from "../services/api";
import { useAuth } from "./useAuth";
import { markdownToHtml } from "../utils/markdown";

// ThemeOption enum isn't re-exported from the main entry, use raw values
const ThemeOption = { Light: 0, Dark: 1 } as const;

// ── Types matching the SDK reference ──────────────────────────────────────

export type IRVoice = "Female" | "Male";
export type IRSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.25 | 2.5;
export type IRTheme = "Light" | "Dark";
export type IRFont = "Calibri" | "ComicSans" | "Sitka";
export type IRTextSize = 14 | 20 | 28 | 36 | 42 | 48 | 56 | 64 | 72 | 84 | 96;

export interface ImmersiveReaderSettings {
  // Read Aloud
  readAloudVoice: IRVoice;
  readAloudSpeed: IRSpeed;
  readAloudAutoPlay: boolean;

  // Translation
  translationLanguage: string;
  autoEnableDocumentTranslation: boolean;
  autoEnableWordTranslation: boolean;

  // Display
  textSize: IRTextSize;
  increaseSpacing: boolean;
  fontFamily: IRFont;
  themeOption: IRTheme;

  // Grammar & features
  disableGrammar: boolean;
  disableTranslation: boolean;
  disableLanguageDetection: boolean;
  disableFirstRun: boolean;

  // Cookie
  enableCookies: boolean;

  // UI language
  uiLang: string;
}

const STORAGE_KEY = "ir-settings";
const PREFS_STORAGE_KEY = "ir-preferences"; // SDK preferences string

const DEFAULT_SETTINGS: ImmersiveReaderSettings = {
  readAloudVoice: "Female",
  readAloudSpeed: 1.25,
  readAloudAutoPlay: true,
  translationLanguage: "",
  autoEnableDocumentTranslation: false,
  autoEnableWordTranslation: false,
  textSize: 36,
  increaseSpacing: false,
  fontFamily: "Calibri",
  themeOption: "Light",
  disableGrammar: false,
  disableTranslation: false,
  disableLanguageDetection: false,
  disableFirstRun: false,
  enableCookies: false,
  uiLang: "en",
};

function loadSettings(): ImmersiveReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      // Ensure auto-play and speed reflect the latest defaults
      saved.readAloudAutoPlay = true;
      if (saved.readAloudSpeed < 1.25) saved.readAloudSpeed = 1.25;
      return saved;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: ImmersiveReaderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function useImmersiveReader() {
  const { getAccessToken } = useAuth();
  const [settings, setSettingsState] = useState<ImmersiveReaderSettings>(loadSettings);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback((patch: Partial<ImmersiveReaderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const launch = useCallback(
    async (title: string, text: string, mimeType: string = "text/plain", eventDetail?: unknown) => {
      setError(null);

      try {
        const token = await getAccessToken();
        const { token: irToken, subdomain } = await apiClient.getIRToken(token);

        // Convert markdown to HTML for proper rendering in Immersive Reader
        const irContent = mimeType === "text/html" ? text : markdownToHtml(text);
        const irMimeType = "text/html";

        const content = {
          title,
          chunks: [{ content: irContent, mimeType: irMimeType }],
        };

        // Build SDK options from settings
        const readAloudOptions = {
          voice: settings.readAloudVoice,
          speed: settings.readAloudSpeed,
          autoplay: settings.readAloudAutoPlay,
        };

        const translationOptions =
          settings.translationLanguage
            ? {
                language: settings.translationLanguage,
                autoEnableDocumentTranslation: settings.autoEnableDocumentTranslation,
                autoEnableWordTranslation: settings.autoEnableWordTranslation,
              }
            : undefined;

        const displayOptions = {
          textSize: settings.textSize,
          increaseSpacing: settings.increaseSpacing,
          fontFamily: settings.fontFamily,
          themeOption: settings.themeOption === "Dark"
            ? ThemeOption.Dark
            : ThemeOption.Light,
        };

        const storedPrefs = (() => {
          try { return localStorage.getItem(PREFS_STORAGE_KEY) ?? undefined; } catch { return undefined; }
        })();

        const options = {
          uiLang: settings.uiLang || undefined,
          readAloudOptions,
          translationOptions,
          displayOptions,
          disableGrammar: settings.disableGrammar,
          disableTranslation: settings.disableTranslation,
          disableLanguageDetection: settings.disableLanguageDetection,
          disableFirstRun: settings.disableFirstRun,
          cookiePolicy: settings.enableCookies
            ? CookiePolicy.Enable
            : CookiePolicy.Disable,
          allowFullscreen: true,
          preferences: storedPrefs,
          onPreferencesChanged: (value: string) => {
            // Persist user preferences from the IR UI
            try { localStorage.setItem(PREFS_STORAGE_KEY, value); } catch { /* ignore */ }
          },
          onExit: () => {
            setIsOpen(false);
            window.dispatchEvent(new Event("immersive-reader-closed"));
          },
        };

        // Pause any active TTS playback before opening Immersive Reader
        window.dispatchEvent(new Event("pause-all-tts"));
        setIsOpen(true);
        window.dispatchEvent(new CustomEvent("immersive-reader-opened", { detail: eventDetail }));
        await launchAsync(irToken, subdomain, content, options);
      } catch (err: unknown) {
        setIsOpen(false);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error("Immersive Reader launch failed:", err);
      }
    },
    [settings, getAccessToken],
  );

  const close = useCallback(() => {
    irClose();
    setIsOpen(false);
    window.dispatchEvent(new Event("immersive-reader-closed"));
  }, []);

  return {
    settings,
    updateSettings,
    launch,
    close,
    isOpen,
    error,
  };
}
