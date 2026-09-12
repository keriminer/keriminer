import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'node:path'
import { enregistrerCanaux } from './ipc'
import { fermerBase, ouvrirBase } from './db'
import { creerSauvegarde } from './services/sauvegarde'

let fenetrePrincipale: BrowserWindow | null = null

function creerFenetre(): void {
  fenetrePrincipale = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f6f8',
    title: 'SCOLIA',
    icon: join(__dirname, '../../resources/icone.png'),
    webPreferences: {
      // electron-vite produit un preload ESM (.mjs) : Electron l’accepte tant que
      // `sandbox` est desactive, ce qui est le cas ici.
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  fenetrePrincipale.once('ready-to-show', () => {
    fenetrePrincipale?.maximize()
    fenetrePrincipale?.show()
  })

  // Les liens externes s’ouvrent dans le navigateur, jamais dans l’application.
  fenetrePrincipale.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    fenetrePrincipale.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    fenetrePrincipale.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function construireMenu(): void {
  const modele: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Sauvegarder maintenant',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            try {
              const fichier = creerSauvegarde()
              fenetrePrincipale?.webContents.send('notification', {
                type: 'succes',
                message: `Sauvegarde creee : ${fichier.nom}`
              })
            } catch (erreur) {
              fenetrePrincipale?.webContents.send('notification', {
                type: 'erreur',
                message: (erreur as Error).message
              })
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Edition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Retablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout selectionner' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Actualiser' },
        { role: 'resetZoom', label: 'Taille normale' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Reduire' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein ecran' },
        { role: 'toggleDevTools', label: 'Outils de developpement' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele))
}

// Une seule instance : deux applications ecrivant dans la meme base SQLite
// finiraient par se marcher dessus.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (fenetrePrincipale) {
      if (fenetrePrincipale.isMinimized()) fenetrePrincipale.restore()
      fenetrePrincipale.focus()
    }
  })

  app.whenReady().then(() => {
    ouvrirBase()
    enregistrerCanaux()
    construireMenu()
    creerFenetre()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Point critique en Afrique : une coupure de courant ne doit rien corrompre.
  // Le mode WAL + checkpoint a la fermeture garantit une base propre.
  app.on('before-quit', () => {
    try {
      creerSauvegarde()
    } catch (erreur) {
      console.error('[app] sauvegarde de fermeture impossible', erreur)
    }
    fermerBase()
  })
}
