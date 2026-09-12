import { base } from '../db'
import type { MessageSms } from '@shared/types'
import { lireEtablissement, lireParametre } from './etablissement'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { compterSms, formaterDate, formaterMontant, normaliserTelephone } from '@shared/format'

/**
 * Messagerie SMS aux parents.
 *
 * Principe directeur : l’application ne depend jamais du reseau pour
 * fonctionner. Un SMS est TOUJOURS d’abord ecrit dans une file d’attente
 * locale ; l’envoi reel est une seconde etape, declenchee manuellement ou
 * automatiquement quand une connexion est disponible. Une coupure d’internet
 * ne fait donc jamais perdre un message.
 */

/* ------------------------------- Modeles --------------------------------- */

export interface ModeleSms {
  id: number
  code: string
  libelle: string
  contenu: string
  actif: number
  automatique: number
}

export function listerModeles(): ModeleSms[] {
  return base().prepare('SELECT * FROM modele_sms ORDER BY libelle').all() as ModeleSms[]
}

export function enregistrerModele(donnees: Partial<ModeleSms> & { code: string; contenu: string }): void {
  base()
    .prepare(
      `INSERT INTO modele_sms (code, libelle, contenu, actif, automatique) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (code) DO UPDATE SET libelle = excluded.libelle, contenu = excluded.contenu,
         actif = excluded.actif, automatique = excluded.automatique`
    )
    .run(
      donnees.code, donnees.libelle ?? donnees.code, donnees.contenu,
      donnees.actif ?? 1, donnees.automatique ?? 0
    )
}

export function supprimerModele(id: number): void {
  base().prepare('DELETE FROM modele_sms WHERE id = ?').run(id)
}

/** Remplace les variables `{{...}}` par leurs valeurs. */
export function appliquerVariables(gabarit: string, variables: Record<string, string>): string {
  return gabarit.replace(/\{\{(\w+)\}\}/g, (_, cle: string) => variables[cle] ?? '')
}

/** Variables communes a tous les messages d’un eleve donne. */
function variablesEleve(eleveId: number): Record<string, string> {
  const etablissement = lireEtablissement()
  const ligne = base()
    .prepare(
      `SELECT e.nom || ' ' || e.prenom AS eleve, c.libelle AS classe,
              t.nom || ' ' || COALESCE(t.prenom, '') AS tuteur, t.telephone
       FROM eleve e
       LEFT JOIN inscription i ON i.eleve_id = e.id AND i.annee_id = (SELECT id FROM annee_scolaire WHERE active = 1)
       LEFT JOIN classe c ON c.id = i.classe_id
       LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
       LEFT JOIN tuteur t ON t.id = et.tuteur_id
       WHERE e.id = ?`
    )
    .get(eleveId) as any

  return {
    eleve: ligne?.eleve ?? '',
    classe: ligne?.classe ?? '',
    tuteur: (ligne?.tuteur ?? '').trim(),
    ecole: etablissement?.sigle || etablissement?.nom || 'Ecole',
    telephone_ecole: etablissement?.telephone ?? '',
    date: formaterDate(new Date().toISOString())
  }
}

/* ----------------------------- File d’attente ---------------------------- */

export function programmerSms(
  destinataire: string,
  telephone: string,
  contenu: string,
  contexte?: { type: string; id: number }
): number | null {
  const numero = normaliserTelephone(telephone, lireParametre('sms.indicatif_pays', '257'))
  if (!numero || numero.length < 8) return null
  const r = base()
    .prepare(
      `INSERT INTO message_sms (destinataire, telephone, contenu, contexte_type, contexte_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(destinataire, numero, contenu, contexte?.type ?? null, contexte?.id ?? null)
  return Number(r.lastInsertRowid)
}

/**
 * Met en file d’attente un message construit a partir d’un modele, adresse au
 * tuteur principal d’un eleve. Renvoie `null` si le tuteur n’a pas de numero ou
 * a refuse les SMS : c’est un cas normal, pas une erreur.
 */
export function fileAttenteDepuisModele(
  codeModele: string,
  eleveId: number,
  variablesSupplementaires: Record<string, string> = {}
): number | null {
  const modele = base()
    .prepare('SELECT * FROM modele_sms WHERE code = ? AND actif = 1')
    .get(codeModele) as ModeleSms | undefined
  if (!modele) return null

  const tuteur = base()
    .prepare(
      `SELECT t.* FROM tuteur t JOIN eleve_tuteur et ON et.tuteur_id = t.id
       WHERE et.eleve_id = ? AND t.recevoir_sms = 1
       ORDER BY et.principal DESC LIMIT 1`
    )
    .get(eleveId) as { id: number; nom: string; prenom: string | null; telephone: string } | undefined
  if (!tuteur) return null

  const etablissement = lireEtablissement()
  const variables = { ...variablesEleve(eleveId), ...variablesSupplementaires }
  if (variables.montant) variables.montant = formaterMontant(Number(variables.montant), etablissement?.devise_code)
  if (variables.reste) variables.reste = formaterMontant(Number(variables.reste), etablissement?.devise_code)

  return programmerSms(
    `${tuteur.nom} ${tuteur.prenom ?? ''}`.trim(),
    tuteur.telephone,
    appliquerVariables(modele.contenu, variables),
    { type: 'eleve', id: eleveId }
  )
}

/** Campagne : un meme modele adresse a une liste d’eleves. */
export function programmerCampagne(
  codeModele: string,
  eleveIds: number[],
  variablesSupplementaires: Record<string, string> = {}
): { programmes: number; ignores: number } {
  let programmes = 0
  let ignores = 0
  const transaction = base().transaction(() => {
    for (const eleveId of eleveIds) {
      const id = fileAttenteDepuisModele(codeModele, eleveId, variablesSupplementaires)
      if (id) programmes++
      else ignores++
    }
  })
  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'CAMPAGNE_SMS',
    'message_sms',
    null,
    { modele: codeModele, programmes, ignores }
  )
  return { programmes, ignores }
}

/** Relance de tous les eleves dont le solde depasse un seuil. */
export function programmerRelanceImpayes(seuil = 1): { programmes: number; ignores: number } {
  const impayes = base()
    .prepare(
      `SELECT i.eleve_id,
              (COALESCE((SELECT SUM(ef.montant_du - ef.remise) FROM eleve_frais ef WHERE ef.inscription_id = i.id), 0)
               - COALESCE((SELECT SUM(p.montant) FROM paiement p WHERE p.inscription_id = i.id AND p.annule = 0), 0)) AS solde
       FROM inscription i
       WHERE i.annee_id = (SELECT id FROM annee_scolaire WHERE active = 1) AND i.statut = 'INSCRIT'`
    )
    .all() as { eleve_id: number; solde: number }[]

  const etablissement = lireEtablissement()
  let programmes = 0
  let ignores = 0
  const transaction = base().transaction(() => {
    for (const ligne of impayes.filter((l) => l.solde >= seuil)) {
      const id = fileAttenteDepuisModele('RAPPEL_IMPAYE', ligne.eleve_id, {
        reste: formaterMontant(ligne.solde, etablissement?.devise_code)
      })
      if (id) programmes++
      else ignores++
    }
  })
  transaction()
  return { programmes, ignores }
}

export function listerMessages(filtre: { statut?: string; limite?: number } = {}): MessageSms[] {
  return base()
    .prepare(
      `SELECT * FROM message_sms WHERE (? = '' OR statut = ?)
       ORDER BY id DESC LIMIT ?`
    )
    .all(filtre.statut ?? '', filtre.statut ?? '', filtre.limite ?? 300) as MessageSms[]
}

export function statistiquesSms(): { en_attente: number; envoyes: number; echecs: number; cout_total: number } {
  return base()
    .prepare(
      `SELECT
         SUM(CASE WHEN statut = 'EN_ATTENTE' THEN 1 ELSE 0 END) AS en_attente,
         SUM(CASE WHEN statut = 'ENVOYE' THEN 1 ELSE 0 END) AS envoyes,
         SUM(CASE WHEN statut = 'ECHEC' THEN 1 ELSE 0 END) AS echecs,
         COALESCE(SUM(cout), 0) AS cout_total
       FROM message_sms`
    )
    .get() as any
}

export function supprimerMessage(id: number): void {
  base().prepare("DELETE FROM message_sms WHERE id = ? AND statut != 'ENVOYE'").run(id)
}

export function reprogrammerEchecs(): number {
  const r = base()
    .prepare("UPDATE message_sms SET statut = 'EN_ATTENTE', erreur = NULL WHERE statut = 'ECHEC'")
    .run()
  return r.changes
}

/* ------------------------------ Envoi reel ------------------------------- */

/**
 * Vide la file d’attente via la passerelle configuree.
 *
 * Chaque message est marque individuellement : un echec sur un numero n’empeche
 * pas les suivants de partir. Les echecs restent dans la file et peuvent etre
 * reprogrammes d’un clic.
 */
export async function envoyerFileAttente(limite = 50): Promise<{
  envoyes: number
  echecs: number
  details: string[]
}> {
  const passerelle = lireParametre('sms.passerelle', 'AUCUNE')
  if (passerelle === 'AUCUNE') {
    throw new Error(
      "Aucune passerelle SMS n’est configuree. Allez dans Parametres > SMS pour en choisir une."
    )
  }

  const messages = base()
    .prepare("SELECT * FROM message_sms WHERE statut = 'EN_ATTENTE' ORDER BY id LIMIT ?")
    .all(limite) as MessageSms[]

  const marquerEnvoye = base().prepare(
    `UPDATE message_sms SET statut = 'ENVOYE', date_envoi = datetime('now','localtime'),
       tentatives = tentatives + 1, reference = ?, cout = ? WHERE id = ?`
  )
  const marquerEchec = base().prepare(
    `UPDATE message_sms SET statut = 'ECHEC', tentatives = tentatives + 1, erreur = ? WHERE id = ?`
  )

  let envoyes = 0
  let echecs = 0
  const details: string[] = []

  for (const message of messages) {
    try {
      const reference = await envoyerViaPasserelle(passerelle, message.telephone, message.contenu)
      marquerEnvoye.run(reference, compterSms(message.contenu), message.id)
      envoyes++
    } catch (erreur) {
      const texte = (erreur as Error).message
      marquerEchec.run(texte, message.id)
      echecs++
      if (details.length < 5) details.push(`${message.telephone} : ${texte}`)
    }
  }

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'ENVOI_SMS',
    'message_sms',
    null,
    { envoyes, echecs, passerelle }
  )
  return { envoyes, echecs, details }
}

/**
 * Adaptateurs de passerelle. Chacun renvoie la reference du message chez
 * l’operateur, ou leve une erreur explicite en francais.
 */
async function envoyerViaPasserelle(
  passerelle: string,
  telephone: string,
  contenu: string
): Promise<string> {
  const expediteur = lireParametre('sms.expediteur', '')
  const cle = lireParametre('sms.cle_api', '')
  const identifiant = lireParametre('sms.identifiant', '')
  const url = lireParametre('sms.url', '')

  switch (passerelle) {
    case 'HTTP_GENERIQUE': {
      // Passerelle d’un operateur local : l’URL contient des jetons remplaces ici.
      if (!url) throw new Error("L’adresse de la passerelle n’est pas renseignee.")
      const adresse = url
        .replace('{telephone}', encodeURIComponent(telephone))
        .replace('{message}', encodeURIComponent(contenu))
        .replace('{expediteur}', encodeURIComponent(expediteur))
        .replace('{cle}', encodeURIComponent(cle))
      const reponse = await fetch(adresse)
      if (!reponse.ok) throw new Error(`Passerelle HTTP : code ${reponse.status}`)
      return (await reponse.text()).slice(0, 120)
    }

    case 'TWILIO': {
      if (!identifiant || !cle) throw new Error('Identifiant ou jeton Twilio manquant.')
      const corps = new URLSearchParams({ To: telephone, From: expediteur, Body: contenu })
      const reponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${identifiant}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${identifiant}:${cle}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: corps
        }
      )
      const donnees = (await reponse.json()) as any
      if (!reponse.ok) throw new Error(donnees?.message ?? `Twilio : code ${reponse.status}`)
      return donnees.sid
    }

    case 'AFRICASTALKING': {
      if (!identifiant || !cle) throw new Error("Identifiant ou cle Africa’s Talking manquant.")
      const reponse = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: cle,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body: new URLSearchParams({
          username: identifiant,
          to: telephone,
          message: contenu,
          ...(expediteur ? { from: expediteur } : {})
        })
      })
      const donnees = (await reponse.json()) as any
      const recipient = donnees?.SMSMessageData?.Recipients?.[0]
      if (!recipient || recipient.statusCode >= 300) {
        throw new Error(recipient?.status ?? "Africa’s Talking : envoi refuse")
      }
      return recipient.messageId
    }

    case 'INFOBIP': {
      if (!url || !cle) throw new Error('Adresse ou cle Infobip manquante.')
      const reponse = await fetch(`${url.replace(/\/$/, '')}/sms/2/text/advanced`, {
        method: 'POST',
        headers: { Authorization: `App ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ destinations: [{ to: telephone }], from: expediteur, text: contenu }]
        })
      })
      const donnees = (await reponse.json()) as any
      if (!reponse.ok) throw new Error(donnees?.requestError?.serviceException?.text ?? 'Infobip : echec')
      return donnees?.messages?.[0]?.messageId ?? ''
    }

    case 'MODEM_GSM':
      throw new Error(
        "L’envoi par modem GSM necessite l’utilitaire SCOLIA Modem installe sur ce poste. Voir le guide d’installation."
      )

    default:
      throw new Error(`Passerelle inconnue : ${passerelle}`)
  }
}
