import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TransferProvider } from "./context/TransferContext";
import { WalletProvider } from "./context/WalletContext";
import "./index.css";

if (!(globalThis as unknown as { Buffer?: typeof Buffer }).Buffer) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("No se encontró #root");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <TransferProvider>
          <App />
        </TransferProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
