import { Configuration, LogLevel } from "@azure/msal-browser";

/**
 * MSAL Configuration for Entra ID authentication.
 *
 * After creating an App Registration in Azure Portal:
 * 1. Set VITE_ENTRA_CLIENT_ID in .env
 * 2. Ensure "Supported account types" includes personal Microsoft accounts
 * 3. Add redirect URI: http://localhost:5173 (dev) and your SWA URL (prod)
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || "YOUR_CLIENT_ID",
    // "common" supports both organizational and personal (@outlook.com) accounts
    authority: "https://login.microsoftonline.com/common",
    knownAuthorities: ["login.microsoftonline.com"],
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
  scopes: [`api://${import.meta.env.VITE_ENTRA_CLIENT_ID || "YOUR_CLIENT_ID"}/access_as_user`],
};
