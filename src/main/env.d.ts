/// <reference types="vite/client" />

/** Les fichiers SQL sont importes comme texte brut et embarques dans le bundle. */
declare module '*.sql?raw' {
  const contenu: string
  export default contenu
}
