import { useState, useCallback } from "react";
import { useMsal, useAccount } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { apiRequest } from "../auth/msalConfig";

const LOCAL_DEV = import.meta.env.VITE_LOCAL_DEV === "true";

// In local dev mode the hook returns a mock authenticated user so the
// rest of the application works without an Entra ID app registration.
export function useAuth() {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] || null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async () => {
    if (LOCAL_DEV) return;
    setIsLoading(true);
    try {
      await instance.loginPopup({ scopes: ["openid", "profile", "email"] });
    } finally {
      setIsLoading(false);
    }
  }, [instance]);

  const logout = useCallback(async () => {
    if (LOCAL_DEV) return;
    await instance.logoutPopup();
  }, [instance]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (LOCAL_DEV) return null; // backend accepts null token in LOCAL_DEV mode
    if (!account) return null;

    try {
      const response = await instance.acquireTokenSilent({
        ...apiRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const response = await instance.acquireTokenPopup(apiRequest);
        return response.accessToken;
      }
      // AADSTS70011 (invalid_scope) means the app registration's "Expose an API"
      // hasn't been configured yet — typically a first-deploy timing issue that
      // resolves once the Bicep deployment script completes.  Return null so the
      // caller can degrade gracefully instead of showing a cryptic error.
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("AADSTS70011") || msg.includes("invalid_scope")) {
        console.warn(
          "Custom API scope not configured yet (AADSTS70011). " +
          "Auth will be skipped until the deployment script finishes. " +
          "Run 'azd up' or redeploy to fix."
        );
      } else {
        console.error("Failed to acquire token:", error);
      }
      return null;
    }
  }, [instance, account]);

  if (LOCAL_DEV) {
    return {
      isAuthenticated: true,
      user: { name: "Local Dev User", email: "dev@localhost" },
      isLoading: false,
      login,
      logout,
      getAccessToken,
    };
  }

  return {
    isAuthenticated: !!account,
    user: account
      ? {
          name: account.name || "User",
          email: account.username || "",
        }
      : null,
    isLoading,
    login,
    logout,
    getAccessToken,
  };
}
