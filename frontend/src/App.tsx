import { useState } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { Chat } from "./components/Chat";
import { LoginButton } from "./components/LoginButton";
import { PreferencesPanel } from "./components/PreferencesPanel";
import { Sidebar } from "./components/Sidebar";
import { useAuth } from "./hooks/useAuth";
import { Feature1Page } from "./features/feature1/Feature1Page";
import { Feature2Page } from "./features/feature2/Feature2Page";
import { Feature3Page } from "./features/feature3/Feature3Page";
import { Feature4Page } from "./features/feature4/Feature4Page";
import { Feature5Page } from "./features/feature5/Feature5Page";
import { Feature6Page } from "./features/feature6/Feature6Page";

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === "true";

function ViewContent({ activeView }: { activeView: string }) {
  switch (activeView) {
    case "chat":     return <Chat />;
    case "feature1": return <Feature1Page />;
    case "feature2": return <Feature2Page />;
    case "feature3": return <Feature3Page />;
    case "feature4": return <Feature4Page />;
    case "feature5": return <Feature5Page />;
    case "feature6": return <Feature6Page />;
    default:         return <Chat />;
  }
}

export default function App() {
  const { user, logout } = useAuth();
  const [showPrefs, setShowPrefs] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>CognitiveClear</h1>
        {(LOCAL_DEV || user) && (
          <div className="user-info">
            <button
              onClick={() => setShowPrefs(true)}
              className="btn-secondary"
              aria-label="Accessibility Preferences"
              title="Accessibility Preferences"
            >
              &#x2699; Preferences
            </button>
            <span>{user?.name ?? "Local Dev"}</span>
            {!LOCAL_DEV && (
              <button onClick={logout} className="btn-secondary">
                Sign Out
              </button>
            )}
          </div>
        )}
      </header>

      <div className="app-body">
        {(LOCAL_DEV || user) && (
          <Sidebar
            activeView={activeView}
            onNavigate={setActiveView}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        <main className="app-main">
          {LOCAL_DEV ? (
            <ViewContent activeView={activeView} />
          ) : (
            <>
              <AuthenticatedTemplate>
                <ViewContent activeView={activeView} />
              </AuthenticatedTemplate>
              <UnauthenticatedTemplate>
                <div className="login-container">
                  <div className="login-card">
                    <h2>Welcome to CognitiveClear</h2>
                    <p>
                      AI accessibility assistant for neurodiverse users.
                      Sign in with your Microsoft account to get started.
                    </p>
                    <LoginButton />
                  </div>
                </div>
              </UnauthenticatedTemplate>
            </>
          )}
        </main>
      </div>

      <PreferencesPanel isOpen={showPrefs} onClose={() => setShowPrefs(false)} />
    </div>
  );
}
