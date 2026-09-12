import { base } from '../db'
import type { Bulletin, Classe, Eleve, Evaluation, LigneBulletin, Note, Periode } from '@shared/types'
import { arrondi2, mention } from '@shared/format'
import { sessionCourante } from './auth'
import { tracer } from './journal'

/* ---------------------------------------------------------------------------
 * Evaluations
 * ------------------------------------------------------------------------ */

export function listerEvaluations(classeMatiereId: number, periodeId: number): Evaluation[] {
  return base()
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM note n WHERE n.evaluation_id = e.id) AS nb_notes
       FROM evaluation e
       WHERE e.classe_matiere_id = ? AND e.periode_id = ?
       ORDER BY e.date_evaluation, e.id`
    )
    .all(classeMatiereId, periodeId) as Evaluation[]
}

export function creerEvaluation(donnees: Omit<Evaluation, 'id' | 'publiee'>): number {
  verifierPeriodeOuverte(donnees.periode_id)
  const r = base()
    .prepare(
      `INSERT INTO evaluation (classe_matiere_id, periode_id, type, libelle, date_evaluation, bareme, poids)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      donnees.classe_matiere_id,
      donnees.periode_id,
      donnees.type,
      donnees.libelle,
      donnees.date_evaluation,
      donnees.bareme,
      donnees.poids
    )
  return Number(r.lastInsertRowid)
}

export function modifierEvaluation(id: number, donnees: Partial<Evaluation>): void {
  const evaluation = base().prepare('SELECT periode_id FROM evaluation WHERE id = ?').get(id) as
    | { periode_id: number }
    | undefined
  if (evaluation) verifierPeriodeOuverte(evaluation.periode_id)
  const champs = Object.keys(donnees).filter((c) => !['id', 'periode_id'].includes(c))
  if (!champs.length) return
  base()
    .prepare(`UPDATE evaluation SET ${champs.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...champs.map((c) => (donnees as Record<string, unknown>)[c]), id)
}

export function supprimerEvaluation(id: number): void {
  const evaluation = base().prepare('SELECT periode_id FROM evaluation WHERE id = ?').get(id) as
    | { periode_id: number }
    | undefined
  if (evaluation) verifierPeriodeOuverte(evaluation.periode_id)
  base().prepare('DELETE FROM evaluation WHERE id = ?').run(id)
}

function verifierPeriodeOuverte(periodeId: number): void {
  const periode = base().prepare('SELECT verrouillee, libelle FROM periode WHERE id = ?').get(periodeId) as
    | { verrouillee: number; libelle: string }
    | undefined
  if (periode?.verrouillee) {
    throw new Error(
      `La periode « ${periode.libelle} » est verrouillee. Deverrouillez-la pour modifier les notes.`
    )
  }
}

/* ---------------------------------------------------------------------------
 * Saisie des notes
 * ------------------------------------------------------------------------ */

export interface SaisieNote {
  eleve_id: number
  valeur: number | null
  absent?: number
  justifie?: number
  observation?: string | null
}

/** Feuille de saisie : les eleves de la classe avec leur note eventuelle. */
export function feuilleDeNotes(evaluationId: number): {
  evaluation: Evaluation
  lignes: { eleve_id: number; matricule: string; nom_complet: string; sexe: string; note: Note | null }[]
} {
  const evaluation = base()
    .prepare(
      `SELECT e.*, m.libelle AS matiere_libelle, c.libelle AS classe_libelle
       FROM evaluation e
       JOIN classe_matiere cm ON cm.id = e.classe_matiere_id
       JOIN matiere m ON m.id = cm.matiere_id
       JOIN classe c ON c.id = cm.classe_id
       WHERE e.id = ?`
    )
    .get(evaluationId) as Evaluation | undefined
  if (!evaluation) throw new Error('Evaluation introuvable.')

  const lignes = base()
    .prepare(
      `SELECT el.id AS eleve_id, el.matricule, el.nom, el.prenom, el.sexe
       FROM inscription i
       JOIN eleve el ON el.id = i.eleve_id
       JOIN classe_matiere cm ON cm.classe_id = i.classe_id
       WHERE cm.id = ? AND i.statut = 'INSCRIT'
       ORDER BY el.nom, el.prenom`
    )
    .all(evaluation.classe_matiere_id) as any[]

  const notes = base()
    .prepare('SELECT * FROM note WHERE evaluation_id = ?')
    .all(evaluationId) as Note[]
  const parEleve = new Map(notes.map((n) => [n.eleve_id, n]))

  return {
    evaluation,
    lignes: lignes.map((l) => ({
      eleve_id: l.eleve_id,
      matricule: l.matricule,
      nom_complet: `${l.nom} ${l.prenom}`.trim(),
      sexe: l.sexe,
      note: parEleve.get(l.eleve_id) ?? null
    }))
  }
}

/** Enregistre toute la feuille d’un coup (une transaction = tout ou rien). */
export function enregistrerNotes(evaluationId: number, saisies: SaisieNote[]): { enregistrees: number } {
  const evaluation = base().prepare('SELECT * FROM evaluation WHERE id = ?').get(evaluationId) as
    | Evaluation
    | undefined
  if (!evaluation) throw new Error('Evaluation introuvable.')
  verifierPeriodeOuverte(evaluation.periode_id)

  for (const s of saisies) {
    if (s.valeur !== null && s.valeur !== undefined) {
      if (s.valeur < 0) throw new Error('Une note ne peut pas etre negative.')
      if (s.valeur > evaluation.bareme) {
        throw new Error(`Note superieure au bareme (/${evaluation.bareme}) pour au moins un eleve.`)
      }
    }
  }

  const insert = base().prepare(
    `INSERT INTO note (evaluation_id, eleve_id, valeur, absent, justifie, observation)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (evaluation_id, eleve_id) DO UPDATE SET
       valeur = excluded.valeur, absent = excluded.absent,
       justifie = excluded.justifie, observation = excluded.observation`
  )

  const transaction = base().transaction(() => {
    for (const s of saisies) {
      insert.run(
        evaluationId,
        s.eleve_id,
        s.absent ? null : (s.valeur ?? null),
        s.absent ?? 0,
        s.justifie ?? 0,
        s.observation ?? null
      )
    }
  })
  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'SAISIE_NOTES',
    'evaluation',
    evaluationId,
    { nombre: saisies.length }
  )
  return { enregistrees: saisies.length }
}

/* ---------------------------------------------------------------------------
 * Moteur de calcul des bulletins
 *
 * Regles appliquees :
 *  - chaque note est ramenee sur 20 : note / bareme * 20 ;
 *  - la moyenne d’une matiere est ponderee par le poids de chaque evaluation ;
 *  - une absence JUSTIFIEE est neutre (l’evaluation est ignoree) ;
 *  - une absence NON justifiee vaut zero ;
 *  - la moyenne generale est ponderee par les coefficients des matieres ;
 *  - le rang est calcule par ordre decroissant, les ex aequo partagent le rang.
 * ------------------------------------------------------------------------ */

interface ResultatEleve {
  eleve: Eleve
  lignes: LigneBulletin[]
  total_coefficients: number
  total_points: number
  moyenne_sur_20: number | null
  rang: number | null
}

export interface ResultatsClasse {
  classe: Classe
  periode: Periode
  eleves: ResultatEleve[]
  moyenne_classe: number | null
  moyenne_premier: number | null
  moyenne_dernier: number | null
  taux_reussite: number
}

/** Calcule en une passe les resultats de toute une classe pour une periode. */
export function calculerClasse(classeId: number, periodeId: number): ResultatsClasse {
  const classe = base()
    .prepare(
      `SELECT c.*, n.libelle AS niveau_libelle, n.cycle, f.libelle AS filiere_libelle
       FROM classe c JOIN niveau n ON n.id = c.niveau_id
       LEFT JOIN filiere f ON f.id = c.filiere_id
       WHERE c.id = ?`
    )
    .get(classeId) as Classe | undefined
  if (!classe) throw new Error('Classe introuvable.')

  const periode = base().prepare('SELECT * FROM periode WHERE id = ?').get(periodeId) as Periode
  if (!periode) throw new Error('Periode introuvable.')

  const seuil = (
    base().prepare('SELECT seuil_reussite FROM etablissement WHERE id = 1').get() as
      | { seuil_reussite: number }
      | undefined
  )?.seuil_reussite ?? 10

  const eleves = base()
    .prepare(
      `SELECT e.* FROM inscription i JOIN eleve e ON e.id = i.eleve_id
       WHERE i.classe_id = ? AND i.statut = 'INSCRIT'
       ORDER BY e.nom, e.prenom`
    )
    .all(classeId) as Eleve[]

  const matieres = base()
    .prepare(
      `SELECT cm.id, cm.matiere_id, cm.coefficient, m.libelle AS matiere_libelle,
              ens.nom AS ens_nom, ens.prenom AS ens_prenom
       FROM classe_matiere cm
       JOIN matiere m ON m.id = cm.matiere_id
       LEFT JOIN enseignant ens ON ens.id = cm.enseignant_id
       WHERE cm.classe_id = ?
       ORDER BY m.libelle`
    )
    .all(classeId) as any[]

  const evaluations = base()
    .prepare(
      `SELECT * FROM evaluation
       WHERE periode_id = ? AND classe_matiere_id IN (
         SELECT id FROM classe_matiere WHERE classe_id = ?
       ) ORDER BY date_evaluation`
    )
    .all(periodeId, classeId) as Evaluation[]

  const idsEvaluations = evaluations.map((e) => e.id)
  const notes: Note[] = idsEvaluations.length
    ? (base()
        .prepare(
          `SELECT * FROM note WHERE evaluation_id IN (${idsEvaluations.map(() => '?').join(',')})`
        )
        .all(...idsEvaluations) as Note[])
    : []

  const notesParCle = new Map<string, Note>()
  for (const n of notes) notesParCle.set(`${n.evaluation_id}:${n.eleve_id}`, n)

  const evaluationsParMatiere = new Map<number, Evaluation[]>()
  for (const e of evaluations) {
    const liste = evaluationsParMatiere.get(e.classe_matiere_id) ?? []
    liste.push(e)
    evaluationsParMatiere.set(e.classe_matiere_id, liste)
  }

  // Premiere passe : moyenne de chaque eleve dans chaque matiere
  const moyennesMatiere = new Map<number, Map<number, number>>() // classe_matiere_id -> eleve_id -> /20
  for (const matiere of matieres) {
    const parEleve = new Map<number, number>()
    const evals = evaluationsParMatiere.get(matiere.id) ?? []
    for (const eleve of eleves) {
      let sommePoids = 0
      let sommeNotes = 0
      for (const evaluation of evals) {
        const note = notesParCle.get(`${evaluation.id}:${eleve.id}`)
        if (!note) continue
        if (note.absent && note.justifie) continue // absence justifiee : neutre
        const brute = note.absent ? 0 : (note.valeur ?? null)
        if (brute === null) continue
        const bareme = evaluation.bareme || 20
        sommeNotes += (brute / bareme) * 20 * evaluation.poids
        sommePoids += evaluation.poids
      }
      if (sommePoids > 0) parEleve.set(eleve.id, arrondi2(sommeNotes / sommePoids))
    }
    moyennesMatiere.set(matiere.id, parEleve)
  }

  // Statistiques par matiere (moyenne de classe, min, max, rang)
  const statsMatiere = new Map<number, { moyenne: number | null; min: number | null; max: number | null; rangs: Map<number, number> }>()
  for (const matiere of matieres) {
    const parEleve = moyennesMatiere.get(matiere.id)!
    const valeurs = [...parEleve.values()]
    const tries = [...parEleve.entries()].sort((a, b) => b[1] - a[1])
    const rangs = new Map<number, number>()
    let rangCourant = 0
    let precedente: number | null = null
    tries.forEach(([eleveId, valeur], index) => {
      if (precedente === null || valeur < precedente) rangCourant = index + 1
      rangs.set(eleveId, rangCourant)
      precedente = valeur
    })
    statsMatiere.set(matiere.id, {
      moyenne: valeurs.length ? arrondi2(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : null,
      min: valeurs.length ? Math.min(...valeurs) : null,
      max: valeurs.length ? Math.max(...valeurs) : null,
      rangs
    })
  }

  // Deuxieme passe : composition du bulletin de chaque eleve
  const resultats: ResultatEleve[] = eleves.map((eleve) => {
    const lignes: LigneBulletin[] = []
    let totalCoefficients = 0
    let totalPoints = 0

    for (const matiere of matieres) {
      const moyenne = moyennesMatiere.get(matiere.id)?.get(eleve.id) ?? null
      const stats = statsMatiere.get(matiere.id)!
      const evals = evaluationsParMatiere.get(matiere.id) ?? []

      if (moyenne !== null) {
        totalCoefficients += matiere.coefficient
        totalPoints += moyenne * matiere.coefficient
      }

      lignes.push({
        matiere_id: matiere.matiere_id,
        matiere_libelle: matiere.matiere_libelle,
        coefficient: matiere.coefficient,
        moyenne,
        moyenne_sur_20: moyenne,
        total_points: moyenne === null ? null : arrondi2(moyenne * matiere.coefficient),
        rang: stats.rangs.get(eleve.id) ?? null,
        moyenne_classe: stats.moyenne,
        note_min: stats.min,
        note_max: stats.max,
        appreciation: mention(moyenne),
        enseignant_nom: matiere.ens_nom ? `${matiere.ens_nom} ${matiere.ens_prenom ?? ''}`.trim() : null,
        details: evals.map((evaluation) => {
          const note = notesParCle.get(`${evaluation.id}:${eleve.id}`)
          return {
            libelle: evaluation.libelle,
            valeur: note?.absent ? null : (note?.valeur ?? null),
            bareme: evaluation.bareme,
            absent: note?.absent ?? 0
          }
        })
      })
    }

    const moyenneGenerale = totalCoefficients > 0 ? arrondi2(totalPoints / totalCoefficients) : null
    return {
      eleve,
      lignes,
      total_coefficients: totalCoefficients,
      total_points: arrondi2(totalPoints),
      moyenne_sur_20: moyenneGenerale,
      rang: null
    }
  })

  // Rang general
  const classables = resultats.filter((r) => r.moyenne_sur_20 !== null)
  classables.sort((a, b) => (b.moyenne_sur_20 ?? 0) - (a.moyenne_sur_20 ?? 0))
  let rangCourant = 0
  let precedente: number | null = null
  classables.forEach((r, index) => {
    if (precedente === null || (r.moyenne_sur_20 ?? 0) < precedente) rangCourant = index + 1
    r.rang = rangCourant
    precedente = r.moyenne_sur_20 ?? 0
  })

  const moyennes = classables.map((r) => r.moyenne_sur_20 as number)
  return {
    classe,
    periode,
    eleves: resultats,
    moyenne_classe: moyennes.length
      ? arrondi2(moyennes.reduce((a, b) => a + b, 0) / moyennes.length)
      : null,
    moyenne_premier: moyennes.length ? Math.max(...moyennes) : null,
    moyenne_dernier: moyennes.length ? Math.min(...moyennes) : null,
    taux_reussite: moyennes.length
      ? arrondi2((moyennes.filter((m) => m >= seuil).length / moyennes.length) * 100)
      : 0
  }
}

/** Classement simple d’une classe (utilise par la cloture et les palmares). */
export function classementClasse(
  classeId: number,
  periodeId: number
): { eleve_id: number; nom_complet: string; moyenne: number | null; rang: number | null }[] {
  const resultats = calculerClasse(classeId, periodeId)
  return resultats.eleves
    .map((r) => ({
      eleve_id: r.eleve.id,
      nom_complet: `${r.eleve.nom} ${r.eleve.prenom}`.trim(),
      moyenne: r.moyenne_sur_20,
      rang: r.rang
    }))
    .sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999))
}

/**
 * Bulletin complet d’un eleve. Si la periode est verrouillee et qu’une archive
 * existe, c’est l’archive qui fait foi.
 */
export function calculerBulletin(eleveId: number, periodeId: number): Bulletin | null {
  const archive = base()
    .prepare('SELECT contenu FROM bulletin_archive WHERE eleve_id = ? AND periode_id = ?')
    .get(eleveId, periodeId) as { contenu: string } | undefined
  const periodeVerrouillee = base()
    .prepare('SELECT verrouillee FROM periode WHERE id = ?')
    .get(periodeId) as { verrouillee: number } | undefined
  if (archive && periodeVerrouillee?.verrouillee) {
    return JSON.parse(archive.contenu) as Bulletin
  }

  const inscription = base()
    .prepare(
      `SELECT i.classe_id FROM inscription i
       JOIN periode p ON p.annee_id = i.annee_id
       WHERE i.eleve_id = ? AND p.id = ?`
    )
    .get(eleveId, periodeId) as { classe_id: number } | undefined
  if (!inscription) return null

  const resultats = calculerClasse(inscription.classe_id, periodeId)
  const resultat = resultats.eleves.find((r) => r.eleve.id === eleveId)
  if (!resultat) return null

  const appreciation = base()
    .prepare('SELECT * FROM appreciation_periode WHERE eleve_id = ? AND periode_id = ?')
    .get(eleveId, periodeId) as { conduite: string; observation: string; decision: string } | undefined

  const assiduite = base()
    .prepare(
      `SELECT
         SUM(CASE WHEN statut = 'ABSENT' THEN 1 ELSE 0 END) AS absences,
         SUM(CASE WHEN statut = 'RETARD' THEN 1 ELSE 0 END) AS retards
       FROM presence_eleve pe
       JOIN periode p ON p.id = ?
       WHERE pe.eleve_id = ? AND pe.date_presence BETWEEN p.date_debut AND p.date_fin`
    )
    .get(periodeId, eleveId) as { absences: number | null; retards: number | null }

  const seuil = (
    base().prepare('SELECT seuil_reussite FROM etablissement WHERE id = 1').get() as
      | { seuil_reussite: number }
      | undefined
  )?.seuil_reussite ?? 10

  return {
    eleve: resultat.eleve,
    classe: resultats.classe,
    periode: resultats.periode,
    lignes: resultat.lignes,
    total_coefficients: resultat.total_coefficients,
    total_points: resultat.total_points,
    moyenne_generale: resultat.moyenne_sur_20,
    moyenne_sur_20: resultat.moyenne_sur_20,
    rang: resultat.rang,
    effectif: resultats.eleves.length,
    mention: mention(resultat.moyenne_sur_20),
    decision: decisionPeriode(resultat.moyenne_sur_20, seuil),
    moyenne_classe: resultats.moyenne_classe,
    moyenne_premier: resultats.moyenne_premier,
    moyenne_dernier: resultats.moyenne_dernier,
    conduite: appreciation?.conduite ?? null,
    absences: assiduite?.absences ?? 0,
    retards: assiduite?.retards ?? 0,
    observation: appreciation?.observation ?? null
  }
}

function decisionPeriode(moyenne: number | null, seuil: number): string {
  if (moyenne === null) return 'Non evalue'
  if (moyenne >= 16) return 'Felicitations du conseil'
  if (moyenne >= 14) return "Tableau d’honneur"
  if (moyenne >= 12) return 'Encouragements'
  if (moyenne >= seuil) return 'Resultats satisfaisants'
  if (moyenne >= seuil - 2) return 'Doit fournir plus d efforts'
  return 'Avertissement travail'
}

export function enregistrerAppreciation(
  eleveId: number,
  periodeId: number,
  donnees: { conduite?: string | null; observation?: string | null; decision?: string | null }
): void {
  base()
    .prepare(
      `INSERT INTO appreciation_periode (eleve_id, periode_id, conduite, observation, decision)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (eleve_id, periode_id) DO UPDATE SET
         conduite = excluded.conduite, observation = excluded.observation, decision = excluded.decision`
    )
    .run(
      eleveId,
      periodeId,
      donnees.conduite ?? null,
      donnees.observation ?? null,
      donnees.decision ?? null
    )
}

/** Bulletins de toute une classe, pour l’impression en lot. */
export function bulletinsClasse(classeId: number, periodeId: number): Bulletin[] {
  const resultats = calculerClasse(classeId, periodeId)
  return resultats.eleves
    .map((r) => calculerBulletin(r.eleve.id, periodeId))
    .filter((b): b is Bulletin => b !== null)
    .sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999))
}
