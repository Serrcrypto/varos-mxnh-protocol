import { useMemo } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import type { SdkTxListItem } from "../lib/api";

function hederaNetworkPath(): "testnet" | "mainnet" {
  return import.meta.env.VITE_HEDERA_NETWORK?.toLowerCase() === "mainnet"
    ? "mainnet"
    : "testnet";
}

function hashscanTxUrl(transactionId: string): string {
  const net = hederaNetworkPath();
  return `https://hashscan.io/${net}/transaction/${encodeURIComponent(transactionId)}`;
}

function hashscanHcsMessageUrl(topicId: string, sequence: number): string | null {
  const trimmed = topicId.trim();
  if (!trimmed || trimmed === "0.0.0") return null;
  const net = hederaNetworkPath();
  return `https://hashscan.io/${net}/topic/${encodeURIComponent(trimmed)}?message=${sequence}`;
}

const nfMxnh = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
});

const nfMxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const nfRate = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 6,
  minimumFractionDigits: 2,
});

const nfPct = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const nfSeq = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function StatCard({
  label,
  value,
  footnote,
  href,
  external,
}: {
  label: string;
  value: string;
  footnote?: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-varos-slate">
        {label}
      </p>
      <p className="mt-2 break-words text-3xl font-bold tabular-nums tracking-tight text-varos-navy sm:text-4xl">
        {value}
      </p>
      {footnote ? (
        <p className="mt-2 text-xs leading-relaxed text-varos-slate">{footnote}</p>
      ) : null}
    </>
  );

  const className =
    "block rounded-2xl border border-varos-slate/12 bg-white p-5 shadow-sm transition hover:border-varos-slate/25";

  if (href) {
    return (
      <a
        href={href}
        className={className}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }

  return <div className={className}>{body}</div>;
}

function TxTable({ rows }: { rows: SdkTxListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-varos-slate/12 bg-white shadow-sm">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-varos-slate/12 bg-varos-cream/60">
            <th className="px-4 py-3 font-semibold text-varos-navy">Tipo</th>
            <th className="px-4 py-3 font-semibold text-varos-navy">Monto</th>
            <th className="px-4 py-3 font-semibold text-varos-navy">Fecha</th>
            <th className="px-4 py-3 font-semibold text-varos-navy">Explorador</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.hederaTxId}-${i}`}
              className="border-b border-varos-slate/8 last:border-0"
            >
              <td className="px-4 py-3 font-mono text-xs font-semibold text-varos-navy">
                {row.type}
              </td>
              <td className="px-4 py-3 tabular-nums text-varos-slate">
                {nfMxnh.format(row.amount)} MXNH
              </td>
              <td className="px-4 py-3 text-varos-slate">
                {formatDateTime(row.timestamp)}
              </td>
              <td className="px-4 py-3">
                <a
                  href={hashscanTxUrl(row.hederaTxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-varos-slate underline decoration-varos-sand underline-offset-2 hover:text-varos-navy"
                >
                  Ver en Hashscan
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const {
    reserve,
    fx,
    feeBalance,
    feeMissingConfig,
    txList,
    loading,
    error,
    refresh,
  } = useDashboardData();

  const topicId = import.meta.env.VITE_HCS_TOPIC_ID ?? "";

  const reserveProofHref = useMemo(() => {
    if (!reserve) return null;
    return hashscanHcsMessageUrl(topicId, reserve.hcsSequence);
  }, [reserve, topicId]);

  const ratioPct =
    reserve != null ? `${nfPct.format(reserve.ratio * 100)} %` : "—";

  return (
    <div className="space-y-10">
      <header className="space-y-3 border-b border-varos-slate/15 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-varos-navy sm:text-3xl">
              MXNH Protocol — Dashboard Público
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-varos-slate sm:text-base">
              Transparencia on-chain: verifica el respaldo 1:1 de cada MXNH
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-varos-navy bg-varos-navy px-5 py-2.5 text-sm font-semibold text-varos-cream shadow-sm transition hover:bg-varos-slate disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        <p className="text-xs text-varos-slate">
          Los datos se cargan solo al abrir la página o al pulsar Actualizar. La
          consulta de reserva publica una nueva prueba en cadena; no hay
          actualización automática.
        </p>
      </header>

      {error ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section aria-label="Indicadores del protocolo">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total MXNH en circulación"
            value={reserve ? nfMxnh.format(reserve.totalMxnh) : loading ? "…" : "—"}
            footnote="Suministro consultado on-chain"
          />
          <StatCard
            label="Total MXN en reserva"
            value={
              reserve ? nfMxn.format(reserve.totalMxnReserve) : loading ? "…" : "—"
            }
            footnote="Respaldo fiduciario asociado"
          />
          <StatCard
            label="Ratio de colateral"
            value={reserve ? ratioPct : loading ? "…" : "—"}
            footnote="1,00 = 100 % de respaldo"
          />
          <StatCard
            label="Total fees distribuidos"
            value={
              feeMissingConfig
                ? "—"
                : feeBalance
                  ? `${nfMxnh.format(feeBalance.balanceMXNH)} MXNH`
                  : loading
                    ? "…"
                    : "—"
            }
            footnote={
              feeMissingConfig
                ? "Define VITE_FEE_COLLECTOR_ID en .env (0.0.x del recolector)."
                : "Saldo MXNH en la cuenta del recolector de comisiones"
            }
          />
          <StatCard
            label="Tipo de cambio actual"
            value={
              fx ? nfRate.format(fx.rateWithSpread) : loading ? "…" : "—"
            }
            footnote={
              fx
                ? `Fuente: ${fx.source} · ${formatDateTime(fx.timestamp)}`
                : undefined
            }
          />
          <StatCard
            label="Última prueba de reserva (HCS)"
            value={
              reserve
                ? `Secuencia ${nfSeq.format(reserve.hcsSequence)}`
                : loading
                  ? "…"
                  : "—"
            }
            footnote={
              reserveProofHref
                ? "Abre el mensaje en el topic de consenso"
                : topicId && topicId !== "0.0.0"
                  ? "Enlace no disponible"
                  : "Configura VITE_HCS_TOPIC_ID para el enlace a Hashscan"
            }
            href={reserveProofHref ?? undefined}
            external
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="tx-heading">
        <h2
          id="tx-heading"
          className="text-lg font-bold tracking-tight text-varos-navy"
        >
          Últimas transacciones
        </h2>
        <p className="text-sm text-varos-slate">
          Transacciones registradas en HCS vía el protocolo. Los enlaces apuntan a
          Hashscan (red {hederaNetworkPath()}).
        </p>

        {txList && txList.length > 0 ? (
          <TxTable rows={txList} />
        ) : (
          <div className="rounded-2xl border border-dashed border-varos-slate/25 bg-white/80 px-5 py-10 text-center">
            <p className="text-sm font-medium text-varos-navy">
              Próximamente: feed de transacciones en tiempo real desde HCS
            </p>
            <p className="mt-2 text-sm text-varos-slate">
              El listado automático requiere un endpoint de historial en el API.
              Mientras tanto, consulta operaciones puntuales por ID en{" "}
              <code className="rounded bg-varos-cream px-1.5 py-0.5 font-mono text-xs">
                GET /sdk/v1/tx/:id
              </code>
              .
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
