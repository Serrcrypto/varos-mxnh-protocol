import type { PayoutMethod } from "../context/TransferContext";

export type SummaryLine = { label: string; value: string; emphasize?: boolean };

type Props = {
  title?: string;
  lines: SummaryLine[];
  className?: string;
};

export function TransactionSummary({ title, lines, className = "" }: Props) {
  return (
    <section
      className={`rounded-2xl border border-varos-slate/15 bg-white p-4 shadow-sm ${className}`}
    >
      {title ? (
        <h2 className="text-sm font-semibold text-varos-navy">{title}</h2>
      ) : null}
      <ul className={title ? "mt-3 space-y-2" : "space-y-2"}>
        {lines.map((l) => (
          <li
            key={l.label}
            className="flex items-start justify-between gap-4 border-b border-varos-slate/10 pb-2 last:border-b-0 last:pb-0"
          >
            <span className="text-sm text-varos-slate">{l.label}</span>
            <span
              className={`text-right text-sm font-semibold text-varos-navy ${
                l.emphasize ? "font-mono text-base" : ""
              }`}
            >
              {l.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function payoutMethodLabel(m: PayoutMethod): string {
  return m === "OXXO" ? "OXXO" : "SPEI (CLABE)";
}
