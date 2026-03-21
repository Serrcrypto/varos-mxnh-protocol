import { Link } from "react-router-dom";
import { WalletButton } from "../components/WalletButton";
import { useHashConnect } from "../hooks/useHashConnect";

function FeatureCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-varos-slate/15 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-varos-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-varos-slate">{body}</p>
    </article>
  );
}

export function Home() {
  const { accountId } = useHashConnect();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-varos-slate/15 bg-gradient-to-br from-white via-varos-cream to-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-varos-slate">
          MXNH Protocol | El peso mexicano en Hedera
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-varos-navy sm:text-6xl">
          VAROS
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-varos-slate sm:text-lg">
          Envía dólares, recibe pesos. Instantáneo, transparente, on-chain.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <WalletButton className="sm:w-auto" />
          {accountId ? (
            <Link
              to="/send"
              className="inline-flex items-center justify-center rounded-lg border border-varos-navy bg-varos-navy px-4 py-2.5 text-sm font-semibold text-varos-cream transition hover:bg-varos-slate"
            >
              Enviar dinero
            </Link>
          ) : (
            <p className="text-sm text-varos-slate">
              Conecta tu wallet para continuar con un envío.
            </p>
          )}
        </div>

        {accountId ? (
          <div className="mt-6 rounded-2xl border border-varos-slate/15 bg-white/70 p-4">
            <p className="text-xs font-semibold text-varos-slate">Cuenta Hedera</p>
            <p className="mt-1 break-all font-mono text-sm font-bold text-varos-navy">
              {accountId}
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="sr-only">Ventajas del protocolo</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            title="Instantáneo (<5s)"
            body="Liquidación rápida con seguimiento on-chain y experiencia simple para el usuario final."
          />
          <FeatureCard
            title="Transparente (on-chain)"
            body="Operación auditable en Hedera: trazabilidad, consistencia y confianza en cada paso."
          />
          <FeatureCard
            title="Económico (<$0.01)"
            body="Costos de red y estructura del protocolo pensados para micropagos y uso frecuente."
          />
        </div>
      </section>
    </div>
  );
}
