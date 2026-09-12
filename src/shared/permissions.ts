/**
 * Controle d’acces base sur les roles.
 *
 * Une permission s’ecrit `domaine.action`. Le caractere `*` est un joker :
 * `finance.*` accorde toutes les actions du domaine finance, `*` accorde tout.
 * La verification est faite cote processus principal (source de verite) ET
 * cote interface (pour masquer ce qui est inaccessible).
 */

export const ROLES = [
  { code: 'SUPER_ADMIN', libelle: 'Administrateur système' },
  { code: 'DIRECTEUR', libelle: 'Directeur / Préfet des études' },
  { code: 'SECRETAIRE', libelle: 'Secrétaire' },
  { code: 'COMPTABLE', libelle: 'Comptable / Économe' },
  { code: 'SURVEILLANT', libelle: 'Surveillant / Discipline' },
  { code: 'ENSEIGNANT', libelle: 'Enseignant' },
  { code: 'INTENDANT', libelle: 'Intendant internat' }
] as const

export type RoleCode = (typeof ROLES)[number]['code']

export const PERMISSIONS_PAR_ROLE: Record<RoleCode, string[]> = {
  SUPER_ADMIN: ['*'],
  DIRECTEUR: [
    'tableau_bord.*', 'élève.*', 'enseignant.*', 'classe.*', 'matière.*',
    'note.*', 'bulletin.*', 'présence.*', 'pointage.*', 'finance.lecture',
    'finance.rapport', 'paie.*', 'sms.*', 'internat.*', 'activité.*',
    'statistique.*', 'année.*', 'paramètre.*', 'utilisateur.*', 'audit.lecture'
  ],
  SECRETAIRE: [
    'tableau_bord.lecture', 'élève.*', 'classe.lecture', 'classe.ecriture',
    'enseignant.lecture', 'matiere.lecture', 'note.lecture', 'bulletin.lecture',
    'bulletin.imprimer', 'presence.lecture', 'sms.envoyer', 'statistique.lecture',
    'activite.lecture'
  ],
  COMPTABLE: [
    'tableau_bord.lecture', 'eleve.lecture', 'classe.lecture', 'finance.*',
    'paie.*', 'sms.envoyer', 'statistique.lecture', 'internat.lecture'
  ],
  SURVEILLANT: [
    'tableau_bord.lecture', 'eleve.lecture', 'classe.lecture', 'présence.*',
    'pointage.*', 'sms.envoyer', 'statistique.lecture'
  ],
  ENSEIGNANT: [
    'tableau_bord.lecture', 'eleve.lecture', 'classe.lecture',
    'note.lecture', 'note.ecriture', 'presence.lecture', 'presence.ecriture',
    'bulletin.lecture', 'activite.lecture'
  ],
  INTENDANT: [
    'tableau_bord.lecture', 'eleve.lecture', 'internat.*', 'presence.lecture',
    'statistique.lecture'
  ]
}

/** Verifie qu’une liste de permissions accordees couvre la permission demandee. */
export function aLaPermission(accordees: string[], demandee: string): boolean {
  if (accordees.includes('*')) return true
  if (accordees.includes(demandee)) return true
  const domaine = demandee.split('.')[0]
  return accordees.includes(`${domaine}.*`)
}

export function permissionsDuRole(role: string): string[] {
  return PERMISSIONS_PAR_ROLE[role as RoleCode] ?? []
}
