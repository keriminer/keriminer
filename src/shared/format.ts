import { DEVISES, MENTIONS } from './constants'

/** Formate un montant selon la devise de l’etablissement (espace insecable fine). */
export function formaterMontant(montant: number, codeDevise = 'BIF', avecSymbole = true): string {
  const devise = DEVISES.find((d) => d.code === codeDevise)
  const decimales = devise?.decimales ?? 0
  const texte = (montant ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  })
  return avecSymbole ? `${texte} ${devise?.symbole ?? codeDevise}` : texte
}

export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, j] = iso.slice(0, 10).split('-')
  if (!a || !m || !j) return iso
  return `${j}/${m}/${a}`
}

export function formaterDateHeure(iso: string | null | undefined): string {
  if (!iso) return '—'
  return `${formaterDate(iso)} ${iso.slice(11, 16)}`
}

export function aujourdHui(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function maintenant(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${aujourdHui()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function nomComplet(p: { nom: string; prenom?: string | null }): string {
  return `${p.nom} ${p.prenom ?? ''}`.trim()
}

export function mention(moyenneSur20: number | null): string {
  if (moyenneSur20 === null || Number.isNaN(moyenneSur20)) return '—'
  return MENTIONS.find((m) => moyenneSur20 >= m.min)?.libelle ?? '—'
}

/** Arrondi a 2 decimales sans les artefacts de virgule flottante. */
export function arrondi2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formaterNote(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(decimales).replace('.', ',')
}

/**
 * Normalise un numero de telephone africain en format international.
 * Accepte « 79 123 456 », « 079123456 », « +257 79 12 34 56 ».
 */
export function normaliserTelephone(numero: string, indicatifPays = '257'): string {
  let n = (numero || '').replace(/[^\d+]/g, '')
  if (!n) return ''
  if (n.startsWith('+')) return n
  if (n.startsWith('00')) return `+${n.slice(2)}`
  if (n.startsWith(indicatifPays) && n.length > indicatifPays.length + 6) return `+${n}`
  n = n.replace(/^0+/, '')
  return `+${indicatifPays}${n}`
}

/** Nombre de SMS factures pour un contenu (160 caracteres, 153 en concatene). */
export function compterSms(contenu: string): number {
  const longueur = contenu.length
  if (longueur === 0) return 0
  return longueur <= 160 ? 1 : Math.ceil(longueur / 153)
}

export function initiales(texte: string): string {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('')
}

/** Retire les accents pour permettre une recherche tolerante. */
export function sansAccents(texte: string): string {
  return (texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
