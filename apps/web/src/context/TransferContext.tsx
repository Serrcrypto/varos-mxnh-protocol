import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FxRateData } from "../lib/api";

export type PayoutMethod = "OXXO" | "SPEI";

export type TransferSnapshot = {
  amountUsd: number;
  receiverPhone: string;
  payoutMethod: PayoutMethod;
  clabe: string;
  fx: Pick<FxRateData, "rate" | "rateWithSpread" | "source">;
  mxnhGross: number;
  protocolFeeMxnh: number;
};

type TransferContextValue = {
  draft: Partial<TransferSnapshot> & {
    amountUsd: number;
    receiverPhone: string;
    payoutMethod: PayoutMethod;
    clabe: string;
  };
  setAmountUsd: (v: number) => void;
  setReceiverPhone: (v: string) => void;
  setPayoutMethod: (v: PayoutMethod) => void;
  setClabe: (v: string) => void;
  commitTransfer: (snapshot: TransferSnapshot) => void;
  committed: TransferSnapshot | null;
  clearCommitted: () => void;
};

const TransferContext = createContext<TransferContextValue | null>(null);

export function TransferProvider({ children }: { children: ReactNode }) {
  const [amountUsd, setAmountUsdState] = useState(0);
  const [receiverPhone, setReceiverPhoneState] = useState("");
  const [payoutMethod, setPayoutMethodState] = useState<PayoutMethod>("OXXO");
  const [clabe, setClabeState] = useState("");
  const [committed, setCommitted] = useState<TransferSnapshot | null>(null);

  const setAmountUsd = useCallback((v: number) => setAmountUsdState(v), []);
  const setReceiverPhone = useCallback((v: string) => setReceiverPhoneState(v), []);
  const setPayoutMethod = useCallback(
    (v: PayoutMethod) => setPayoutMethodState(v),
    []
  );
  const setClabe = useCallback((v: string) => setClabeState(v), []);

  const commitTransfer = useCallback((snapshot: TransferSnapshot) => {
    setCommitted(snapshot);
  }, []);

  const clearCommitted = useCallback(() => setCommitted(null), []);

  const value = useMemo<TransferContextValue>(
    () => ({
      draft: { amountUsd, receiverPhone, payoutMethod, clabe },
      setAmountUsd,
      setReceiverPhone,
      setPayoutMethod,
      setClabe,
      commitTransfer,
      committed,
      clearCommitted,
    }),
    [
      amountUsd,
      receiverPhone,
      payoutMethod,
      clabe,
      setAmountUsd,
      setReceiverPhone,
      setPayoutMethod,
      setClabe,
      commitTransfer,
      committed,
      clearCommitted,
    ]
  );

  return (
    <TransferContext.Provider value={value}>{children}</TransferContext.Provider>
  );
}

export function useTransfer(): TransferContextValue {
  const ctx = useContext(TransferContext);
  if (!ctx) {
    throw new Error("useTransfer debe usarse dentro de TransferProvider");
  }
  return ctx;
}
