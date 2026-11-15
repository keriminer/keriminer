"use client";

import { useCallback, useEffect, useState } from "react";
import GenerateView, { type GenerateSeed } from "./GenerateView";
import MediaLibrary from "./MediaLibrary";
import TwinDrawer from "./TwinDrawer";
import TwinWizard from "./TwinWizard";
import { api, cx, hasTwin, type Catalog, type Media, type Profile } from "./client";

type Tab = "studio" | "library";

export default function Studio() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wizardDone, setWizardDone] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");
  const [drawer, setDrawer] = useState(false);
  const [seed, setSeed] = useState<GenerateSeed | null>(null);
  const [openMedia, setOpenMedia] = useState<Media | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [c, p, m] = await Promise.all([api<Catalog>("/api/catalog"), api<Profile>("/api/twin"), api<{ media: Media[] }>("/api/media")]);
      setCatalog(c);
      setProfile(p);
      setMedia(m.media);
      setWizardDone(hasTwin(p, "smiling") || hasTwin(p, "neutral"));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-danger">{loadError}</p>
          <button type="button" onClick={load} className="btn-primary mt-4">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!catalog || !profile) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Chargement" />
      </div>
    );
  }

  const showWizard = !wizardDone || (!hasTwin(profile, "smiling") && !hasTwin(profile, "neutral"));

  function regenerate(m: Media) {
    const g = m.generation;
    setSeed({
      nonce: Date.now(),
      collectionKey: g.collectionKey,
      customPrompt: g.collectionKey ? null : (g.prompt.match(/^Brief: (.*)$/m)?.[1] ?? g.prompt),
      aspectRatio: g.aspectRatio,
    });
    setTab("studio");
  }

  const tabs = (
    <nav className="flex gap-1">
      {(
        [
          ["studio", "Studio"],
          ["library", `Médiathèque${media.length ? ` · ${media.length}` : ""}`],
        ] as const
      ).map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={cx("rounded-full px-3 py-1.5 text-sm font-semibold transition", tab === k ? "bg-ink text-white" : "text-muted hover:bg-surface-2")}>
          {l}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <span className="shrink-0 font-display text-lg font-semibold">
              Twin<span className="text-accent">Shoot</span>
            </span>
            {!showWizard && <div className="hidden sm:block">{tabs}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {profile.provider === "mock" && <span className="hidden rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn sm:inline">Mode démo</span>}
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold" title="1 crédit = 1 photo">
              {profile.credits}<span className="hidden sm:inline"> crédit{profile.credits > 1 ? "s" : ""}</span><span className="sm:hidden"> cr.</span>
            </span>
            {!showWizard && (
              <button type="button" onClick={() => setDrawer(true)} className="btn-ghost btn-sm">
                Mes jumelles
              </button>
            )}
          </div>
        </div>
        {!showWizard && <div className="border-t border-line px-4 py-2 sm:hidden">{tabs}</div>}
      </header>

      {showWizard ? (
        <TwinWizard catalog={catalog} profile={profile} onProfile={setProfile} onDone={() => setWizardDone(true)} />
      ) : tab === "studio" ? (
        <GenerateView
          catalog={catalog}
          profile={profile}
          seed={seed}
          onCredits={(credits) => setProfile((p) => (p ? { ...p, credits } : p))}
          onMedia={(items) => setMedia((cur) => [...items.filter((i) => !cur.some((c) => c.id === i.id)), ...cur])}
          onOpenTwins={() => setDrawer(true)}
          onOpenMedia={(m) => {
            setOpenMedia(m);
            setTab("library");
          }}
        />
      ) : (
        <MediaLibrary media={media} onChange={setMedia} onRegenerate={regenerate} open={openMedia} setOpen={setOpenMedia} />
      )}

      <TwinDrawer open={drawer} catalog={catalog} profile={profile} onProfile={setProfile} onClose={() => setDrawer(false)} />
    </div>
  );
}
