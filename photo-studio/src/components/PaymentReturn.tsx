"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./client";

interface Res { order: { status: "pending" | "paid" | "failed" | "cancelled"; credits: number; amountLabel: string; failureReason: string | null }; credits: number }

const POLL_MS = 3000;
const MAX_MS = 3 * 60 * 1000;

export default function PaymentReturn({ orderId }: { orderId: string }) {
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await api<Res>(`/api/billing/orders/${orderId}`);
        setRes(r);
        if (r.order.status !== "pending") return;
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      if (Date.now() - started.current > MAX_MS) return setTimedOut(true);
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => clearTimeout(timer);
  }, [orderId]);

  const s = res?.order.status;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="card fade-up w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <p className="font-display text-2xl">Commande introuvable</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </>
        ) : s === "paid" ? (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-sage-soft text-2xl text-sage">✓</div>
            <p className="font-display text-2xl">Paiement confirmé</p>
            <p className="mt-2 text-muted">+{res!.order.credits} crédits ajoutés. Nouveau solde : <strong>{res!.credits}</strong>.</p>
            <a href="/" className="btn-primary mt-6 w-full py-3">Lancer une séance →</a>
          </>
        ) : s === "failed" || s === "cancelled" ? (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-2xl text-danger">×</div>
            <p className="font-display text-2xl">Paiement non abouti</p>
            <p className="mt-2 text-sm text-muted">{res!.order.failureReason ?? "Le paiement a été annulé ou refusé."} Aucun crédit n&apos;a été débité.</p>
            <a href="/billing" className="btn-primary mt-6 w-full py-3">Réessayer</a>
          </>
        ) : (
          <>
            <span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="font-display text-2xl">Confirmation en cours…</p>
            <p className="mt-2 text-sm text-muted">
              {timedOut
                ? "La confirmation de l'opérateur prend du temps. Vos crédits seront ajoutés automatiquement dès réception : vous pouvez fermer cette page."
                : "Si vous payez par Mobile Money, validez la transaction sur votre téléphone."}
            </p>
            <a href="/billing" className="btn-ghost mt-6 w-full">Voir mes commandes</a>
          </>
        )}
      </div>
    </main>
  );
}
