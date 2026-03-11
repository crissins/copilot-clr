import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { Chat } from "./components/Chat";
import { LoginButton } from "./components/LoginButton";
import { useAuth } from "./hooks/useAuth";

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === "true";

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Azure Chat</h1>
        {(LOCAL_DEV || user) && (
          <div className="user-info">
            <span>{user?.name ?? "Local Dev"}</span>
            {!LOCAL_DEV && (
              <button onClick={logout} className="btn-secondary">
                Sign Out
              </button>
            )}
          </div>
        )}
      </header>

      <main className="app-main">
        {LOCAL_DEV ? (
          <Chat />
        ) : (
          <>
            <AuthenticatedTemplate>
              <Chat />
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
              <div className="login-container">
                <div className="login-card">
                  <h2>Welcome to Azure Chat</h2>
                  <p>Sign in with your Microsoft account to start chatting.</p>
                  <LoginButton />
                </div>
              </div>
            </UnauthenticatedTemplate>
          </>
        )}
      </main>
    </div>
  );
}
