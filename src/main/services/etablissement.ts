import { base } from '../db'
import type { Etablissement } from '@shared/types'
import { MODELES_STRUCTURE, MATIERES_REFERENCE, FILIERES_REFERENCE, MODELES_SMS_REFERENCE } from '../db/referentiel'
import { creerUtilisateur } from './auth'
import { tracer } from './journal'

/** L’application est-elle deja configuree ? */
export function estInstalle(): boolean {
  const ligne = base().prepare('SELECT id FROM etablissement WHERE id = 1').get()
  return Boolean(ligne)
}

export function lireEtablissement(): Etablissement | null {
  return (base().prepare('SELECT * FROM etablissement WHERE id = 1').get() as Etablissement) ?? null
}

export function modifierEtablissement(donnees: Partial<Etablissement>): void {
  const champs = Object.keys(donnees).filter((c) => c !== 'id')
  if (champs.length === 0) return
  const clause = champs.map((c) => `${c} = ?`).join(', ')
  base()
    .prepare(`UPDATE etablissement SET ${clause} WHERE id = 1`)
    .run(...champs.map((c) => (donnees as Record<string, unknown>)[c]))
  tracer(null, null, 'MODIFICATION_ETABLISSEMENT', 'etablissement', 1, champs)
}

export interface DonneesInstallation {
  etablissement: Partial<Etablissement> & { nom: string }
  modele_structure: string
  cycles: string[]
  annee: { libelle: string; date_debut: string; date_fin: string; decoupage: 'TRIMESTRE' | 'SEMESTRE' }
  administrateur: { nom_complet: string; login: string; mot_de_passe: string }
}

/**
 * Assistant de premiere installation.
 * Cree l’etablissement, la premiere annee scolaire et ses periodes, les niveaux
 * du modele choisi, les matieres du referentiel, les modeles SMS et le compte
 * administrateur. Le tout dans une seule transaction : en cas de coupure, rien
 * n’est ecrit a moitie.
 */
export function installer(donnees: DonneesInstallation): void {
  if (estInstalle()) throw new Error("L’application est deja configuree.")
  const e = donnees.etablissement
  if (!e.nom?.trim()) throw new Error("Le nom de l’etablissement est obligatoire.")
  if (donnees.administrateur.mot_de_passe.length < 6) {
    throw new Error('Le mot de passe administrateur doit contenir au moins 6 caracteres.')
  }

  const db = base()
  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO etablissement
        (id, nom, sigle, devise_texte, type_etablissement, cycles, pays, province, commune,
         adresse, telephone, telephone2, email, site_web, bp, code_officiel, nom_directeur,
         logo, couleur_primaire, couleur_secondaire, devise_code, langue, bareme_notation,
         seuil_reussite, autorite_tutelle)
       VALUES (1, @nom, @sigle, @devise_texte, @type_etablissement, @cycles, @pays, @province,
         @commune, @adresse, @telephone, @telephone2, @email, @site_web, @bp, @code_officiel,
         @nom_directeur, @logo, @couleur_primaire, @couleur_secondaire, @devise_code, @langue,
         @bareme_notation, @seuil_reussite, @autorite_tutelle)`
    ).run({
      nom: e.nom.trim(),
      sigle: e.sigle ?? null,
      devise_texte: e.devise_texte ?? null,
      type_etablissement: e.type_etablissement ?? 'Privé',
      cycles: JSON.stringify(donnees.cycles),
      pays: e.pays ?? null,
      province: e.province ?? null,
      commune: e.commune ?? null,
      adresse: e.adresse ?? null,
      telephone: e.telephone ?? null,
      telephone2: e.telephone2 ?? null,
      email: e.email ?? null,
      site_web: e.site_web ?? null,
      bp: e.bp ?? null,
      code_officiel: e.code_officiel ?? null,
      nom_directeur: e.nom_directeur ?? null,
      logo: e.logo ?? null,
      couleur_primaire: e.couleur_primaire ?? '#0f766e',
      couleur_secondaire: e.couleur_secondaire ?? '#f59e0b',
      devise_code: e.devise_code ?? 'BIF',
      langue: e.langue ?? 'fr',
      bareme_notation: e.bareme_notation ?? 20,
      seuil_reussite: e.seuil_reussite ?? 10,
      autorite_tutelle: e.autorite_tutelle ?? null
    })

    // Niveaux du modele retenu, limites aux cycles actives par l’ecole
    const modele = MODELES_STRUCTURE.find((m) => m.code === donnees.modele_structure)
    if (modele) {
      const insertNiveau = db.prepare(
        'INSERT OR IGNORE INTO niveau (cycle, libelle, code, ordre) VALUES (?, ?, ?, ?)'
      )
      for (const n of modele.niveaux) {
        if (!donnees.cycles.includes(n.cycle)) continue
        insertNiveau.run(n.cycle, n.libelle, n.code, n.ordre)
      }
    }

    const insertMatiere = db.prepare(
      'INSERT OR IGNORE INTO matiere (code, libelle, cycle, categorie) VALUES (?, ?, ?, ?)'
    )
    for (const m of MATIERES_REFERENCE) {
      if (m.cycle && !donnees.cycles.includes(m.cycle)) continue
      insertMatiere.run(m.code, m.libelle, m.cycle, m.categorie)
    }

    const insertFiliere = db.prepare(
      'INSERT OR IGNORE INTO filiere (code, libelle, cycle) VALUES (?, ?, ?)'
    )
    for (const f of FILIERES_REFERENCE) {
      if (f.cycle && !donnees.cycles.includes(f.cycle)) continue
      insertFiliere.run(f.code, f.libelle, f.cycle)
    }

    const insertModele = db.prepare(
      'INSERT OR IGNORE INTO modele_sms (code, libelle, contenu, automatique) VALUES (?, ?, ?, ?)'
    )
    for (const m of MODELES_SMS_REFERENCE) {
      insertModele.run(m.code, m.libelle, m.contenu, m.automatique)
    }

    const annee = db
      .prepare(
        'INSERT INTO annee_scolaire (libelle, date_debut, date_fin, active) VALUES (?, ?, ?, 1)'
      )
      .run(donnees.annee.libelle, donnees.annee.date_debut, donnees.annee.date_fin)
    creerPeriodes(Number(annee.lastInsertRowid), donnees.annee)

    for (const [cle, valeur] of Object.entries(PARAMETRES_DEFAUT)) {
      db.prepare('INSERT OR REPLACE INTO parametre (cle, valeur) VALUES (?, ?)').run(cle, valeur)
    }
  })

  transaction()

  creerUtilisateur({
    login: donnees.administrateur.login,
    nom_complet: donnees.administrateur.nom_complet,
    mot_de_passe: donnees.administrateur.mot_de_passe,
    role: 'SUPER_ADMIN'
  })
  // Le compte cree par l’assistant n’a pas a changer son mot de passe : il vient
  // de le choisir lui-meme.
  base().prepare("UPDATE utilisateur SET doit_changer_mdp = 0 WHERE login = ?").run(
    donnees.administrateur.login.trim()
  )

  tracer(null, donnees.administrateur.nom_complet, 'INSTALLATION', 'etablissement', 1, {
    ecole: e.nom
  })
}

/** Decoupe une annee scolaire en trimestres ou semestres de duree egale. */
export function creerPeriodes(
  anneeId: number,
  annee: { date_debut: string; date_fin: string; decoupage: 'TRIMESTRE' | 'SEMESTRE' }
): void {
  const nb = annee.decoupage === 'SEMESTRE' ? 2 : 3
  const debut = new Date(annee.date_debut)
  const fin = new Date(annee.date_fin)
  const duree = (fin.getTime() - debut.getTime()) / nb
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const insert = base().prepare(
    `INSERT OR IGNORE INTO periode (annee_id, libelle, code, ordre, date_debut, date_fin)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  for (let i = 0; i < nb; i++) {
    const d = new Date(debut.getTime() + duree * i)
    const f = new Date(debut.getTime() + duree * (i + 1) - 86400000)
    const libelle = annee.decoupage === 'SEMESTRE' ? `${i + 1}er semestre` : `${i + 1}e trimestre`
    insert.run(anneeId, libelle.replace('1e ', '1er '), `P${i + 1}`, i + 1, iso(d), iso(f))
  }
}

export const PARAMETRES_DEFAUT: Record<string, string> = {
  'sms.passerelle': 'AUCUNE',
  'sms.expediteur': '',
  'sms.url': '',
  'sms.cle_api': '',
  'sms.identifiant': '',
  'sms.port_modem': '',
  'sms.indicatif_pays': '257',
  'sms.auto_absence': '0',
  'sms.auto_paiement': '0',
  'momo.operateurs_actifs': '[]',
  'presence.seances': '["MATIN","APRES_MIDI"]',
  'presence.heure_limite_retard': '08:00',
  'pointage.heure_arrivee_prevue': '07:30',
  'pointage.heure_depart_prevue': '16:00',
  'pointage.heures_par_jour': '6',
  'bulletin.afficher_rang': '1',
  'bulletin.afficher_moyenne_classe': '1',
  'bulletin.afficher_appreciation': '1',
  'bulletin.format_papier': 'A4',
  'recu.prefixe': 'REC',
  'recu.mentions_legales': '',
  'matricule.prefixe': '',
  'matricule.format': 'ANNEE-SEQ',
  'sauvegarde.dossier_externe': ''
}

export function lireParametres(): Record<string, string> {
  const lignes = base().prepare('SELECT cle, valeur FROM parametre').all() as {
    cle: string
    valeur: string
  }[]
  const resultat: Record<string, string> = { ...PARAMETRES_DEFAUT }
  for (const l of lignes) resultat[l.cle] = l.valeur
  return resultat
}

export function lireParametre(cle: string, defaut = ''): string {
  const ligne = base().prepare('SELECT valeur FROM parametre WHERE cle = ?').get(cle) as
    | { valeur: string }
    | undefined
  return ligne?.valeur ?? PARAMETRES_DEFAUT[cle] ?? defaut
}

export function ecrireParametres(valeurs: Record<string, string>): void {
  const insert = base().prepare('INSERT OR REPLACE INTO parametre (cle, valeur) VALUES (?, ?)')
  const transaction = base().transaction(() => {
    for (const [cle, valeur] of Object.entries(valeurs)) insert.run(cle, String(valeur ?? ''))
  })
  transaction()
  tracer(null, null, 'MODIFICATION_PARAMETRES', 'parametre', null, Object.keys(valeurs))
}
