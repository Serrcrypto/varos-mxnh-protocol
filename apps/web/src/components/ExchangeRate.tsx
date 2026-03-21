import type { FxRateData } from "../lib/api";

type Props = {
  data: FxRateData | null;
  loading: boolean;
  error: string | null;
  className?: string;
};

export function ExchangeRate({ data, loading, error, className = "" }: Props) {
  return (
    <section
      className={`rounded-2xl border border-varos-slate/15 bg-white p-4 shadow-sm ${className}`}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-varos-navy">Tipo de cambio</h2>
          <p className="mt-1 text-xs text-varos-slate">
            Se actualiza automáticamente cada 30 segundos.
          </p>
        </div>
        {loading ? (
          <span className="text-xs font-medium text-varos-slate">Actualizando…</span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      ) : data ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-varos-cream/70 p-3">
            <dt className="text-xs font-semibold text-varos-slate">Rate</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-varos-navy">
              {data.rate.toFixed(6)}
            </dd>
          </div>
          <div className="rounded-xl bg-varos-cream/70 p-3">
            <dt className="text-xs font-semibold text-varos-slate">Rate con spread</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-varos-navy">
              {data.rateWithSpread.toFixed(6)}
            </dd>
          </div>
          <div className="rounded-xl bg-varos-cream/70 p-3">
            <dt className="text-xs font-semibold text-varos-slate">Fuente</dt>
            <dd className="mt-1 text-sm font-semibold text-varos-navy">{data.source}</dd>
            <dd className="mt-1 text-[11px] text-varos-slate">
              {new Date(data.timestamp).toLocaleString("es-MX")}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-varos-slate">Cargando tipo de cambio…</p>
      )}
    </section>
  );
}
