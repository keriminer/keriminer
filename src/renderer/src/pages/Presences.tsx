import { useEffect, useState } from 'react'
import { CalendarDays, CheckCheck, Printer, Save, TriangleAlert } from 'lucide-react'
import type { Classe } from '@shared/types'
import { useAction, useDocument, useDonnees } from '../hooks'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Message,
  Onglets, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { STATUTS_PRESENCE } from '@shared/constants'
import { aujourdHui, formaterDate } from '@shared/format'

interface LignePresence {
  eleve_id: number
  matricule: string
  nom_complet: string
  sexe: string
  statut: string
  justifie: number
  motif: string | null
  heure_arrivee: string | null
}

export default function Presences() {
  const [onglet, setOnglet] = useState('appel')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Présences des élèves</h1>
          <div className="sous-texte">Appel quotidien, suivi de l’assiduité et alerte aux parents</div>
        </div>
      </div>
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'appel', libelle: "Faire l’appel" },
          { cle: 'synthese', libelle: 'Assiduité par classe' },
          { cle: 'alertes', libelle: 'Élèves à suivre' }
        ]}
      />
      {onglet === 'appel' && <OngletAppel />}
      {onglet === 'synthese' && <OngletSynthese />}
      {onglet === 'alertes' && <OngletAlertes />}
    </>
  )
}

/* ---------------------------------- Appel -------------------------------- */

function OngletAppel() {
  const { executer, enCours } = useAction()
  const document = useDocument()
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const [date, setDate] = useState(aujourdHui())
  const [seance, setSeance] = useState('MATIN')
  const [lignes, setLignes] = useState<LignePresence[]>([])
  const [modifiee, setModifiee] = useState(false)

  const feuille = useDonnees<LignePresence[]>(
    classeId ? 'presence.feuille' : null, [classeId, date, seance], []
  )

  useEffect(() => {
    setLignes(feuille.donnees)
    setModifiee(false)
  }, [feuille.donnees])

  const majLigne = (eleveId: number, champs: Partial<LignePresence>) => {
    setLignes((l) => l.map((x) => (x.eleve_id === eleveId ? { ...x, ...champs } : x)))
    setModifiee(true)
  }

  const toutPresent = () => {
    setLignes((l) => l.map((x) => ({ ...x, statut: 'PRESENT', justifie: 0, motif: null })))
    setModifiee(true)
  }

  const enregistrer = () =>
    executer(
      async () => {
        if (!classeId) throw new Error('Choisissez une classe.')
        const resultat = await appeler<{ enregistrees: number; sms_programmes: number }>(
          'presence.enregistrer', classeId, date, seance, lignes
        )
        return resultat
      },
      { succes: "Appel enregistré.", surSucces: () => { setModifiee(false); feuille.recharger() } }
    )

  const compteurs = STATUTS_PRESENCE.map((s) => ({
    ...s,
    nombre: lignes.filter((l) => l.statut === s.code).length
  }))
  const presents = lignes.filter((l) => l.statut === 'PRESENT' || l.statut === 'RETARD').length

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Choisir…"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: `${c.libelle} (${c.effectif ?? 0})` }))}
          />
        </Champ>
        <Champ label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={aujourdHui()} />
        </Champ>
        <Champ label="Séance">
          <Selection
            valeur={seance}
            surChangement={(v) => setSeance(v ?? 'MATIN')}
            options={[
              { valeur: 'MATIN', libelle: 'Matin' },
              { valeur: 'APRES_MIDI', libelle: 'Après-midi' }
            ]}
          />
        </Champ>
        {classeId && (
          <>
            <button className="bouton" onClick={toutPresent}>
              <CheckCheck size={16} /> Tous présents
            </button>
            <button
              className="bouton"
              onClick={() => document.apercu('impression.feuille_appel', 'feuille-appel', classeId, date.slice(0, 7))}
            >
              <Printer size={16} /> Fiche papier
            </button>
            <button className="bouton principal" onClick={enregistrer} disabled={enCours || !modifiee}>
              <Save size={16} /> Enregistrer{modifiee ? ' *' : ''}
            </button>
          </>
        )}
      </div>

      {!classeId ? (
        <Carte>
          <EtatVide
            icone={<CalendarDays size={42} />}
            titre="Choisissez une classe"
            description="Tous les élèves sont marqués présents par défaut : ne touchez que les exceptions."
          />
        </Carte>      ) : feuille.chargement ? (        <Chargement />
      ) : (
        <>
          <div className="entre mb-12" style={{ gap: 16, flexWrap: 'wrap' }}>
            {compteurs.map((c) => (
              <span key={c.code} className="etiquette" style={{ borderLeft: `3px solid ${c.couleur}` }}>
                {c.libelle} : <b style={{ marginLeft: 4 }}>{c.nombre}</b>
              </span>
            ))}
            <span className="pousse doux petit">
              Taux de présence : <b>{lignes.length ? ((presents / lignes.length) * 100).toFixed(0) : 0} %</b>
            </span>
          </div>

          <Carte sansMarge>
            <div className="tableau-conteneur" style={{ maxHeight: '62vh' }}>
              <table className="tableau compacte">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>N°</th>
                    <th>Nom et prénom</th>
                    <th style={{ width: 360 }}>Statut</th>
                    <th className="centre" style={{ width: 90 }}>Justifié</th>
                    <th style={{ width: 200 }}>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, index) => (
                    <tr key={l.eleve_id}>
                      <td className="centre discret petit">{index + 1}</td>
                      <td>
                        <div className="gras">{l.nom_complet}</div>
                        <div className="petit discret mono">{l.matricule}</div>
                      </td>
                      <td>
                        <div className="groupe-boutons">
                          {STATUTS_PRESENCE.map((s) => (
                            <button
                              key={s.code}
                              className={l.statut === s.code ? 'actif' : ''}
                              style={l.statut === s.code ? { background: s.couleur, color: '#fff' } : undefined}
                              onClick={() => majLigne(l.eleve_id, { statut: s.code })}
                            >
                              {s.libelle}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="centre">
                        <input
                          type="checkbox"
                          checked={Boolean(l.justifie)}
                          disabled={l.statut === 'PRESENT'}
                          onChange={(e) => majLigne(l.eleve_id, { justifie: e.target.checked ? 1 : 0 })}
                        />
                      </td>
                      <td>
                        <input
                          value={l.motif ?? ''}
                          disabled={l.statut === 'PRESENT'}
                          placeholder="Maladie, deuil…"
                          onChange={(e) => majLigne(l.eleve_id, { motif: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <Message type="info">            Si l’envoi automatique de SMS est active dans les paramètres, les parents des élèves absents non
            justifies recoivent un message des l’enregistrement de l’appel.          </Message>
        </>
      )}
    </>
  )
}

/* -------------------------------- Synthese ------------------------------- */

function OngletSynthese() {
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const premierDuMois = `${aujourdHui().slice(0, 7)}-01`
  const [debut, setDebut] = useState(premierDuMois)
  const [fin, setFin] = useState(aujourdHui())

  const synthese = useDonnees<any[]>(classeId ? 'presence.synthese' : null, [classeId, debut, fin], [])

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Choisir…"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
        <Champ label="Du"><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ>
        <Champ label="Au"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></Champ>
      </div>

      {!classeId ? (
        <Carte><EtatVide titre="Choisissez une classe" /></Carte>
      ) : (
        <Carte sansMarge>
          <Tableau
            lignes={synthese.donnees}
            cleLigne={(l) => l.eleve_id}
            vide={<EtatVide titre="Aucun appel enregistré" description="Faites l’appel pour alimenter cette synthèse." />}
            colonnes={[
              { cle: 'nom_complet', titre: 'Élève', rendu: (l) => (
                <div>
                  <div className="gras">{l.nom_complet}</div>
                  <div className="petit discret mono">{l.matricule}</div>
                </div>
              ) },
              { cle: 'seances', titre: 'Séances', alignement: 'centre' },
              { cle: 'presences', titre: 'Présences', alignement: 'centre' },
              { cle: 'absences', titre: 'Absences', alignement: 'centre', rendu: (l) =>
                l.absences > 0 ? <b style={{ color: 'var(--danger)' }}>{l.absences}</b> : '0' },
              { cle: 'absences_justifiees', titre: 'Dont justifiées', alignement: 'centre' },
              { cle: 'retards', titre: 'Retards', alignement: 'centre' },
              { cle: 'taux_presence', titre: 'Assiduité', alignement: 'droite', largeur: '150px', rendu: (l) => (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="nombre petit">{l.taux_presence} %</span>
                  <BarreProgression pourcentage={l.taux_presence} />
                </div>
              ) }
            ]}
          />
        </Carte>
      )}
    </>
  )
}

/* --------------------------------- Alertes ------------------------------- */

function OngletAlertes() {
  const { executer } = useAction()
  const premierDuMois = `${aujourdHui().slice(0, 7)}-01`
  const [debut, setDebut] = useState(premierDuMois)
  const [fin, setFin] = useState(aujourdHui())
  const [seuil, setSeuil] = useState(3)
  const [selection, setSelection] = useState<number[]>([])

  const alertes = useDonnees<any[]>('presence.absenteistes', [debut, fin, seuil], [])

  const convoquer = () =>
    executer(
      async () => {
        if (selection.length === 0) throw new Error('Sélectionnez au moins un élève.')
        await appeler('sms.campagne', 'CONVOCATION', selection, {
          motif: `absences repetees depuis le ${formaterDate(debut)}`
        })
      },
      { succes: 'Convocations mises en file d’attente.', surSucces: () => setSelection([]) }
    )

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Du"><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ>
        <Champ label="Au"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></Champ>
        <Champ label="A partir de" aide="absences non justifiées">
          <input type="number" min={1} style={{ width: 80 }} value={seuil} onChange={(e) => setSeuil(Number(e.target.value))} />
        </Champ>
        <button className="bouton principal" onClick={convoquer} disabled={selection.length === 0}>
          Convoquer {selection.length > 0 ? `${selection.length} tuteur(s)` : 'les tuteurs'}
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={alertes.donnees}
          cleLigne={(l) => l.eleve_id}
          vide={
            <EtatVide
              icone={<TriangleAlert size={42} />}
              titre="Aucun élève au-dessus du seuil"
              description="L’assiduité est satisfaisante sur la période choisie."
            />
          }
          colonnes={[
            { cle: 'selection', titre: '', largeur: '44px', alignement: 'centre', rendu: (l) => (
              <input
                type="checkbox"
                checked={selection.includes(l.eleve_id)}
                onChange={(e) =>
                  setSelection((s) => (e.target.checked ? [...s, l.eleve_id] : s.filter((x) => x !== l.eleve_id)))
                }
              />
            ) },
            { cle: 'nom_complet', titre: 'Élève', rendu: (l) => <b>{l.nom_complet}</b> },
            { cle: 'classe_libelle', titre: 'Classe', rendu: (l) => <Etiquette variante="primaire">{l.classe_libelle}</Etiquette> },
            { cle: 'absences', titre: 'Absences non justifiées', alignement: 'centre', rendu: (l) => (
              <b style={{ color: 'var(--danger)' }}>{l.absences}</b>
            ) },
            { cle: 'tuteur_telephone', titre: 'Téléphone du tuteur', rendu: (l) =>
              l.tuteur_telephone ? <span className="mono petit">{l.tuteur_telephone}</span>
                : <Etiquette variante="alerte">Pas de numéro</Etiquette> }
          ]}
        />
      </Carte>
    </>
  )
}
