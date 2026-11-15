"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AspectRatio, IntentKey, TwinKind } from "@/lib/types";
import { api, ApiError, cx, hasTwin, type Catalog, type JobState, type Media, type Profile } from "./client";

export interface GenerateSeed {
  nonce: number;
  collectionKey?: string | null;
  customPrompt?: string | null;
  aspectRatio?: AspectRatio;
}

interface Props {
  catalog: Catalog;
  profile: Profile;
  seed: GenerateSeed | null;
  onCredits: (n: number) => void;
  onMedia: (m: Media[]) => void;
  onOpenTwins: () => void;
  onOpenMedia: (m: Media) => void;
}

type Mode = "collection" | "reference" | "custom";

const LOADING = ["Installation des lumières…", "Recherche du meilleur angle…", "Mesure de la lumière…", "Ajustement du cadrage…", "Presque prêt…"];
const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

const ERROR_TONE: Record<string, "warn" | "danger"> = { not_enough_credits: "warn", too_many_pending_jobs: "warn" };

export default function GenerateView({ catalog, profile, seed, onCredits, onMedia, onOpenTwins, onOpenMedia }: Props) {
  const [mode, setMode] = useState<Mode>("collection");
  const [intent, setIntent] = useState<IntentKey>("website_profile");
  const [industry, setIndustry] = useState<string | null>(null);
  const [collectionKey, setCollectionKey] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customTwin, setCustomTwin] = useState<TwinKind>("smiling");
  const [ratio, setRatio] = useState<AspectRatio>("4:5");
  const [count, setCount] = useState(1);

  const [analyzing, setAnalyzing] = useState(false);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [job, setJob] = useState<JobState | null>(null);
  const [results, setResults] = useState<Media[]>([]);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collection = catalog.collections.find((c) => c.key === collectionKey) ?? null;
  const visibleCollections = useMemo(
    () => catalog.collections.filter((c) => c.intent === intent && (intent !== "industry" || c.industry === industry)),
    [catalog.collections, intent, industry],
  );
  const neutralMissing = !!collection && collection.energy === "polished" && !hasTwin(profile, "neutral");
  const generating = job?.status === "queued" || job?.status === "running";
  const canGenerate = !generating && (mode === "collection" ? !!collectionKey : mode === "custom" ? customPrompt.trim().length >= 15 : false);

  useEffect(() => {
    if (!seed) return;
    if (seed.aspectRatio) setRatio(seed.aspectRatio);
    const c = seed.collectionKey ? catalog.collections.find((x) => x.key === seed.collectionKey) : null;
    if (c) {
      setMode("collection");
      setIntent(c.intent);
      setIndustry(c.industry ?? null);
      setCollectionKey(c.key);
    } else if (seed.customPrompt) {
      setMode("custom");
      setCustomPrompt(seed.customPrompt);
    }
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING.length), 2600);
    return () => clearInterval(t);
  }, [generating]);

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  }, []);

  useEffect(() => setPreview(null), [collectionKey, customPrompt, ratio, customTwin, mode]);

  function payload() {
    return mode === "collection"
      ? { mode: "collection", collectionKey, aspectRatio: ratio, count }
      : { mode: "custom", customPrompt, twin: customTwin, aspectRatio: ratio, count };
  }

  async function loadPreview() {
    setPreviewLoading(true);
    setError(null);
    try {
      const r = await api<{ prompt: string }>("/api/prompt/preview", { method: "POST", json: payload() });
      setPreview(r.prompt);
    } catch (e) {
      setError({ code: (e as ApiError).code, text: (e as Error).message });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function analyzeReference(file: File | undefined) {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setRefPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api<{ brief: string; energy: "warm" | "polished"; suggestedRatio: AspectRatio }>("/api/reference/analyze", { method: "POST", body: form });
      setCustomPrompt(r.brief);
      setCustomTwin(r.energy === "polished" && hasTwin(profile, "neutral") ? "neutral" : "smiling");
      setRatio(r.suggestedRatio);
      setMode("custom");
      setNotice("Brief rédigé à partir de votre photo. Relisez-le puis générez.");
    } catch (e) {
      setError({ code: (e as ApiError).code, text: (e as Error).message });
    } finally {
      setAnalyzing(false);
    }
  }

  function poll(id: string, startedAt: number) {
    pollRef.current = setTimeout(async () => {
      try {
        const s = await api<JobState>(`/api/jobs/${id}`);
        setJob(s);
        if (typeof s.credits === "number") onCredits(s.credits);
        if (s.status === "complete" || s.status === "failed") {
          const media = s.media ?? [];
          setResults(media);
          onMedia(media);
          if (s.status === "failed") {
            const blocked = s.error?.startsWith("generation_blocked");
            setError({
              code: blocked ? "generation_blocked" : "provider_error",
              text: blocked
                ? "Cette image a été bloquée par le filtre de sécurité. Essayez une autre collection ou relancez. Vos crédits ont été rendus."
                : "La génération a échoué. Vos crédits ont été rendus. Réessayez dans un instant.",
            });
          } else if (media.length < s.count) {
            setNotice(`${media.length} photo(s) sur ${s.count} générée(s). Les crédits des photos manquantes ont été rendus.`);
          }
          return;
        }
      } catch {
        // erreur réseau passagère : on continue de sonder
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setNotice("Ça prend plus de temps que prévu. Vos photos arriveront dans la médiathèque, vous pouvez fermer cette page.");
        setJob(null);
        return;
      }
      poll(id, startedAt);
    }, POLL_MS);
  }

  async function generate() {
    setError(null);
    setNotice(null);
    setResults([]);
    setLoadingIdx(0);
    try {
      const j = await api<JobState>("/api/generate", { method: "POST", json: payload() });
      setJob(j);
      onCredits(profile.credits - count);
      poll(j.id, Date.now());
    } catch (e) {
      setError({ code: (e as ApiError).code, text: (e as Error).message });
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const ratioCls: Record<AspectRatio, string> = { "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "1:1": "aspect-square", "16:9": "aspect-video" };

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[420px_1fr]">
      {/* ── Réglages ── */}
      <aside className="card flex min-w-0 flex-col lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
        <div className="flex gap-1 border-b border-line p-2" role="tablist">
          {(
            [
              ["collection", "Collections"],
              ["reference", "Miroir"],
              ["custom", "Prompt libre"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)} className={cx("flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition", mode === k ? "bg-ink text-white" : "text-muted hover:bg-surface-2")}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {mode === "collection" && (
            <>
              <div>
                <span className="label">À quoi va servir cette photo ?</span>
                <div className="flex flex-wrap gap-1.5">
                  {catalog.intents.map((i) => (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() => {
                        setIntent(i.key);
                        setCollectionKey(null);
                      }}
                      className={cx("pill", intent === i.key ? "pill-on" : "pill-off")}
                    >
                      {i.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">{catalog.intents.find((i) => i.key === intent)?.description}</p>
              </div>

              {intent === "industry" && (
                <label className="block">
                  <span className="label">Votre secteur</span>
                  <select
                    className="field"
                    value={industry ?? ""}
                    onChange={(e) => {
                      setIndustry(e.target.value || null);
                      setCollectionKey(null);
                    }}
                  >
                    <option value="">Choisissez votre secteur…</option>
                    {catalog.industries.map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {visibleCollections.length > 0 && (
                <div>
                  <span className="label">Collection</span>
                  <div className="grid grid-cols-2 gap-2">
                    {visibleCollections.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCollectionKey(c.key)}
                        className={cx("rounded-xl border p-3 text-left transition", collectionKey === c.key ? "border-accent bg-accent-soft ring-2 ring-accent/20" : "border-line hover:border-accent/40")}
                      >
                        <span className="block text-sm font-semibold">{c.name}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted">{c.tagline}</span>
                        <span className={cx("mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", c.energy === "warm" ? "bg-accent-soft text-accent" : "bg-sage-soft text-sage")}>
                          {c.energy === "warm" ? "Souriante" : "Neutre"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {neutralMissing && (
                <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
                  Cette collection est pensée pour votre jumelle neutre. En attendant, on utilise la souriante.{" "}
                  <button type="button" onClick={onOpenTwins} className="font-semibold underline">
                    Ajouter ma jumelle neutre
                  </button>
                </p>
              )}
            </>
          )}

          {mode === "reference" && (
            <div>
              <p className="mb-3 text-sm text-muted">Déposez une photo dont vous aimez le style. On rédige un brief qui la reproduit, avec votre visage. Vous le relisez avant de générer.</p>
              <label className={cx("relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-line bg-surface-2 text-center", analyzing && "pointer-events-none")}>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={analyzing} onChange={(e) => analyzeReference(e.target.files?.[0])} />
                {refPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={refPreview} alt="Photo de référence" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                )}
                <span className="relative grid h-11 w-11 place-items-center rounded-full bg-surface text-xl text-accent shadow">{analyzing ? "…" : "↑"}</span>
                <span className="relative text-sm font-semibold">{analyzing ? "Analyse de la photo…" : "Importer une photo d'inspiration"}</span>
                <span className="relative text-xs text-muted">JPG, PNG ou WebP · 10 Mo max</span>
              </label>
              <p className="mt-3 text-xs text-muted">Utilisez des images que vous avez le droit d&apos;exploiter. Seuls le décor, la lumière et le cadrage sont repris, jamais l&apos;identité de la personne.</p>
            </div>
          )}

          {mode === "custom" && (
            <>
              <label className="block">
                <span className="label">Décrivez la scène</span>
                <textarea
                  className="field min-h-40 resize-y leading-relaxed"
                  maxLength={2000}
                  placeholder="ex. Assise à un bureau en chêne clair, ordinateur ouvert, lumière douce du matin, chemise en lin beige, plantes en arrière-plan flou…"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
                <span className="mt-1 block text-right text-xs text-muted">{customPrompt.length}/2000</span>
              </label>
              <div>
                <span className="label">Jumelle</span>
                <div className="flex gap-1.5">
                  {(["smiling", "neutral"] as const).map((t) => (
                    <button key={t} type="button" disabled={t === "neutral" && !hasTwin(profile, "neutral")} onClick={() => setCustomTwin(t)} className={cx("pill disabled:opacity-40", customTwin === t ? "pill-on" : "pill-off")}>
                      {t === "smiling" ? "😊 Souriante" : "🎯 Neutre"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {preview && (
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">Brief photo</span>
                <button type="button" onClick={() => copy(preview)} className="btn-ghost btn-sm">
                  {copied ? "Copié !" : "Copier"}
                </button>
              </div>
              <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{preview}</pre>
            </div>
          )}
        </div>

        {mode !== "reference" && (
          <div className="space-y-3 border-t border-line p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="label">Format</span>
                <div className="flex gap-1">
                  {catalog.aspectRatios.map((r) => (
                    <button key={r.key} type="button" title={r.usage} onClick={() => setRatio(r.key)} className={cx("rounded-lg border px-2.5 py-1.5 text-xs font-semibold", ratio === r.key ? "border-ink bg-ink text-white" : "border-line hover:bg-surface-2")}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Nombre</span>
                <div className="flex gap-1">
                  {Array.from({ length: catalog.maxPhotosPerJob }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" onClick={() => setCount(n)} className={cx("h-8 w-8 rounded-lg border text-xs font-semibold", count === n ? "border-ink bg-ink text-white" : "border-line hover:bg-surface-2")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={loadPreview} disabled={!canGenerate || previewLoading} className="btn-ghost shrink-0" title="Voir le brief envoyé à l'IA">
                {previewLoading ? "…" : "Brief"}
              </button>
              <button type="button" onClick={generate} disabled={!canGenerate} className="btn-primary flex-1 py-3">
                {generating ? "Génération…" : count > 1 ? `Générer ${count} photos · ${count} crédits` : "Générer la photo · 1 crédit"}
              </button>
            </div>
            {error && (
              <p className={cx("rounded-xl px-3 py-2 text-sm", ERROR_TONE[error.code] === "warn" ? "bg-warn-soft text-warn" : "bg-danger/10 text-danger")}>{error.text}</p>
            )}
          </div>
        )}
        {mode === "reference" && error && <p className="m-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error.text}</p>}
      </aside>

      {/* ── Résultats ── */}
      <section className="min-w-0">
        {notice && (
          <div className="fade-up mb-4 flex items-start justify-between gap-3 rounded-xl bg-sage-soft px-4 py-3 text-sm text-sage">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fermer" className="font-bold">
              ×
            </button>
          </div>
        )}

        {generating ? (
          <div className={cx("grid gap-4", job!.count > 1 ? "sm:grid-cols-2" : "max-w-md")}>
            {Array.from({ length: job!.count }).map((_, i) => (
              <div key={i} className={cx("shimmer relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-2 to-accent-soft", ratioCls[ratio])}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <p className="font-display text-lg">{collection?.name ?? "Séance personnalisée"}</p>
                  <p className="text-sm text-muted">{LOADING[(loadingIdx + i) % LOADING.length]}</p>
                </div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="fade-up">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-sage">✓ Enregistré dans la médiathèque</p>
              <button type="button" onClick={generate} disabled={!canGenerate} className="btn-ghost btn-sm">
                Générer à nouveau
              </button>
            </div>
            <div className={cx("grid gap-4", results.length > 1 ? "sm:grid-cols-2" : "max-w-md")}>
              {results.map((m) => (
                <figure key={m.id} className="group relative overflow-hidden rounded-2xl bg-surface-2">
                  <button type="button" onClick={() => onOpenMedia(m)} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="Photo générée" className="w-full object-cover" />
                  </button>
                  <figcaption className="absolute inset-x-2 bottom-2 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <a href={`${m.url}?download=1`} className="btn-ghost btn-sm flex-1">
                      Télécharger
                    </a>
                    <button type="button" onClick={() => copy(m.generation.prompt)} className="btn-ghost btn-sm flex-1">
                      {copied ? "Copié !" : "Copier le brief"}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            {!hasTwin(profile, "neutral") || profile.photos.filter((p) => p.kind === "smiling").length < 4 ? (
              <div className="mt-5 rounded-2xl border border-line bg-surface p-4 text-sm">
                <p className="font-semibold">Envie d&apos;une ressemblance encore plus fidèle ?</p>
                <p className="mt-1 text-muted">Ajoutez les angles manquants et votre jumelle neutre : la différence est nette.</p>
                <button type="button" onClick={onOpenTwins} className="mt-3 font-semibold text-accent hover:underline">
                  Compléter mes jumelles →
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-[50vh] place-items-center rounded-2xl border-2 border-dashed border-line p-8 text-center">
            <div className="max-w-sm">
              <p className="font-display text-2xl">{mode === "reference" ? "Importez une photo d'inspiration" : mode === "custom" ? "Décrivez votre scène" : collection ? collection.name : "Choisissez une collection"}</p>
              <p className="mt-2 text-sm text-muted">
                {mode === "reference"
                  ? "On la transforme en brief à gauche."
                  : collection
                    ? `${collection.tagline}. Réglez le format puis générez.`
                    : "Sélectionnez l'usage puis une collection à gauche."}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
