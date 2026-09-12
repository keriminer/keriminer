import { useCallback, useEffect, useState } from 'react'
import { appeler } from '../lib/api'
import { useNotifications } from '../components/ui'

/**
 * Charge des donnees via une methode du processus principal et gere les etats
 * de chargement et d’erreur. `dependances` declenche un rechargement.
 */
export function useDonnees<T>(
  methode: string | null,
  args: unknown[] = [],
  defaut: T
): { donnees: T; chargement: boolean; erreur: string | null; recharger: () => void } {
  const [donnees, setDonnees] = useState<T>(defaut)
  const [chargement, setChargement] = useState(Boolean(methode))
  const [erreur, setErreur] = useState<string | null>(null)
  const [compteur, setCompteur] = useState(0)
  const cleArgs = JSON.stringify(args)

  useEffect(() => {
    if (!methode) {
      setChargement(false)
      return
    }
    let annule = false
    setChargement(true)
    setErreur(null)
    appeler<T>(methode, ...JSON.parse(cleArgs))
      .then((resultat) => !annule && setDonnees(resultat))
      .catch((e) => !annule && setErreur((e as Error).message))
      .finally(() => !annule && setChargement(false))
    return () => {
      annule = true
    }
  }, [methode, cleArgs, compteur])

  return { donnees, chargement, erreur, recharger: () => setCompteur((c) => c + 1) }
}

/** Impression, apercu et enregistrement d’un document genere cote principal. */
export function useDocument() {
  const { notifier } = useNotifications()

  const produire = useCallback(
    async (
      action: 'apercu' | 'enregistrer' | 'imprimer',
      methodeHtml: string,
      nomFichier: string,
      ...args: unknown[]
    ) => {
      try {
        const html = await appeler<string>(methodeHtml, ...args)
        if (action === 'imprimer') {
          await appeler('document.imprimer', html)
          return
        }
        if (action === 'apercu') {
          await appeler('document.apercu', html, nomFichier)
          notifier('info', 'Le document est ouvert dans votre lecteur PDF.')
          return
        }
        const chemin = await appeler<string | null>('document.enregistrer', html, nomFichier)
        if (chemin) notifier('succes', `Document enregistre : ${chemin}`)
      } catch (e) {
        notifier('erreur', (e as Error).message)
      }
    },
    [notifier]
  )

  return {
    apercu: (methode: string, nom: string, ...args: unknown[]) => produire('apercu', methode, nom, ...args),
    enregistrer: (methode: string, nom: string, ...args: unknown[]) => produire('enregistrer', methode, nom, ...args),
    imprimer: (methode: string, ...args: unknown[]) => produire('imprimer', methode, '', ...args)
  }
}

/** Retarde la valeur : evite de relancer une requete a chaque frappe. */
export function useDebounce<T>(valeur: T, delai = 300): T {
  const [retardee, setRetardee] = useState(valeur)
  useEffect(() => {
    const minuteur = setTimeout(() => setRetardee(valeur), delai)
    return () => clearTimeout(minuteur)
  }, [valeur, delai])
  return retardee
}

/** Encapsule une action asynchrone : etat « en cours » et notification d’erreur. */
export function useAction() {
  const { notifier } = useNotifications()
  const [enCours, setEnCours] = useState(false)

  const executer = useCallback(
    async (
      action: () => Promise<unknown>,
      options: { succes?: string; surSucces?: () => void } = {}
    ) => {
      setEnCours(true)
      try {
        await action()
        if (options.succes) notifier('succes', options.succes)
        options.surSucces?.()
        return true
      } catch (e) {
        notifier('erreur', (e as Error).message)
        return false
      } finally {
        setEnCours(false)
      }
    },
    [notifier]
  )

  return { executer, enCours }
}
