/**
 * Lecture et ecriture de fichiers CSV.
 * Volontairement autonome : les ecoles echangent leurs listes en CSV depuis
 * Excel ou LibreOffice, et le separateur varie (virgule ou point-virgule).
 */

export function lireCsv(contenu: string): Record<string, string>[] {
  const texte = contenu.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim()
  if (!texte) return []

  const premiereLigne = texte.split('\n')[0]
  const separateur = (premiereLigne.match(/;/g)?.length ?? 0) > (premiereLigne.match(/,/g)?.length ?? 0) ? ';' : ','

  const lignes = decouper(texte, separateur)
  if (lignes.length < 2) return []

  const entetes = lignes[0].map((e) => e.trim().toLowerCase().replace(/\s+/g, '_'))
  return lignes.slice(1)
    .filter((l) => l.some((c) => c.trim() !== ''))
    .map((l) => Object.fromEntries(entetes.map((e, i) => [e, (l[i] ?? '').trim()])))
}

/** Analyse caractere par caractere pour gerer les guillemets et les retours a la ligne. */
function decouper(texte: string, separateur: string): string[][] {
  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let entreGuillemets = false

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"'
          i++
        } else entreGuillemets = false
      } else champ += c
    } else if (c === '"') {
      entreGuillemets = true
    } else if (c === separateur) {
      ligne.push(champ)
      champ = ''
    } else if (c === '\n') {
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else champ += c
  }
  ligne.push(champ)
  lignes.push(ligne)
  return lignes
}

export function ecrireCsv(
  colonnes: { cle: string; libelle: string }[],
  lignes: Record<string, unknown>[]
): string {
  const echapper = (v: unknown) => {
    const texte = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
  }
  return [
    colonnes.map((c) => echapper(c.libelle)).join(';'),
    ...lignes.map((l) => colonnes.map((c) => echapper(l[c.cle])).join(';'))
  ].join('\n')
}
