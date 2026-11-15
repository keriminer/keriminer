"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { api } from "./client";

export default function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    await authClient.signOut();
    window.location.href = "/login";
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", { method: "DELETE" });
      window.location.href = "/login";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mon compte"
        className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-semibold text-white hover:bg-ink/85"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="card fade-up absolute right-0 top-11 z-50 w-64 overflow-hidden p-1.5 shadow-xl">
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <a role="menuitem" href="/api/account/export" className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
            Exporter mes données (JSON)
          </a>
          <button role="menuitem" type="button" onClick={() => setConfirmDelete(true)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/5">
            Supprimer mon compte
          </button>
          <button role="menuitem" type="button" onClick={logout} disabled={busy} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
            Se déconnecter
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm p-6">
            <h3 className="font-display text-xl">Supprimer définitivement votre compte ?</h3>
            <p className="mt-2 text-sm text-muted">Vos jumelles, photos générées, crédits restants et historique seront effacés. Cette action est irréversible.</p>
            <label className="mt-4 block">
              <span className="label">Tapez SUPPRIMER pour confirmer</span>
              <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setTyped("");
                  setError(null);
                }}
                className="btn-ghost flex-1"
              >
                Annuler
              </button>
              <button type="button" disabled={typed !== "SUPPRIMER" || busy} onClick={deleteAccount} className="btn flex-1 bg-danger text-white hover:bg-danger/90">
                {busy ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
