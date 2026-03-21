import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExchangeRate } from "../components/ExchangeRate";
import {
  useTransfer,
  type PayoutMethod,
} from "../context/TransferContext";
import { useExchangeRate } from "../hooks/useExchangeRate";

function onlyDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

export function Send() {
  const navigate = useNavigate();
  const { data, loading, error } = useExchangeRate(true);
  const {
    draft,
    setAmountUsd,
    setReceiverPhone,
    setPayoutMethod,
    setClabe,
    commitTransfer,
  } = useTransfer();

  const [amountInput, setAmountInput] = useState(
    draft.amountUsd > 0 ? String(draft.amountUsd) : ""
  );
  const [phoneLocal, setPhoneLocal] = useState(
    draft.receiverPhone.replace(/^\+52/, "")
  );
  const [clabeInput, setClabeInput] = useState(draft.clabe);
  const [method, setMethod] = useState<PayoutMethod>(draft.payoutMethod);
  const [formError, setFormError] = useState<string | null>(null);

  const amountUsd = useMemo(() => {
    const n = Number(amountInput);
    return Number.isFinite(n) ? n : 0;
  }, [amountInput]);

  const rateWithSpread = data?.rateWithSpread ?? 0;
  const mxnhGross = amountUsd > 0 && rateWithSpread > 0 ? amountUsd * rateWithSpread : 0;
  const protocolFeeMxnh = mxnhGross > 0 ? mxnhGross * 0.005 : 0;

  const fullPhone = phoneLocal ? `+52${onlyDigits(phoneLocal, 10)}` : "";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!data) {
      setFormError("Espera a que cargue el tipo de cambio e intenta de nuevo.");
      return;
    }
    if (!(amountUsd > 0)) {
      setFormError("Ingresa un monto válido en USD.");
      return;
    }
    if (onlyDigits(phoneLocal, 10).length !== 10) {
      setFormError("El teléfono debe tener 10 dígitos (México).");
      return;
    }
    if (method === "SPEI") {
      const clabe = onlyDigits(clabeInput, 18);
      if (clabe.length !== 18) {
        setFormError("La CLABE debe tener 18 dígitos.");
        return;
      }
    }

    setAmountUsd(amountUsd);
    setReceiverPhone(fullPhone);
    setPayoutMethod(method);
    setClabe(method === "SPEI" ? onlyDigits(clabeInput, 18) : "");

    commitTransfer({
      amountUsd,
      receiverPhone: fullPhone,
      payoutMethod: method,
      clabe: method === "SPEI" ? onlyDigits(clabeInput, 18) : "",
      fx: {
        rate: data.rate,
        rateWithSpread: data.rateWithSpread,
        source: data.source,
      },
      mxnhGross,
      protocolFeeMxnh,
    });

    navigate("/pay");
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-varos-navy sm:text-3xl">
          Nuevo envío
        </h1>
        <p className="text-sm text-varos-slate">
          Define el monto, revisa el tipo de cambio y los datos del receptor.
        </p>
      </header>

      <ExchangeRate data={data} loading={loading} error={error} />

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-varos-slate/15 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-varos-navy">
              Monto en USD
            </span>
            <input
              inputMode="decimal"
              className="mt-2 w-full rounded-xl border border-varos-slate/20 bg-varos-cream/40 px-3 py-3 text-base outline-none ring-varos-slate focus:ring-2"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="Ej. 100.00"
              autoComplete="transaction-amount"
            />
          </label>

          <div className="rounded-2xl border border-varos-slate/15 bg-varos-cream/50 p-4">
            <p className="text-sm font-semibold text-varos-navy">Vista previa MXNH</p>
            <p className="mt-2 font-mono text-2xl font-bold text-varos-navy">
              {mxnhGross > 0 ? mxnhGross.toFixed(6) : "—"} MXNH
            </p>
            <p className="mt-2 text-xs text-varos-slate">
              Cálculo: USD × rateWithSpread (tiempo real).
            </p>
            <div className="mt-4 border-t border-varos-slate/10 pt-3">
              <p className="text-xs font-semibold text-varos-slate">
                Fee del protocolo (0.5% sobre MXNH)
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-varos-navy">
                {protocolFeeMxnh > 0 ? `${protocolFeeMxnh.toFixed(6)} MXNH` : "—"}
              </p>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-varos-navy">
            Teléfono del receptor
          </span>
          <div className="mt-2 flex overflow-hidden rounded-xl border border-varos-slate/20 bg-varos-cream/40 focus-within:ring-2 focus-within:ring-varos-slate">
            <span className="flex items-center border-r border-varos-slate/15 bg-white/60 px-3 text-sm font-semibold text-varos-slate">
              +52
            </span>
            <input
              inputMode="numeric"
              className="w-full bg-transparent px-3 py-3 text-base outline-none"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(onlyDigits(e.target.value, 10))}
              placeholder="10 dígitos"
              autoComplete="tel"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-varos-navy">
            Método de cobro
          </span>
          <select
            className="mt-2 w-full rounded-xl border border-varos-slate/20 bg-white px-3 py-3 text-base outline-none ring-varos-slate focus:ring-2"
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoutMethod)}
          >
            <option value="OXXO">OXXO</option>
            <option value="SPEI">SPEI</option>
          </select>
        </label>

        {method === "SPEI" ? (
          <label className="block">
            <span className="text-sm font-semibold text-varos-navy">CLABE</span>
            <input
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-varos-slate/20 bg-varos-cream/40 px-3 py-3 font-mono text-base outline-none ring-varos-slate focus:ring-2"
              value={clabeInput}
              onChange={(e) => setClabeInput(onlyDigits(e.target.value, 18))}
              placeholder="18 dígitos"
              autoComplete="off"
            />
          </label>
        ) : null}

        {formError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-varos-navy px-4 py-3 text-sm font-bold text-varos-cream transition hover:bg-varos-slate disabled:opacity-50"
          disabled={loading || !data}
        >
          Continuar al pago
        </button>
      </form>
    </div>
  );
}
