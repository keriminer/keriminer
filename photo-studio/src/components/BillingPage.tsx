"use client";

import { useEffect, useState } from "react";
import { api, cx } from "./client";

interface Provider { key: string; label: string; description: string; methods: string[]; currency: string }
interface Pack { key: string; name: string; credits: number; highlight: string | null; prices: Record<string, { amount: number; label: string }> }
interface Order { id: string; provider: string; credits: number; amountLabel: string; status: "pending" | "paid" | "failed" | "cancelled"; failureReason: string | null; createdAt: string }
interface Billing { providers: Provider[]; packs: Pack[]; orders: Order[]; credits: number }

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  paid: { label: "Payé", cls: "bg-sage-soft text-sage" },
  pending: { label: "En attente", cls: "bg-warn-soft text-warn" },
  failed: { label: "Échoué", cls: "bg-danger/10 text-danger" },
  cancelled: { label: "Annulé", cls: "bg-surface-2 text-muted" },
};

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [packKey, setPackKey] = useState("pro");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).has("cancelled") : false));

  useEffect(() => {
    api<Billing>("/api/billing")
      .then((d) => {
        setData(d);
        setProvider(d.providers[0]?.key ?? null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function pay() {
    if (!provider) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { packKey, provider, phone: phone || undefined } });
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const selected = data?.packs.find((p) => p.key === packKey);
  const price = selected && provider ? selected.prices[provider] : null;
  const mobileMoney = provider === "paydunya" || provider === "mock";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" className="font-display text-lg font-semibold">
            Twin<span className="text-accent">Shoot</span>
          </a>
          <a href="/" className="btn-ghost btn-sm">
            ← Retour au studio
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">Recharger mes crédits</h1>
            <p className="mt-1 text-muted">1 crédit = 1 photo. Sans abonnement, vos crédits n&apos;expirent pas.</p>
          </div>
          {data && (
            <span className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold">
              Solde : {data.credits} crédit{data.credits > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {cancelled && <p className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Paiement annulé. Aucun montant n&apos;a été débité.</p>}

        {!data ? (
          error ? <p className="text-danger">{error}</p> : <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        ) : data.providers.length === 0 ? (
          <div className="card p-6 text-sm text-muted">Le paiement n&apos;est pas encore configuré sur ce serveur. Contactez l&apos;administrateur.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <section className="space-y-6">
              <div>
                <span className="label">1. Choisissez un pack</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.packs.map((p) => {
                    const pr = provider ? p.prices[provider] : null;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPackKey(p.key)}
                        className={cx("relative rounded-2xl border p-5 text-left transition", packKey === p.key ? "border-accent bg-accent-soft ring-2 ring-accent/20" : "border-line bg-surface hover:border-accent/40")}
                      >
                        {p.highlight && <span className="absolute -top-2.5 left-4 rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-semibold text-white">{p.highlight}</span>}
                        <span className="block text-sm font-semibold text-muted">{p.name}</span>
                        <span className="mt-1 block font-display text-3xl">{p.credits} <span className="text-base">crédits</span></span>
                        <span className="mt-2 block text-lg font-semibold">{pr?.label ?? "—"}</span>
                        {pr && <span className="block text-xs text-muted">soit {Math.round(pr.amount / p.credits).toLocaleString("fr-FR")} {provider === "stripe" ? "c" : "F"} / photo</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label">2. Moyen de paiement</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.providers.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setProvider(p.key)}
                      className={cx("rounded-2xl border p-4 text-left transition", provider === p.key ? "border-accent bg-accent-soft ring-2 ring-accent/20" : "border-line bg-surface hover:border-accent/40")}
                    >
                      <span className="block font-semibold">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{p.description}</span>
                      <span className="mt-3 flex flex-wrap gap-1">
                        {p.methods.map((m) => (
                          <span key={m} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold">
                            {m}
                          </span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {mobileMoney && (
                <label className="block max-w-sm">
                  <span className="label">Numéro Mobile Money (facultatif)</span>
                  <input className="field" inputMode="tel" placeholder="ex. +223 70 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
                  <span className="mt-1 block text-xs text-muted">Pré-remplit la page de paiement. Vous validerez sur votre téléphone.</span>
                </label>
              )}
            </section>

            <aside className="card h-fit p-5 lg:sticky lg:top-24">
              <p className="label">Récapitulatif</p>
              <div className="flex items-baseline justify-between">
                <span>{selected?.name} · {selected?.credits} crédits</span>
                <span className="font-semibold">{price?.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Nouveau solde : {(data.credits + (selected?.credits ?? 0)).toLocaleString("fr-FR")} crédits</p>
              {error && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <button type="button" onClick={pay} disabled={busy || !price} className="btn-primary mt-4 w-full py-3">
                {busy ? "Redirection…" : `Payer ${price?.label ?? ""}`}
              </button>
              <p className="mt-3 text-center text-xs text-muted">Paiement sécurisé sur la page du prestataire. Vos crédits sont ajoutés dès la confirmation.</p>
            </aside>
          </div>
        )}

        {data && data.orders.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 font-display text-xl">Historique</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {data.orders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.credits} crédits · {o.amountLabel}</p>
                    <p className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {o.provider === "paydunya" ? "Mobile Money" : o.provider === "stripe" ? "Carte" : "Test"}
                      {o.failureReason && o.status !== "paid" ? ` · ${o.failureReason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.status === "pending" && (
                      <a href={`/billing/return?order=${o.id}`} className="text-xs font-semibold text-accent hover:underline">
                        Vérifier
                      </a>
                    )}
                    <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[o.status].cls)}>{STATUS[o.status].label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
