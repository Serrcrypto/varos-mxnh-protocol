import { Link, NavLink } from "react-router-dom";
import { useHashConnect } from "../hooks/useHashConnect";

function WalletGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 7a2 2 0 012-2h11a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 10h16v4H4v-4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function Navbar() {
  const { accountId, initializing, disconnectWallet, initError } = useHashConnect();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-white/70 text-varos-navy shadow-sm"
        : "text-varos-slate hover:bg-white/50"
    }`;

  return (
    <header className="border-b border-varos-slate/15 bg-varos-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="text-lg font-black tracking-[0.18em] text-varos-navy">
            VAROS
          </span>
          <span className="hidden text-xs font-semibold text-varos-slate sm:inline">
            MXNH
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Inicio
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/send" className={linkClass}>
            Enviar
          </NavLink>
        </nav>

        <div className="flex min-w-0 items-center gap-2">
          {!initError && !initializing ? (
            <div className="hidden min-w-0 items-center gap-2 rounded-lg border border-varos-slate/15 bg-white/60 px-2 py-1.5 sm:flex">
              <WalletGlyph className="text-varos-slate" />
              <span className="truncate text-xs font-mono text-varos-navy">
                {accountId ?? "Sin conectar"}
              </span>
            </div>
          ) : null}

          {accountId ? (
            <button
              type="button"
              onClick={() => void disconnectWallet()}
              className="rounded-lg border border-varos-slate/20 bg-white px-3 py-2 text-xs font-semibold text-varos-navy hover:border-varos-navy"
            >
              Desconectar
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
