import { useState } from "react";
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
  Settings24Regular,
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
import { PreferencesPanel } from "./components/PreferencesPanel";
import { Sidebar } from "./components/Sidebar";
import { SettingsPage } from "./components/SettingsPage";
import { LanguageSelector } from "./components/LanguageSelector";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import { Feature1Page } from "./features/feature1/Feature1Page";
import { Feature2Page } from "./features/feature2/Feature2Page";
import { Feature3Page } from "./features/feature3/Feature3Page";
import { Feature4Page } from "./features/feature4/Feature4Page";
import { Feature5Page } from "./features/feature5/Feature5Page";
import { Feature6Page } from "./features/feature6/Feature6Page";
import { Feature7Page } from "./features/feature7/Feature7Page";

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

function ViewContent({ activeView, onStartOnboarding }: { activeView: string; onStartOnboarding?: () => void }) {
  switch (activeView) {
    case "chat":     return <Chat />;
    case "feature1": return <Feature1Page />;
    case "feature2": return <Feature2Page />;
    case "feature3": return <Feature3Page />;
    case "feature4": return <Feature4Page />;
    case "feature5": return <Feature5Page />;
    case "feature6": return <Feature6Page />;
    case "feature7": return <Feature7Page />;
    case "settings": return <SettingsPage onStartOnboarding={onStartOnboarding} />;
    default:         return <Chat />;
  }
}

// ── App shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const { settings, loading: settingsLoading, reload: reloadSettings } = useSettings();
  const [showPrefs, setShowPrefs] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Onboarding: "lang" → language selector, "wizard" → step wizard, null → done/not needed
  const [onboardingPhase, setOnboardingPhase] = useState<"lang" | "wizard" | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const isAuthed = LOCAL_DEV || !!user;

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

  return (
    <FluentProvider theme={darkMode ? webDarkTheme : webLightTheme}>
      <div className={styles.appShell}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className={styles.header} role="banner">
          <Text className={styles.headerTitle}>Copilot CLR</Text>

          {isAuthed && (
            <div className={styles.headerActions}>
              {/* Dark mode toggle */}
              <Button
                appearance="subtle"
                icon={darkMode ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
                onClick={() => setDarkMode(!darkMode)}
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                style={{ color: tokens.colorNeutralForegroundOnBrand }}
              />

              {/* Preferences */}
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                onClick={() => setShowPrefs(true)}
                aria-label="Accessibility preferences"
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
                  aria-label="Sign out"
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
                />
              </main>
            ) : (
              <>
                <Sidebar
                  activeView={activeView}
                  onNavigate={setActiveView}
                  collapsed={sidebarCollapsed}
                  onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
                <main className={styles.main} role="main">
                  <ViewContent activeView={activeView} onStartOnboarding={startOnboarding} />
                </main>
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
                    />
                  </main>
                ) : (
                  <>
                    <Sidebar
                      activeView={activeView}
                      onNavigate={setActiveView}
                      collapsed={sidebarCollapsed}
                      onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                    <main className={styles.main} role="main">
                      <ViewContent activeView={activeView} onStartOnboarding={startOnboarding} />
                    </main>
                  </>
                )}
              </AuthenticatedTemplate>

              <UnauthenticatedTemplate>
                <LandingPage />
              </UnauthenticatedTemplate>
            </>
          )}
        </div>

        {/* ── Preferences drawer ─────────────────────────────────────── */}
        {showPrefs && (
          <PreferencesPanel isOpen={showPrefs} onClose={() => setShowPrefs(false)} />
        )}
      </div>
    </FluentProvider>
  );
}

export default function App() {
  // FluentProvider lives inside AppShell so dark mode state can control it.
  // Wrap with a minimal provider here so any MSAL context works outside AppShell.
  return <AppShell />;
}
