"use client";

import { useRef, useState } from "react";
import type { AngleKey, TwinKind } from "@/lib/types";
import { api, cx, type Catalog, type Profile } from "./client";

interface Props {
  kind: TwinKind;
  catalog: Catalog;
  profile: Profile;
  onProfile: (p: Profile) => void;
  compact?: boolean;
}

export default function TwinSlots({ kind, catalog, profile, onProfile, compact }: Props) {
  const [busy, setBusy] = useState<AngleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<AngleKey, HTMLInputElement | null>>>({});

  async function upload(angle: AngleKey, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(angle);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("angle", angle);
    try {
      onProfile(await api<Profile>("/api/twin/photos", { method: "POST", body: form }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      const el = inputs.current[angle];
      if (el) el.value = "";
    }
  }

  async function remove(id: string, angle: AngleKey) {
    setBusy(angle);
    setError(null);
    try {
      onProfile(await api<Profile>(`/api/twin/photos?id=${id}`, { method: "DELETE" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className={cx("grid gap-3", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        {catalog.angles.map((a) => {
          const photo = profile.photos.find((p) => p.kind === kind && p.angle === a.key);
          return (
            <div key={a.key} className="min-w-0">
              <div className="mb-1.5 flex items-baseline justify-between gap-1">
                <span className="truncate text-xs font-semibold">{a.label}</span>
                {!a.required && <span className="text-[10px] text-muted">option</span>}
              </div>
              <div className={cx("relative overflow-hidden rounded-xl border-2 border-dashed", photo ? "border-transparent" : "border-line bg-surface-2", "aspect-[3/4]")}>
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`${a.label}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => remove(photo.id, a.key)}
                      disabled={busy !== null}
                      aria-label={`Supprimer la photo ${a.label}`}
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-sm text-white hover:bg-ink"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <label className={cx("absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1.5 p-2 text-center", busy && "pointer-events-none")}>
                    <input
                      ref={(el) => {
                        inputs.current[a.key] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => upload(a.key, e.target.files?.[0])}
                    />
                    {busy === a.key ? (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-accent shadow-sm">+</span>
                    )}
                    {!compact && <span className="text-[11px] leading-tight text-muted">{a.hint}</span>}
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
