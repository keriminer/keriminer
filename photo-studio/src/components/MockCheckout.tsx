"use client";

import { useState } from "react";
import { api } from "./client";

export default function MockCheckout({ orderId, credits, amount }: { orderId: string; credits: number; amount: string }) {
  const [busy, setBusy] = useState(false);
  async function finish(outcome: "paid" | "failed") {
    setBusy(true);
    await api(`/api/billing/mock/${orderId}`, { method: "POST", json: { outcome } }).catch(() => undefined);
    window.location.href = `/billing/return?order=${orderId}`;
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-ink/5 px-4">
      <div className="card w-full max-w-sm p-6">
        <p className="rounded-full bg-warn-soft px-3 py-1 text-center text-xs font-semibold text-warn">Page de paiement simulée (développement)</p>
        <p className="mt-5 text-center text-sm text-muted">Montant à payer</p>
        <p className="text-center font-display text-3xl">{amount}</p>
        <p className="text-center text-sm text-muted">{credits} crédits TwinShoot</p>
        <div className="mt-6 grid gap-2">
          <button type="button" disabled={busy} onClick={() => finish("paid")} className="btn-primary py-3">Simuler un paiement réussi</button>
          <button type="button" disabled={busy} onClick={() => finish("failed")} className="btn-ghost">Simuler un refus</button>
        </div>
      </div>
    </main>
  );
}
