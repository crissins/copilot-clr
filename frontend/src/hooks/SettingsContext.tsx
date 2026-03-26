import { createContext, useContext, type ReactNode } from "react";
import { useSettings } from "./useSettings";
import type { NeurodiverseSettings } from "../services/api";

interface SettingsContextValue {
  settings: NeurodiverseSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateSettings: (updates: Partial<NeurodiverseSettings>) => Promise<NeurodiverseSettings | undefined>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const value = useSettings();
  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSharedSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSharedSettings must be used within a SettingsProvider");
  }
  return ctx;
}
