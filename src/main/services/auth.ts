import bcrypt from 'bcryptjs'
import { base } from '../db'
import { permissionsDuRole } from '@shared/permissions'
import type { SessionUtilisateur, Utilisateur } from '@shared/types'
import { tracer } from './journal'

let session: SessionUtilisateur | null = null

export function sessionCourante(): SessionUtilisateur | null {
  return session
}

export function exigerSession(): SessionUtilisateur {
  if (!session) throw new Error('Session expiree. Veuillez vous reconnecter.')
  return session
}

export function connecter(login: string, motDePasse: string): SessionUtilisateur {
  const ligne = base()
    .prepare('SELECT * FROM utilisateur WHERE login = ? COLLATE NOCASE')
    .get(login.trim()) as (Utilisateur & { mot_de_passe: string }) | undefined

  if (!ligne) throw new Error('Identifiant ou mot de passe incorrect.')
  if (!ligne.actif) throw new Error('Ce compte est desactive. Contactez la direction.')
  if (!bcrypt.compareSync(motDePasse, ligne.mot_de_passe)) {
    tracer(ligne.id, ligne.nom_complet, 'CONNEXION_ECHOUEE', 'utilisateur', ligne.id)
    throw new Error('Identifiant ou mot de passe incorrect.')
  }

  base()
    .prepare("UPDATE utilisateur SET dernier_login = datetime('now','localtime') WHERE id = ?")
    .run(ligne.id)

  const { mot_de_passe: _ignore, ...utilisateur } = ligne
  session = { utilisateur: utilisateur as Utilisateur, permissions: permissionsDuRole(ligne.role) }
  tracer(ligne.id, ligne.nom_complet, 'CONNEXION', 'utilisateur', ligne.id)
  return session
}

export function deconnecter(): void {
  if (session) tracer(session.utilisateur.id, session.utilisateur.nom_complet, 'DECONNEXION')
  session = null
}

export function listerUtilisateurs(): Utilisateur[] {
  return base()
    .prepare(
      `SELECT id, login, nom_complet, role, actif, telephone, email, enseignant_id,
              dernier_login, doit_changer_mdp
       FROM utilisateur ORDER BY nom_complet`
    )
    .all() as Utilisateur[]
}

export function creerUtilisateur(donnees: {
  login: string
  nom_complet: string
  mot_de_passe: string
  role: string
  telephone?: string | null
  email?: string | null
  enseignant_id?: number | null
}): number {
  if (donnees.mot_de_passe.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caracteres.')
  }
  const existant = base()
    .prepare('SELECT id FROM utilisateur WHERE login = ? COLLATE NOCASE')
    .get(donnees.login.trim())
  if (existant) throw new Error('Cet identifiant est deja utilise.')

  const resultat = base()
    .prepare(
      `INSERT INTO utilisateur (login, nom_complet, mot_de_passe, role, telephone, email, enseignant_id, doit_changer_mdp)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      donnees.login.trim(),
      donnees.nom_complet.trim(),
      bcrypt.hashSync(donnees.mot_de_passe, 10),
      donnees.role,
      donnees.telephone ?? null,
      donnees.email ?? null,
      donnees.enseignant_id ?? null
    )

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? 'systeme',
    'CREATION_UTILISATEUR',
    'utilisateur',
    Number(resultat.lastInsertRowid),
    { login: donnees.login, role: donnees.role }
  )
  return Number(resultat.lastInsertRowid)
}

export function modifierUtilisateur(
  id: number,
  donnees: Partial<{
    nom_complet: string
    role: string
    actif: number
    telephone: string | null
    email: string | null
    enseignant_id: number | null
  }>
): void {
  const champs = Object.keys(donnees)
  if (champs.length === 0) return
  const clause = champs.map((c) => `${c} = ?`).join(', ')
  base()
    .prepare(`UPDATE utilisateur SET ${clause} WHERE id = ?`)
    .run(...champs.map((c) => (donnees as Record<string, unknown>)[c]), id)

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'MODIFICATION_UTILISATEUR',
    'utilisateur',
    id,
    donnees
  )
}

export function reinitialiserMotDePasse(id: number, nouveau: string): void {
  if (nouveau.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caracteres.')
  base()
    .prepare('UPDATE utilisateur SET mot_de_passe = ?, doit_changer_mdp = 1 WHERE id = ?')
    .run(bcrypt.hashSync(nouveau, 10), id)

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'REINITIALISATION_MOT_DE_PASSE',
    'utilisateur',
    id
  )
}

export function changerSonMotDePasse(actuel: string, nouveau: string): void {
  const courante = exigerSession()
  const ligne = base()
    .prepare('SELECT mot_de_passe FROM utilisateur WHERE id = ?')
    .get(courante.utilisateur.id) as { mot_de_passe: string } | undefined
  if (!ligne || !bcrypt.compareSync(actuel, ligne.mot_de_passe)) {
    throw new Error('Mot de passe actuel incorrect.')
  }
  if (nouveau.length < 6) throw new Error('Le nouveau mot de passe doit contenir au moins 6 caracteres.')
  base()
    .prepare('UPDATE utilisateur SET mot_de_passe = ?, doit_changer_mdp = 0 WHERE id = ?')
    .run(bcrypt.hashSync(nouveau, 10), courante.utilisateur.id)
  courante.utilisateur.doit_changer_mdp = 0
  tracer(courante.utilisateur.id, courante.utilisateur.nom_complet, 'CHANGEMENT_MOT_DE_PASSE')
}

export function supprimerUtilisateur(id: number): void {
  const nbAdmins = base()
    .prepare("SELECT COUNT(*) n FROM utilisateur WHERE role = 'SUPER_ADMIN' AND actif = 1")
    .get() as { n: number }
  const cible = base().prepare('SELECT role FROM utilisateur WHERE id = ?').get(id) as
    | { role: string }
    | undefined
  if (cible?.role === 'SUPER_ADMIN' && nbAdmins.n <= 1) {
    throw new Error('Impossible de supprimer le dernier administrateur.')
  }
  base().prepare('DELETE FROM utilisateur WHERE id = ?').run(id)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'SUPPRESSION_UTILISATEUR',
    'utilisateur',
    id
  )
}
