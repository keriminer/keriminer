import { base } from '../db'
import type { ActivitePedagogique } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { majPartielle } from './structure'

/**
 * Journees pedagogiques, formations, conseils de classe, reunions de parents.
 * Tout est archive avec la liste de presence et le rapport : c’est la trace
 * exigee lors des inspections.
 */

export function listerActivites(anneeId?: number): ActivitePedagogique[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM participation_activite p WHERE p.activite_id = a.id) AS nb_participants,
              (SELECT COUNT(*) FROM participation_activite p WHERE p.activite_id = a.id AND p.present = 1) AS nb_presents
       FROM activite_pedagogique a
       WHERE a.annee_id = ?
       ORDER BY a.date_debut DESC`
    )
    .all(id) as ActivitePedagogique[]
}

export function creerActivite(d: Partial<ActivitePedagogique> & { libelle: string; date_debut: string }): number {
  const r = base()
    .prepare(
      `INSERT INTO activite_pedagogique (annee_id, libelle, type, date_debut, date_fin, heure_debut,
         heure_fin, lieu, animateur, objectifs, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      d.annee_id ?? exigerAnneeActive().id, d.libelle, d.type ?? 'JOURNEE_PEDAGOGIQUE',
      d.date_debut, d.date_fin ?? null, d.heure_debut ?? null, d.heure_fin ?? null,
      d.lieu ?? null, d.animateur ?? null, d.objectifs ?? null, d.statut ?? 'PLANIFIEE'
    )
  return Number(r.lastInsertRowid)
}

export function modifierActivite(id: number, d: Partial<ActivitePedagogique>): void {
  majPartielle('activite_pedagogique', id, d, ['id', 'annee_id', 'nb_participants', 'nb_presents'])
}

export function supprimerActivite(id: number): void {
  base().prepare('DELETE FROM activite_pedagogique WHERE id = ?').run(id)
}

export function listerParticipants(activiteId: number): {
  enseignant_id: number
  matricule: string
  nom_complet: string
  specialite: string | null
  invite: number
  present: number
  observation: string | null
}[] {
  return base()
    .prepare(
      `SELECT e.id AS enseignant_id, e.matricule, e.nom || ' ' || e.prenom AS nom_complet, e.specialite,
              CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS invite,
              COALESCE(p.present, 0) AS present, p.observation
       FROM enseignant e
       LEFT JOIN participation_activite p ON p.enseignant_id = e.id AND p.activite_id = ?
       WHERE e.statut = 'ACTIF'
       ORDER BY e.nom, e.prenom`
    )
    .all(activiteId) as any[]
}

export function enregistrerParticipants(
  activiteId: number,
  lignes: { enseignant_id: number; invite: number; present: number; observation?: string | null }[]
): { enregistres: number } {
  const insert = base().prepare(
    `INSERT INTO participation_activite (activite_id, enseignant_id, present, observation)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (activite_id, enseignant_id) DO UPDATE SET
       present = excluded.present, observation = excluded.observation`
  )
  const supprimer = base().prepare(
    'DELETE FROM participation_activite WHERE activite_id = ? AND enseignant_id = ?'
  )
  const transaction = base().transaction(() => {
    for (const l of lignes) {
      if (l.invite) insert.run(activiteId, l.enseignant_id, l.present, l.observation ?? null)
      else supprimer.run(activiteId, l.enseignant_id)
    }
  })
  transaction()
  return { enregistres: lignes.filter((l) => l.invite).length }
}

/** Taux de participation de chaque enseignant aux activites de l’annee. */
export function bilanParticipation(anneeId?: number): {
  enseignant_id: number
  nom_complet: string
  invitations: number
  presences: number
  taux: number
}[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT e.id AS enseignant_id, e.nom || ' ' || e.prenom AS nom_complet,
              COUNT(p.id) AS invitations,
              SUM(CASE WHEN p.present = 1 THEN 1 ELSE 0 END) AS presences,
              CASE WHEN COUNT(p.id) = 0 THEN 0
                   ELSE ROUND(100.0 * SUM(CASE WHEN p.present = 1 THEN 1 ELSE 0 END) / COUNT(p.id), 1)
              END AS taux
       FROM enseignant e
       LEFT JOIN participation_activite p ON p.enseignant_id = e.id
       LEFT JOIN activite_pedagogique a ON a.id = p.activite_id AND a.annee_id = ?
       WHERE e.statut = 'ACTIF'
       GROUP BY e.id
       ORDER BY taux DESC, e.nom`
    )
    .all(id) as any[]
}
