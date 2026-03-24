import { Configuration, LogLevel } from "@azure/msal-browser";

/**
 * MSAL Configuration for Entra ID authentication.
 *
 * After creating an App Registration in Azure Portal:
 * 1. Set VITE_ENTRA_CLIENT_ID in .env
 * 2. Set VITE_ENTRA_TENANT_ID in .env (or use "common" for multi-tenant)
 * 3. Add redirect URI: http://localhost:5173 (dev) and your SWA URL (prod)
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "YOUR_CLIENT_ID",
    authority: `https://login.microsoftonline.com/${
      import.meta.env.VITE_ENTRA_TENANT_ID || "common"
    }/v2.0`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const apiRequest = {
  scopes: [`api://${import.meta.env.VITE_ENTRA_BACKEND_CLIENT_ID || "YOUR_CLIENT_ID"}/access_as_user`],
};
