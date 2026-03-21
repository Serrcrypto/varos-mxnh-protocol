import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LedgerId } from "@hashgraph/sdk";
import {
  HashConnect,
  HashConnectConnectionState,
} from "@hashconnect/sdk";

export type WalletContextValue = {
  accountId: string | null;
  connectionState: HashConnectConnectionState | null;
  initializing: boolean;
  initError: string | null;
  connectError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

export const WalletContext = createContext<WalletContextValue | null>(null);

function buildMetadata() {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:5173";

  return {
    name: import.meta.env.VITE_HEDERA_APP_NAME,
    description: import.meta.env.VITE_HEDERA_APP_DESCRIPTION,
    icons: [`${origin}/favicon.svg`],
    url: origin,
  };
}

function resolveLedgerId(): LedgerId {
  const net = (import.meta.env.VITE_HEDERA_NETWORK || "testnet").toLowerCase();
  if (net === "mainnet") return LedgerId.MAINNET;
  return LedgerId.TESTNET;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const hashConnectRef = useRef<HashConnect | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<HashConnectConnectionState | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
    if (!projectId) {
      setInitError(
        "Falta VITE_WALLETCONNECT_PROJECT_ID (WalletConnect en portal.hedera.com)."
      );
      setInitializing(false);
      return;
    }

    let cancelled = false;
    const hc = new HashConnect(
      resolveLedgerId(),
      projectId,
      buildMetadata(),
      false
    );
    hashConnectRef.current = hc;

    const syncAccountsFromClient = () => {
      const ids = hc.connectedAccountIds.map((a) => a.toString());
      setAccountId(ids[0] ?? null);
    };

    hc.pairingEvent.on((session) => {
      const first = session.accountIds[0] ?? null;
      setAccountId(first);
    });

    hc.disconnectionEvent.on(() => {
      setAccountId(null);
    });

    hc.connectionStatusChangeEvent.on((state) => {
      setConnectionState(state);
      if (state === HashConnectConnectionState.Disconnected) {
        setAccountId(null);
      }
      if (state === HashConnectConnectionState.Paired) {
        syncAccountsFromClient();
      }
    });

    void (async () => {
      try {
        await hc.init();
        if (cancelled) return;
        syncAccountsFromClient();
        setInitError(null);
      } catch (e) {
        if (!cancelled) {
          setInitError(
            e instanceof Error ? e.message : "No se pudo inicializar HashConnect"
          );
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      void hc.disconnect().catch(() => undefined);
      hashConnectRef.current = null;
    };
  }, []);

  const connectWallet = useCallback(async () => {
    setConnectError(null);
    const hc = hashConnectRef.current;
    if (!hc) {
      setConnectError(initError || "HashConnect no está listo");
      return;
    }
    try {
      await hc.openPairingModal(
        "light",
        "#F9F3EF",
        "#1B3C53",
        "#456882",
        "12px"
      );
    } catch (e) {
      setConnectError(
        e instanceof Error ? e.message : "No se pudo abrir el modal de wallets"
      );
    }
  }, [initError]);

  const disconnectWallet = useCallback(async () => {
    const hc = hashConnectRef.current;
    if (!hc) return;
    setConnectError(null);
    try {
      await hc.disconnect();
      setAccountId(null);
    } catch (e) {
      setConnectError(
        e instanceof Error ? e.message : "No se pudo desconectar la wallet"
      );
    }
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      accountId,
      connectionState,
      initializing,
      initError,
      connectError,
      connectWallet,
      disconnectWallet,
    }),
    [
      accountId,
      connectionState,
      initializing,
      initError,
      connectError,
      connectWallet,
      disconnectWallet,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
