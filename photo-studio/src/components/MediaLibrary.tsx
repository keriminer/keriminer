"use client";

import { useEffect, useMemo, useState } from "react";
import { api, cx, type Media } from "./client";

interface Props {
  media: Media[];
  onChange: (m: Media[]) => void;
  onRegenerate: (m: Media) => void;
  open: Media | null;
  setOpen: (m: Media | null) => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Lightbox({ media, list, onClose, onNavigate, onFavorite, onDelete, onRegenerate }: {
  media: Media;
  list: Media[];
  onClose: () => void;
  onNavigate: (m: Media) => void;
  onFavorite: (m: Media) => void;
  onDelete: (m: Media) => void;
  onRegenerate: (m: Media) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const idx = list.findIndex((x) => x.id === media.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  useEffect(() => {
    setConfirm(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media.id, prev, next, onClose, onNavigate]);

  const g = media.generation;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-3 sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {prev && (
          <button type="button" onClick={() => onNavigate(prev)} aria-label="Précédente" className="absolute left-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20">
            ‹
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt="Photo générée" className="max-h-full max-w-full rounded-xl object-contain" />
        {next && (
          <button type="button" onClick={() => onNavigate(next)} aria-label="Suivante" className="absolute right-0 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20">
            ›
          </button>
        )}
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-3xl flex-col items-center gap-3 text-center text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-white/70">
          {g.collectionName ?? (g.mode === "custom" ? "Prompt libre" : "Séance")} · {g.twin === "smiling" ? "Souriante" : "Neutre"} · {g.aspectRatio} · {fmt(media.createdAt)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={`${media.url}?download=1`} className="btn btn-sm bg-white text-ink hover:bg-white/90">
            Télécharger
          </a>
          <button type="button" onClick={() => onRegenerate(media)} className="btn btn-sm bg-accent text-white hover:bg-accent-strong">
            Générer dans ce style
          </button>
          <button type="button" onClick={() => onFavorite(media)} className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
            {media.favorite ? "★ Favori" : "☆ Favori"}
          </button>
          {confirm ? (
            <button type="button" onClick={() => onDelete(media)} className="btn btn-sm bg-danger text-white">
              Confirmer la suppression
            </button>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
              Supprimer
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MediaLibrary({ media, onChange, onRegenerate, open, setOpen }: Props) {
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => (filter === "favorites" ? media.filter((m) => m.favorite) : media), [media, filter]);

  async function toggleFavorite(m: Media) {
    setError(null);
    try {
      const updated = await api<Media>(`/api/media/${m.id}`, { method: "PATCH", json: { favorite: !m.favorite } });
      onChange(media.map((x) => (x.id === m.id ? updated : x)));
      if (open?.id === m.id) setOpen(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(m: Media) {
    setError(null);
    try {
      await api(`/api/media/${m.id}`, { method: "DELETE" });
      const idx = list.findIndex((x) => x.id === m.id);
      const rest = media.filter((x) => x.id !== m.id);
      onChange(rest);
      const nextOpen = list[idx + 1] ?? list[idx - 1] ?? null;
      setOpen(nextOpen && nextOpen.id !== m.id ? nextOpen : null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Médiathèque <span className="text-base text-muted">({media.length})</span></h2>
        <div className="flex gap-1.5">
          {(["all", "favorites"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cx("pill text-xs", filter === f ? "pill-on" : "pill-off")}>
              {f === "all" ? "Toutes" : "★ Favoris"}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {list.length === 0 ? (
        <div className="grid min-h-[40vh] place-items-center rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">
          {filter === "favorites" ? "Aucun favori pour l'instant." : "Vos photos générées apparaîtront ici."}
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {list.map((m) => (
            <button key={m.id} type="button" onClick={() => setOpen(m)} className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="Photo générée" loading="lazy" className="w-full transition duration-300 group-hover:scale-[1.02]" />
              {m.favorite && <span className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 text-sm text-warn">★</span>}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/70 to-transparent px-2.5 pb-2 pt-6 text-left text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                {m.generation.collectionName ?? "Prompt libre"} · {fmt(m.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Lightbox
          media={open}
          list={list}
          onClose={() => setOpen(null)}
          onNavigate={setOpen}
          onFavorite={toggleFavorite}
          onDelete={remove}
          onRegenerate={(m) => {
            setOpen(null);
            onRegenerate(m);
          }}
        />
      )}
    </div>
  );
}
