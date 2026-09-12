import { base } from '../db'
import type { Frais, Paiement, SituationFinanciere } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { lireParametre } from './etablissement'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { majPartielle } from './structure'
import { fileAttenteDepuisModele } from './sms'
import { aujourdHui, sansAccents } from '@shared/format'

/* ------------------------------ Grille tarifaire ------------------------- */

export function listerFrais(anneeId?: number): Frais[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT f.*, n.libelle AS niveau_libelle, c.libelle AS classe_libelle
       FROM frais f
       LEFT JOIN niveau n ON n.id = f.niveau_id
       LEFT JOIN classe c ON c.id = f.classe_id
       WHERE f.annee_id = ?
       ORDER BY f.type, f.libelle`
    )
    .all(id) as Frais[]
}

export function creerFrais(donnees: Partial<Frais> & { libelle: string; montant: number }): number {
  const anneeId = donnees.annee_id ?? exigerAnneeActive().id
  const r = base()
    .prepare(
      `INSERT INTO frais (annee_id, libelle, type, montant, obligatoire, niveau_id, classe_id, periodicite, date_echeance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      anneeId, donnees.libelle, donnees.type ?? 'SCOLARITE', Math.round(donnees.montant),
      donnees.obligatoire ?? 1, donnees.niveau_id ?? null, donnees.classe_id ?? null,
      donnees.periodicite ?? 'ANNUEL', donnees.date_echeance ?? null
    )
  return Number(r.lastInsertRowid)
}

export function modifierFrais(id: number, donnees: Partial<Frais>): void {
  majPartielle('frais', id, donnees, ['id', 'annee_id', 'niveau_libelle', 'classe_libelle'])
}

export function supprimerFrais(id: number): void {
  const encaisse = base()
    .prepare(
      `SELECT COUNT(*) n FROM paiement_ligne pl
       JOIN eleve_frais ef ON ef.id = pl.eleve_frais_id WHERE ef.frais_id = ?`
    )
    .get(id) as { n: number }
  if (encaisse.n > 0) {
    throw new Error('Des paiements sont rattaches a ce frais. Desactivez-le au lieu de le supprimer.')
  }
  base().prepare('DELETE FROM frais WHERE id = ?').run(id)
}

/**
 * Applique la grille tarifaire a tous les eleves deja inscrits.
 * A lancer apres avoir cree ou modifie les frais en debut d’annee.
 */
export function appliquerGrilleTarifaire(anneeId?: number): { inscriptions: number; lignes: number } {
  const id = anneeId ?? exigerAnneeActive().id
  const inscriptions = base()
    .prepare(
      `SELECT i.id, i.classe_id, c.niveau_id FROM inscription i
       JOIN classe c ON c.id = i.classe_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'`
    )
    .all(id) as { id: number; classe_id: number; niveau_id: number }[]

  const frais = base()
    .prepare('SELECT * FROM frais WHERE annee_id = ? AND actif = 1')
    .all(id) as Frais[]

  const insert = base().prepare(
    'INSERT OR IGNORE INTO eleve_frais (inscription_id, frais_id, montant_du) VALUES (?, ?, ?)'
  )
  let lignes = 0
  const transaction = base().transaction(() => {
    for (const inscription of inscriptions) {
      for (const f of frais) {
        if (f.classe_id && f.classe_id !== inscription.classe_id) continue
        if (f.niveau_id && f.niveau_id !== inscription.niveau_id) continue
        const r = insert.run(inscription.id, f.id, f.montant)
        if (r.changes > 0) lignes++
      }
    }
  })
  transaction()
  return { inscriptions: inscriptions.length, lignes }
}

/* ---------------------------- Situation par eleve ------------------------ */

export function situationEleve(inscriptionId: number): {
  situation: SituationFinanciere
  frais: {
    eleve_frais_id: number
    libelle: string
    type: string
    montant_du: number
    remise: number
    motif_remise: string | null
    paye: number
    solde: number
  }[]
  paiements: Paiement[]
} {
  const situation = base()
    .prepare(`${REQUETE_SITUATION} WHERE i.id = ?`)
    .get(inscriptionId) as SituationFinanciere | undefined
  if (!situation) throw new Error('Inscription introuvable.')

  const frais = base()
    .prepare(
      `SELECT ef.id AS eleve_frais_id, f.libelle, f.type, ef.montant_du, ef.remise, ef.motif_remise,
              COALESCE((SELECT SUM(pl.montant) FROM paiement_ligne pl
                        JOIN paiement p ON p.id = pl.paiement_id
                        WHERE pl.eleve_frais_id = ef.id AND p.annule = 0), 0) AS paye
       FROM eleve_frais ef JOIN frais f ON f.id = ef.frais_id
       WHERE ef.inscription_id = ?
       ORDER BY f.type, f.libelle`
    )
    .all(inscriptionId) as any[]

  const paiements = base()
    .prepare(
      `SELECT p.*, u.nom_complet AS caissier FROM paiement p
       LEFT JOIN utilisateur u ON u.id = p.encaisse_par
       WHERE p.inscription_id = ? ORDER BY p.date_paiement DESC, p.id DESC`
    )
    .all(inscriptionId) as Paiement[]

  return {
    situation,
    frais: frais.map((f) => ({ ...f, solde: f.montant_du - f.remise - f.paye })),
    paiements
  }
}

const REQUETE_SITUATION = `
  SELECT i.id AS inscription_id, e.id AS eleve_id, e.matricule,
         e.nom || ' ' || e.prenom AS nom_complet, c.libelle AS classe_libelle,
         t.telephone AS tuteur_telephone,
         COALESCE((SELECT SUM(ef.montant_du) FROM eleve_frais ef WHERE ef.inscription_id = i.id), 0) AS total_du,
         COALESCE((SELECT SUM(ef.remise) FROM eleve_frais ef WHERE ef.inscription_id = i.id), 0) AS total_remise,
         COALESCE((SELECT SUM(p.montant) FROM paiement p WHERE p.inscription_id = i.id AND p.annule = 0), 0) AS total_paye,
         (SELECT MAX(p.date_paiement) FROM paiement p WHERE p.inscription_id = i.id AND p.annule = 0) AS dernier_paiement
  FROM inscription i
  JOIN eleve e ON e.id = i.eleve_id
  JOIN classe c ON c.id = i.classe_id
  LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
  LEFT JOIN tuteur t ON t.id = et.tuteur_id
`

export interface FiltreSituations {
  annee_id?: number
  classe_id?: number | null
  recherche?: string
  seulement_impayes?: boolean
  seuil_solde?: number
}

export function listerSituations(filtre: FiltreSituations = {}): SituationFinanciere[] {
  const anneeId = filtre.annee_id ?? exigerAnneeActive().id
  const conditions = ["i.annee_id = ?", "i.statut = 'INSCRIT'"]
  const parametres: unknown[] = [anneeId]
  if (filtre.classe_id) {
    conditions.push('i.classe_id = ?')
    parametres.push(filtre.classe_id)
  }

  const lignes = base()
    .prepare(`${REQUETE_SITUATION} WHERE ${conditions.join(' AND ')} ORDER BY e.nom, e.prenom`)
    .all(...parametres) as SituationFinanciere[]

  let resultat = lignes.map((l) => {
    const solde = l.total_du - l.total_remise - l.total_paye
    const attendu = l.total_du - l.total_remise
    return {
      ...l,
      solde,
      taux: attendu > 0 ? Math.round((l.total_paye / attendu) * 1000) / 10 : 100
    }
  })

  if (filtre.seulement_impayes) {
    resultat = resultat.filter((l) => l.solde > (filtre.seuil_solde ?? 0))
  }
  if (filtre.recherche?.trim()) {
    const termes = sansAccents(filtre.recherche).split(/\s+/).filter(Boolean)
    resultat = resultat.filter((l) => {
      const cible = sansAccents(`${l.nom_complet} ${l.matricule} ${l.classe_libelle}`)
      return termes.every((t) => cible.includes(t))
    })
  }
  return resultat.sort((a, b) => b.solde - a.solde)
}

/* -------------------------------- Paiements ------------------------------ */

function genererNumeroRecu(): string {
  const prefixe = lireParametre('recu.prefixe', 'REC')
  const annee = new Date().getFullYear()
  const dernier = base()
    .prepare("SELECT numero_recu FROM paiement WHERE numero_recu LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`${prefixe}${annee}-%`) as { numero_recu: string } | undefined
  const sequence = dernier ? Number(dernier.numero_recu.split('-').pop()) + 1 : 1
  return `${prefixe}${annee}-${String(sequence).padStart(5, '0')}`
}

export interface DonneesPaiement {
  inscription_id: number
  montant: number
  date_paiement?: string
  mode: string
  operateur?: string | null
  reference?: string | null
  observation?: string | null
  /** Repartition explicite ; si absente, le montant est impute automatiquement. */
  affectations?: { eleve_frais_id: number; montant: number }[]
}

/**
 * Encaisse un paiement.
 *
 * Si aucune repartition n’est fournie, le montant est impute automatiquement
 * sur les frais les plus anciens d’abord (inscription avant scolarite, etc.),
 * ce qui correspond a la pratique des econimats : on solde ce qui est du en
 * premier. Le trop-percu eventuel reste sur le compte de l’eleve en avance.
 */
export function encaisserPaiement(donnees: DonneesPaiement): { paiement_id: number; numero_recu: string } {
  if (donnees.montant <= 0) throw new Error('Le montant doit etre superieur a zero.')
  const utilisateur = sessionCourante()?.utilisateur.id ?? null
  const db = base()
  let paiementId = 0
  const numeroRecu = genererNumeroRecu()

  const transaction = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO paiement (numero_recu, inscription_id, montant, date_paiement, mode, operateur, reference, encaisse_par, observation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        numeroRecu, donnees.inscription_id, Math.round(donnees.montant),
        donnees.date_paiement ?? aujourdHui(), donnees.mode, donnees.operateur ?? null,
        donnees.reference ?? null, utilisateur, donnees.observation ?? null
      )
    paiementId = Number(r.lastInsertRowid)

    const insertLigne = db.prepare(
      'INSERT INTO paiement_ligne (paiement_id, eleve_frais_id, montant) VALUES (?, ?, ?)'
    )

    if (donnees.affectations?.length) {
      const total = donnees.affectations.reduce((s, a) => s + a.montant, 0)
      if (Math.round(total) !== Math.round(donnees.montant)) {
        throw new Error("La repartition ne correspond pas au montant verse.")
      }
      for (const a of donnees.affectations) insertLigne.run(paiementId, a.eleve_frais_id, Math.round(a.montant))
    } else {
      const soldes = db
        .prepare(
          `SELECT ef.id, (ef.montant_du - ef.remise -
              COALESCE((SELECT SUM(pl.montant) FROM paiement_ligne pl
                        JOIN paiement p ON p.id = pl.paiement_id
                        WHERE pl.eleve_frais_id = ef.id AND p.annule = 0), 0)) AS solde
           FROM eleve_frais ef
           JOIN frais f ON f.id = ef.frais_id
           WHERE ef.inscription_id = ?
           ORDER BY CASE f.type WHEN 'INSCRIPTION' THEN 0 WHEN 'SCOLARITE' THEN 1 ELSE 2 END,
                    f.date_echeance IS NULL, f.date_echeance, ef.id`
        )
        .all(donnees.inscription_id) as { id: number; solde: number }[]

      let restant = Math.round(donnees.montant)
      for (const ligne of soldes) {
        if (restant <= 0) break
        if (ligne.solde <= 0) continue
        const impute = Math.min(restant, ligne.solde)
        insertLigne.run(paiementId, ligne.id, impute)
        restant -= impute
      }
      // Un eventuel trop-percu n’est rattache a aucun frais : il apparait comme
      // avance dans la situation de l’eleve et sera impute plus tard.
    }
  })
  transaction()

  tracer(
    utilisateur,
    sessionCourante()?.utilisateur.nom_complet ?? null,
    'ENCAISSEMENT',
    'paiement',
    paiementId,
    { montant: donnees.montant, recu: numeroRecu, mode: donnees.mode }
  )

  if (lireParametre('sms.auto_paiement', '0') === '1') {
    const eleve = base()
      .prepare('SELECT eleve_id FROM inscription WHERE id = ?')
      .get(donnees.inscription_id) as { eleve_id: number }
    const situation = situationEleve(donnees.inscription_id).situation
    fileAttenteDepuisModele('RECU_PAIEMENT', eleve.eleve_id, {
      montant: String(Math.round(donnees.montant)),
      reste: String(situation.total_du - situation.total_remise - situation.total_paye),
      recu: numeroRecu
    })
  }

  return { paiement_id: paiementId, numero_recu: numeroRecu }
}

export function annulerPaiement(paiementId: number, motif: string): void {
  if (!motif?.trim()) throw new Error("Le motif d’annulation est obligatoire.")
  base()
    .prepare('UPDATE paiement SET annule = 1, motif_annulation = ? WHERE id = ?')
    .run(motif, paiementId)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'ANNULATION_PAIEMENT',
    'paiement',
    paiementId,
    { motif }
  )
}

export function accorderRemise(eleveFraisId: number, remise: number, motif: string): void {
  if (!motif?.trim()) throw new Error('Le motif de la remise est obligatoire.')
  base()
    .prepare('UPDATE eleve_frais SET remise = ?, motif_remise = ? WHERE id = ?')
    .run(Math.round(remise), motif, eleveFraisId)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'REMISE_ACCORDEE',
    'eleve_frais',
    eleveFraisId,
    { remise, motif }
  )
}

export function lirePaiement(id: number): Paiement | null {
  return (
    (base()
      .prepare(
        `SELECT p.*, e.nom || ' ' || e.prenom AS eleve_nom, e.matricule, c.libelle AS classe_libelle,
                u.nom_complet AS caissier
         FROM paiement p
         JOIN inscription i ON i.id = p.inscription_id
         JOIN eleve e ON e.id = i.eleve_id
         JOIN classe c ON c.id = i.classe_id
         LEFT JOIN utilisateur u ON u.id = p.encaisse_par
         WHERE p.id = ?`
      )
      .get(id) as Paiement) ?? null
  )
}

export function journalCaisse(dateDebut: string, dateFin: string): {
  paiements: Paiement[]
  total: number
  par_mode: { mode: string; montant: number; nombre: number }[]
} {
  const paiements = base()
    .prepare(
      `SELECT p.*, e.nom || ' ' || e.prenom AS eleve_nom, e.matricule, c.libelle AS classe_libelle,
              u.nom_complet AS caissier
       FROM paiement p
       JOIN inscription i ON i.id = p.inscription_id
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       LEFT JOIN utilisateur u ON u.id = p.encaisse_par
       WHERE p.date_paiement BETWEEN ? AND ?
       ORDER BY p.date_paiement DESC, p.id DESC`
    )
    .all(dateDebut, dateFin) as Paiement[]

  const parMode = base()
    .prepare(
      `SELECT mode, COALESCE(SUM(montant), 0) AS montant, COUNT(*) AS nombre
       FROM paiement WHERE date_paiement BETWEEN ? AND ? AND annule = 0
       GROUP BY mode ORDER BY montant DESC`
    )
    .all(dateDebut, dateFin) as any[]

  return {
    paiements,
    total: paiements.filter((p) => !p.annule).reduce((s, p) => s + p.montant, 0),
    par_mode: parMode
  }
}

/* -------------------------------- Depenses ------------------------------- */

export function listerDepenses(anneeId?: number): any[] {
  const id = anneeId ?? exigerAnneeActive().id
  return base()
    .prepare(
      `SELECT d.*, u.nom_complet AS saisi_par_nom FROM depense d
       LEFT JOIN utilisateur u ON u.id = d.saisi_par
       WHERE d.annee_id = ? ORDER BY d.date_depense DESC`
    )
    .all(id)
}

export function creerDepense(donnees: {
  libelle: string
  categorie?: string | null
  montant: number
  date_depense: string
  beneficiaire?: string | null
  piece_justificative?: string | null
}): number {
  const r = base()
    .prepare(
      `INSERT INTO depense (annee_id, libelle, categorie, montant, date_depense, beneficiaire, piece_justificative, saisi_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      exigerAnneeActive().id, donnees.libelle, donnees.categorie ?? null,
      Math.round(donnees.montant), donnees.date_depense, donnees.beneficiaire ?? null,
      donnees.piece_justificative ?? null, sessionCourante()?.utilisateur.id ?? null
    )
  return Number(r.lastInsertRowid)
}

export function supprimerDepense(id: number): void {
  base().prepare('DELETE FROM depense WHERE id = ?').run(id)
}

/** Recettes, depenses et solde, par mois, pour le compte d’exploitation. */
export function bilanFinancier(anneeId?: number): {
  recettes: number
  depenses: number
  solde: number
  attendu: number
  impayes: number
  taux_recouvrement: number
  par_mois: { mois: string; recettes: number; depenses: number }[]
  par_type_frais: { type: string; attendu: number; encaisse: number }[]
} {
  const id = anneeId ?? exigerAnneeActive().id

  const recettes = base()
    .prepare(
      `SELECT COALESCE(SUM(p.montant), 0) t FROM paiement p
       JOIN inscription i ON i.id = p.inscription_id
       WHERE i.annee_id = ? AND p.annule = 0`
    )
    .get(id) as { t: number }

  const depenses = base()
    .prepare('SELECT COALESCE(SUM(montant), 0) t FROM depense WHERE annee_id = ?')
    .get(id) as { t: number }

  const attendu = base()
    .prepare(
      `SELECT COALESCE(SUM(ef.montant_du - ef.remise), 0) t FROM eleve_frais ef
       JOIN inscription i ON i.id = ef.inscription_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'`
    )
    .get(id) as { t: number }

  const parMois = base()
    .prepare(
      `SELECT mois, SUM(recettes) AS recettes, SUM(depenses) AS depenses FROM (
         SELECT substr(p.date_paiement, 1, 7) AS mois, SUM(p.montant) AS recettes, 0 AS depenses
         FROM paiement p JOIN inscription i ON i.id = p.inscription_id
         WHERE i.annee_id = ? AND p.annule = 0 GROUP BY mois
         UNION ALL
         SELECT substr(date_depense, 1, 7) AS mois, 0 AS recettes, SUM(montant) AS depenses
         FROM depense WHERE annee_id = ? GROUP BY mois
       ) GROUP BY mois ORDER BY mois`
    )
    .all(id, id) as any[]

  const parType = base()
    .prepare(
      `SELECT f.type,
              COALESCE(SUM(ef.montant_du - ef.remise), 0) AS attendu,
              COALESCE(SUM((SELECT COALESCE(SUM(pl.montant), 0) FROM paiement_ligne pl
                            JOIN paiement p ON p.id = pl.paiement_id
                            WHERE pl.eleve_frais_id = ef.id AND p.annule = 0)), 0) AS encaisse
       FROM eleve_frais ef
       JOIN frais f ON f.id = ef.frais_id
       JOIN inscription i ON i.id = ef.inscription_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'
       GROUP BY f.type ORDER BY attendu DESC`
    )
    .all(id) as any[]

  return {
    recettes: recettes.t,
    depenses: depenses.t,
    solde: recettes.t - depenses.t,
    attendu: attendu.t,
    impayes: Math.max(0, attendu.t - recettes.t),
    taux_recouvrement: attendu.t > 0 ? Math.round((recettes.t / attendu.t) * 1000) / 10 : 0,
    par_mois: parMois,
    par_type_frais: parType
  }
}
