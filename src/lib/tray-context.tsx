import { createContext, useContext, type ReactNode } from "react";

type TrayContextValue = {
  openTray: (content: ReactNode, onClose?: () => void) => void;
  closeTray: () => void;
  isOpen: boolean;
};

export const TrayContext = createContext<TrayContextValue | null>(null);

export function useTray() {
  const context = useContext(TrayContext);

  if (!context) {
    throw new Error("useTray must be used within AppShell");
  }

  return context;
}
