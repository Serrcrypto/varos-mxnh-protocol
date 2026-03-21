import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { payoutMethodLabel } from "../components/TransactionSummary";
import type { PayoutMethod } from "../context/TransferContext";
import { useTransfer } from "../context/TransferContext";

export type SuccessState = {
  amountUsd: number;
  amountMxnh: number;
  voucherCode: string;
  payoutMethod: PayoutMethod;
  transactionId: string;
  hcsSequence: number | string;
  exchangeRate: number;
  protocolFee: number;
  receiverPhone: string;
};

function isSuccessState(x: unknown): x is SuccessState {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const hcs = o.hcsSequence;
  const hcsOk =
    (typeof hcs === "number" && Number.isFinite(hcs)) ||
    (typeof hcs === "string" && hcs.trim().length > 0);
  const xr = o.exchangeRate;
  const exchangeRateOk =
    typeof xr === "number"
      ? Number.isFinite(xr)
      : xr === null || xr === undefined;
  return (
    typeof o.amountUsd === "number" &&
    Number.isFinite(o.amountUsd) &&
    typeof o.amountMxnh === "number" &&
    Number.isFinite(o.amountMxnh) &&
    typeof o.voucherCode === "string" &&
    o.voucherCode.length > 0 &&
    (o.payoutMethod === "OXXO" || o.payoutMethod === "SPEI") &&
    typeof o.transactionId === "string" &&
    o.transactionId.length > 0 &&
    hcsOk &&
    exchangeRateOk &&
    typeof o.protocolFee === "number" &&
    Number.isFinite(o.protocolFee) &&
    typeof o.receiverPhone === "string"
  );
}

function hederaNetworkPath(): "testnet" | "mainnet" {
  return import.meta.env.VITE_HEDERA_NETWORK?.toLowerCase() === "mainnet"
    ? "mainnet"
    : "testnet";
}

function hashscanTxUrl(transactionId: string): string {
  const net = hederaNetworkPath();
  return `https://hashscan.io/${net}/transaction/${encodeURIComponent(transactionId)}`;
}

function hashscanTopicUrl(topicId: string): string | null {
  const trimmed = topicId.trim();
  if (!trimmed || trimmed === "0.0.0") return null;
  const net = hederaNetworkPath();
  return `https://hashscan.io/${net}/topic/${encodeURIComponent(trimmed)}`;
}

const nfUsd = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const nfMxnh = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 6,
  minimumFractionDigits: 2,
});

const nfRate = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 6,
  minimumFractionDigits: 2,
});

export function Success() {
  const location = useLocation();
  const { clearCommitted } = useTransfer();
  const [copied, setCopied] = useState(false);

  const state = location.state;

  useEffect(() => {
    if (isSuccessState(state)) {
      clearCommitted();
    }
  }, [state, clearCommitted]);

  const topicId = import.meta.env.VITE_HCS_TOPIC_ID ?? "";
  const topicHref = useMemo(() => hashscanTopicUrl(topicId), [topicId]);

  if (!isSuccessState(state)) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-varos-slate/15 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-varos-navy sm:text-2xl">
            No hay datos de transacción
          </h1>
          <p className="mt-3 text-sm text-varos-slate">
            Esta página solo muestra el resultado después de completar un pago. Inicia un
            envío desde el formulario.
          </p>
          <Link
            to="/send"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-varos-navy px-5 py-3 text-sm font-bold text-varos-cream transition hover:bg-varos-slate"
          >
            Ir a enviar
          </Link>
        </div>
      </div>
    );
  }

  const exchangeRateDisplay =
    state.exchangeRate == null || Number.isNaN(state.exchangeRate)
      ? "—"
      : nfRate.format(state.exchangeRate);

  const copyVoucher = async () => {
    try {
      await navigator.clipboard.writeText(state.voucherCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const hcsDisplay =
    typeof state.hcsSequence === "number"
      ? String(state.hcsSequence)
      : state.hcsSequence;

  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-varos-slate/15 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-varos-navy sm:text-4xl">
          ¡Envío exitoso!
        </h1>
        <p className="text-sm text-varos-slate">
          Conserva tu código de voucher y los enlaces de Hashscan para tus registros.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-varos-slate/12 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
            Monto enviado (USD)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-varos-navy">
            {nfUsd.format(state.amountUsd)}
          </p>
        </div>
        <div className="rounded-2xl border border-varos-slate/12 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
            Monto recibido (MXNH)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-varos-navy">
            {nfMxnh.format(state.amountMxnh)} MXNH
          </p>
        </div>
        <div className="rounded-2xl border border-varos-slate/12 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
            Tipo de cambio usado
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-varos-navy">
            {exchangeRateDisplay}
          </p>
        </div>
        <div className="rounded-2xl border border-varos-slate/12 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
            Fee del protocolo
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-varos-navy">
            {nfMxnh.format(state.protocolFee)} MXNH
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-varos-slate/15 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
          Teléfono receptor
        </p>
        <p className="mt-1 text-sm font-medium text-varos-navy">{state.receiverPhone}</p>
        <p className="mt-3 text-xs text-varos-slate">
          Método de cobro:{" "}
          <span className="font-semibold text-varos-navy">
            {payoutMethodLabel(state.payoutMethod)}
          </span>
        </p>
      </section>

      <section className="rounded-2xl border border-varos-sand/40 bg-gradient-to-br from-white to-varos-cream/50 p-6 shadow-sm sm:p-8">
        <h2 className="text-sm font-semibold text-varos-slate">Código de voucher</h2>
        <p className="mt-4 break-all font-mono text-3xl font-black tracking-tight text-varos-navy sm:text-4xl">
          {state.voucherCode}
        </p>
        <button
          type="button"
          onClick={() => void copyVoucher()}
          className="mt-5 inline-flex items-center justify-center rounded-xl border border-varos-slate/25 bg-varos-cream/60 px-5 py-2.5 text-sm font-bold text-varos-navy transition hover:border-varos-navy hover:bg-varos-sand/30"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </section>

      <section className="rounded-2xl border border-varos-slate/15 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-varos-navy">On-chain</h2>
        <ul className="mt-4 space-y-5 text-sm">
          <li>
            <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
              Transaction ID
            </p>
            <a
              className="mt-1 inline-block break-all font-mono text-sm font-semibold text-varos-slate underline decoration-varos-sand underline-offset-4 hover:text-varos-navy"
              href={hashscanTxUrl(state.transactionId)}
              target="_blank"
              rel="noreferrer"
            >
              {state.transactionId}
            </a>
          </li>
          <li>
            <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
              Secuencia HCS
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-varos-navy">{hcsDisplay}</p>
            {topicHref ? (
              <a
                className="mt-2 inline-block text-sm font-semibold text-varos-slate underline decoration-varos-sand underline-offset-4 hover:text-varos-navy"
                href={topicHref}
                target="_blank"
                rel="noreferrer"
              >
                Ver topic en Hashscan ({topicId})
              </a>
            ) : (
              <p className="mt-2 text-xs text-varos-slate">
                Configura <span className="font-mono">VITE_HCS_TOPIC_ID</span> para el
                enlace al topic.
              </p>
            )}
          </li>
        </ul>
      </section>

      <Link
        to="/send"
        className="inline-flex w-full items-center justify-center rounded-xl bg-varos-navy px-4 py-3 text-center text-sm font-bold text-varos-cream transition hover:bg-varos-slate sm:w-auto"
      >
        Hacer otro envío
      </Link>
    </div>
  );
}
