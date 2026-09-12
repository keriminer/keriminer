import { base } from '../db'
import { lireEtablissement, lireParametre } from './etablissement'
import { exigerAnneeActive } from './annee'
import { bulletinsClasse, calculerBulletin } from './notes'
import { lirePaiement, situationEleve } from './finances'
import { feuilleAppel } from './presences'
import { lireEleve } from './eleves'
import { etatPaieMois } from './paie'
import { rapportTutelle } from './statistiques'
import {
  documentBadges, documentBulletins, documentFeuilleAppel, documentFicheEleve,
  documentListeClasse, documentRecu, documentTableau
} from '../print/documents'
import { formaterDate } from '@shared/format'

/**
 * Fabrique les documents imprimables.
 * Chaque fonction renvoie le HTML complet ; le processus principal se charge
 * ensuite de l’apercu, de l’enregistrement PDF ou de l’impression.
 */

function etablissement() {
  const e = lireEtablissement()
  if (!e) throw new Error("L’etablissement n’est pas configure.")
  return e
}

export function htmlBulletinsClasse(classeId: number, periodeId: number): string {
  const bulletins = bulletinsClasse(classeId, periodeId)
  if (!bulletins.length) throw new Error('Aucun bulletin a imprimer pour cette classe.')
  return documentBulletins(etablissement(), bulletins, optionsBulletin())
}

export function htmlBulletinEleve(eleveId: number, periodeId: number): string {
  const bulletin = calculerBulletin(eleveId, periodeId)
  if (!bulletin) throw new Error("Cet eleve n’a pas de bulletin pour cette periode.")
  return documentBulletins(etablissement(), [bulletin], optionsBulletin())
}

function optionsBulletin() {
  return {
    afficher_rang: lireParametre('bulletin.afficher_rang', '1') === '1',
    afficher_moyenne_classe: lireParametre('bulletin.afficher_moyenne_classe', '1') === '1',
    afficher_details: false
  }
}

export function htmlRecu(paiementId: number): string {
  const paiement = lirePaiement(paiementId)
  if (!paiement) throw new Error('Paiement introuvable.')
  const { situation } = situationEleve(paiement.inscription_id)
  return documentRecu(
    etablissement(),
    paiement,
    situation,
    lireParametre('recu.mentions_legales', ''),
    true
  )
}

export function htmlListeClasse(classeId: number, colonnesVides = 0): string {
  const classe = base()
    .prepare(
      `SELECT c.*, n.libelle AS niveau_libelle,
              CASE WHEN t.id IS NULL THEN NULL ELSE t.nom || ' ' || t.prenom END AS titulaire_nom
       FROM classe c JOIN niveau n ON n.id = c.niveau_id
       LEFT JOIN enseignant t ON t.id = c.titulaire_id WHERE c.id = ?`
    )
    .get(classeId) as any
  if (!classe) throw new Error('Classe introuvable.')

  const eleves = base()
    .prepare(
      `SELECT e.*, t.nom || ' ' || COALESCE(t.prenom, '') AS tuteur_nom, t.telephone AS tuteur_telephone
       FROM inscription i JOIN eleve e ON e.id = i.eleve_id
       LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
       LEFT JOIN tuteur t ON t.id = et.tuteur_id
       WHERE i.classe_id = ? AND i.statut = 'INSCRIT'
       ORDER BY e.nom, e.prenom`
    )
    .all(classeId) as any[]

  return documentListeClasse(
    etablissement(),
    classe,
    eleves,
    exigerAnneeActive().libelle,
    colonnesVides
  )
}

export function htmlFeuilleAppel(classeId: number, mois: string): string {
  const classe = base().prepare('SELECT libelle FROM classe WHERE id = ?').get(classeId) as {
    libelle: string
  }
  const eleves = feuilleAppel(classeId, `${mois}-01`, 'MATIN')
  return documentFeuilleAppel(etablissement(), classe.libelle, eleves, `Mois de ${mois}`)
}

export async function htmlBadgesEnseignants(enseignantIds: number[]): Promise<string> {
  const enseignants = enseignantIds.length
    ? (base()
        .prepare(
          `SELECT nom, prenom, matricule, code_pointage, photo FROM enseignant
           WHERE id IN (${enseignantIds.map(() => '?').join(',')})`
        )
        .all(...enseignantIds) as any[])
    : (base()
        .prepare("SELECT nom, prenom, matricule, code_pointage, photo FROM enseignant WHERE statut = 'ACTIF'")
        .all() as any[])
  return documentBadges(etablissement(), enseignants)
}

export function htmlFicheEleve(eleveId: number): string {
  const donnees = lireEleve(eleveId)
  if (!donnees) throw new Error('Eleve introuvable.')
  const inscriptionCourante = donnees.inscriptions.find(
    (i) => i.annee_id === exigerAnneeActive().id
  )
  const situation = inscriptionCourante ? situationEleve(inscriptionCourante.id).situation : null
  return documentFicheEleve(
    etablissement(),
    donnees.eleve,
    donnees.tuteurs,
    donnees.inscriptions,
    situation
  )
}

export function htmlEtatImpayes(classeId: number | null): string {
  const anneeId = exigerAnneeActive().id
  const lignes = base()
    .prepare(
      `SELECT e.matricule, e.nom || ' ' || e.prenom AS nom_complet, c.libelle AS classe,
              t.telephone AS telephone,
              COALESCE((SELECT SUM(ef.montant_du - ef.remise) FROM eleve_frais ef WHERE ef.inscription_id = i.id), 0) AS du,
              COALESCE((SELECT SUM(p.montant) FROM paiement p WHERE p.inscription_id = i.id AND p.annule = 0), 0) AS paye
       FROM inscription i
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
       LEFT JOIN tuteur t ON t.id = et.tuteur_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT' AND (? IS NULL OR i.classe_id = ?)
       ORDER BY c.libelle, e.nom`
    )
    .all(anneeId, classeId, classeId) as any[]

  const avecSolde = lignes
    .map((l) => ({ ...l, solde: l.du - l.paye }))
    .filter((l) => l.solde > 0)

  return documentTableau(
    etablissement(),
    'Etat des impayes',
    `Annee scolaire ${exigerAnneeActive().libelle}`,
    [
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'nom_complet', libelle: 'Nom et prenom' },
      { cle: 'classe', libelle: 'Classe' },
      { cle: 'telephone', libelle: 'Telephone tuteur' },
      { cle: 'du', libelle: 'Montant du', type: 'montant' },
      { cle: 'paye', libelle: 'Verse', type: 'montant' },
      { cle: 'solde', libelle: 'Solde', type: 'montant' }
    ],
    avecSolde,
    {
      nom_complet: `${avecSolde.length} eleve(s)`,
      du: avecSolde.reduce((s, l) => s + l.du, 0),
      paye: avecSolde.reduce((s, l) => s + l.paye, 0),
      solde: avecSolde.reduce((s, l) => s + l.solde, 0)
    }
  )
}

export function htmlJournalCaisse(dateDebut: string, dateFin: string): string {
  const lignes = base()
    .prepare(
      `SELECT p.numero_recu, p.date_paiement, e.nom || ' ' || e.prenom AS eleve, c.libelle AS classe,
              p.mode, p.montant, u.nom_complet AS caissier
       FROM paiement p
       JOIN inscription i ON i.id = p.inscription_id
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       LEFT JOIN utilisateur u ON u.id = p.encaisse_par
       WHERE p.date_paiement BETWEEN ? AND ? AND p.annule = 0
       ORDER BY p.date_paiement, p.id`
    )
    .all(dateDebut, dateFin) as any[]

  return documentTableau(
    etablissement(),
    'Journal de caisse',
    `Du ${formaterDate(dateDebut)} au ${formaterDate(dateFin)}`,
    [
      { cle: 'numero_recu', libelle: 'N° recu' },
      { cle: 'date_paiement', libelle: 'Date', type: 'date' },
      { cle: 'eleve', libelle: 'Eleve' },
      { cle: 'classe', libelle: 'Classe' },
      { cle: 'mode', libelle: 'Mode' },
      { cle: 'caissier', libelle: 'Encaisse par' },
      { cle: 'montant', libelle: 'Montant', type: 'montant' }
    ],
    lignes,
    { eleve: `${lignes.length} operation(s)`, montant: lignes.reduce((s, l) => s + l.montant, 0) }
  )
}

export function htmlEtatPaie(mois: number, annee: number): string {
  const etat = etatPaieMois(mois, annee)
  const libelleMois = new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  })

  return documentTableau(
    etablissement(),
    'Etat de paie du personnel enseignant',
    `Mois de ${libelleMois}`,
    [
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'enseignant_nom', libelle: 'Nom et prenom' },
      { cle: 'heures_faites', libelle: 'H. faites', type: 'nombre' },
      { cle: 'jours_absence', libelle: 'J. abs.', type: 'nombre' },
      { cle: 'salaire_base', libelle: 'Base', type: 'montant' },
      { cle: 'total_primes', libelle: 'Primes', type: 'montant' },
      { cle: 'total_retenues', libelle: 'Retenues', type: 'montant' },
      { cle: 'net_a_payer', libelle: 'Net a payer', type: 'montant' },
      { cle: 'statut', libelle: 'Statut' }
    ],
    etat.lignes as unknown as Record<string, unknown>[],
    {
      enseignant_nom: `${etat.lignes.length} agent(s)`,
      salaire_base: etat.total_brut,
      total_primes: etat.total_primes,
      total_retenues: etat.total_retenues,
      net_a_payer: etat.total_net
    }
  )
}

export function htmlRapportTutelle(): string {
  const rapport = rapportTutelle()
  return documentTableau(
    etablissement(),
    'Etat statistique de l etablissement',
    `Annee scolaire ${rapport.annee} — ratio ${rapport.encadrement.ratio_eleves_enseignant} eleves par enseignant`,
    [
      { cle: 'niveau', libelle: 'Niveau' },
      { cle: 'cycle', libelle: 'Cycle' },
      { cle: 'classes', libelle: 'Classes', type: 'nombre' },
      { cle: 'garcons', libelle: 'Garcons', type: 'nombre' },
      { cle: 'filles', libelle: 'Filles', type: 'nombre' },
      { cle: 'total', libelle: 'Total', type: 'nombre' },
      { cle: 'redoublants', libelle: 'Redoublants', type: 'nombre' },
      { cle: 'abandons', libelle: 'Abandons', type: 'nombre' }
    ],
    rapport.effectifs,
    {
      niveau: 'TOTAL',
      classes: rapport.totaux.classes,
      garcons: rapport.totaux.garcons,
      filles: rapport.totaux.filles,
      total: rapport.totaux.total,
      redoublants: rapport.totaux.redoublants,
      abandons: rapport.totaux.abandons
    }
  )
}

export function htmlPalmares(
  periodeId: number,
  lignes: { rang: number; nom_complet: string; classe_libelle: string; moyenne: number }[]
): string {
  const periode = base().prepare('SELECT libelle FROM periode WHERE id = ?').get(periodeId) as {
    libelle: string
  }
  return documentTableau(
    etablissement(),
    'Palmares',
    `${periode?.libelle ?? ''} — annee ${exigerAnneeActive().libelle}`,
    [
      { cle: 'rang', libelle: 'Rang', type: 'nombre' },
      { cle: 'nom_complet', libelle: 'Nom et prenom' },
      { cle: 'classe_libelle', libelle: 'Classe' },
      { cle: 'moyenne', libelle: 'Moyenne /20', type: 'nombre' }
    ],
    lignes as unknown as Record<string, unknown>[]
  )
}
