import { create } from 'zustand'
import type { AnneeScolaire, Etablissement, SessionUtilisateur } from '@shared/types'
import { aLaPermission } from '@shared/permissions'
import { appeler } from '../lib/api'

interface EtatSession {
  chargement: boolean
  installe: boolean
  session: SessionUtilisateur | null
  etablissement: Etablissement | null
  annee: AnneeScolaire | null
  parametres: Record<string, string>
  rafraichir: () => Promise<void>
  connecter: (login: string, motDePasse: string) => Promise<void>
  deconnecter: () => Promise<void>
  peut: (permission: string) => boolean
}

export const useSession = create<EtatSession>((set, get) => ({
  chargement: true,
  installe: false,
  session: null,
  etablissement: null,
  annee: null,
  parametres: {},

  rafraichir: async () => {
    const etat = await appeler<{
      installe: boolean
      session: SessionUtilisateur | null
      etablissement: Etablissement | null
      annee: AnneeScolaire | null
    }>('session.etat')

    let parametres: Record<string, string> = {}
    if (etat.session) {
      try {
        parametres = await appeler<Record<string, string>>('parametres.lire')
      } catch {
        parametres = {}
      }
    }

    set({
      chargement: false,
      installe: etat.installe,
      session: etat.session,
      etablissement: etat.etablissement,
      annee: etat.annee,
      parametres
    })
    appliquerIdentiteVisuelle(etat.etablissement)
  },

  connecter: async (login, motDePasse) => {
    await appeler('session.connexion', login, motDePasse)
    await get().rafraichir()
  },

  deconnecter: async () => {
    await appeler('session.deconnexion')
    set({ session: null })
  },

  peut: (permission) => {
    const session = get().session
    return session ? aLaPermission(session.permissions, permission) : false
  }
}))

/**
 * Applique les couleurs de l’école à toute l’interface.
 * C’est le cœur de la personnalisation : une seule ecriture de variables CSS
 * et l’application entière prend l’identite de l’etablissement.
 */
export function appliquerIdentiteVisuelle(etablissement: Etablissement | null): void {
  const racine = document.documentElement
  const primaire = etablissement?.couleur_primaire || '#0f766e'
  const secondaire = etablissement?.couleur_secondaire || '#f59e0b'

  racine.style.setProperty('--primaire', primaire)
  racine.style.setProperty('--primaire-sombre', assombrir(primaire, 0.18))
  racine.style.setProperty('--primaire-clair', eclaircir(primaire, 0.9))
  racine.style.setProperty('--primaire-doux', eclaircir(primaire, 0.82))
  racine.style.setProperty('--secondaire', secondaire)
  racine.style.setProperty('--secondaire-clair', eclaircir(secondaire, 0.88))
  racine.style.setProperty('--contraste-primaire', contrasteLisible(primaire))

  if (etablissement?.nom) document.title = `SCOLIA — ${etablissement.nom}`
}

function versRvb(hex: string): [number, number, number] {
  const propre = hex.replace('#', '')
  const complet = propre.length === 3 ? propre.split('').map((c) => c + c).join('') : propre
  return [
    parseInt(complet.slice(0, 2), 16),
    parseInt(complet.slice(2, 4), 16),
    parseInt(complet.slice(4, 6), 16)
  ]
}

function versHex(r: number, v: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(v)}${c(b)}`
}

function assombrir(hex: string, taux: number): string {
  const [r, v, b] = versRvb(hex)
  return versHex(r * (1 - taux), v * (1 - taux), b * (1 - taux))
}

function eclaircir(hex: string, taux: number): string {
  const [r, v, b] = versRvb(hex)
  return versHex(r + (255 - r) * taux, v + (255 - v) * taux, b + (255 - b) * taux)
}

/** Noir ou blanc selon la luminance, pour que le texte reste lisible. */
function contrasteLisible(hex: string): string {
  const [r, v, b] = versRvb(hex)
  const luminance = (0.299 * r + 0.587 * v + 0.114 * b) / 255
  return luminance > 0.62 ? '#111827' : '#ffffff'
}
