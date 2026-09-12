import { base } from '../db'
import { encaisserPaiement } from './finances'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { exigerAnneeActive } from './annee'

/**
 * Rapprochement des paiements par mobile money.
 *
 * La realite du terrain : la plupart des ecoles n’ont pas d’API marchand. Le
 * parent paie sur le numero de l’ecole et l’operateur envoie un SMS de
 * confirmation. Le module accepte donc trois voies, de la plus simple a la plus
 * automatisee :
 *   1. saisie de la reference du SMS par le caissier ;
 *   2. import d’un relevé (CSV) fourni par l’operateur ;
 *   3. connecteur API pour les operateurs qui en proposent un.
 *
 * Dans tous les cas, une transaction n’est convertie en recu qu’apres
 * rapprochement explicite avec un eleve : aucun encaissement fantome.
 */

export interface TransactionMobileMoney {
  id: number
  operateur: string
  reference: string
  telephone: string | null
  montant: number
  date_transaction: string
  statut: string
  inscription_id: number | null
  paiement_id: number | null
  eleve_nom?: string | null
  suggestion_inscription_id?: number | null
  suggestion_eleve?: string | null
}

export function listerTransactions(statut = ''): TransactionMobileMoney[] {
  const lignes = base()
    .prepare(
      `SELECT t.*, e.nom || ' ' || e.prenom AS eleve_nom
       FROM transaction_mobile_money t
       LEFT JOIN inscription i ON i.id = t.inscription_id
       LEFT JOIN eleve e ON e.id = i.eleve_id
       WHERE (? = '' OR t.statut = ?)
       ORDER BY t.date_transaction DESC, t.id DESC LIMIT 500`
    )
    .all(statut, statut) as TransactionMobileMoney[]

  // Suggestion de rapprochement : le numero du payeur correspond souvent au
  // telephone d’un tuteur enregistre. On propose, l’humain valide.
  return lignes.map((t) => {
    if (t.inscription_id || !t.telephone) return t
    const suggestion = base()
      .prepare(
        `SELECT i.id AS inscription_id, e.nom || ' ' || e.prenom AS eleve
         FROM tuteur tu
         JOIN eleve_tuteur et ON et.tuteur_id = tu.id
         JOIN eleve e ON e.id = et.eleve_id
         JOIN inscription i ON i.eleve_id = e.id AND i.annee_id = ?
         WHERE replace(tu.telephone, '+', '') LIKE ?
         LIMIT 1`
      )
      .get(exigerAnneeActive().id, `%${t.telephone.replace(/\D/g, '').slice(-8)}%`) as
      | { inscription_id: number; eleve: string }
      | undefined
    return {
      ...t,
      suggestion_inscription_id: suggestion?.inscription_id ?? null,
      suggestion_eleve: suggestion?.eleve ?? null
    }
  })
}

export function enregistrerTransaction(donnees: {
  operateur: string
  reference: string
  telephone?: string | null
  montant: number
  date_transaction: string
  brut?: string | null
}): number {
  const existante = base()
    .prepare('SELECT id FROM transaction_mobile_money WHERE operateur = ? AND reference = ?')
    .get(donnees.operateur, donnees.reference)
  if (existante) throw new Error(`La reference ${donnees.reference} a deja ete enregistree.`)

  const r = base()
    .prepare(
      `INSERT INTO transaction_mobile_money (operateur, reference, telephone, montant, date_transaction, brut)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      donnees.operateur, donnees.reference.trim(), donnees.telephone ?? null,
      Math.round(donnees.montant), donnees.date_transaction, donnees.brut ?? null
    )
  return Number(r.lastInsertRowid)
}

/** Import d’un releve operateur. Les doublons sont ignores silencieusement. */
export function importerReleve(
  operateur: string,
  lignes: { reference: string; telephone?: string; montant: number; date: string }[]
): { importees: number; doublons: number; erreurs: number } {
  let importees = 0
  let doublons = 0
  let erreurs = 0
  for (const ligne of lignes) {
    try {
      enregistrerTransaction({
        operateur,
        reference: ligne.reference,
        telephone: ligne.telephone ?? null,
        montant: ligne.montant,
        date_transaction: ligne.date
      })
      importees++
    } catch (erreur) {
      if ((erreur as Error).message.includes('deja ete enregistree')) doublons++
      else erreurs++
    }
  }
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'IMPORT_RELEVE_MOBILE_MONEY',
    'transaction_mobile_money',
    null,
    { operateur, importees, doublons, erreurs }
  )
  return { importees, doublons, erreurs }
}

/** Rapproche une transaction d’un eleve et genere le recu correspondant. */
export function rapprocherTransaction(
  transactionId: number,
  inscriptionId: number
): { paiement_id: number; numero_recu: string } {
  const transaction = base()
    .prepare('SELECT * FROM transaction_mobile_money WHERE id = ?')
    .get(transactionId) as TransactionMobileMoney | undefined
  if (!transaction) throw new Error('Transaction introuvable.')
  if (transaction.statut === 'RAPPROCHE') throw new Error('Cette transaction est deja rapprochee.')

  const paiement = encaisserPaiement({
    inscription_id: inscriptionId,
    montant: transaction.montant,
    date_paiement: transaction.date_transaction.slice(0, 10),
    mode: 'MOBILE_MONEY',
    operateur: transaction.operateur,
    reference: transaction.reference,
    observation: 'Rapprochement mobile money'
  })

  base()
    .prepare(
      "UPDATE transaction_mobile_money SET statut = 'RAPPROCHE', inscription_id = ?, paiement_id = ? WHERE id = ?"
    )
    .run(inscriptionId, paiement.paiement_id, transactionId)

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'RAPPROCHEMENT_MOBILE_MONEY',
    'transaction_mobile_money',
    transactionId,
    { inscription_id: inscriptionId, recu: paiement.numero_recu }
  )
  return paiement
}

export function rejeterTransaction(transactionId: number, motif: string): void {
  base()
    .prepare("UPDATE transaction_mobile_money SET statut = 'REJETE', brut = COALESCE(brut, '') || ? WHERE id = ?")
    .run(` | rejet: ${motif}`, transactionId)
}

/**
 * Extrait reference, montant et numero d’un SMS d’operateur colle par le
 * caissier. Les formats varient, on reste donc tolerant : on cherche des
 * motifs plutot qu’une structure figee.
 */
export function analyserSmsOperateur(texte: string): {
  reference: string | null
  montant: number | null
  telephone: string | null
} {
  const reference =
    texte.match(/\b(?:ref|reference|txn|transaction|id)[\s:.]*([A-Z0-9]{6,})/i)?.[1] ??
    texte.match(/\b([A-Z]{2}\d{6,})\b/)?.[1] ??
    null

  const montantBrut = texte.match(/(\d[\d\s.,]{2,})\s*(?:BIF|FBu|FC|FCFA|RWF|USD|KES|UGX|TZS)/i)?.[1]
  const montant = montantBrut ? Number(montantBrut.replace(/[\s.,]/g, '')) : null

  const telephone = texte.match(/(?:\+?\d{1,3})?[\s-]?(\d{8,12})/)?.[1] ?? null

  return { reference, montant, telephone }
}
