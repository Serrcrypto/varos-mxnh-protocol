import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  payoutMethodLabel,
  TransactionSummary,
} from "../components/TransactionSummary";
import { useTransfer } from "../context/TransferContext";
import { useHashConnect } from "../hooks/useHashConnect";
import { createPaymentIntent, createVoucher } from "../lib/api";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise =
  stripePublishableKey && stripePublishableKey.startsWith("pk_")
    ? loadStripe(stripePublishableKey)
    : null;

const cardElementOptions = {
  style: {
    base: {
      color: "#1B3C53",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      fontSize: "16px",
      "::placeholder": { color: "#456882" },
    },
    invalid: { color: "#b91c1c" },
  },
};

function PayCheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { accountId } = useHashConnect();
  const { committed } = useTransfer();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summaryLines = useMemo(() => {
    if (!committed) return [];
    return [
      { label: "Monto (USD)", value: `$${committed.amountUsd.toFixed(2)}` },
      {
        label: "Monto estimado (MXNH)",
        value: `${committed.mxnhGross.toFixed(6)} MXNH`,
        emphasize: true,
      },
      {
        label: "Tipo de cambio (con spread)",
        value: committed.fx.rateWithSpread.toFixed(6),
      },
      {
        label: "Fee protocolo (0.5%)",
        value: `${committed.protocolFeeMxnh.toFixed(6)} MXNH`,
      },
      { label: "Teléfono receptor", value: committed.receiverPhone },
      {
        label: "Método de cobro",
        value: payoutMethodLabel(committed.payoutMethod),
      },
    ];
  }, [committed]);

  const onPay = async () => {
    if (!committed) return;
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe no está listo. Recarga la página e intenta de nuevo.");
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      setError("No se encontró el campo de tarjeta.");
      return;
    }

    setBusy(true);
    try {
      const amountCents = Math.round(committed.amountUsd * 100);
      if (!(amountCents > 0)) {
        throw new Error("Monto inválido para el cobro.");
      }

      const clientSecret = await createPaymentIntent({
        amount: amountCents,
        currency: "usd",
      });

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card },
        });

      if (stripeError) {
        throw new Error(stripeError.message || "El pago con tarjeta falló.");
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        throw new Error("El pago no se completó correctamente.");
      }

      const voucher = await createVoucher({
        amountUsd: committed.amountUsd,
        receiverPhone: committed.receiverPhone,
      });

      navigate("/success", {
        replace: true,
        state: {
          ...voucher,
          amountUsd: committed.amountUsd,
          payoutMethod: committed.payoutMethod,
          receiverPhone: committed.receiverPhone,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setBusy(false);
    }
  };

  if (!committed) return null;

  return (
    <div className="space-y-6">
      <TransactionSummary title="Resumen del envío" lines={summaryLines} />

      <section className="rounded-2xl border border-varos-slate/15 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-varos-navy">Cuenta Hedera</h2>
        <p className="mt-2 break-all font-mono text-sm font-bold text-varos-navy">
          {accountId ?? "—"}
        </p>
        <p className="mt-2 text-xs text-varos-slate">
          Esta cuenta está conectada vía HashConnect.
        </p>
      </section>

      <section className="rounded-2xl border border-varos-slate/15 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-varos-navy">
          Pago con tarjeta
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-varos-slate">
          El pago en USD se procesa vía Stripe. Los MXNH se mintean
          automáticamente en Hedera y el receptor recibe un código de cobro por
          SMS.
        </p>
        <p className="mt-2 text-xs text-varos-slate">
          Tus datos de tarjeta se procesan de forma segura con Stripe.
        </p>

        <div className="mt-4 rounded-xl border border-varos-slate/20 bg-varos-cream/30 p-3">
          <CardElement options={cardElementOptions} />
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void onPay()}
          disabled={busy || !stripe || !elements}
          className="mt-5 w-full rounded-xl bg-varos-navy px-4 py-3 text-sm font-bold text-varos-cream transition hover:bg-varos-slate disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Pagar y enviar"}
        </button>
      </section>
    </div>
  );
}

export function Pay() {
  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        Falta una clave pública válida de Stripe en{" "}
        <span className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</span>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-varos-navy sm:text-3xl">Pago</h1>
        <p className="text-sm text-varos-slate">
          Confirma el resumen y completa el cobro con tarjeta.
        </p>
      </header>

      <Elements stripe={stripePromise}>
        <PayCheckoutForm />
      </Elements>
    </div>
  );
}
