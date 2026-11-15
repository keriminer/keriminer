"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cx } from "./client";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet email. Connectez-vous.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cet email. Connectez-vous.",
  PASSWORD_TOO_SHORT: "Mot de passe trop court (8 caractères minimum).",
  PASSWORD_TOO_LONG: "Mot de passe trop long (128 caractères maximum).",
  INVALID_EMAIL: "Adresse email invalide.",
};

export default function AuthForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && name.trim().length < 2) return setError("Indiquez votre prénom.");
    if (password.length < 8) return setError("Mot de passe trop court (8 caractères minimum).");
    setBusy(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    if (res.error) {
      setBusy(false);
      if (res.error.status === 429) return setError("Trop de tentatives. Patientez une minute.");
      return setError(MESSAGES[res.error.code ?? ""] ?? res.error.message ?? "Une erreur est survenue. Réessayez.");
    }
    window.location.href = "/";
  }

  async function google() {
    setBusy(true);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (res.error) {
      setBusy(false);
      setError("Connexion Google impossible. Réessayez.");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-8 font-display text-2xl font-semibold lg:hidden">
        Twin<span className="text-accent">Shoot</span>
      </p>
      <h2 className="font-display text-3xl">{mode === "signin" ? "Bon retour" : "Créer mon compte"}</h2>
      <p className="mt-1 text-sm text-muted">{mode === "signin" ? "Connectez-vous pour retrouver votre studio." : "20 crédits offerts pour vos premières photos."}</p>

      <div className="mt-6 grid grid-cols-2 rounded-full border border-line bg-surface p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cx("rounded-full py-2 text-sm font-semibold transition", mode === m ? "bg-ink text-white" : "text-muted")}
          >
            {m === "signin" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {mode === "signup" && (
          <label className="block">
            <span className="label">Prénom</span>
            <input className="field" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </label>
        )}
        <label className="block">
          <span className="label">Email</span>
          <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Mot de passe</span>
          <input
            className="field"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
          {mode === "signup" && <span className="mt-1 block text-xs text-muted">8 caractères minimum.</span>}
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !email || !password} className="btn-primary w-full py-3">
          {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={google} disabled={busy} className="btn-ghost w-full py-3">
            Continuer avec Google
          </button>
        </>
      )}
    </div>
  );
}
