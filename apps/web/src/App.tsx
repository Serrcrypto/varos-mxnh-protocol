import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { useTransfer } from "./context/TransferContext";
import { useHashConnect } from "./hooks/useHashConnect";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Pay } from "./pages/Pay";
import { Send } from "./pages/Send";
import { Success } from "./pages/Success";
import type { ReactNode } from "react";

function AppShell() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 pb-16">
        <Outlet />
      </main>
    </div>
  );
}

function RequireWallet({ children }: { children: ReactNode }) {
  const { accountId, initializing, initError } = useHashConnect();

  if (initializing) {
    return (
      <div className="rounded-2xl border border-varos-slate/15 bg-white p-6 text-sm text-varos-slate shadow-sm">
        Preparando conexión con wallets…
      </div>
    );
  }

  if (initError || !accountId) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireCommittedTransfer({ children }: { children: ReactNode }) {
  const { committed } = useTransfer();
  if (!committed) {
    return <Navigate to="/send" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/send"
          element={
            <RequireWallet>
              <Send />
            </RequireWallet>
          }
        />
        <Route
          path="/pay"
          element={
            <RequireWallet>
              <RequireCommittedTransfer>
                <Pay />
              </RequireCommittedTransfer>
            </RequireWallet>
          }
        />
        <Route path="/success" element={<Success />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
