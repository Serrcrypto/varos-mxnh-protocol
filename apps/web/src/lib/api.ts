const apiUrl = import.meta.env.VITE_API_URL.replace(/\/$/, "");
const apiKey = import.meta.env.VITE_API_KEY;

export type FxRateData = {
  rate: number;
  rateWithSpread: number;
  spread: number;
  source: string;
  timestamp: string;
};

export type FxRateResponse = {
  success: boolean;
  data: FxRateData;
};

export type CreatePaymentIntentResponse = {
  clientSecret: string;
};

export type VoucherData = {
  voucherCode: string;
  amountMxnh: number;
  exchangeRate: number;
  protocolFee: number;
  transactionId: string;
  /** El backend puede enviarlo como string (secuencia HCS). */
  hcsSequence: number | string;
  amountUsd?: number | null;
};

export type VoucherCreateResponse = {
  success: boolean;
  data: VoucherData;
};

export type HederaBalanceData = {
  accountId: string;
  balanceMXNH: number;
};

export type HederaBalanceResponse = {
  success: boolean;
  data: HederaBalanceData;
};

export type HederaReserveData = {
  totalMxnh: number;
  totalMxnReserve: number;
  ratio: number;
  hcsSequence: number;
};

export type HederaReserveResponse = {
  success: boolean;
  data: HederaReserveData;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Respuesta del servidor no válida (JSON)");
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : res.statusText;
    throw new Error(msg || `Error HTTP ${res.status}`);
  }

  return body as T;
}

export async function getFxRate(): Promise<FxRateData> {
  const json = await apiFetch<FxRateResponse>("/fx/rate", { method: "GET" });
  if (!json.success) {
    throw new Error("No se pudo obtener el tipo de cambio");
  }
  return json.data;
}

export async function createPaymentIntent(body: {
  amount: number;
  currency: string;
}): Promise<string> {
  const json = await apiFetch<any>("/payments/create-intent", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return json.data.clientSecret;
}

/** El backend convierte USD→MXNH con el oracle FX; no enviar amountMxnh. */
export async function createVoucher(body: {
  amountUsd: number;
  receiverPhone: string;
}): Promise<VoucherData> {
  const json = await apiFetch<VoucherCreateResponse>("/voucher/create", {
    method: "POST",
    body: JSON.stringify({
      amountUsd: body.amountUsd,
      receiverPhone: body.receiverPhone,
    }),
  });
  if (!json.success || !json.data) {
    throw new Error("No se pudo crear el voucher");
  }
  const d = json.data;
  const hcsRaw = d.hcsSequence;
  const hcsSequence =
    typeof hcsRaw === "string" ? hcsRaw : Number(hcsRaw);
  const exchangeRate =
    d.exchangeRate == null ? 0 : Number(d.exchangeRate);
  return {
    ...d,
    hcsSequence,
    exchangeRate,
  };
}

export async function getHederaBalance(
  accountId: string,
): Promise<HederaBalanceData> {
  const encoded = encodeURIComponent(accountId);
  const json = await apiFetch<HederaBalanceResponse>(
    `/hedera/balance/${encoded}`,
    { method: "GET" },
  );
  if (!json.success) {
    throw new Error("No se pudo consultar el saldo");
  }
  return json.data;
}

export async function getHederaReserve(): Promise<HederaReserveData> {
  const json = await apiFetch<HederaReserveResponse>("/hedera/reserve", {
    method: "GET",
  });
  if (!json.success) {
    throw new Error("No se pudo consultar la reserva");
  }
  return json.data;
}

/** Fila del listado de transacciones SDK (si el backend expone GET /sdk/v1/tx/). */
export type SdkTxListItem = {
  type: "MINT" | "BURN" | "TRANSFER";
  amount: number;
  timestamp: string;
  hederaTxId: string;
};

function parseSdkTxListItem(raw: unknown): SdkTxListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (type !== "MINT" && type !== "BURN" && type !== "TRANSFER") return null;
  const amountRaw = o.amount ?? o.amountMxnh;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw)
        : NaN;
  if (!Number.isFinite(amount)) return null;
  const tsRaw = o.timestamp ?? o.createdAt;
  let timestamp: string;
  if (typeof tsRaw === "string") {
    timestamp = tsRaw;
  } else if (tsRaw instanceof Date) {
    timestamp = tsRaw.toISOString();
  } else {
    timestamp = new Date().toISOString();
  }
  const hederaTxId =
    typeof o.hederaTxId === "string"
      ? o.hederaTxId
      : typeof o.transactionId === "string"
        ? o.transactionId
        : null;
  if (!hederaTxId) return null;
  return { type, amount, timestamp, hederaTxId };
}

/**
 * Intenta obtener el listado de transacciones SDK.
 * Devuelve null si el endpoint no existe o la respuesta no es válida.
 */
export async function tryFetchSdkTxList(): Promise<SdkTxListItem[] | null> {
  try {
    const res = await fetch(`${apiUrl}/sdk/v1/tx/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      success?: boolean;
      data?: unknown;
    };
    if (!body?.success || !Array.isArray(body.data)) return null;
    const rows: SdkTxListItem[] = [];
    for (const item of body.data) {
      const parsed = parseSdkTxListItem(item);
      if (parsed) rows.push(parsed);
    }
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}
