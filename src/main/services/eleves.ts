import { base } from '../db'
import type { Eleve, Inscription, Tuteur } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { lireParametre } from './etablissement'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { majPartielle } from './structure'
import { normaliserTelephone, sansAccents } from '@shared/format'

/**
 * Genere un matricule unique.
 * Format par defaut : PREFIXE + annee sur 2 chiffres + sequence sur 4 chiffres
 * (ex. « ST25-0042 »). Le compteur repart de la plus grande valeur existante
 * pour l’annee, ce qui reste correct meme apres suppression d’une fiche.
 */
export function genererMatricule(): string {
  const prefixe = lireParametre('matricule.prefixe', '')
  const annee = exigerAnneeActive().libelle.slice(2, 4)
  const motif = `${prefixe}${annee}-%`
  const dernier = base()
    .prepare('SELECT matricule FROM eleve WHERE matricule LIKE ? ORDER BY matricule DESC LIMIT 1')
    .get(motif) as { matricule: string } | undefined
  const sequence = dernier ? Number(dernier.matricule.split('-').pop()) + 1 : 1
  return `${prefixe}${annee}-${String(sequence).padStart(4, '0')}`
}

export interface FiltreEleves {
  recherche?: string
  classe_id?: number | null
  niveau_id?: number | null
  sexe?: string | null
  statut?: string | null
  annee_id?: number | null
  sans_classe?: boolean
}

export function listerEleves(filtre: FiltreEleves = {}): Eleve[] {
  const anneeId = filtre.annee_id ?? exigerAnneeActive().id
  const conditions: string[] = ['1 = 1']
  const parametres: unknown[] = [anneeId]

  if (filtre.classe_id) {
    conditions.push('i.classe_id = ?')
    parametres.push(filtre.classe_id)
  }
  if (filtre.niveau_id) {
    conditions.push('c.niveau_id = ?')
    parametres.push(filtre.niveau_id)
  }
  if (filtre.sexe) {
    conditions.push('e.sexe = ?')
    parametres.push(filtre.sexe)
  }
  if (filtre.statut) {
    conditions.push('e.statut = ?')
    parametres.push(filtre.statut)
  }
  if (filtre.sans_classe) conditions.push('i.id IS NULL')

  const lignes = base()
    .prepare(
      `SELECT e.*, i.id AS inscription_id, i.classe_id, c.libelle AS classe_libelle,
              t.nom AS tuteur_nom_brut, t.prenom AS tuteur_prenom, t.telephone AS tuteur_telephone
       FROM eleve e
       LEFT JOIN inscription i ON i.eleve_id = e.id AND i.annee_id = ?
       LEFT JOIN classe c ON c.id = i.classe_id
       LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
       LEFT JOIN tuteur t ON t.id = et.tuteur_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.nom, e.prenom`
    )
    .all(...parametres) as any[]

  const eleves: Eleve[] = lignes.map((l) => ({
    ...l,
    tuteur_nom: l.tuteur_nom_brut ? `${l.tuteur_nom_brut} ${l.tuteur_prenom ?? ''}`.trim() : null
  }))

  // La recherche est faite en memoire pour tolerer les accents et l’ordre des mots.
  if (filtre.recherche?.trim()) {
    const termes = sansAccents(filtre.recherche).split(/\s+/).filter(Boolean)
    return eleves.filter((e) => {
      const cible = sansAccents(
        `${e.nom} ${e.prenom} ${e.matricule} ${e.classe_libelle ?? ''} ${e.tuteur_telephone ?? ''}`
      )
      return termes.every((t) => cible.includes(t))
    })
  }
  return eleves
}

export function lireEleve(id: number): {
  eleve: Eleve
  tuteurs: (Tuteur & { principal: number })[]
  inscriptions: (Inscription & { classe_libelle: string; annee_libelle: string })[]
} | null {
  const eleve = base().prepare('SELECT * FROM eleve WHERE id = ?').get(id) as Eleve | undefined
  if (!eleve) return null

  const tuteurs = base()
    .prepare(
      `SELECT t.*, et.principal FROM tuteur t
       JOIN eleve_tuteur et ON et.tuteur_id = t.id
       WHERE et.eleve_id = ? ORDER BY et.principal DESC, t.nom`
    )
    .all(id) as (Tuteur & { principal: number })[]

  const inscriptions = base()
    .prepare(
      `SELECT i.*, c.libelle AS classe_libelle, a.libelle AS annee_libelle
       FROM inscription i
       JOIN classe c ON c.id = i.classe_id
       JOIN annee_scolaire a ON a.id = i.annee_id
       WHERE i.eleve_id = ? ORDER BY a.date_debut DESC`
    )
    .all(id) as any[]

  return { eleve, tuteurs, inscriptions }
}

export interface DonneesEleve extends Omit<Partial<Eleve>, 'classe_id'> {
  nom: string
  prenom: string
  sexe: 'M' | 'F'
  classe_id?: number | null
  tuteur?: Partial<Tuteur> & { nom?: string; telephone?: string }
}

export function creerEleve(donnees: DonneesEleve): number {
  if (!donnees.nom?.trim() || !donnees.prenom?.trim()) {
    throw new Error('Le nom et le prenom sont obligatoires.')
  }
  const db = base()
  let eleveId = 0

  const transaction = db.transaction(() => {
    const matricule = donnees.matricule?.trim() || genererMatricule()
    const existant = db.prepare('SELECT id FROM eleve WHERE matricule = ?').get(matricule)
    if (existant) throw new Error(`Le matricule ${matricule} existe deja.`)

    const r = db
      .prepare(
        `INSERT INTO eleve (matricule, nom, prenom, sexe, date_naissance, lieu_naissance,
           nationalite, adresse, telephone, photo, groupe_sanguin, besoins_particuliers, ecole_provenance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        matricule,
        donnees.nom.trim(),
        donnees.prenom.trim(),
        donnees.sexe,
        donnees.date_naissance ?? null,
        donnees.lieu_naissance ?? null,
        donnees.nationalite ?? null,
        donnees.adresse ?? null,
        donnees.telephone ?? null,
        donnees.photo ?? null,
        donnees.groupe_sanguin ?? null,
        donnees.besoins_particuliers ?? null,
        donnees.ecole_provenance ?? null
      )
    eleveId = Number(r.lastInsertRowid)

    if (donnees.tuteur?.nom && donnees.tuteur.telephone) {
      rattacherTuteur(eleveId, donnees.tuteur, true)
    }
    if (donnees.classe_id) inscrire(eleveId, donnees.classe_id)
  })
  transaction()

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'CREATION_ELEVE',
    'eleve',
    eleveId,
    { nom: `${donnees.nom} ${donnees.prenom}` }
  )
  return eleveId
}

export function modifierEleve(id: number, donnees: Partial<Eleve>): void {
  majPartielle('eleve', id, donnees, [
    'id', 'date_creation', 'classe_libelle', 'classe_id', 'inscription_id',
    'tuteur_nom', 'tuteur_telephone'
  ])
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'MODIFICATION_ELEVE',
    'eleve',
    id
  )
}

export function supprimerEleve(id: number): void {
  const paiements = base()
    .prepare(
      `SELECT COUNT(*) n FROM paiement p JOIN inscription i ON i.id = p.inscription_id
       WHERE i.eleve_id = ?`
    )
    .get(id) as { n: number }
  if (paiements.n > 0) {
    throw new Error(
      "Cet eleve a des paiements enregistres. Sa suppression detruirait la comptabilite : changez plutot son statut en « Abandon » ou « Transfere »."
    )
  }
  base().prepare('DELETE FROM eleve WHERE id = ?').run(id)
  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'SUPPRESSION_ELEVE',
    'eleve',
    id
  )
}

/* --------------------------------- Tuteurs ------------------------------- */

export function rattacherTuteur(
  eleveId: number,
  donnees: Partial<Tuteur>,
  principal = false
): number {
  if (!donnees.telephone) throw new Error('Le telephone du tuteur est obligatoire.')
  const telephone = normaliserTelephone(donnees.telephone, lireParametre('sms.indicatif_pays', '257'))

  // Un meme parent a souvent plusieurs enfants dans l’ecole : on le reutilise.
  let tuteur = base().prepare('SELECT * FROM tuteur WHERE telephone = ?').get(telephone) as
    | Tuteur
    | undefined

  if (!tuteur) {
    const r = base()
      .prepare(
        `INSERT INTO tuteur (nom, prenom, lien_parente, telephone, telephone2, email, profession, adresse)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        donnees.nom ?? 'Tuteur',
        donnees.prenom ?? null,
        donnees.lien_parente ?? null,
        telephone,
        donnees.telephone2 ?? null,
        donnees.email ?? null,
        donnees.profession ?? null,
        donnees.adresse ?? null
      )
    tuteur = { id: Number(r.lastInsertRowid) } as Tuteur
  }

  if (principal) {
    base().prepare('UPDATE eleve_tuteur SET principal = 0 WHERE eleve_id = ?').run(eleveId)
  }
  base()
    .prepare(
      `INSERT INTO eleve_tuteur (eleve_id, tuteur_id, principal) VALUES (?, ?, ?)
       ON CONFLICT (eleve_id, tuteur_id) DO UPDATE SET principal = excluded.principal`
    )
    .run(eleveId, tuteur.id, principal ? 1 : 0)
  return tuteur.id
}

export function modifierTuteur(id: number, donnees: Partial<Tuteur>): void {
  if (donnees.telephone) {
    donnees.telephone = normaliserTelephone(
      donnees.telephone,
      lireParametre('sms.indicatif_pays', '257')
    )
  }
  majPartielle('tuteur', id, donnees, ['id'])
}

export function detacherTuteur(eleveId: number, tuteurId: number): void {
  base().prepare('DELETE FROM eleve_tuteur WHERE eleve_id = ? AND tuteur_id = ?').run(eleveId, tuteurId)
}

/* ------------------------------ Inscriptions ----------------------------- */

/**
 * Inscrit un eleve dans une classe et genere immediatement ses frais dus,
 * a partir de la grille tarifaire de l’annee (frais generaux, frais du niveau,
 * frais specifiques a la classe).
 */
export function inscrire(eleveId: number, classeId: number, redoublant = 0): number {
  const classe = base().prepare('SELECT * FROM classe WHERE id = ?').get(classeId) as
    | { id: number; annee_id: number; niveau_id: number; capacite: number }
    | undefined
  if (!classe) throw new Error('Classe introuvable.')

  const effectif = base()
    .prepare("SELECT COUNT(*) n FROM inscription WHERE classe_id = ? AND statut = 'INSCRIT'")
    .get(classeId) as { n: number }

  const existante = base()
    .prepare('SELECT id FROM inscription WHERE eleve_id = ? AND annee_id = ?')
    .get(eleveId, classe.annee_id) as { id: number } | undefined

  let inscriptionId: number
  if (existante) {
    base()
      .prepare("UPDATE inscription SET classe_id = ?, statut = 'INSCRIT' WHERE id = ?")
      .run(classeId, existante.id)
    inscriptionId = existante.id
  } else {
    const r = base()
      .prepare(
        `INSERT INTO inscription (eleve_id, classe_id, annee_id, redoublant, numero_ordre)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(eleveId, classeId, classe.annee_id, redoublant, effectif.n + 1)
    inscriptionId = Number(r.lastInsertRowid)
  }

  genererFraisDus(inscriptionId)
  return inscriptionId
}

/** Cree les lignes `eleve_frais` correspondant a la grille tarifaire applicable. */
export function genererFraisDus(inscriptionId: number): number {
  const inscription = base()
    .prepare(
      `SELECT i.*, c.niveau_id FROM inscription i JOIN classe c ON c.id = i.classe_id WHERE i.id = ?`
    )
    .get(inscriptionId) as { annee_id: number; classe_id: number; niveau_id: number } | undefined
  if (!inscription) return 0

  const frais = base()
    .prepare(
      `SELECT * FROM frais WHERE annee_id = ? AND actif = 1
         AND (classe_id IS NULL OR classe_id = ?)
         AND (niveau_id IS NULL OR niveau_id = ?)`
    )
    .all(inscription.annee_id, inscription.classe_id, inscription.niveau_id) as any[]

  const insert = base().prepare(
    `INSERT OR IGNORE INTO eleve_frais (inscription_id, frais_id, montant_du) VALUES (?, ?, ?)`
  )
  let creees = 0
  const transaction = base().transaction(() => {
    for (const f of frais) {
      const r = insert.run(inscriptionId, f.id, f.montant)
      if (r.changes > 0) creees++
    }
  })
  transaction()
  return creees
}

/** Transfert d’un eleve vers une autre classe (les notes suivent l’eleve). */
export function transfererEleve(inscriptionId: number, nouvelleClasseId: number, motif?: string): void {
  const inscription = base()
    .prepare('SELECT * FROM inscription WHERE id = ?')
    .get(inscriptionId) as Inscription | undefined
  if (!inscription) throw new Error('Inscription introuvable.')

  base().prepare('UPDATE inscription SET classe_id = ? WHERE id = ?').run(nouvelleClasseId, inscriptionId)
  genererFraisDus(inscriptionId)

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'TRANSFERT_ELEVE',
    'inscription',
    inscriptionId,
    { de: inscription.classe_id, vers: nouvelleClasseId, motif }
  )
}

/** Sortie definitive : transfert vers une autre ecole, abandon, exclusion. */
export function sortirEleve(inscriptionId: number, statut: string, motif: string, date: string): void {
  base()
    .prepare('UPDATE inscription SET statut = ?, motif_sortie = ?, date_sortie = ? WHERE id = ?')
    .run(statut, motif, date, inscriptionId)
  const inscription = base()
    .prepare('SELECT eleve_id FROM inscription WHERE id = ?')
    .get(inscriptionId) as { eleve_id: number }
  base().prepare('UPDATE eleve SET statut = ? WHERE id = ?').run(statut, inscription.eleve_id)

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'SORTIE_ELEVE',
    'inscription',
    inscriptionId,
    { statut, motif }
  )
}

/* ----------------------------- Import en masse --------------------------- */

export interface LigneImport {
  nom: string
  prenom: string
  sexe: string
  date_naissance?: string
  lieu_naissance?: string
  matricule?: string
  classe?: string
  tuteur_nom?: string
  tuteur_telephone?: string
  tuteur_lien?: string
}

export interface RapportImport {
  importes: number
  ignores: number
  erreurs: { ligne: number; message: string }[]
}

/**
 * Import en masse depuis un tableur. Chaque ligne est traitee independamment :
 * une ligne fautive n’annule pas tout l’import, elle est simplement signalee.
 */
export function importerEleves(lignes: LigneImport[]): RapportImport {
  const rapport: RapportImport = { importes: 0, ignores: 0, erreurs: [] }
  const classes = base()
    .prepare('SELECT id, libelle FROM classe WHERE annee_id = ?')
    .all(exigerAnneeActive().id) as { id: number; libelle: string }[]
  const parLibelle = new Map(classes.map((c) => [sansAccents(c.libelle), c.id]))

  lignes.forEach((ligne, index) => {
    try {
      if (!ligne.nom?.trim() || !ligne.prenom?.trim()) {
        rapport.ignores++
        rapport.erreurs.push({ ligne: index + 2, message: 'Nom ou prenom manquant' })
        return
      }
      const sexe = (ligne.sexe ?? '').trim().toUpperCase().startsWith('F') ? 'F' : 'M'
      const classeId = ligne.classe ? parLibelle.get(sansAccents(ligne.classe)) : undefined
      if (ligne.classe && !classeId) {
        rapport.ignores++
        rapport.erreurs.push({ ligne: index + 2, message: `Classe « ${ligne.classe} » introuvable` })
        return
      }
      creerEleve({
        nom: ligne.nom,
        prenom: ligne.prenom,
        sexe,
        matricule: ligne.matricule,
        date_naissance: ligne.date_naissance || null,
        lieu_naissance: ligne.lieu_naissance || null,
        classe_id: classeId ?? null,
        tuteur:
          ligne.tuteur_nom && ligne.tuteur_telephone
            ? {
                nom: ligne.tuteur_nom,
                telephone: ligne.tuteur_telephone,
                lien_parente: ligne.tuteur_lien
              }
            : undefined
      })
      rapport.importes++
    } catch (erreur) {
      rapport.ignores++
      rapport.erreurs.push({ ligne: index + 2, message: (erreur as Error).message })
    }
  })

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'IMPORT_ELEVES',
    'eleve',
    null,
    rapport
  )
  return rapport
}
