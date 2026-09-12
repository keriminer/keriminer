import { base } from '../db'
import type { Dortoir, Lit } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { majPartielle } from './structure'

/**
 * Module internat (optionnel).
 * Gere les dortoirs, l’affectation des lits, les repas et le pointage de nuit —
 * la responsabilite la plus lourde d’un etablissement avec pensionnat.
 */

export function listerDortoirs(): Dortoir[] {
  return base()
    .prepare(
      `SELECT d.*,
              (SELECT COUNT(*) FROM lit l WHERE l.dortoir_id = d.id) AS nb_lits,
              (SELECT COUNT(*) FROM pensionnaire p JOIN lit l ON l.id = p.lit_id
                 WHERE l.dortoir_id = d.id AND p.date_sortie IS NULL) AS occupes,
              CASE WHEN r.id IS NULL THEN NULL ELSE r.nom || ' ' || r.prenom END AS responsable_nom
       FROM dortoir d
       LEFT JOIN enseignant r ON r.id = d.responsable_id
       ORDER BY d.libelle`
    )
    .all() as Dortoir[]
}

export function creerDortoir(d: Partial<Dortoir> & { libelle: string }): number {
  const r = base()
    .prepare('INSERT INTO dortoir (libelle, batiment, sexe, capacite, responsable_id) VALUES (?, ?, ?, ?, ?)')
    .run(d.libelle, d.batiment ?? null, d.sexe ?? 'M', d.capacite ?? 0, d.responsable_id ?? null)
  return Number(r.lastInsertRowid)
}

export function modifierDortoir(id: number, d: Partial<Dortoir>): void {
  majPartielle('dortoir', id, d, ['id', 'occupes'])
}

export function supprimerDortoir(id: number): void {
  const occupes = base()
    .prepare(
      `SELECT COUNT(*) n FROM pensionnaire p JOIN lit l ON l.id = p.lit_id
       WHERE l.dortoir_id = ? AND p.date_sortie IS NULL`
    )
    .get(id) as { n: number }
  if (occupes.n > 0) throw new Error('Ce dortoir heberge encore des pensionnaires.')
  base().prepare('DELETE FROM dortoir WHERE id = ?').run(id)
}

/** Cree d’un coup une serie de lits numerotes : gain de temps a l’installation. */
export function genererLits(dortoirId: number, nombre: number, prefixe = ''): number {
  const insert = base().prepare('INSERT OR IGNORE INTO lit (dortoir_id, numero) VALUES (?, ?)')
  let crees = 0
  const transaction = base().transaction(() => {
    const depart = (base().prepare('SELECT COUNT(*) n FROM lit WHERE dortoir_id = ?').get(dortoirId) as { n: number }).n
    for (let i = 1; i <= nombre; i++) {
      const r = insert.run(dortoirId, `${prefixe}${depart + i}`)
      if (r.changes > 0) crees++
    }
  })
  transaction()
  return crees
}

export function listerLits(dortoirId: number): Lit[] {
  return base()
    .prepare(
      `SELECT l.*, d.libelle AS dortoir_libelle, p.id AS pensionnaire_id,
              e.nom || ' ' || e.prenom AS occupant
       FROM lit l
       JOIN dortoir d ON d.id = l.dortoir_id
       LEFT JOIN pensionnaire p ON p.lit_id = l.id AND p.date_sortie IS NULL
       LEFT JOIN inscription i ON i.id = p.inscription_id
       LEFT JOIN eleve e ON e.id = i.eleve_id
       WHERE l.dortoir_id = ?
       ORDER BY CAST(l.numero AS INTEGER), l.numero`
    )
    .all(dortoirId) as Lit[]
}

export function modifierLit(id: number, d: Partial<Lit>): void {
  majPartielle('lit', id, d, ['id', 'dortoir_libelle', 'occupant', 'pensionnaire_id'])
}

export function supprimerLit(id: number): void {
  base().prepare('DELETE FROM lit WHERE id = ?').run(id)
}

export function listerPensionnaires(): any[] {
  return base()
    .prepare(
      `SELECT p.*, e.id AS eleve_id, e.matricule, e.nom || ' ' || e.prenom AS nom_complet, e.sexe,
              c.libelle AS classe_libelle, l.numero AS lit_numero, d.libelle AS dortoir_libelle
       FROM pensionnaire p
       JOIN inscription i ON i.id = p.inscription_id
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       LEFT JOIN lit l ON l.id = p.lit_id
       LEFT JOIN dortoir d ON d.id = l.dortoir_id
       WHERE i.annee_id = ? AND p.date_sortie IS NULL
       ORDER BY d.libelle, CAST(l.numero AS INTEGER)`
    )
    .all(exigerAnneeActive().id)
}

/**
 * Affecte un eleve a un lit.
 * Deux garde-fous : un lit ne peut accueillir qu’un pensionnaire, et le sexe de
 * l’eleve doit correspondre a celui du dortoir (regle non negociable en
 * internat).
 */
export function affecterLit(inscriptionId: number, litId: number): number {
  const lit = base()
    .prepare(
      `SELECT l.*, d.sexe AS dortoir_sexe, d.libelle AS dortoir_libelle FROM lit l
       JOIN dortoir d ON d.id = l.dortoir_id WHERE l.id = ?`
    )
    .get(litId) as any
  if (!lit) throw new Error('Lit introuvable.')
  if (lit.etat === 'HORS_SERVICE') throw new Error('Ce lit est hors service.')

  const occupant = base()
    .prepare('SELECT id FROM pensionnaire WHERE lit_id = ? AND date_sortie IS NULL')
    .get(litId)
  if (occupant) throw new Error('Ce lit est deja occupe.')

  const eleve = base()
    .prepare('SELECT e.sexe FROM inscription i JOIN eleve e ON e.id = i.eleve_id WHERE i.id = ?')
    .get(inscriptionId) as { sexe: string } | undefined
  if (eleve && lit.dortoir_sexe !== 'MIXTE' && eleve.sexe !== lit.dortoir_sexe) {
    throw new Error(`Le dortoir ${lit.dortoir_libelle} est reserve aux ${lit.dortoir_sexe === 'F' ? 'filles' : 'garcons'}.`)
  }

  const r = base()
    .prepare(
      `INSERT INTO pensionnaire (inscription_id, lit_id) VALUES (?, ?)
       ON CONFLICT (inscription_id) DO UPDATE SET lit_id = excluded.lit_id, date_sortie = NULL`
    )
    .run(inscriptionId, litId)
  return Number(r.lastInsertRowid)
}

export function libererLit(pensionnaireId: number, date: string): void {
  base().prepare('UPDATE pensionnaire SET date_sortie = ? WHERE id = ?').run(date, pensionnaireId)
}

/* ---------------------- Pointage des repas et des nuits ------------------ */

export interface LignePointageInternat {
  pensionnaire_id: number
  nom_complet: string
  classe_libelle: string
  dortoir_libelle: string | null
  lit_numero: string | null
  present: number
  observation: string | null
}

export function feuillePointageInternat(date: string, moment: string): LignePointageInternat[] {
  return base()
    .prepare(
      `SELECT p.id AS pensionnaire_id, e.nom || ' ' || e.prenom AS nom_complet,
              c.libelle AS classe_libelle, d.libelle AS dortoir_libelle, l.numero AS lit_numero,
              COALESCE(pi.present, 1) AS present, pi.observation
       FROM pensionnaire p
       JOIN inscription i ON i.id = p.inscription_id
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       LEFT JOIN lit l ON l.id = p.lit_id
       LEFT JOIN dortoir d ON d.id = l.dortoir_id
       LEFT JOIN pointage_internat pi ON pi.pensionnaire_id = p.id
            AND pi.date_pointage = ? AND pi.moment = ?
       WHERE p.date_sortie IS NULL AND i.annee_id = ?
       ORDER BY d.libelle, e.nom`
    )
    .all(date, moment, exigerAnneeActive().id) as LignePointageInternat[]
}

export function enregistrerPointageInternat(
  date: string,
  moment: string,
  lignes: { pensionnaire_id: number; present: number; observation?: string | null }[]
): { enregistres: number } {
  const insert = base().prepare(
    `INSERT INTO pointage_internat (pensionnaire_id, date_pointage, moment, present, observation)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (pensionnaire_id, date_pointage, moment) DO UPDATE SET
       present = excluded.present, observation = excluded.observation`
  )
  const transaction = base().transaction(() => {
    for (const l of lignes) {
      insert.run(l.pensionnaire_id, date, moment, l.present, l.observation ?? null)
    }
  })
  transaction()
  return { enregistres: lignes.length }
}

/** Effectif a servir pour un repas donne : la base de la commande de vivres. */
export function effectifRepas(date: string, moment: string): { attendus: number; presents: number } {
  const lignes = feuillePointageInternat(date, moment)
  return {
    attendus: lignes.length,
    presents: lignes.filter((l) => l.present).length
  }
}

export function statistiquesInternat(): {
  capacite: number
  lits: number
  occupes: number
  libres: number
  hors_service: number
  taux_occupation: number
} {
  const stats = base()
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(capacite), 0) FROM dortoir WHERE actif = 1) AS capacite,
         (SELECT COUNT(*) FROM lit) AS lits,
         (SELECT COUNT(*) FROM lit WHERE etat = 'HORS_SERVICE') AS hors_service,
         (SELECT COUNT(*) FROM pensionnaire WHERE date_sortie IS NULL) AS occupes`
    )
    .get() as any
  const utilisables = stats.lits - stats.hors_service
  return {
    ...stats,
    libres: Math.max(0, utilisables - stats.occupes),
    taux_occupation: utilisables > 0 ? Math.round((stats.occupes / utilisables) * 1000) / 10 : 0
  }
}
