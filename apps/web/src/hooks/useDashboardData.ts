import { useCallback, useEffect, useState } from "react";
import {
  getFxRate,
  getHederaBalance,
  getHederaReserve,
  tryFetchSdkTxList,
  type FxRateData,
  type HederaBalanceData,
  type HederaReserveData,
  type SdkTxListItem,
} from "../lib/api";

export type DashboardDataState = {
  reserve: HederaReserveData | null;
  fx: FxRateData | null;
  feeBalance: HederaBalanceData | null;
  feeMissingConfig: boolean;
  txList: SdkTxListItem[] | null;
  loading: boolean;
  error: string | null;
};

const initialState: DashboardDataState = {
  reserve: null,
  fx: null,
  feeBalance: null,
  feeMissingConfig: false,
  txList: null,
  loading: true,
  error: null,
};

export function useDashboardData() {
  const [state, setState] = useState<DashboardDataState>(initialState);

  const refresh = useCallback(async () => {
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
    }));

    const rawFee = import.meta.env.VITE_FEE_COLLECTOR_ID?.trim();
    const feeId =
      rawFee && rawFee !== "0.0.0" ? rawFee : undefined;
    const feeMissingConfig = !feeId;

    try {
      const [reserve, fx, txList] = await Promise.all([
        getHederaReserve(),
        getFxRate(),
        tryFetchSdkTxList(),
      ]);

      let feeBalance: HederaBalanceData | null = null;
      if (feeId) {
        feeBalance = await getHederaBalance(feeId);
      }

      setState({
        reserve,
        fx,
        feeBalance,
        feeMissingConfig,
        txList,
        loading: false,
        error: null,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudieron cargar los datos";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
