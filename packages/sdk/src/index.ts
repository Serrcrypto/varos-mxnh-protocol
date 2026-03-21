// ============================================================
// @varos/mxnh-sdk
// SDK del protocolo MXNH — Peso mexicano nativo en Hedera
//
// Permite a cualquier fintech integrar pagos US→México con
// 5 líneas de código. El SDK se comunica con el backend del
// protocolo Varos vía REST API.
//
// Ejemplo:
//   const varos = new VarosSDK({ apiKey: 'sk_...', baseUrl: '...' });
//   const result = await varos.mint({ amountUsd: 50, receiverPhone: '+525512345678' });
// ============================================================

import axios, { AxiosInstance, AxiosError } from "axios";

// ─── TIPOS DE CONFIGURACIÓN ─────────────────────────────────────────────────

export interface VarosConfig {
  apiKey: string;                          // API key asignada a la fintech
  baseUrl: string;                         // URL del protocolo (ej: https://api.varos.mx)
  environment?: "testnet" | "mainnet";     // Red de Hedera a usar (default: testnet)
  timeout?: number;                        // Timeout en ms (default: 30000)
}

// ─── TIPOS DE PARÁMETROS ────────────────────────────────────────────────────

export interface MintParams {
  amountUsd: number;       // Monto en USD a convertir
  receiverPhone: string;   // Teléfono del receptor en México (+52...)
}

export interface BurnParams {
  voucherCode: string;             // Código del voucher a cobrar
  method: "OXXO" | "SPEI";        // Método de cobro
  clabe?: string;                  // CLABE destino (requerido para SPEI)
}

export interface TransferParams {
  from: string;     // Account ID de Hedera origen (0.0.XXXXX)
  to: string;       // Account ID de Hedera destino
  amount: number;   // Monto en MXNH
}

// ─── TIPOS DE RESULTADOS ────────────────────────────────────────────────────

export interface MintResult {
  success: boolean;
  transactionId?: string;    // TX de Hedera
  hcsSequence?: string;      // Secuencia en HCS
  voucherCode?: string;      // Código para cobro
  amountMxnh?: number;       // Monto convertido
  amountUsd?: number;        // Monto original en USD
  exchangeRate?: number;     // Tipo de cambio usado
  protocolFee?: number;      // Fee cobrado (0.5%)
  error?: string;
}

export interface BurnResult {
  success: boolean;
  transactionId?: string;
  hcsSequence?: string;
  offRampReference?: string;  // Referencia de OXXO o clave SPEI
  amountMxnh?: number;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  transactionId?: string;
  hcsSequence?: string;
  from?: string;
  to?: string;
  amount?: number;
  error?: string;
}

export interface BalanceResult {
  success: boolean;
  accountId?: string;
  balance?: number;
  error?: string;
}

export interface RateResult {
  success: boolean;
  pair?: string;             // "MXN/USD"
  rate?: number;             // Tipo de cambio base
  rateWithSpread?: number;   // Con spread del protocolo
  spread?: string;           // Ej: "0.3%"
  source?: string;           // "chainlink" | "exchangerate-api" | "cache"
  timestamp?: string;
  error?: string;
}

export interface ReserveProofResult {
  success: boolean;
  totalMxnh?: number;
  totalMxnReserve?: number;
  ratio?: number;
  hcsSequence?: string;
  timestamp?: string;
  error?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  type?: string;
  amountMxnh?: number;
  amountUsd?: number;
  exchangeRate?: number;
  protocolFee?: number;
  voucherCode?: string;
  hcsSequence?: string;
  error?: string;
}

// ─── CLASE PRINCIPAL DEL SDK ────────────────────────────────────────────────

export class VarosSDK {
  private client: AxiosInstance;
  private config: VarosConfig;

  constructor(config: VarosConfig) {
    this.config = {
      environment: "testnet",
      timeout: 30000,
      ...config,
    };

    if (!config.apiKey) {
      throw new Error("VarosSDK: apiKey es requerida");
    }
    if (!config.baseUrl) {
      throw new Error("VarosSDK: baseUrl es requerida");
    }

    // Crear cliente HTTP con autenticación automática
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
    });
  }

  // ─── MINT: Convertir USD → MXNH ──────────────────────────────────────────
  // Crea un voucher de MXNH a partir de un pago en USD.
  // El backend convierte USD→MXNH usando el oracle FX.
  // El receptor recibe un SMS con el código de cobro.
  async mint(params: MintParams): Promise<MintResult> {
    try {
      const { data } = await this.client.post("/voucher/create", {
        amountUsd: params.amountUsd,
        receiverPhone: params.receiverPhone,
      });

      return {
        success: true,
        transactionId: data.data?.transactionId,
        hcsSequence: data.data?.hcsSequence,
        voucherCode: data.data?.voucherCode,
        amountMxnh: data.data?.amountMxnh,
        amountUsd: data.data?.amountUsd,
        exchangeRate: data.data?.exchangeRate,
        protocolFee: data.data?.protocolFee,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── BURN: Cobrar voucher vía OXXO o SPEI ────────────────────────────────
  // El receptor cobra sus MXNH en pesos mexicanos.
  async burn(params: BurnParams): Promise<BurnResult> {
    try {
      let data;

      if (params.method === "SPEI") {
        // SPEI va por el endpoint dedicado con validación de CLABE
        const response = await this.client.post("/offramp/spei", {
          voucherCode: params.voucherCode,
          clabe: params.clabe,
        });
        data = response.data;
      } else {
        // OXXO va por el redeem genérico
        const response = await this.client.post(
          `/voucher/${params.voucherCode}/redeem`,
          { offRampType: "OXXO" }
        );
        data = response.data;
      }

      return {
        success: true,
        transactionId: data.data?.burnTransactionId,
        hcsSequence: data.data?.hcsSequence,
        offRampReference: data.data?.offRampReference || data.data?.trackingKey,
        amountMxnh: data.data?.amountMxnh || data.data?.amountMxn,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── TRANSFER: Mover MXNH entre cuentas Hedera ───────────────────────────
  async transfer(params: TransferParams): Promise<TransferResult> {
    try {
      const { data } = await this.client.post("/sdk/v1/transfer", {
        from: params.from,
        to: params.to,
        amount: params.amount,
      });

      return {
        success: true,
        transactionId: data.data?.transactionId,
        hcsSequence: data.data?.hcsSequence,
        from: params.from,
        to: params.to,
        amount: params.amount,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── BALANCE: Consultar saldo de MXNH ────────────────────────────────────
  async getBalance(accountId: string): Promise<BalanceResult> {
    try {
      const { data } = await this.client.get(
        `/hedera/balance/${accountId}`
      );

      return {
        success: true,
        accountId,
        balance: data.data?.balanceMXNH,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── RATE: Obtener tipo de cambio actual ──────────────────────────────────
  async getRate(): Promise<RateResult> {
    try {
      const { data } = await this.client.get("/fx/rate");

      return {
        success: true,
        pair: "MXN/USD",
        rate: data.data?.rate,
        rateWithSpread: data.data?.rateWithSpread,
        spread: data.data?.spread,
        source: data.data?.source,
        timestamp: data.data?.timestamp,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── RESERVE PROOF: Obtener prueba de reserva ────────────────────────────
  // El backend calcula el proof en vivo: consulta el Treasury en Hedera,
  // publica el proof en HCS, y devuelve los datos.
  async getReserveProof(): Promise<ReserveProofResult> {
    try {
      const { data } = await this.client.get("/hedera/reserve");

      return {
        success: true,
        totalMxnh: data.data?.totalMxnh,
        totalMxnReserve: data.data?.totalMxnReserve,
        ratio: data.data?.ratio,
        hcsSequence: data.data?.hcsSequence,
        timestamp: data.data?.timestamp,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── TRANSACTION: Consultar estado de una transacción ────────────────────
  async getTransaction(txId: string): Promise<TransactionResult> {
    try {
      const { data } = await this.client.get(`/sdk/v1/tx/${txId}`);

      return {
        success: true,
        transactionId: data.data?.transactionId || data.data?.hederaTxId,
        status: data.data?.status,
        type: data.data?.type,
        amountMxnh: data.data?.amountMxnh || data.data?.amount,
        amountUsd: data.data?.amountUsd,
        exchangeRate: data.data?.exchangeRate,
        protocolFee: data.data?.protocolFee,
        voucherCode: data.data?.voucherCode,
        hcsSequence: data.data?.hcsSequence,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── MANEJO DE ERRORES ────────────────────────────────────────────────────
  private handleError(error: unknown): any {
    if (error instanceof AxiosError) {
      return {
        success: false,
        error:
          error.response?.data?.error ||
          error.message ||
          "Error de conexión con el protocolo Varos",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// ─── EXPORT POR DEFECTO ─────────────────────────────────────────────────────
export default VarosSDK;
