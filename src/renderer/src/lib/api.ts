import type { Reponse } from '@shared/types'

declare global {
  interface Window {
    scolia: {
      appeler: <T = unknown>(methode: string, ...args: unknown[]) => Promise<Reponse<T>>
      version: string
    }
  }
}

/** Erreur metier remontee par le processus principal, avec son code. */
export class ErreurScolia extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message)
    this.name = 'ErreurScolia'
  }
}

/**
 * Appelle une methode du processus principal.
 * Leve une `ErreurScolia` en cas d’echec : les appelants utilisent try/catch
 * plutot que de tester un booleen a chaque appel.
 */
export async function appeler<T = unknown>(methode: string, ...args: unknown[]): Promise<T> {
  const reponse = await window.scolia.appeler<T>(methode, ...args)
  if (!reponse.ok) throw new ErreurScolia(reponse.erreur ?? 'Erreur inconnue', reponse.code ?? 'ERREUR')
  return reponse.donnees as T
}

/** Variante tolerante : renvoie une valeur de repli au lieu de lever. */
export async function appelerOuDefaut<T>(defaut: T, methode: string, ...args: unknown[]): Promise<T> {
  try {
    return await appeler<T>(methode, ...args)
  } catch {
    return defaut
  }
}
