import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import migration001 from './migrations/001_init.sql?raw'

/**
 * Acces a la base locale.
 *
 * Choix techniques dictes par le terrain africain :
 *  - SQLite embarque : zero serveur, zero reseau, fonctionne sur un PC modeste ;
 *  - journal WAL + `synchronous = FULL` : une coupure de courant ne corrompt pas
 *    la base et ne fait perdre au pire que la transaction en cours ;
 *  - sauvegarde automatique horodatee a chaque demarrage.
 */

let db: Database.Database | null = null

/** Ordre d’application des migrations. Ajouter les suivantes a la suite. */
const MIGRATIONS: { version: number; nom: string; sql: string }[] = [
  { version: 1, nom: '001_init', sql: migration001 }
]

export function cheminDossierDonnees(): string {
  const dossier = join(app.getPath('userData'), 'donnees')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}

export function cheminBase(): string {
  return join(cheminDossierDonnees(), 'scolia.db')
}

export function cheminDossierSauvegardes(): string {
  const dossier = join(app.getPath('userData'), 'sauvegardes')
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true })
  return dossier
}

export function ouvrirBase(): Database.Database {
  if (db) return db

  const fichier = cheminBase()
  const nouvelle = !existsSync(fichier)

  db = new Database(fichier)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL') // resiste aux coupures d’electricite
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  appliquerMigrations(db)
  if (!nouvelle) sauvegardeAutomatique(fichier)

  return db
}

export function base(): Database.Database {
  if (!db) return ouvrirBase()
  return db
}

export function fermerBase(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* la base peut deja etre fermee */
    }
    db.close()
    db = null
  }
}

function appliquerMigrations(base: Database.Database): void {
  base.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    version INTEGER PRIMARY KEY,
    nom TEXT NOT NULL,
    date_application TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`)

  const appliquees = new Set(
    base.prepare('SELECT version FROM schema_migration').all().map((r: any) => r.version as number)
  )

  for (const migration of MIGRATIONS) {
    if (appliquees.has(migration.version)) continue
    const transaction = base.transaction(() => {
      base.exec(migration.sql)
      base
        .prepare('INSERT INTO schema_migration (version, nom) VALUES (?, ?)')
        .run(migration.version, migration.nom)
    })
    transaction()
    console.log(`[base] migration appliquee : ${migration.nom}`)
  }
}

/**
 * Copie la base au demarrage et conserve les 20 dernieres copies.
 * C’est le filet de securite minimal pour une ecole sans informaticien.
 */
function sauvegardeAutomatique(fichierSource: string): void {
  try {
    const dossier = cheminDossierSauvegardes()
    const horodatage = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    copyFileSync(fichierSource, join(dossier, `auto-${horodatage}.db`))

    const copies = readdirSync(dossier)
      .filter((f) => f.startsWith('auto-') && f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(dossier, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)

    for (const ancienne of copies.slice(20)) unlinkSync(join(dossier, ancienne.f))
  } catch (erreur) {
    console.error('[base] sauvegarde automatique impossible', erreur)
  }
}
