import { useHashConnect } from "../hooks/useHashConnect";

type Props = {
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

export function WalletButton({ variant = "primary", className = "" }: Props) {
  const {
    accountId,
    initializing,
    initError,
    connectError,
    connectWallet,
    disconnectWallet,
  } = useHashConnect();

  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

  const styles =
    variant === "primary"
      ? "bg-varos-navy text-varos-cream hover:bg-varos-slate focus-visible:outline-varos-navy"
      : variant === "outline"
        ? "border border-varos-slate/40 bg-white text-varos-navy hover:border-varos-navy focus-visible:outline-varos-slate"
        : "text-varos-navy hover:bg-white/60 focus-visible:outline-varos-slate";

  if (initializing) {
    return (
      <button type="button" className={`${base} ${styles} ${className}`} disabled>
        Preparando wallet…
      </button>
    );
  }

  if (initError) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 ${className}`}>
        {initError}
      </div>
    );
  }

  if (accountId) {
    return (
      <button
        type="button"
        className={`${base} ${styles} ${className}`}
        onClick={() => void disconnectWallet()}
      >
        <span className="hidden sm:inline">Desconectar</span>
        <span className="sm:hidden">Salir</span>
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        className={`${base} ${styles}`}
        onClick={() => void connectWallet()}
      >
        Conectar Wallet
      </button>
      {connectError ? (
        <p className="text-xs text-red-700">{connectError}</p>
      ) : null}
    </div>
  );
}
