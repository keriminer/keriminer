import { base } from '../db'

/**
 * Journal d’audit : qui a fait quoi, quand.
 * Indispensable des qu’il y a de l’argent en jeu (encaissements, remises,
 * annulations de recus) et pour arbitrer les litiges internes.
 */
export function tracer(
  utilisateurId: number | null,
  utilisateurNom: string | null,
  action: string,
  entite?: string | null,
  entiteId?: number | null,
  details?: unknown
): void {
  try {
    base()
      .prepare(
        `INSERT INTO journal_audit (utilisateur_id, utilisateur_nom, action, entite, entite_id, details)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        utilisateurId,
        utilisateurNom,
        action,
        entite ?? null,
        entiteId ?? null,
        details === undefined ? null : JSON.stringify(details)
      )
  } catch (erreur) {
    console.error('[audit] ecriture impossible', erreur)
  }
}

export function listerJournal(limite = 300, recherche = ''): unknown[] {
  const motif = `%${recherche}%`
  return base()
    .prepare(
      `SELECT * FROM journal_audit
       WHERE (? = '' OR action LIKE ? OR utilisateur_nom LIKE ? OR entite LIKE ?)
       ORDER BY id DESC LIMIT ?`
    )
    .all(recherche, motif, motif, motif, limite)
}
