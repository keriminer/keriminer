import { base } from '../db'
import type { Enseignant } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { majPartielle } from './structure'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { normaliserTelephone, sansAccents } from '@shared/format'
import { lireParametre } from './etablissement'

export function listerEnseignants(filtre: { recherche?: string; statut?: string } = {}): Enseignant[] {
  const lignes = base()
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM classe_matiere cm
                 JOIN classe c ON c.id = cm.classe_id
                 WHERE cm.enseignant_id = e.id AND c.annee_id = ?) AS nb_attributions,
              (SELECT COALESCE(SUM(cm.volume_horaire), 0) FROM classe_matiere cm
                 JOIN classe c ON c.id = cm.classe_id
                 WHERE cm.enseignant_id = e.id AND c.annee_id = ?) AS heures_semaine
       FROM enseignant e
       WHERE (? = '' OR e.statut = ?)
       ORDER BY e.nom, e.prenom`
    )
    .all(
      exigerAnneeActive().id,
      exigerAnneeActive().id,
      filtre.statut ?? '',
      filtre.statut ?? ''
    ) as Enseignant[]

  if (filtre.recherche?.trim()) {
    const termes = sansAccents(filtre.recherche).split(/\s+/).filter(Boolean)
    return lignes.filter((e) => {
      const cible = sansAccents(`${e.nom} ${e.prenom} ${e.matricule} ${e.specialite ?? ''} ${e.telephone}`)
      return termes.every((t) => cible.includes(t))
    })
  }
  return lignes
}

export function lireEnseignant(id: number): Enseignant | null {
  return (base().prepare('SELECT * FROM enseignant WHERE id = ?').get(id) as Enseignant) ?? null
}

function genererMatriculeEnseignant(): string {
  const dernier = base()
    .prepare("SELECT matricule FROM enseignant WHERE matricule LIKE 'ENS-%' ORDER BY matricule DESC LIMIT 1")
    .get() as { matricule: string } | undefined
  const sequence = dernier ? Number(dernier.matricule.split('-').pop()) + 1 : 1
  return `ENS-${String(sequence).padStart(3, '0')}`
}

/** Code porte par le badge QR de pointage. Court, unique, non devinable. */
function genererCodePointage(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  do {
    code = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  } while (base().prepare('SELECT id FROM enseignant WHERE code_pointage = ?').get(code))
  return code
}

export function creerEnseignant(donnees: Partial<Enseignant> & { nom: string; prenom: string }): number {
  if (!donnees.telephone) throw new Error('Le numero de telephone est obligatoire.')
  const indicatif = lireParametre('sms.indicatif_pays', '257')
  const r = base()
    .prepare(
      `INSERT INTO enseignant (matricule, nom, prenom, sexe, date_naissance, telephone, telephone2,
         email, adresse, photo, diplome, specialite, date_embauche, type_contrat, statut,
         salaire_base, taux_horaire, numero_compte, numero_mobile_money, code_pointage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      donnees.matricule?.trim() || genererMatriculeEnseignant(),
      donnees.nom.trim(),
      donnees.prenom.trim(),
      donnees.sexe ?? 'M',
      donnees.date_naissance ?? null,
      normaliserTelephone(donnees.telephone, indicatif),
      donnees.telephone2 ? normaliserTelephone(donnees.telephone2, indicatif) : null,
      donnees.email ?? null,
      donnees.adresse ?? null,
      donnees.photo ?? null,
      donnees.diplome ?? null,
      donnees.specialite ?? null,
      donnees.date_embauche ?? null,
      donnees.type_contrat ?? 'PERMANENT',
      donnees.statut ?? 'ACTIF',
      donnees.salaire_base ?? 0,
      donnees.taux_horaire ?? 0,
      donnees.numero_compte ?? null,
      donnees.numero_mobile_money ?? null,
      genererCodePointage()
    )

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'CREATION_ENSEIGNANT',
    'enseignant',
    Number(r.lastInsertRowid)
  )
  return Number(r.lastInsertRowid)
}

export function modifierEnseignant(id: number, donnees: Partial<Enseignant>): void {
  const indicatif = lireParametre('sms.indicatif_pays', '257')
  if (donnees.telephone) donnees.telephone = normaliserTelephone(donnees.telephone, indicatif)
  majPartielle('enseignant', id, donnees, ['id', 'code_pointage'])
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'MODIFICATION_ENSEIGNANT',
    'enseignant',
    id
  )
}

export function supprimerEnseignant(id: number): void {
  const attributions = base()
    .prepare('SELECT COUNT(*) n FROM classe_matiere WHERE enseignant_id = ?')
    .get(id) as { n: number }
  if (attributions.n > 0) {
    throw new Error(
      "Cet enseignant a des matieres attribuees. Retirez ses attributions ou passez son statut a « Inactif »."
    )
  }
  base().prepare('DELETE FROM enseignant WHERE id = ?').run(id)
}

export function regenererCodePointage(id: number): string {
  const code = genererCodePointage()
  base().prepare('UPDATE enseignant SET code_pointage = ? WHERE id = ?').run(code, id)
  return code
}

/** Charge de travail hebdomadaire, pour reperer les sur- et sous-charges. */
export function chargeEnseignants(): {
  id: number
  nom_complet: string
  heures_semaine: number
  nb_classes: number
  nb_matieres: number
}[] {
  return base()
    .prepare(
      `SELECT e.id, e.nom || ' ' || e.prenom AS nom_complet,
              COALESCE(SUM(cm.volume_horaire), 0) AS heures_semaine,
              COUNT(DISTINCT cm.classe_id) AS nb_classes,
              COUNT(DISTINCT cm.matiere_id) AS nb_matieres
       FROM enseignant e
       LEFT JOIN classe_matiere cm ON cm.enseignant_id = e.id
       LEFT JOIN classe c ON c.id = cm.classe_id AND c.annee_id = ?
       WHERE e.statut = 'ACTIF'
       GROUP BY e.id
       ORDER BY heures_semaine DESC`
    )
    .all(exigerAnneeActive().id) as any[]
}
