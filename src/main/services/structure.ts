import { base } from '../db'
import type { Classe, ClasseMatiere, Filiere, Matiere, Niveau } from '@shared/types'
import { exigerAnneeActive } from './annee'

/* -------------------------------- Niveaux -------------------------------- */

export function listerNiveaux(): Niveau[] {
  return base().prepare('SELECT * FROM niveau ORDER BY ordre, libelle').all() as Niveau[]
}

export function creerNiveau(d: Omit<Niveau, 'id' | 'actif'>): number {
  const r = base()
    .prepare('INSERT INTO niveau (cycle, libelle, code, ordre) VALUES (?, ?, ?, ?)')
    .run(d.cycle, d.libelle, d.code, d.ordre)
  return Number(r.lastInsertRowid)
}

export function modifierNiveau(id: number, d: Partial<Niveau>): void {
  majPartielle('niveau', id, d, ['id'])
}

export function supprimerNiveau(id: number): void {
  const utilise = base().prepare('SELECT COUNT(*) n FROM classe WHERE niveau_id = ?').get(id) as {
    n: number
  }
  if (utilise.n > 0) throw new Error('Ce niveau est utilise par des classes. Desactivez-le plutot.')
  base().prepare('DELETE FROM niveau WHERE id = ?').run(id)
}

/* -------------------------------- Filieres ------------------------------- */

export function listerFilieres(): Filiere[] {
  return base().prepare('SELECT * FROM filiere ORDER BY libelle').all() as Filiere[]
}

export function creerFiliere(d: Omit<Filiere, 'id' | 'actif'>): number {
  const r = base()
    .prepare('INSERT INTO filiere (libelle, code, cycle) VALUES (?, ?, ?)')
    .run(d.libelle, d.code, d.cycle)
  return Number(r.lastInsertRowid)
}

export function modifierFiliere(id: number, d: Partial<Filiere>): void {
  majPartielle('filiere', id, d, ['id'])
}

export function supprimerFiliere(id: number): void {
  base().prepare('DELETE FROM filiere WHERE id = ?').run(id)
}

/* -------------------------------- Matieres ------------------------------- */

export function listerMatieres(): Matiere[] {
  return base().prepare('SELECT * FROM matiere ORDER BY categorie, libelle').all() as Matiere[]
}

export function creerMatiere(d: Omit<Matiere, 'id' | 'actif'>): number {
  const r = base()
    .prepare('INSERT INTO matiere (code, libelle, cycle, categorie) VALUES (?, ?, ?, ?)')
    .run(d.code, d.libelle, d.cycle, d.categorie)
  return Number(r.lastInsertRowid)
}

export function modifierMatiere(id: number, d: Partial<Matiere>): void {
  majPartielle('matiere', id, d, ['id'])
}

export function supprimerMatiere(id: number): void {
  const utilise = base()
    .prepare('SELECT COUNT(*) n FROM classe_matiere WHERE matiere_id = ?')
    .get(id) as { n: number }
  if (utilise.n > 0) throw new Error('Cette matiere est attribuee a des classes. Desactivez-la plutot.')
  base().prepare('DELETE FROM matiere WHERE id = ?').run(id)
}

/* --------------------------------- Classes ------------------------------- */

export function listerClasses(anneeId?: number): Classe[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT c.*, n.libelle AS niveau_libelle, n.cycle, n.ordre AS niveau_ordre,
              f.libelle AS filiere_libelle,
              CASE WHEN t.id IS NULL THEN NULL ELSE t.nom || ' ' || t.prenom END AS titulaire_nom,
              (SELECT COUNT(*) FROM inscription i WHERE i.classe_id = c.id AND i.statut = 'INSCRIT') AS effectif
       FROM classe c
       JOIN niveau n ON n.id = c.niveau_id
       LEFT JOIN filiere f ON f.id = c.filiere_id
       LEFT JOIN enseignant t ON t.id = c.titulaire_id
       WHERE c.annee_id = ?
       ORDER BY n.ordre, c.libelle`
    )
    .all(id) as Classe[]
}

export function creerClasse(d: Omit<Classe, 'id'>): number {
  const anneeId = d.annee_id || exigerAnneeActive().id
  const r = base()
    .prepare(
      `INSERT INTO classe (annee_id, niveau_id, filiere_id, libelle, capacite, salle, titulaire_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(anneeId, d.niveau_id, d.filiere_id ?? null, d.libelle, d.capacite ?? 50, d.salle ?? null, d.titulaire_id ?? null)
  return Number(r.lastInsertRowid)
}

export function modifierClasse(id: number, d: Partial<Classe>): void {
  majPartielle('classe', id, d, [
    'id', 'niveau_libelle', 'cycle', 'filiere_libelle', 'titulaire_nom', 'effectif', 'niveau_ordre'
  ])
}

export function supprimerClasse(id: number): void {
  const effectif = base()
    .prepare('SELECT COUNT(*) n FROM inscription WHERE classe_id = ?')
    .get(id) as { n: number }
  if (effectif.n > 0) {
    throw new Error(`Cette classe compte ${effectif.n} eleve(s). Transferez-les avant de la supprimer.`)
  }
  base().prepare('DELETE FROM classe WHERE id = ?').run(id)
}

/* ------------------------- Attribution des matieres ---------------------- */

export function listerAttributions(classeId: number): ClasseMatiere[] {
  return base()
    .prepare(
      `SELECT cm.*, m.libelle AS matiere_libelle, m.code AS matiere_code,
              CASE WHEN e.id IS NULL THEN NULL ELSE e.nom || ' ' || e.prenom END AS enseignant_nom
       FROM classe_matiere cm
       JOIN matiere m ON m.id = cm.matiere_id
       LEFT JOIN enseignant e ON e.id = cm.enseignant_id
       WHERE cm.classe_id = ?
       ORDER BY m.libelle`
    )
    .all(classeId) as ClasseMatiere[]
}

/** Toutes les matieres attribuees a un enseignant (son « service »). */
export function attributionsEnseignant(enseignantId: number, anneeId?: number): ClasseMatiere[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT cm.*, m.libelle AS matiere_libelle, m.code AS matiere_code, c.libelle AS classe_libelle
       FROM classe_matiere cm
       JOIN matiere m ON m.id = cm.matiere_id
       JOIN classe c ON c.id = cm.classe_id
       WHERE cm.enseignant_id = ? AND c.annee_id = ?
       ORDER BY c.libelle, m.libelle`
    )
    .all(enseignantId, id) as ClasseMatiere[]
}

export function creerAttribution(d: Omit<ClasseMatiere, 'id'>): number {
  const r = base()
    .prepare(
      `INSERT INTO classe_matiere (classe_id, matiere_id, enseignant_id, coefficient, volume_horaire)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (classe_id, matiere_id) DO UPDATE SET
         enseignant_id = excluded.enseignant_id,
         coefficient = excluded.coefficient,
         volume_horaire = excluded.volume_horaire`
    )
    .run(d.classe_id, d.matiere_id, d.enseignant_id ?? null, d.coefficient ?? 1, d.volume_horaire ?? 0)
  return Number(r.lastInsertRowid)
}

export function modifierAttribution(id: number, d: Partial<ClasseMatiere>): void {
  majPartielle('classe_matiere', id, d, [
    'id', 'matiere_libelle', 'matiere_code', 'enseignant_nom', 'classe_libelle'
  ])
}

export function supprimerAttribution(id: number): void {
  const notes = base()
    .prepare(
      `SELECT COUNT(*) n FROM note WHERE evaluation_id IN
       (SELECT id FROM evaluation WHERE classe_matiere_id = ?)`
    )
    .get(id) as { n: number }
  if (notes.n > 0) {
    throw new Error(
      `Des notes existent deja pour cette matiere (${notes.n}). Supprimez d abord les evaluations.`
    )
  }
  base().prepare('DELETE FROM classe_matiere WHERE id = ?').run(id)
}

/**
 * Applique la meme grille de matieres/coefficients a toutes les classes d’un
 * niveau : gain de temps considerable en debut d’annee.
 */
export function appliquerGrilleAuNiveau(classeSourceId: number, niveauId: number): number {
  const grille = base()
    .prepare('SELECT matiere_id, coefficient, volume_horaire FROM classe_matiere WHERE classe_id = ?')
    .all(classeSourceId) as any[]
  const cibles = base()
    .prepare('SELECT id FROM classe WHERE niveau_id = ? AND annee_id = (SELECT annee_id FROM classe WHERE id = ?) AND id != ?')
    .all(niveauId, classeSourceId, classeSourceId) as { id: number }[]

  const insert = base().prepare(
    `INSERT INTO classe_matiere (classe_id, matiere_id, coefficient, volume_horaire)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (classe_id, matiere_id) DO UPDATE SET
       coefficient = excluded.coefficient, volume_horaire = excluded.volume_horaire`
  )
  let appliquees = 0
  const transaction = base().transaction(() => {
    for (const cible of cibles) {
      for (const ligne of grille) {
        insert.run(cible.id, ligne.matiere_id, ligne.coefficient, ligne.volume_horaire)
        appliquees++
      }
    }
  })
  transaction()
  return appliquees
}

/* ---------------------------- Emploi du temps ---------------------------- */

export interface Seance {
  id: number
  classe_id: number
  jour: number
  heure_debut: string
  heure_fin: string
  matiere_id: number | null
  enseignant_id: number | null
  salle: string | null
  matiere_libelle?: string
  enseignant_nom?: string
  classe_libelle?: string
}

export function emploiDuTempsClasse(classeId: number): Seance[] {
  return base()
    .prepare(
      `SELECT s.*, m.libelle AS matiere_libelle,
              CASE WHEN e.id IS NULL THEN NULL ELSE e.nom || ' ' || e.prenom END AS enseignant_nom
       FROM seance_emploi_temps s
       LEFT JOIN matiere m ON m.id = s.matiere_id
       LEFT JOIN enseignant e ON e.id = s.enseignant_id
       WHERE s.classe_id = ?
       ORDER BY s.jour, s.heure_debut`
    )
    .all(classeId) as Seance[]
}

export function emploiDuTempsEnseignant(enseignantId: number, anneeId?: number): Seance[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT s.*, m.libelle AS matiere_libelle, c.libelle AS classe_libelle
       FROM seance_emploi_temps s
       JOIN classe c ON c.id = s.classe_id
       LEFT JOIN matiere m ON m.id = s.matiere_id
       WHERE s.enseignant_id = ? AND c.annee_id = ?
       ORDER BY s.jour, s.heure_debut`
    )
    .all(enseignantId, id) as Seance[]
}

/**
 * Cree une seance en refusant les conflits : un enseignant ne peut pas etre
 * dans deux classes au meme moment, ni une salle accueillir deux classes.
 */
export function creerSeance(d: Omit<Seance, 'id'>): number {
  verifierConflit(d, null)
  const r = base()
    .prepare(
      `INSERT INTO seance_emploi_temps (classe_id, jour, heure_debut, heure_fin, matiere_id, enseignant_id, salle)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(d.classe_id, d.jour, d.heure_debut, d.heure_fin, d.matiere_id, d.enseignant_id, d.salle ?? null)
  return Number(r.lastInsertRowid)
}

export function modifierSeance(id: number, d: Partial<Seance>): void {
  const existante = base().prepare('SELECT * FROM seance_emploi_temps WHERE id = ?').get(id) as Seance
  verifierConflit({ ...existante, ...d }, id)
  majPartielle('seance_emploi_temps', id, d, [
    'id', 'matiere_libelle', 'enseignant_nom', 'classe_libelle'
  ])
}

export function supprimerSeance(id: number): void {
  base().prepare('DELETE FROM seance_emploi_temps WHERE id = ?').run(id)
}

function verifierConflit(seance: Partial<Seance>, idIgnore: number | null): void {
  const anneeId = exigerAnneeActive().id
  const chevauchement = `s.heure_debut < ? AND s.heure_fin > ?`

  if (seance.enseignant_id) {
    const conflit = base()
      .prepare(
        `SELECT c.libelle FROM seance_emploi_temps s
         JOIN classe c ON c.id = s.classe_id
         WHERE s.enseignant_id = ? AND s.jour = ? AND ${chevauchement}
           AND c.annee_id = ? AND (? IS NULL OR s.id != ?)`
      )
      .get(
        seance.enseignant_id, seance.jour, seance.heure_fin, seance.heure_debut,
        anneeId, idIgnore, idIgnore
      ) as { libelle: string } | undefined
    if (conflit) {
      throw new Error(`Cet enseignant a deja cours en ${conflit.libelle} sur ce creneau.`)
    }
  }

  if (seance.salle) {
    const conflit = base()
      .prepare(
        `SELECT c.libelle FROM seance_emploi_temps s
         JOIN classe c ON c.id = s.classe_id
         WHERE s.salle = ? AND s.jour = ? AND ${chevauchement}
           AND c.annee_id = ? AND (? IS NULL OR s.id != ?)`
      )
      .get(
        seance.salle, seance.jour, seance.heure_fin, seance.heure_debut,
        anneeId, idIgnore, idIgnore
      ) as { libelle: string } | undefined
    if (conflit) throw new Error(`La salle ${seance.salle} est deja occupee par ${conflit.libelle}.`)
  }
}

/** Mise a jour partielle generique, en ignorant les colonnes calculees. */
export function majPartielle(
  table: string,
  id: number,
  donnees: Record<string, unknown>,
  exclus: string[]
): void {
  const champs = Object.keys(donnees).filter((c) => !exclus.includes(c) && donnees[c] !== undefined)
  if (!champs.length) return
  base()
    .prepare(`UPDATE ${table} SET ${champs.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...champs.map((c) => donnees[c] as never), id)
}
