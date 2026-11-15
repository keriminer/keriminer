"use client";

import { useState } from "react";
import TwinSlots from "./TwinSlots";
import { cx, hasTwin, type Catalog, type Profile } from "./client";

interface Props {
  catalog: Catalog;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onDone: () => void;
}

const BENEFITS = [
  "Un site qui a enfin l'allure de la professionnelle que vous êtes",
  "De nouvelles photos pour vos réseaux chaque semaine, sans studio",
  "Des visuels de campagne prêts le jour même où vous décidez de lancer",
];

const TILES = [
  { label: "Site & profil", tone: "from-[#e9d8c7] to-[#c98b6b]", rot: "-rotate-3" },
  { label: "Campagne", tone: "from-[#dfe7df] to-[#7f9c85]", rot: "rotate-2" },
  { label: "Social", tone: "from-[#efe1d0] to-[#d6a66f]", rot: "rotate-1" },
  { label: "Mon métier", tone: "from-[#e4dcea] to-[#9a86b5]", rot: "-rotate-2" },
];

export default function TwinWizard({ catalog, profile, onProfile, onDone }: Props) {
  const [step, setStep] = useState(0);
  const smilingReady = hasTwin(profile, "smiling");
  const neutralCount = profile.photos.filter((p) => p.kind === "neutral").length;

  if (step === 0) {
    return (
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
        <div className="order-2 lg:order-1">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">Votre séance photo à la demande</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">Des photos pro de vous. Sans photographe, sans studio.</h1>
          <ul className="mt-6 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3 text-base">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage-soft text-xs text-sage">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setStep(1)} className="btn-primary mt-8 px-7 py-3.5 text-base">
            Créer ma jumelle IA
          </button>
          <p className="mt-3 text-sm text-muted">Une seule photo suffit pour commencer. Environ 2 minutes.</p>
        </div>
        <div className="order-1 grid grid-cols-2 gap-4 lg:order-2">
          {TILES.map((t, i) => (
            <div key={t.label} className={cx("relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br shadow-lg", t.tone, t.rot, i % 2 === 1 && "translate-y-6")}>
              <div className="absolute inset-x-[22%] top-[22%] aspect-square rounded-full bg-white/35" />
              <div className="absolute inset-x-[12%] bottom-0 h-[38%] rounded-t-[50%] bg-white/35" />
              <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold">{t.label}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex justify-center gap-2" aria-label={`Étape ${step} sur 4`}>
        {[1, 2, 3, 4].map((s) => (
          <span key={s} className={cx("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-accent" : s < step ? "w-4 bg-accent/50" : "w-4 bg-line")} />
        ))}
      </div>

      <div className="card fade-up p-6 sm:p-8" key={step}>
        {step === 1 && (
          <>
            <h2 className="font-display text-2xl">Venez prête pour la séance</h2>
            <p className="mt-2 text-muted">Comme avec un vrai photographe : on ne corrige pas tout après coup.</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {["Belle lumière naturelle, sans flash", "Aucun filtre", "Maquillage déjà fait (si vous en portez)", "Coiffure déjà faite"].map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                  <span className="text-sage">●</span> {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-xl bg-accent-soft p-4 text-sm leading-relaxed">
              Plus l&apos;IA doit inventer (maquillage, coiffure), plus elle réinterprète votre visage. Des photos fidèles = une jumelle fidèle.
            </p>
            <button type="button" onClick={() => setStep(2)} className="btn-primary mt-6 w-full py-3">
              C&apos;est noté, je suis prête
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-2xl">Faites connaissance avec vos deux jumelles</h2>
            <p className="mt-2 text-muted">Comme deux tenues : une pour un brunch, une pour un rendez-vous client. Même vous, énergie différente.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="font-semibold">😊 Jumelle souriante</p>
                <p className="mt-1 text-sm text-muted">Chaleureuse, vraie, proche. Pour le contenu social et les moments de vie.</p>
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="font-semibold">🎯 Jumelle neutre</p>
                <p className="mt-1 text-sm text-muted">Nette, affirmée, soignée. Pour les portraits corporate et éditoriaux.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">Le studio choisit automatiquement la bonne jumelle selon la collection.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={() => setStep(3)} className="btn-primary w-full py-3">
                On les configure
              </button>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost w-full">
                Retour
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-2xl">Votre jumelle souriante</h2>
            <p className="mt-2 mb-5 text-muted">
              Même sourire sur toutes les photos. <strong>La photo de face suffit pour démarrer</strong> ; les autres angles affinent la ressemblance.
            </p>
            <TwinSlots kind="smiling" catalog={catalog} profile={profile} onProfile={onProfile} />
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" disabled={!smilingReady} onClick={() => setStep(4)} className="btn-primary w-full py-3">
                {smilingReady ? "Continuer vers la jumelle neutre" : "Ajoutez la photo de face pour continuer"}
              </button>
              <button type="button" onClick={() => setStep(2)} className="btn-ghost w-full">
                Retour
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-display text-2xl">Votre jumelle neutre <span className="text-base font-normal text-muted">(optionnelle)</span></h2>
            <p className="mt-2 mb-5 text-muted">Expression détendue et assurée, sans sourire. Passez cette étape si vous n&apos;avez pas besoin de photos corporate.</p>
            <TwinSlots kind="neutral" catalog={catalog} profile={profile} onProfile={onProfile} />
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={onDone} className="btn-primary w-full py-3">
                {neutralCount > 0 ? "Jumelles prêtes. On shoote →" : "Passer et commencer à shooter →"}
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn-ghost w-full">
                Retour
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
