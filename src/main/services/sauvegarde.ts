import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import Database from 'better-sqlite3'
import { base, cheminBase, cheminDossierSauvegardes, fermerBase, ouvrirBase } from '../db'
import { lireParametre } from './etablissement'
import { sessionCourante } from './auth'
import { tracer } from './journal'

/**
 * Sauvegarde et restauration.
 *
 * Regle d’or pour une ecole sans informaticien : la sauvegarde doit tenir dans
 * UN SEUL fichier que l’on copie sur une cle USB. C’est exactement ce que fait
 * `VACUUM INTO` : une copie compacte et coherente de toute la base, meme si
 * l’application est en train de tourner.
 */

export interface FichierSauvegarde {
  nom: string
  chemin: string
  taille: number
  date: string
  automatique: boolean
}

export function listerSauvegardes(): FichierSauvegarde[] {
  const dossier = cheminDossierSauvegardes()
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const chemin = join(dossier, f)
      const infos = statSync(chemin)
      return {
        nom: f,
        chemin,
        taille: infos.size,
        date: new Date(infos.mtime).toISOString(),
        automatique: f.startsWith('auto-')
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function creerSauvegarde(destination?: string): FichierSauvegarde {
  const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const nom = `sauvegarde-${horodatage}.db`
  const chemin = destination ?? join(cheminDossierSauvegardes(), nom)

  base().prepare('VACUUM INTO ?').run(chemin)

  // Copie miroir sur un support externe (cle USB, disque reseau) si configure.
  const dossierExterne = lireParametre('sauvegarde.dossier_externe', '')
  if (dossierExterne) {
    try {
      if (!existsSync(dossierExterne)) mkdirSync(dossierExterne, { recursive: true })
      copyFileSync(chemin, join(dossierExterne, basename(chemin)))
    } catch (erreur) {
      console.error('[sauvegarde] copie externe impossible', erreur)
    }
  }

  const acteur = sessionCourante()
  tracer(
    acteur?.utilisateur.id ?? null,
    acteur?.utilisateur.nom_complet ?? null,
    'SAUVEGARDE',
    undefined,
    undefined,
    { fichier: basename(chemin) }
  )

  const infos = statSync(chemin)
  return {
    nom: basename(chemin),
    chemin,
    taille: infos.size,
    date: new Date(infos.mtime).toISOString(),
    automatique: false
  }
}

/**
 * Restaure une sauvegarde apres l’avoir verifiee.
 * La base actuelle est d’abord mise de cote : une restauration ratee ne doit
 * jamais laisser l’ecole sans donnees.
 */
export function restaurerSauvegarde(chemin: string): void {
  if (!existsSync(chemin)) throw new Error('Fichier de sauvegarde introuvable.')

  // Verification d’integrite avant de toucher a quoi que ce soit
  const controle = new Database(chemin, { readonly: true })
  try {
    const integrite = controle.pragma('integrity_check', { simple: true })
    if (integrite !== 'ok') throw new Error('Le fichier de sauvegarde est endommage.')
    const tables = controle
      .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = 'etablissement'")
      .get() as { n: number }
    if (tables.n === 0) throw new Error("Ce fichier n’est pas une sauvegarde SCOLIA.")
  } finally {
    controle.close()
  }

  const secours = join(
    cheminDossierSauvegardes(),
    `avant-restauration-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`
  )
  base().prepare('VACUUM INTO ?').run(secours)

  fermerBase()
  copyFileSync(chemin, cheminBase())
  ouvrirBase()

  tracer(null, 'restauration', 'RESTAURATION', undefined, undefined, { fichier: basename(chemin), secours })
}

/** Export complet des donnees au format JSON, pour migration ou archivage legal. */
export function exporterJson(chemin: string): { tables: number; lignes: number } {
  const tables = base()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]

  const contenu: Record<string, unknown[]> = {}
  let lignes = 0
  for (const table of tables) {
    const donnees = base().prepare(`SELECT * FROM ${table.name}`).all()
    contenu[table.name] = donnees
    lignes += donnees.length
  }

  writeFileSync(
    chemin,
    JSON.stringify(
      { application: 'SCOLIA', version: app.getVersion(), date: new Date().toISOString(), donnees: contenu },
      null,
      2
    ),
    'utf-8'
  )
  return { tables: tables.length, lignes }
}

/** Verifie l’integrite de la base courante et renvoie sa taille. */
export function diagnostic(): { integrite: string; taille: number; tables: number; chemin: string } {
  const integrite = base().pragma('integrity_check', { simple: true }) as string
  const tables = (
    base()
      .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .get() as { n: number }
  ).n
  return {
    integrite,
    taille: existsSync(cheminBase()) ? statSync(cheminBase()).size : 0,
    tables,
    chemin: cheminBase()
  }
}
