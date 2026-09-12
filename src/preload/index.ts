import { contextBridge, ipcRenderer } from 'electron'
import type { Reponse } from '@shared/types'

/**
 * Pont securise entre l’interface et le processus principal.
 * `contextIsolation` est actif : l’interface n’a acces ni a Node, ni au
 * systeme de fichiers, uniquement a la fonction `appeler` ci-dessous.
 */
const api = {
  appeler: <T = unknown>(methode: string, ...args: unknown[]): Promise<Reponse<T>> =>
    ipcRenderer.invoke('scolia', methode, ...args) as Promise<Reponse<T>>,
  version: process.versions.electron
}

contextBridge.exposeInMainWorld('scolia', api)

export type ApiScolia = typeof api
