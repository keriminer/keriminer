import { BrowserWindow, app, dialog, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Conversion HTML -> PDF via une fenetre invisible d’Electron.
 * Aucune bibliotheque PDF externe : le rendu est celui du navigateur, donc
 * identique a l’apercu affiche a l’utilisateur.
 */
async function rendre(html: string): Promise<Buffer> {
  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false }
  })
  try {
    await fenetre.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await fenetre.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    })
  } finally {
    fenetre.destroy()
  }
}

/** Genere le PDF dans un fichier temporaire et l’ouvre dans la visionneuse. */
export async function apercuPdf(html: string, nomFichier: string): Promise<string> {
  const pdf = await rendre(html)
  const chemin = join(app.getPath('temp'), `${nomFichier}-${Date.now()}.pdf`)
  writeFileSync(chemin, pdf)
  await shell.openPath(chemin)
  return chemin
}

/** Demande a l’utilisateur ou enregistrer le PDF. */
export async function enregistrerPdf(
  html: string,
  nomFichier: string,
  fenetreParente?: BrowserWindow
): Promise<string | null> {
  const resultat = await dialog.showSaveDialog(fenetreParente ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Enregistrer le document',
    defaultPath: join(app.getPath('documents'), `${nomFichier}.pdf`),
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
  })
  if (resultat.canceled || !resultat.filePath) return null

  const pdf = await rendre(html)
  writeFileSync(resultat.filePath, pdf)
  return resultat.filePath
}

/** Envoie directement le document a l’imprimante par defaut. */
export async function imprimer(html: string): Promise<boolean> {
  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, javascript: false }
  })
  try {
    await fenetre.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await new Promise<boolean>((resolve) => {
      fenetre.webContents.print(
        { silent: false, printBackground: true, margins: { marginType: 'none' } },
        (succes) => resolve(succes)
      )
    })
  } finally {
    setTimeout(() => !fenetre.isDestroyed() && fenetre.destroy(), 1000)
  }
}
