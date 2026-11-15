"use client";

import { useEffect, useState } from "react";
import type { StyleOverride, TwinKind } from "@/lib/types";
import TwinSlots from "./TwinSlots";
import { api, cx, type Catalog, type Profile } from "./client";

interface Props {
  open: boolean;
  catalog: Catalog;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onClose: () => void;
}

const OVERRIDE_OPTIONS: { mode: StyleOverride["mode"]; label: string }[] = [
  { mode: "none", label: "Aucun changement" },
  { mode: "collection", label: "Selon la collection" },
  { mode: "custom", label: "Personnalisé" },
];

function OverrideField({ label, help, placeholder, value, onChange }: { label: string; help: string; placeholder: string; value: StyleOverride; onChange: (v: StyleOverride) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {OVERRIDE_OPTIONS.map((o) => (
          <button
            key={o.mode}
            type="button"
            onClick={() => onChange({ mode: o.mode, value: o.mode === "custom" ? value.value ?? "" : null })}
            className={cx("pill text-xs", value.mode === o.mode ? "pill-on" : "pill-off")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.mode === "custom" && (
        <input className="field mt-2" maxLength={120} placeholder={placeholder} value={value.value ?? ""} onChange={(e) => onChange({ mode: "custom", value: e.target.value })} />
      )}
      <p className="mt-1.5 text-xs text-muted">{help}</p>
    </div>
  );
}

export default function TwinDrawer({ open, catalog, profile, onProfile, onClose }: Props) {
  const [form, setForm] = useState({ primaryColor: "", secondaryColor: "", hair: profile.hair, makeup: profile.makeup });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<TwinKind | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ primaryColor: profile.primaryColor ?? "", secondaryColor: profile.secondaryColor ?? "", hair: profile.hair, makeup: profile.makeup });
    setMessage(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      onProfile(await api<Profile>("/api/twin", { method: "PATCH", json: form }));
      setMessage({ ok: true, text: "Enregistré." });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function reset(kind: TwinKind) {
    try {
      onProfile(await api<Profile>("/api/twin/reset", { method: "POST", json: { kind } }));
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setConfirmReset(null);
  }

  if (!open) return null;

  const section = (kind: TwinKind, title: string, desc: string) => {
    const n = profile.photos.filter((p) => p.kind === kind).length;
    return (
      <section className="border-b border-line pb-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="font-semibold">{title}</h3>
          <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", n > 0 ? "bg-sage-soft text-sage" : "bg-surface-2 text-muted")}>{n}/4 photos</span>
        </div>
        <p className="mb-3 text-sm text-muted">{desc}</p>
        <TwinSlots kind={kind} catalog={catalog} profile={profile} onProfile={onProfile} compact />
        {n > 0 && (
          <button type="button" onClick={() => setConfirmReset(kind)} className="mt-3 text-xs font-semibold text-danger hover:underline">
            Effacer toutes les photos
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Modifier mes jumelles">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-canvas shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">Mes jumelles</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Fermer">
            ×
          </button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {section("smiling", "😊 Jumelle souriante", "Même sourire chaleureux : face, 45° droite, profil, en pied.")}
          {section("neutral", "🎯 Jumelle neutre", "Calme, sans sourire : face, 45° droite, profil, en pied.")}

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Couleurs de marque</h3>
              <p className="text-sm text-muted">Utilisées pour personnaliser tenues et décors.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["primaryColor", "secondaryColor"] as const).map((k) => (
                <label key={k} className="block min-w-0">
                  <span className="label">{k === "primaryColor" ? "Principale" : "Secondaire"}</span>
                  <input
                    className="field"
                    maxLength={40}
                    placeholder={k === "primaryColor" ? "ex. terracotta, #B4532A" : "ex. crème, doré"}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <OverrideField
              label="Coiffure"
              help="Plus vous vous éloignez de vos photos, plus le visage peut dériver."
              placeholder="ex. carré moderne, longs cheveux ondulés"
              value={form.hair}
              onChange={(hair) => setForm({ ...form, hair })}
            />
            <OverrideField
              label="Maquillage"
              help="Pour la meilleure ressemblance, importez des photos avec votre maquillage habituel."
              placeholder="ex. glam doux, rouge à lèvres intense"
              value={form.makeup}
              onChange={(makeup) => setForm({ ...form, makeup })}
            />
          </section>
        </div>
        <footer className="border-t border-line px-5 py-4">
          {message && <p className={cx("mb-2 text-sm", message.ok ? "text-sage" : "text-danger")}>{message.text}</p>}
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? "Enregistrement…" : "Enregistrer les réglages"}
          </button>
        </footer>

        {confirmReset && (
          <div className="absolute inset-0 grid place-items-center bg-ink/50 p-6">
            <div className="card w-full max-w-sm p-6">
              <h3 className="font-display text-lg">Réinitialiser la jumelle {confirmReset === "smiling" ? "souriante" : "neutre"} ?</h3>
              <p className="mt-2 text-sm text-muted">Ses photos de référence seront supprimées. Vos photos générées restent dans la médiathèque.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setConfirmReset(null)} className="btn-ghost flex-1">
                  Annuler
                </button>
                <button type="button" onClick={() => reset(confirmReset)} className="btn flex-1 bg-danger text-white hover:bg-danger/90">
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
