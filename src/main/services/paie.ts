import { base } from '../db'
import type { BulletinPaie } from '@shared/types'
import { lireParametre } from './etablissement'
import { synthesePointageMois } from './presences'
import { sessionCourante } from './auth'
import { tracer } from './journal'

/**
 * Paie des enseignants.
 *
 * La particularite africaine traitee ici : beaucoup d’enseignants sont
 * vacataires et payes a l’heure effectivement faite, pas au forfait. Le module
 * relie donc directement le pointage (heures reellement presentes) au calcul du
 * salaire, et rend visible la retenue pour absence plutot que de la noyer.
 */

export function listerBulletinsPaie(mois: number, annee: number): BulletinPaie[] {
  return base()
    .prepare(
      `SELECT b.*, e.nom || ' ' || e.prenom AS enseignant_nom, e.matricule
       FROM bulletin_paie b JOIN enseignant e ON e.id = b.enseignant_id
       WHERE b.mois = ? AND b.annee = ?
       ORDER BY e.nom`
    )
    .all(mois, annee) as BulletinPaie[]
}

export function lireBulletinPaie(id: number): {
  bulletin: BulletinPaie
  lignes: { id: number; libelle: string; type: string; montant: number }[]
} | null {
  const bulletin = base()
    .prepare(
      `SELECT b.*, e.nom || ' ' || e.prenom AS enseignant_nom, e.matricule
       FROM bulletin_paie b JOIN enseignant e ON e.id = b.enseignant_id WHERE b.id = ?`
    )
    .get(id) as BulletinPaie | undefined
  if (!bulletin) return null
  const lignes = base()
    .prepare('SELECT * FROM ligne_paie WHERE bulletin_paie_id = ? ORDER BY type DESC, id')
    .all(id) as any[]
  return { bulletin, lignes }
}

/**
 * Prepare la paie du mois pour tous les enseignants actifs.
 *
 * - Permanent : salaire de base, moins une retenue proportionnelle aux jours
 *   d’absence non justifies.
 * - Vacataire : heures reellement pointees x taux horaire.
 *
 * Les bulletins deja payes ne sont jamais recalcules.
 */
export function preparerPaieMois(mois: number, annee: number): { crees: number; mis_a_jour: number; ignores: number } {
  const heuresParJour = Number(lireParametre('pointage.heures_par_jour', '6')) || 6
  const synthese = synthesePointageMois(mois, annee)
  const enseignants = base()
    .prepare("SELECT * FROM enseignant WHERE statut = 'ACTIF'")
    .all() as any[]

  const parEnseignant = new Map(synthese.map((s) => [s.enseignant_id, s]))
  let crees = 0
  let misAJour = 0
  let ignores = 0

  const transaction = base().transaction(() => {
    for (const enseignant of enseignants) {
      const existant = base()
        .prepare('SELECT * FROM bulletin_paie WHERE enseignant_id = ? AND mois = ? AND annee = ?')
        .get(enseignant.id, mois, annee) as BulletinPaie | undefined
      if (existant?.statut === 'PAYE') {
        ignores++
        continue
      }

      const pointage = parEnseignant.get(enseignant.id)
      const joursTravailles = pointage?.jours_presents ?? 0
      const joursAbsence = pointage?.jours_absents ?? 0
      const heuresFaites = pointage?.heures_faites ?? 0
      const joursOuvres = joursTravailles + joursAbsence

      let base_ = 0
      let retenueAbsence = 0

      if (enseignant.type_contrat === 'VACATAIRE') {
        base_ = Math.round(heuresFaites * (enseignant.taux_horaire || 0))
      } else {
        base_ = enseignant.salaire_base || 0
        if (joursOuvres > 0 && joursAbsence > 0) {
          retenueAbsence = Math.round((base_ / joursOuvres) * joursAbsence)
        }
      }

      const heuresPrevues = joursOuvres * heuresParJour
      const net = Math.max(0, base_ - retenueAbsence)

      if (existant) {
        base()
          .prepare(
            `UPDATE bulletin_paie SET salaire_base = ?, heures_prevues = ?, heures_faites = ?,
               jours_absence = ?, total_retenues = ?, net_a_payer = ? WHERE id = ?`
          )
          .run(base_, heuresPrevues, heuresFaites, joursAbsence, retenueAbsence, net, existant.id)
        remplacerLigneAutomatique(existant.id, retenueAbsence)
        misAJour++
      } else {
        const r = base()
          .prepare(
            `INSERT INTO bulletin_paie (enseignant_id, mois, annee, salaire_base, heures_prevues,
               heures_faites, jours_absence, total_retenues, net_a_payer)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(enseignant.id, mois, annee, base_, heuresPrevues, heuresFaites, joursAbsence, retenueAbsence, net)
        remplacerLigneAutomatique(Number(r.lastInsertRowid), retenueAbsence)
        crees++
      }
    }
  })
  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'PREPARATION_PAIE',
    'bulletin_paie',
    null,
    { mois, annee, crees, mis_a_jour: misAJour }
  )
  return { crees, mis_a_jour: misAJour, ignores }
}

/** La retenue pour absence est recalculee a chaque preparation, pas cumulee. */
function remplacerLigneAutomatique(bulletinId: number, retenue: number): void {
  base()
    .prepare("DELETE FROM ligne_paie WHERE bulletin_paie_id = ? AND libelle = 'Retenue pour absence'")
    .run(bulletinId)
  if (retenue > 0) {
    base()
      .prepare(
        "INSERT INTO ligne_paie (bulletin_paie_id, libelle, type, montant) VALUES (?, 'Retenue pour absence', 'RETENUE', ?)"
      )
      .run(bulletinId, retenue)
  }
}

export function ajouterLignePaie(
  bulletinId: number,
  ligne: { libelle: string; type: 'PRIME' | 'RETENUE'; montant: number }
): void {
  base()
    .prepare('INSERT INTO ligne_paie (bulletin_paie_id, libelle, type, montant) VALUES (?, ?, ?, ?)')
    .run(bulletinId, ligne.libelle, ligne.type, Math.round(ligne.montant))
  recalculerBulletin(bulletinId)
}

export function supprimerLignePaie(ligneId: number): void {
  const ligne = base().prepare('SELECT bulletin_paie_id FROM ligne_paie WHERE id = ?').get(ligneId) as
    | { bulletin_paie_id: number }
    | undefined
  base().prepare('DELETE FROM ligne_paie WHERE id = ?').run(ligneId)
  if (ligne) recalculerBulletin(ligne.bulletin_paie_id)
}

export function recalculerBulletin(bulletinId: number): void {
  const totaux = base()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'PRIME' THEN montant ELSE 0 END), 0) AS primes,
         COALESCE(SUM(CASE WHEN type = 'RETENUE' THEN montant ELSE 0 END), 0) AS retenues
       FROM ligne_paie WHERE bulletin_paie_id = ?`
    )
    .get(bulletinId) as { primes: number; retenues: number }

  const bulletin = base()
    .prepare('SELECT salaire_base, montant_heures_sup FROM bulletin_paie WHERE id = ?')
    .get(bulletinId) as { salaire_base: number; montant_heures_sup: number }

  const net = Math.max(
    0,
    bulletin.salaire_base + bulletin.montant_heures_sup + totaux.primes - totaux.retenues
  )
  base()
    .prepare('UPDATE bulletin_paie SET total_primes = ?, total_retenues = ?, net_a_payer = ? WHERE id = ?')
    .run(totaux.primes, totaux.retenues, net, bulletinId)
}

export function validerPaie(mois: number, annee: number): { valides: number } {
  const r = base()
    .prepare("UPDATE bulletin_paie SET statut = 'VALIDE' WHERE mois = ? AND annee = ? AND statut = 'BROUILLON'")
    .run(mois, annee)
  return { valides: r.changes }
}

export function marquerPaye(
  bulletinId: number,
  donnees: { date_paiement: string; mode_paiement: string; reference?: string | null }
): void {
  base()
    .prepare(
      "UPDATE bulletin_paie SET statut = 'PAYE', date_paiement = ?, mode_paiement = ?, reference = ? WHERE id = ?"
    )
    .run(donnees.date_paiement, donnees.mode_paiement, donnees.reference ?? null, bulletinId)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'PAIEMENT_SALAIRE',
    'bulletin_paie',
    bulletinId,
    donnees
  )
}

export function etatPaieMois(mois: number, annee: number): {
  lignes: BulletinPaie[]
  total_brut: number
  total_primes: number
  total_retenues: number
  total_net: number
  nb_payes: number
} {
  const lignes = listerBulletinsPaie(mois, annee)
  return {
    lignes,
    total_brut: lignes.reduce((s, l) => s + l.salaire_base + l.montant_heures_sup, 0),
    total_primes: lignes.reduce((s, l) => s + l.total_primes, 0),
    total_retenues: lignes.reduce((s, l) => s + l.total_retenues, 0),
    total_net: lignes.reduce((s, l) => s + l.net_a_payer, 0),
    nb_payes: lignes.filter((l) => l.statut === 'PAYE').length
  }
}
