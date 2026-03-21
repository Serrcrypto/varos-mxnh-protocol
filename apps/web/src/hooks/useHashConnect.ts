import { useContext } from "react";
import { WalletContext, type WalletContextValue } from "../context/WalletContext";

export function useHashConnect(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useHashConnect debe usarse dentro de WalletProvider");
  }
  return ctx;
}
