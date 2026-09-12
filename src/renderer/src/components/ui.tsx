import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle, Inbox
} from 'lucide-react'

/* ------------------------------- Notifications --------------------------- */

export type TypeNotification = 'succes' | 'erreur' | 'alerte' | 'info'
interface Notification { id: number; type: TypeNotification; message: string }

const ContexteNotifications = createContext<{
  notifier: (type: TypeNotification, message: string) => void
}>({ notifier: () => {} })

export function useNotifications() {
  return useContext(ContexteNotifications)
}

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([])

  const notifier = (type: TypeNotification, message: string) => {
    const id = Date.now() + Math.random()
    setListe((l) => [...l, { id, type, message }])
    setTimeout(() => setListe((l) => l.filter((n) => n.id !== id)), type === 'erreur' ? 8000 : 4500)
  }

  const icones = {
    succes: <CheckCircle2 size={17} color="var(--succes)" />,
    erreur: <XCircle size={17} color="var(--danger)" />,
    alerte: <AlertTriangle size={17} color="var(--alerte)" />,
    info: <Info size={17} color="var(--info)" />
  }

  return (
    <ContexteNotifications.Provider value={{ notifier }}>
      {children}
      <div className="notifications">
        {liste.map((n) => (
          <div key={n.id} className={`notification ${n.type}`}>
            {icones[n.type]}
            <span>{n.message}</span>
            <button onClick={() => setListe((l) => l.filter((x) => x.id !== n.id))} aria-label="Fermer">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ContexteNotifications.Provider>
  )
}

/* ---------------------------------- Carte -------------------------------- */

export function Carte({
  titre, sousTitre, actions, children, sansMarge, style
}: {
  titre?: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  children: ReactNode
  sansMarge?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div className="carte" style={style}>
      {(titre || actions) && (
        <div className="tete">
          <div>
            {titre && <h3>{titre}</h3>}
            {sousTitre && <div className="sous-texte">{sousTitre}</div>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className={`corps${sansMarge ? ' sans-marge' : ''}`}>{children}</div>
    </div>
  )
}

/* -------------------------------- Formulaire ----------------------------- */

export function Champ({
  label, obligatoire, aide, erreur, children
}: {
  label?: string
  obligatoire?: boolean
  aide?: string
  erreur?: string
  children: ReactNode
}) {
  return (
    <div className="champ">
      {label && (
        <label>
          {label} {obligatoire && <span className="obligatoire">*</span>}
        </label>
      )}
      {children}
      {aide && !erreur && <span className="aide">{aide}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </div>
  )
}

export function Selection<T extends string | number>({
  valeur, surChangement, options, vide, ...reste
}: {
  valeur: T | null | undefined
  surChangement: (v: T | null) => void
  options: { valeur: T; libelle: string }[]
  vide?: string
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return (
    <select
      {...reste}
      value={valeur ?? ''}
      onChange={(e) => {
        const brut = e.target.value
        if (brut === '') return surChangement(null)
        const premier = options[0]?.valeur
        surChangement((typeof premier === 'number' ? Number(brut) : brut) as T)
      }}
    >
      {vide !== undefined && <option value="">{vide}</option>}
      {options.map((o) => (
        <option key={String(o.valeur)} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  )
}

/* --------------------------------- Modale -------------------------------- */

export function Modale({
  titre, ouverte, surFermeture, children, pied, taille = ''
}: {
  titre: ReactNode
  ouverte: boolean
  surFermeture: () => void
  children: ReactNode
  pied?: ReactNode
  taille?: '' | 'petite' | 'large' | 'tres-large'
}) {
  useEffect(() => {
    if (!ouverte) return
    const gerer = (e: KeyboardEvent) => e.key === 'Escape' && surFermeture()
    window.addEventListener('keydown', gerer)
    return () => window.removeEventListener('keydown', gerer)
  }, [ouverte, surFermeture])

  if (!ouverte) return null
  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && surFermeture()}>
      <div className={`modale ${taille}`}>
        <div className="tete">
          <h2>{titre}</h2>
          <button className="fermer" onClick={surFermeture} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>
        <div className="corps">{children}</div>
        {pied && <div className="pied">{pied}</div>}
      </div>
    </div>
  )
}

/** Boite de confirmation, obligatoire avant toute action destructrice. */
export function Confirmation({
  ouverte, titre, message, libelleConfirmation = 'Confirmer', danger, surConfirmation, surAnnulation
}: {
  ouverte: boolean
  titre: string
  message: ReactNode
  libelleConfirmation?: string
  danger?: boolean
  surConfirmation: () => void
  surAnnulation: () => void
}) {
  return (
    <Modale
      titre={titre}
      ouverte={ouverte}
      surFermeture={surAnnulation}
      taille="petite"
      pied={
        <>
          <button className="bouton" onClick={surAnnulation}>Annuler</button>
          <button className={`bouton ${danger ? 'danger' : 'principal'}`} onClick={surConfirmation}>
            {libelleConfirmation}
          </button>
        </>
      }
    >
      <div className="entre" style={{ alignItems: 'flex-start', gap: 12 }}>
        <AlertTriangle size={22} color={danger ? 'var(--danger)' : 'var(--alerte)'} style={{ flexShrink: 0 }} />
        <div>{message}</div>
      </div>
    </Modale>
  )
}

/* -------------------------------- Etats --------------------------------- */

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="chargement">
      <div className="pile" style={{ alignItems: 'center' }}>
        <Loader2 size={26} className="rotation" />
        <span>{texte}</span>
      </div>
    </div>
  )
}

export function EtatVide({
  titre, description, action, icone
}: {
  titre: string
  description?: string
  action?: ReactNode
  icone?: ReactNode
}) {
  return (
    <div className="etat-vide">
      {icone ?? <Inbox size={42} />}
      <div className="titre">{titre}</div>
      {description && <div style={{ maxWidth: 460, margin: '0 auto 12px' }}>{description}</div>}
      {action}
    </div>
  )
}

export function Message({
  type = 'info', children
}: {
  type?: TypeNotification
  children: ReactNode
}) {
  const icones = {
    succes: <CheckCircle2 size={17} />,
    erreur: <XCircle size={17} />,
    alerte: <AlertTriangle size={17} />,
    info: <Info size={17} />
  }
  return (
    <div className={`message ${type}`}>
      {icones[type]}
      <div>{children}</div>
    </div>
  )
}

export function Etiquette({
  children, variante = ''
}: {
  children: ReactNode
  variante?: '' | 'succes' | 'danger' | 'alerte' | 'info' | 'primaire'
}) {
  return <span className={`etiquette ${variante}`}>{children}</span>
}

export function Indicateur({
  valeur, etiquette, detail, icone, couleurIcone, couleurFond
}: {
  valeur: ReactNode
  etiquette: string
  detail?: ReactNode
  icone?: ReactNode
  couleurIcone?: string
  couleurFond?: string
}) {
  return (
    <div className="carte">
      <div className="indicateur">
        {icone && (
          <div
            className="icone"
            style={{
              background: couleurFond ?? 'var(--primaire-clair)',
              color: couleurIcone ?? 'var(--primaire)'
            }}
          >
            {icone}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="valeur">{valeur}</div>
          <div className="etiquette">{etiquette}</div>
          {detail && <div className="detail">{detail}</div>}
        </div>
      </div>
    </div>
  )
}

export function BarreProgression({
  pourcentage, variante
}: {
  pourcentage: number
  variante?: 'succes' | 'alerte' | 'danger'
}) {
  const valeur = Math.max(0, Math.min(100, pourcentage))
  const auto = variante ?? (valeur >= 80 ? 'succes' : valeur >= 40 ? 'alerte' : 'danger')
  return (
    <div className={`barre-progression ${auto}`} title={`${valeur.toFixed(0)} %`}>
      <div style={{ width: `${valeur}%` }} />
    </div>
  )
}

export function Onglets({
  onglets, actif, surChangement
}: {
  onglets: { cle: string; libelle: string; pastille?: number }[]
  actif: string
  surChangement: (cle: string) => void
}) {
  return (
    <div className="onglets">
      {onglets.map((o) => (
        <button
          key={o.cle}
          className={actif === o.cle ? 'actif' : ''}
          onClick={() => surChangement(o.cle)}
        >
          {o.libelle}
          {o.pastille !== undefined && o.pastille > 0 && (
            <span className="etiquette primaire" style={{ marginLeft: 6 }}>{o.pastille}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------- Tableau generique -------------------------- */

export interface ColonneTableau<T> {
  cle: string
  titre: ReactNode
  rendu?: (ligne: T, index: number) => ReactNode
  largeur?: string
  alignement?: 'gauche' | 'centre' | 'droite'
  triable?: boolean
}

export function Tableau<T extends Record<string, any>>({
  colonnes, lignes, cleLigne, surClicLigne, ligneSelectionnee, vide, compacte
}: {
  colonnes: ColonneTableau<T>[]
  lignes: T[]
  cleLigne: (ligne: T, index: number) => string | number
  surClicLigne?: (ligne: T) => void
  ligneSelectionnee?: (ligne: T) => boolean
  vide?: ReactNode
  compacte?: boolean
}) {
  if (lignes.length === 0) {
    return <>{vide ?? <EtatVide titre="Aucune donnée" description="Rien à afficher pour le moment." />}</>
  }

  const classe = (a?: string) => (a === 'droite' ? 'num' : a === 'centre' ? 'centre' : '')

  return (
    <div className="tableau-conteneur">
      <table className={`tableau${compacte ? ' compacte' : ''}`}>
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th key={c.cle} className={classe(c.alignement)} style={{ width: c.largeur }}>
                {c.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr
              key={cleLigne(ligne, index)}
              onClick={surClicLigne ? () => surClicLigne(ligne) : undefined}
              className={ligneSelectionnee?.(ligne) ? 'selectionnee' : ''}
              style={surClicLigne ? { cursor: 'pointer' } : undefined}
            >
              {colonnes.map((c) => (
                <td key={c.cle} className={classe(c.alignement)}>
                  {c.rendu ? c.rendu(ligne, index) : (ligne[c.cle] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
