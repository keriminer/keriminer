import { base } from '../db'
import type { AnneeScolaire, Periode } from '@shared/types'
import { creerPeriodes } from './etablissement'
import { calculerBulletin, classementClasse } from './notes'
import { sessionCourante } from './auth'
import { tracer } from './journal'

export function listerAnnees(): AnneeScolaire[] {
  return base()
    .prepare('SELECT * FROM annee_scolaire ORDER BY date_debut DESC')
    .all() as AnneeScolaire[]
}

export function anneeActive(): AnneeScolaire | null {
  return (
    (base().prepare('SELECT * FROM annee_scolaire WHERE active = 1').get() as AnneeScolaire) ?? null
  )
}

export function exigerAnneeActive(): AnneeScolaire {
  const annee = anneeActive()
  if (!annee) throw new Error('Aucune annee scolaire active. Ouvrez une annee dans les parametres.')
  return annee
}

export function activerAnnee(id: number): void {
  const transaction = base().transaction(() => {
    base().prepare('UPDATE annee_scolaire SET active = 0').run()
    base().prepare('UPDATE annee_scolaire SET active = 1 WHERE id = ?').run(id)
  })
  transaction()
  tracer(null, null, 'ACTIVATION_ANNEE', 'annee_scolaire', id)
}

export function listerPeriodes(anneeId?: number): Periode[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare('SELECT * FROM periode WHERE annee_id = ? ORDER BY ordre')
    .all(id) as Periode[]
}

export function modifierPeriode(id: number, donnees: Partial<Periode>): void {
  const champs = Object.keys(donnees).filter((c) => !['id', 'annee_id'].includes(c))
  if (!champs.length) return
  base()
    .prepare(`UPDATE periode SET ${champs.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...champs.map((c) => (donnees as Record<string, unknown>)[c]), id)
}

/**
 * Verrouille une periode : les notes ne sont plus modifiables et les bulletins
 * de tous les eleves concernes sont figes dans `bulletin_archive`.
 * On archive le bulletin calcule, pas seulement les notes : un changement futur
 * de coefficient ne doit jamais reecrire l’histoire.
 */
export function verrouillerPeriode(periodeId: number): { archives: number } {
  const periode = base().prepare('SELECT * FROM periode WHERE id = ?').get(periodeId) as Periode
  if (!periode) throw new Error('Periode introuvable.')

  const classes = base()
    .prepare('SELECT id FROM classe WHERE annee_id = ?')
    .all(periode.annee_id) as { id: number }[]

  let archives = 0
  const insert = base().prepare(
    `INSERT OR REPLACE INTO bulletin_archive (eleve_id, periode_id, classe_id, contenu, moyenne, rang)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  const transaction = base().transaction(() => {
    for (const classe of classes) {
      const classement = classementClasse(classe.id, periodeId)
      for (const entree of classement) {
        const bulletin = calculerBulletin(entree.eleve_id, periodeId)
        if (!bulletin) continue
        insert.run(
          entree.eleve_id,
          periodeId,
          classe.id,
          JSON.stringify(bulletin),
          bulletin.moyenne_sur_20,
          bulletin.rang
        )
        archives++
      }
    }
    base().prepare('UPDATE periode SET verrouillee = 1 WHERE id = ?').run(periodeId)
  })
  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'VERROUILLAGE_PERIODE',
    'periode',
    periodeId,
    { archives }
  )
  return { archives }
}

export function deverrouillerPeriode(periodeId: number): void {
  base().prepare('UPDATE periode SET verrouillee = 0 WHERE id = ?').run(periodeId)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'DEVERROUILLAGE_PERIODE',
    'periode',
    periodeId
  )
}

export interface BilanAnnuelEleve {
  inscription_id: number
  eleve_id: number
  matricule: string
  nom_complet: string
  classe_id: number
  classe_libelle: string
  niveau_ordre: number
  moyenne_annuelle: number | null
  decision: 'ADMIS' | 'REDOUBLE' | 'A_EXAMINER'
  solde: number
}

/**
 * Calcule le bilan de fin d’annee : moyenne annuelle (moyenne des periodes
 * ponderee), decision de passage et solde financier restant.
 */
export function bilanAnnuel(anneeId: number): BilanAnnuelEleve[] {
  const seuil = (
    base().prepare('SELECT seuil_reussite FROM etablissement WHERE id = 1').get() as
      | { seuil_reussite: number }
      | undefined
  )?.seuil_reussite ?? 10

  const periodes = listerPeriodes(anneeId)
  const inscriptions = base()
    .prepare(
      `SELECT i.id AS inscription_id, i.eleve_id, e.matricule, e.nom, e.prenom,
              c.id AS classe_id, c.libelle AS classe_libelle, n.ordre AS niveau_ordre
       FROM inscription i
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       JOIN niveau n ON n.id = c.niveau_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'
       ORDER BY n.ordre, c.libelle, e.nom`
    )
    .all(anneeId) as any[]

  return inscriptions.map((i) => {
    let sommePoids = 0
    let sommeMoyennes = 0
    for (const p of periodes) {
      const archive = base()
        .prepare('SELECT moyenne FROM bulletin_archive WHERE eleve_id = ? AND periode_id = ?')
        .get(i.eleve_id, p.id) as { moyenne: number | null } | undefined
      const moyenne =
        archive?.moyenne ?? calculerBulletin(i.eleve_id, p.id)?.moyenne_sur_20 ?? null
      if (moyenne !== null) {
        sommeMoyennes += moyenne * p.poids
        sommePoids += p.poids
      }
    }
    const moyenneAnnuelle = sommePoids > 0 ? Math.round((sommeMoyennes / sommePoids) * 100) / 100 : null

    const solde = soldeInscription(i.inscription_id)
    let decision: BilanAnnuelEleve['decision'] = 'A_EXAMINER'
    if (moyenneAnnuelle !== null) decision = moyenneAnnuelle >= seuil ? 'ADMIS' : 'REDOUBLE'

    return {
      inscription_id: i.inscription_id,
      eleve_id: i.eleve_id,
      matricule: i.matricule,
      nom_complet: `${i.nom} ${i.prenom}`.trim(),
      classe_id: i.classe_id,
      classe_libelle: i.classe_libelle,
      niveau_ordre: i.niveau_ordre,
      moyenne_annuelle: moyenneAnnuelle,
      decision,
      solde
    }
  })
}

function soldeInscription(inscriptionId: number): number {
  const du = base()
    .prepare(
      'SELECT COALESCE(SUM(montant_du - remise), 0) t FROM eleve_frais WHERE inscription_id = ?'
    )
    .get(inscriptionId) as { t: number }
  const paye = base()
    .prepare(
      'SELECT COALESCE(SUM(montant), 0) t FROM paiement WHERE inscription_id = ? AND annule = 0'
    )
    .get(inscriptionId) as { t: number }
  return du.t - paye.t
}

export interface OptionsCloture {
  annee_id: number
  nouvelle_annee: { libelle: string; date_debut: string; date_fin: string; decoupage: 'TRIMESTRE' | 'SEMESTRE' }
  reconduire_classes: boolean
  reconduire_frais: boolean
  reconduire_attributions: boolean
  promouvoir: boolean
  decisions: Record<number, 'ADMIS' | 'REDOUBLE' | 'SORTIE'> // par inscription_id
}

export interface ResultatCloture {
  nouvelle_annee_id: number
  classes_creees: number
  eleves_promus: number
  eleves_redoublants: number
  eleves_sortis: number
  frais_reconduits: number
}

/**
 * Cloture d’une annee et ouverture de la suivante en une seule operation.
 *
 * Le point delicat est la promotion : on fait passer chaque eleve dans la
 * classe du niveau immediatement superieur au sein du meme cycle et de la meme
 * filiere. Si aucune classe superieure n’existe (derniere annee du cycle),
 * l’eleve est marque DIPLOME plutot que promu dans le vide.
 */
export function cloturerAnnee(options: OptionsCloture): ResultatCloture {
  const ancienne = base()
    .prepare('SELECT * FROM annee_scolaire WHERE id = ?')
    .get(options.annee_id) as AnneeScolaire | undefined
  if (!ancienne) throw new Error('Annee scolaire introuvable.')
  if (ancienne.cloturee) throw new Error('Cette annee est deja cloturee.')

  const db = base()
  const resultat: ResultatCloture = {
    nouvelle_annee_id: 0,
    classes_creees: 0,
    eleves_promus: 0,
    eleves_redoublants: 0,
    eleves_sortis: 0,
    frais_reconduits: 0
  }

  const transaction = db.transaction(() => {
    // 1. Figer toutes les periodes non encore verrouillees
    const periodes = db
      .prepare('SELECT id FROM periode WHERE annee_id = ? AND verrouillee = 0')
      .all(options.annee_id) as { id: number }[]
    for (const p of periodes) verrouillerPeriode(p.id)

    // 2. Creer la nouvelle annee et ses periodes
    const insertAnnee = db
      .prepare('INSERT INTO annee_scolaire (libelle, date_debut, date_fin, active) VALUES (?, ?, ?, 0)')
      .run(
        options.nouvelle_annee.libelle,
        options.nouvelle_annee.date_debut,
        options.nouvelle_annee.date_fin
      )
    const nouvelleAnneeId = Number(insertAnnee.lastInsertRowid)
    resultat.nouvelle_annee_id = nouvelleAnneeId
    creerPeriodes(nouvelleAnneeId, options.nouvelle_annee)

    // 3. Reconduire la structure des classes
    const correspondanceClasses = new Map<number, number>() // ancienne -> nouvelle
    if (options.reconduire_classes) {
      const classes = db
        .prepare('SELECT * FROM classe WHERE annee_id = ?')
        .all(options.annee_id) as any[]
      const insertClasse = db.prepare(
        `INSERT INTO classe (annee_id, niveau_id, filiere_id, libelle, capacite, salle, titulaire_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const c of classes) {
        const nouvelle = insertClasse.run(
          nouvelleAnneeId,
          c.niveau_id,
          c.filiere_id,
          c.libelle,
          c.capacite,
          c.salle,
          c.titulaire_id
        )
        correspondanceClasses.set(c.id, Number(nouvelle.lastInsertRowid))
        resultat.classes_creees++

        if (options.reconduire_attributions) {
          const attributions = db
            .prepare('SELECT * FROM classe_matiere WHERE classe_id = ?')
            .all(c.id) as any[]
          const insertAttribution = db.prepare(
            `INSERT OR IGNORE INTO classe_matiere (classe_id, matiere_id, enseignant_id, coefficient, volume_horaire)
             VALUES (?, ?, ?, ?, ?)`
          )
          for (const a of attributions) {
            insertAttribution.run(
              Number(nouvelle.lastInsertRowid),
              a.matiere_id,
              a.enseignant_id,
              a.coefficient,
              a.volume_horaire
            )
          }
        }
      }
    }

    // 4. Reconduire la grille tarifaire
    if (options.reconduire_frais) {
      const frais = db
        .prepare('SELECT * FROM frais WHERE annee_id = ? AND actif = 1')
        .all(options.annee_id) as any[]
      const insertFrais = db.prepare(
        `INSERT INTO frais (annee_id, libelle, type, montant, obligatoire, niveau_id, classe_id, periodicite, date_echeance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const f of frais) {
        insertFrais.run(
          nouvelleAnneeId,
          f.libelle,
          f.type,
          f.montant,
          f.obligatoire,
          f.niveau_id,
          f.classe_id ? (correspondanceClasses.get(f.classe_id) ?? null) : null,
          f.periodicite,
          null
        )
        resultat.frais_reconduits++
      }
    }

    // 5. Promotion des eleves
    if (options.promouvoir) {
      const inscriptions = db
        .prepare(
          `SELECT i.*, c.niveau_id, c.filiere_id, n.ordre AS niveau_ordre, n.cycle
           FROM inscription i
           JOIN classe c ON c.id = i.classe_id
           JOIN niveau n ON n.id = c.niveau_id
           WHERE i.annee_id = ? AND i.statut = 'INSCRIT'`
        )
        .all(options.annee_id) as any[]

      const insertInscription = db.prepare(
        `INSERT OR IGNORE INTO inscription (eleve_id, classe_id, annee_id, redoublant, statut)
         VALUES (?, ?, ?, ?, 'INSCRIT')`
      )

      for (const inscription of inscriptions) {
        const decision = options.decisions[inscription.id] ?? 'ADMIS'

        if (decision === 'SORTIE') {
          db.prepare("UPDATE eleve SET statut = 'DIPLOME' WHERE id = ?").run(inscription.eleve_id)
          resultat.eleves_sortis++
          continue
        }

        let classeCible: number | null = null
        if (decision === 'REDOUBLE') {
          classeCible = correspondanceClasses.get(inscription.classe_id) ?? null
        } else {
          classeCible = trouverClasseSuperieure(
            nouvelleAnneeId,
            inscription.niveau_ordre,
            inscription.cycle,
            inscription.filiere_id
          )
          if (!classeCible) {
            // Fin de cycle : l’eleve sort diplome plutot que d’etre range au hasard.
            db.prepare("UPDATE eleve SET statut = 'DIPLOME' WHERE id = ?").run(inscription.eleve_id)
            resultat.eleves_sortis++
            continue
          }
        }

        if (!classeCible) continue
        insertInscription.run(
          inscription.eleve_id,
          classeCible,
          nouvelleAnneeId,
          decision === 'REDOUBLE' ? 1 : 0
        )
        if (decision === 'REDOUBLE') resultat.eleves_redoublants++
        else resultat.eleves_promus++
      }
    }

    // 6. Basculer l’annee active
    db.prepare(
      "UPDATE annee_scolaire SET cloturee = 1, active = 0, date_cloture = date('now','localtime') WHERE id = ?"
    ).run(options.annee_id)
    db.prepare('UPDATE annee_scolaire SET active = 1 WHERE id = ?').run(nouvelleAnneeId)
  })

  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'CLOTURE_ANNEE',
    'annee_scolaire',
    options.annee_id,
    resultat
  )
  return resultat
}

/** Classe du niveau immediatement superieur, dans le meme cycle et la meme filiere. */
function trouverClasseSuperieure(
  anneeId: number,
  ordreActuel: number,
  cycle: string,
  filiereId: number | null
): number | null {
  const candidat = base()
    .prepare(
      `SELECT c.id FROM classe c
       JOIN niveau n ON n.id = c.niveau_id
       WHERE c.annee_id = ? AND n.ordre > ?
         AND (n.cycle = ? OR ? IS NULL)
         AND (c.filiere_id IS ? OR ? IS NULL)
       ORDER BY n.ordre ASC,
                (SELECT COUNT(*) FROM inscription i WHERE i.classe_id = c.id) ASC
       LIMIT 1`
    )
    .get(anneeId, ordreActuel, cycle, cycle, filiereId, filiereId) as { id: number } | undefined
  return candidat?.id ?? null
}
