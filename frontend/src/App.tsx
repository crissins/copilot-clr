import { useState, useMemo, useEffect, useCallback } from "react";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Button,
  Avatar,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  SignOut24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from "@fluentui/react-icons";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";

import { Chat } from "./components/Chat";
import { LandingPage } from "./components/LandingPage";

import { Sidebar } from "./components/Sidebar";
import { SmartContextSidebar } from "./components/SmartContextSidebar";
import { SettingsPage } from "./components/SettingsPage";
import { LanguageSelector } from "./components/LanguageSelector";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { useAuth } from "./hooks/useAuth";
import { SettingsProvider, useSharedSettings } from "./hooks/SettingsContext";
import { TimerProvider } from "./hooks/TimerContext";
import { useFocusTimer } from "./hooks/useFocusTimer";
import { getAppI18n } from "./i18n";
import { I18nProvider } from "./I18nContext";
import { Feature1Page } from "./features/feature1/Feature1Page";
import { Feature2Page } from "./features/feature2/Feature2Page";
import { Feature3Page } from "./features/feature3/Feature3Page";
import { Feature4Page } from "./features/feature4/Feature4Page";
import { Feature5Page } from "./features/feature5/Feature5Page";
import { Feature6Page } from "./features/feature6/Feature6Page";
import { Feature7Page } from "./features/feature7/Feature7Page";
import { AvatarPage } from "./features/avatar/AvatarPage";
import { VoiceLivePage } from "./features/voicelive/VoiceLivePage";
import { FeedbackPage } from "./components/FeedbackPage";
import { AboutPage } from "./components/AboutPage";
import { FloatingChat } from "./components/FloatingChat";
import { FloatingTimer } from "./components/FloatingTimer";

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === "true";

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  appShell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("0", "16px"),
    height: "48px",
    backgroundColor: tokens.colorBrandBackground,
    flexShrink: 0,
    ...shorthands.borderBottom("1px", "solid", tokens.colorBrandBackground2),
  },
  headerTitle: {
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
    flex: 1,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  loginWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── View router ──────────────────────────────────────────────────────────────

const VIEW_STYLE_HIDDEN: React.CSSProperties = { display: "none" };
const VIEW_STYLE_VISIBLE: React.CSSProperties = { display: "flex", flexDirection: "column", flex: 1, height: "100%", overflow: "hidden" };

function ViewContent({ activeView, onStartOnboarding, loadSessionId, onSessionLoaded, onNavigate }: {
  activeView: string;
  onStartOnboarding?: () => void;
  loadSessionId?: string | null;
  onSessionLoaded?: () => void;
  onNavigate?: (viewId: string) => void;
}) {
  return (
    <>
      <div style={activeView === "chat" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Chat loadSessionId={loadSessionId} onSessionLoaded={onSessionLoaded} /></div>
      <div style={activeView === "feature1" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature1Page /></div>
      <div style={activeView === "feature2" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature2Page /></div>
      <div style={activeView === "feature3" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature3Page /></div>
      <div style={activeView === "feature4" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature4Page /></div>
      <div style={activeView === "feature5" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature5Page /></div>
      <div style={activeView === "feature6" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature6Page onStartOnboarding={onStartOnboarding} /></div>
      <div style={activeView === "feature7" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><Feature7Page /></div>
      <div style={activeView === "avatar" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><AvatarPage /></div>
      <div style={activeView === "voicelive" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><VoiceLivePage /></div>
      <div style={activeView === "feedback" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><FeedbackPage /></div>
      <div style={activeView === "about" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><AboutPage onNavigate={onNavigate} /></div>
      <div style={activeView === "settings" ? VIEW_STYLE_VISIBLE : VIEW_STYLE_HIDDEN}><SettingsPage onStartOnboarding={onStartOnboarding} /></div>
    </>
  );
}

// ── Visual settings → CSS variables ─────────────────────────────────────────

const FONT_SIZE_MAP: Record<string, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  "x-large": "22px",
};

const FONT_FAMILY_MAP: Record<string, string> = {
  default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  OpenDyslexic: '"OpenDyslexic", sans-serif',
  "Comic Sans MS": '"Comic Sans MS", "Comic Sans", cursive',
  Arial: "Arial, Helvetica, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
};

const LINE_SPACING_MAP: Record<string, string> = {
  compact: "1.2",
  normal: "1.5",
  relaxed: "1.8",
  spacious: "2.2",
};

const COLOR_OVERLAY_MAP: Record<string, string> = {
  none: "transparent",
  yellow: "rgba(255, 255, 0, 0.08)",
  blue: "rgba(0, 100, 255, 0.06)",
  green: "rgba(0, 200, 0, 0.06)",
  pink: "rgba(255, 105, 180, 0.06)",
  peach: "rgba(255, 218, 185, 0.1)",
};

function useApplyVisualSettings() {
  const { settings } = useSharedSettings();

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    // Font size
    root.style.setProperty(
      "--user-font-size",
      FONT_SIZE_MAP[settings.fontSize] || "16px",
    );

    // Font family (dyslexiaFont toggle overrides fontFamily)
    const family = settings.dyslexiaFont
      ? FONT_FAMILY_MAP["OpenDyslexic"]
      : FONT_FAMILY_MAP[settings.fontFamily] || FONT_FAMILY_MAP["default"];
    root.style.setProperty("--user-font-family", family);

    // Line spacing
    root.style.setProperty(
      "--user-line-spacing",
      LINE_SPACING_MAP[settings.lineSpacing] || "1.5",
    );

    // Text alignment
    root.style.setProperty("--user-text-align", settings.textAlignment || "left");

    // Color overlay
    root.style.setProperty(
      "--user-color-overlay",
      COLOR_OVERLAY_MAP[settings.colorOverlay] || "transparent",
    );

    // High contrast
    root.classList.toggle("high-contrast", !!settings.highContrast);

    // Reduced motion
    root.classList.toggle("reduced-motion", !!settings.reducedMotion);
  }, [settings]);
}

// ── App shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const { settings, loading: settingsLoading, updateSettings, reload: reloadSettings } = useSharedSettings();
  const [activeView, setActiveView] = useState("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(true);

  // Session loading from history sidebar
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleLoadSession = useCallback((sessionId: string) => {
    setActiveView("chat");
    setPendingSessionId(sessionId);
    setActiveSessionId(sessionId);
  }, []);

  // Apply all visual settings (font, spacing, overlay, etc.) to DOM
  useApplyVisualSettings();

  // Focus timer & break reminders
  useFocusTimer();

  // Derive dark mode from settings.theme (fallback: system preference)
  const darkMode = useMemo(() => {
    if (!settings) return false;
    if (settings.theme === "dark") return true;
    if (settings.theme === "light") return false;
    // "system" — use OS preference
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }, [settings?.theme]);

  // Toggle theme between light/dark via header button
  const handleToggleTheme = useCallback(() => {
    const next = darkMode ? "light" : "dark";
    updateSettings({ theme: next }).catch(() => {});
  }, [darkMode, updateSettings]);

  // Onboarding: "lang" → language selector, "wizard" → step wizard, null → done/not needed
  const [onboardingPhase, setOnboardingPhase] = useState<"lang" | "wizard" | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const isAuthed = LOCAL_DEV || !!user;

  // Sync language from saved settings once loaded
  useEffect(() => {
    if (settings?.language && !selectedLanguage) {
      setSelectedLanguage(settings.language);
    }
  }, [settings?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive effective language: onboarding selection → saved settings → "en"
  const effectiveLanguage = selectedLanguage || settings?.language || "en";
  const i18nValue = useMemo(
    () => ({ language: effectiveLanguage, t: getAppI18n(effectiveLanguage) }),
    [effectiveLanguage],
  );

  // Detect first-time user (no updatedAt means they've never saved settings)
  const needsOnboarding =
    isAuthed && !settingsLoading && settings && !settings.updatedAt && !onboardingDismissed;

  // Derive effective phase — also allow manual re-trigger via onboardingPhase
  const activeOnboarding =
    onboardingPhase !== null ? onboardingPhase
    : needsOnboarding ? "lang"
    : null;

  const startOnboarding = () => {
    setOnboardingPhase("lang");
  };

  const skipOnboarding = () => {
    setOnboardingPhase(null);
    setOnboardingDismissed(true);
  };

  return (
    <FluentProvider theme={darkMode ? webDarkTheme : webLightTheme}>
      <I18nProvider value={i18nValue}>
      <div className={styles.appShell}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className={styles.header} role="banner">
          <Text className={styles.headerTitle}>{i18nValue.t.appTitle}</Text>

          {isAuthed && (
            <div className={styles.headerActions}>
              {/* Dark mode toggle */}
              <Button
                appearance="subtle"
                icon={darkMode ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
                onClick={handleToggleTheme}
                aria-label={darkMode ? i18nValue.t.switchToLight : i18nValue.t.switchToDark}
                style={{ color: tokens.colorNeutralForegroundOnBrand }}
              />

              {/* User avatar */}
              {user && (
                <Avatar
                  name={user.name ?? "User"}
                  size={28}
                  aria-label={`Signed in as ${user.name}`}
                />
              )}

              {/* Sign out */}
              {!LOCAL_DEV && (
                <Button
                  appearance="subtle"
                  icon={<SignOut24Regular />}
                  onClick={logout}
                  aria-label={i18nValue.t.signOut}
                  style={{ color: tokens.colorNeutralForegroundOnBrand }}
                />
              )}
            </div>
          )}
        </header>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className={styles.body}>
          {LOCAL_DEV ? (
            // LOCAL_DEV: show onboarding or normal content
            activeOnboarding === "lang" ? (
              <main className={styles.main} role="main">
                <LanguageSelector
                  onSelect={(lang) => {
                    setSelectedLanguage(lang);
                    setOnboardingPhase("wizard");
                  }}
                  onSkip={skipOnboarding}
                />
              </main>
            ) : activeOnboarding === "wizard" ? (
              <main className={styles.main} role="main">
                <OnboardingWizard
                  language={selectedLanguage}
                  onComplete={() => {
                    setOnboardingPhase(null);
                    setOnboardingDismissed(true);
                    reloadSettings();
                  }}
                  onSkip={skipOnboarding}
                />
              </main>
            ) : (
              <>
                <Sidebar
                  activeView={activeView}
                  onNavigate={setActiveView}
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                  onLoadSession={handleLoadSession}
                />
                <SmartContextSidebar
                  collapsed={historySidebarCollapsed}
                  onToggle={() => setHistorySidebarCollapsed(!historySidebarCollapsed)}
                  onNavigate={setActiveView}
                />
                <main className={styles.main} role="main">
                  <ViewContent
                    activeView={activeView}
                    onStartOnboarding={startOnboarding}
                    loadSessionId={pendingSessionId}
                    onSessionLoaded={() => setPendingSessionId(null)}
                    onNavigate={setActiveView}
                  />
                </main>
                <FloatingTimer />
                <FloatingChat />
              </>
            )
          ) : (
            <>
              <AuthenticatedTemplate>
                {activeOnboarding === "lang" ? (
                  <main className={styles.main} role="main">
                    <LanguageSelector
                      onSelect={(lang) => {
                        setSelectedLanguage(lang);
                        setOnboardingPhase("wizard");
                      }}
                      onSkip={skipOnboarding}
                    />
                  </main>
                ) : activeOnboarding === "wizard" ? (
                  <main className={styles.main} role="main">
                    <OnboardingWizard
                      language={selectedLanguage}
                      onComplete={() => {
                        setOnboardingPhase(null);
                        setOnboardingDismissed(true);
                        reloadSettings();
                      }}
                      onSkip={skipOnboarding}
                    />
                  </main>
                ) : (
                  <>
                    <Sidebar
                      activeView={activeView}
                      onNavigate={setActiveView}
                      collapsed={sidebarCollapsed}
                      onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                      onLoadSession={handleLoadSession}
                    />
                    <SmartContextSidebar
                      collapsed={historySidebarCollapsed}
                      onToggle={() => setHistorySidebarCollapsed(!historySidebarCollapsed)}
                      onNavigate={setActiveView}
                    />
                    <main className={styles.main} role="main">
                      <ViewContent
                        activeView={activeView}
                        onStartOnboarding={startOnboarding}
                        loadSessionId={pendingSessionId}
                        onSessionLoaded={() => setPendingSessionId(null)}
                        onNavigate={setActiveView}
                      />
                    </main>
                    <FloatingTimer />
                    <FloatingChat />
                  </>
                )}
              </AuthenticatedTemplate>

              <UnauthenticatedTemplate>
                <LandingPage />
              </UnauthenticatedTemplate>
            </>
          )}
        </div>

      </div>
      </I18nProvider>
    </FluentProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <TimerProvider>
        <AppShell />
      </TimerProvider>
    </SettingsProvider>
  );
}
