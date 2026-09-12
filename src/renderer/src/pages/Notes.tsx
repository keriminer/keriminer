import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCheck, Lock, Plus, Save, Trash2 } from 'lucide-react'
import type { Classe, ClasseMatiere, Evaluation, Periode } from '@shared/types'
import { useAction, useDonnees } from '../hooks'
import {
  Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide, Message, Modale,
  Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { TYPES_EVALUATION } from '@shared/constants'
import { formaterDate, formaterNote } from '@shared/format'

interface LigneFeuille {
  eleve_id: number
  matricule: string
  nom_complet: string
  sexe: string
  note: { valeur: number | null; absent: number; justifie: number; observation: string | null } | null
}

export default function Notes() {
  const { notifier } = useNotifications()
  const { executer } = useAction()

  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const periodes = useDonnees<Periode[]>('annee.periodes', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const [periodeId, setPeriodeId] = useState<number | null>(null)
  const [classeMatiereId, setClasseMatiereId] = useState<number | null>(null)
  const [evaluationId, setEvaluationId] = useState<number | null>(null)
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [suppression, setSuppression] = useState<Evaluation | null>(null)

  const attributions = useDonnees<ClasseMatiere[]>(classeId ? 'classe.attributions' : null, [classeId], [])
  const evaluations = useDonnees<Evaluation[]>(
    classeMatiereId && periodeId ? 'evaluation.liste' : null,
    [classeMatiereId, periodeId],
    []
  )

  useEffect(() => {
    if (!periodeId && periodes.donnees.length) {
      const aujourdHui = new Date().toISOString().slice(0, 10)
      const courante = periodes.donnees.find((p) => p.date_debut <= aujourdHui && p.date_fin >= aujourdHui)
      setPeriodeId((courante ?? periodes.donnees[0]).id)
    }
  }, [periodes.donnees, periodeId])

  useEffect(() => setClasseMatiereId(null), [classeId])
  useEffect(() => setEvaluationId(null), [classeMatiereId, periodeId])

  const periode = periodes.donnees.find((p) => p.id === periodeId)
  const verrouillee = Boolean(periode?.verrouillee)

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Saisie des notes</h1>
          <div className="sous-texte">Choisissez une classe, une matière, puis une évaluation</div>
        </div>
      </div>

      <div className="barre-filtres">
        <Champ label="Période">
          <Selection
            valeur={periodeId}
            surChangement={setPeriodeId}
            vide="Choisir…"
            options={periodes.donnees.map((p) => ({
              valeur: p.id,
              libelle: `${p.libelle}${p.verrouillee ? ' (verrouillée)' : ''}`
            }))}
          />
        </Champ>
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Choisir…"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
        <Champ label="Matière">
          <Selection
            valeur={classeMatiereId}
            surChangement={setClasseMatiereId}
            vide={classeId ? 'Choisir…' : 'Choisissez d’abord une classe'}
            options={attributions.donnees.map((a) => ({
              valeur: a.id,
              libelle: `${a.matiere_libelle} (coef. ${a.coefficient})`
            }))}
          />
        </Champ>
        {classeMatiereId && periodeId && !verrouillee && (
          <button className="bouton principal" onClick={() => setCreationOuverte(true)}>
            <Plus size={16} /> Nouvelle evaluation
          </button>
        )}
      </div>

      {verrouillee && (
        <Message type="alerte">
          La periode « {periode?.libelle} » est verrouillee : les notes ne sont plus modifiables. Un
          administrateur peut la deverrouiller depuis les parametres.
        </Message>
      )}

      {!classeMatiereId ? (
        <Carte>
          <EtatVide
            icone={<ClipboardCheck size={42} />}
            titre="Sélectionnez une matière"
            description="Les évaluations et la feuille de notes apparaîtront ici."
          />
        </Carte>
      ) : (
        <div className="grille" style={{ gridTemplateColumns: '340px minmax(0, 1fr)' }}>
          <Carte titre="Évaluations" sousTitre={periode?.libelle} sansMarge>
            {evaluations.chargement ? (
              <Chargement />
            ) : evaluations.donnees.length === 0 ? (
              <EtatVide titre="Aucune évaluation" description="Créez une interrogation, un devoir ou une composition." />
            ) : (
              <div className="pile" style={{ padding: 8, gap: 4 }}>
                {evaluations.donnees.map((e) => (
                  <div
                    key={e.id}
                    className={`choix-carte${evaluationId === e.id ? ' choisi' : ''}`}
                    onClick={() => setEvaluationId(e.id)}
                    style={{ padding: '8px 10px' }}
                  >
                    <div className="entre espace">
                      <span className="gras petit">{e.libelle}</span>
                      <Etiquette>{e.type}</Etiquette>
                    </div>
                    <div className="entre espace petit discret mt-8">
                      <span>{formaterDate(e.date_evaluation)} · /{e.bareme} · poids {e.poids}</span>
                      <span>{e.nb_notes ?? 0} note(s)</span>
                    </div>
                    {!verrouillee && (
                      <button
                        className="bouton discret petit mt-8"
                        onClick={(ev) => { ev.stopPropagation(); setSuppression(e) }}
                      >
                        <Trash2 size={13} /> Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Carte>

          {evaluationId ? (
            <FeuilleDeNotes
              evaluationId={evaluationId}
              verrouillee={verrouillee}
              surEnregistrement={evaluations.recharger}
            />
          ) : (
            <Carte>
              <EtatVide titre="Choisissez une évaluation" description="Vous pourrez alors saisir les notes de la classe." />
            </Carte>
          )}
        </div>
      )}

      {creationOuverte && classeMatiereId && periodeId && (
        <CreationEvaluation
          classeMatiereId={classeMatiereId}
          periodeId={periodeId}
          surFermeture={() => setCreationOuverte(false)}
          surCreation={(id) => { setCreationOuverte(false); evaluations.recharger(); setEvaluationId(id) }}
        />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer cette évaluation ?"
        message={<>Toutes les notes de « <b>{suppression?.libelle}</b> » seront perdues.</>}
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('evaluation.supprimer', suppression!.id), {
            succes: 'Évaluation supprimée.',
            surSucces: () => {
              if (evaluationId === suppression!.id) setEvaluationId(null)
              setSuppression(null)
              evaluations.recharger()
            }
          })
        }
      />
    </>
  )
}

/* --------------------------- Feuille de saisie ---------------------------- */

/**
 * Saisie rapide : le clavier suffit. Entree passe a l’eleve suivant, « a »
 * marque une absence. C’est la difference entre saisir une classe en 2 minutes
 * et en 15.
 */
function FeuilleDeNotes({
  evaluationId, verrouillee, surEnregistrement
}: {
  evaluationId: number
  verrouillee: boolean
  surEnregistrement: () => void
}) {
  const { notifier } = useNotifications()
  const { executer, enCours } = useAction()
  const feuille = useDonnees<{ evaluation: Evaluation; lignes: LigneFeuille[] } | null>(
    'note.feuille', [evaluationId], null
  )
  const [saisies, setSaisies] = useState<Record<number, { valeur: string; absent: boolean; justifie: boolean }>>({})
  const [modifiee, setModifiee] = useState(false)
  const champs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!feuille.donnees) return
    const initial: Record<number, { valeur: string; absent: boolean; justifie: boolean }> = {}
    for (const l of feuille.donnees.lignes) {
      initial[l.eleve_id] = {
        valeur: l.note?.valeur !== null && l.note?.valeur !== undefined ? String(l.note.valeur) : '',
        absent: Boolean(l.note?.absent),
        justifie: Boolean(l.note?.justifie)
      }
    }
    setSaisies(initial)
    setModifiee(false)
  }, [feuille.donnees])

  const evaluation = feuille.donnees?.evaluation
  const lignes = feuille.donnees?.lignes ?? []

  const statistiques = useMemo(() => {
    const valeurs = Object.values(saisies)
      .filter((s) => !s.absent && s.valeur !== '')
      .map((s) => Number(s.valeur))
      .filter((v) => !Number.isNaN(v))
    if (valeurs.length === 0) return null
    const bareme = evaluation?.bareme || 20
    const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length
    return {
      saisies: valeurs.length,
      moyenne,
      min: Math.min(...valeurs),
      max: Math.max(...valeurs),
      reussite: (valeurs.filter((v) => v / bareme >= 0.5).length / valeurs.length) * 100
    }
  }, [saisies, evaluation])

  const majSaisie = (eleveId: number, champs2: Partial<{ valeur: string; absent: boolean; justifie: boolean }>) => {
    setSaisies((s) => ({ ...s, [eleveId]: { ...s[eleveId], ...champs2 } }))
    setModifiee(true)
  }

  const gererTouche = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      const suivant = lignes[index + 1]
      if (suivant) champs.current[suivant.eleve_id]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const precedent = lignes[index - 1]
      if (precedent) champs.current[precedent.eleve_id]?.focus()
    }
  }

  const enregistrer = () =>
    executer(
      async () => {
        const bareme = evaluation?.bareme ?? 20
        const charge = lignes.map((l) => {
          const s = saisies[l.eleve_id]
          const valeur = s?.valeur === '' || s?.absent ? null : Number(s.valeur)
          if (valeur !== null && (Number.isNaN(valeur) || valeur < 0 || valeur > bareme)) {
            throw new Error(`Note invalide pour ${l.nom_complet} : attendu entre 0 et ${bareme}.`)
          }
          return {
            eleve_id: l.eleve_id,
            valeur,
            absent: s?.absent ? 1 : 0,
            justifie: s?.justifie ? 1 : 0
          }
        })
        await appeler('note.enregistrer', evaluationId, charge)
      },
      {
        succes: 'Notes enregistrées.',
        surSucces: () => { setModifiee(false); feuille.recharger(); surEnregistrement() }
      }
    )

  // Avertissement si l’on quitte la page avec des notes non sauvegardees.
  useEffect(() => {
    if (!modifiee) return
    const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [modifiee])

  if (feuille.chargement) return <Carte><Chargement /></Carte>
  if (!evaluation) return <Carte><EtatVide titre="Évaluation introuvable" /></Carte>

  return (
    <Carte
      titre={evaluation.libelle}
      sousTitre={`${evaluation.matiere_libelle ?? ''} · ${evaluation.classe_libelle ?? ''} · note sur ${evaluation.bareme}`}
      actions={
        !verrouillee && (
          <button className="bouton principal" onClick={enregistrer} disabled={enCours || !modifiee}>
            <Save size={16} /> Enregistrer{modifiee ? ' *' : ''}
          </button>
        )
      }
      sansMarge
    >
      {statistiques && (
        <div
          className="entre"
          style={{ padding: '10px 14px', borderBottom: '1px solid var(--bordure)', gap: 20, flexWrap: 'wrap' }}
        >
          <span className="petit doux">Saisies : <b>{statistiques.saisies}/{lignes.length}</b></span>
          <span className="petit doux">Moyenne : <b>{formaterNote(statistiques.moyenne)}</b>/{evaluation.bareme}</span>
          <span className="petit doux">Min : <b>{formaterNote(statistiques.min)}</b></span>
          <span className="petit doux">Max : <b>{formaterNote(statistiques.max)}</b></span>
          <span className="petit doux">Réussite : <b>{statistiques.reussite.toFixed(0)} %</b></span>
        </div>
      )}

      <div className="tableau-conteneur" style={{ maxHeight: '58vh' }}>
        <table className="tableau compacte">
          <thead>
            <tr>
              <th style={{ width: 44 }}>N°</th>
              <th style={{ width: 110 }}>Matricule</th>
              <th>Nom et prénom</th>
              <th className="centre" style={{ width: 110 }}>Note /{evaluation.bareme}</th>
              <th className="centre" style={{ width: 90 }}>Absent</th>
              <th className="centre" style={{ width: 100 }}>Justifié</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, index) => {
              const s = saisies[l.eleve_id] ?? { valeur: '', absent: false, justifie: false }
              return (
                <tr key={l.eleve_id}>
                  <td className="centre discret petit">{index + 1}</td>
                  <td className="mono petit">{l.matricule}</td>
                  <td>{l.nom_complet}</td>
                  <td className="centre">
                    <input
                      ref={(el) => { champs.current[l.eleve_id] = el }}
                      type="text"
                      inputMode="decimal"
                      disabled={verrouillee || s.absent}
                      value={s.valeur}
                      style={{ width: 78, textAlign: 'center' }}
                      onChange={(e) => {
                        const brut = e.target.value.replace(',', '.')
                        if (brut !== '' && !/^\d*\.?\d*$/.test(brut)) return
                        majSaisie(l.eleve_id, { valeur: brut })
                      }}
                      onKeyDown={(e) => {
                        if (e.key.toLowerCase() === 'a' && !s.valeur) {
                          e.preventDefault()
                          majSaisie(l.eleve_id, { absent: true, valeur: '' })
                          const suivant = lignes[index + 1]
                          if (suivant) champs.current[suivant.eleve_id]?.focus()
                          return
                        }
                        gererTouche(e, index)
                      }}
                    />
                  </td>
                  <td className="centre">
                    <input
                      type="checkbox"
                      disabled={verrouillee}
                      checked={s.absent}
                      onChange={(e) => majSaisie(l.eleve_id, { absent: e.target.checked, valeur: '' })}
                    />
                  </td>
                  <td className="centre">
                    <input
                      type="checkbox"
                      disabled={verrouillee || !s.absent}
                      checked={s.justifie}
                      onChange={(e) => majSaisie(l.eleve_id, { justifie: e.target.checked })}
                      title="Une absence justifiée est neutre ; une absence non justifiée compte zéro."
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!verrouillee && (
        <div className="petit discret" style={{ padding: '10px 14px', borderTop: '1px solid var(--bordure)' }}>
          Astuce : tapez la note puis <b>Entrée</b> pour passer à l’élève suivant. La touche <b>A</b> sur un
          champ vide marque une absence.
        </div>
      )}
    </Carte>
  )
}

/* --------------------------- Creation evaluation -------------------------- */

function CreationEvaluation({
  classeMatiereId, periodeId, surFermeture, surCreation
}: {
  classeMatiereId: number
  periodeId: number
  surFermeture: () => void
  surCreation: (id: number) => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState({
    type: 'INTERRO',
    libelle: '',
    date_evaluation: new Date().toISOString().slice(0, 10),
    bareme: 20,
    poids: 1
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  const creer = () =>
    executer(
      async () => {
        if (!d.libelle.trim()) throw new Error("Donnez un intitulé à l’évaluation.")
        const id = await appeler<number>('evaluation.creer', {
          classe_matiere_id: classeMatiereId,
          periode_id: periodeId,
          ...d,
          bareme: Number(d.bareme),
          poids: Number(d.poids)
        })
        surCreation(id)
      },
      { succes: 'Évaluation créée.' }
    )

  return (
    <Modale
      ouverte
      titre="Nouvelle évaluation"
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={creer} disabled={enCours}>Créer</button>
        </>
      }
    >
      <Champ label="Type">
        <div className="enveloppe">
          {TYPES_EVALUATION.map((t) => (
            <button
              key={t.code}
              className={`bouton ${d.type === t.code ? 'principal' : ''}`}
              onClick={() => maj({ type: t.code, poids: t.poidsDefaut, libelle: d.libelle || t.libelle })}
            >
              {t.libelle}
            </button>
          ))}
        </div>
      </Champ>
      <Champ label="Intitulé" obligatoire aide="Ex. : Interrogation n°1, Composition du 1er trimestre">
        <input autoFocus value={d.libelle} onChange={(e) => maj({ libelle: e.target.value })} />
      </Champ>
      <div className="ligne-champs c3">
        <Champ label="Date">
          <input type="date" value={d.date_evaluation} onChange={(e) => maj({ date_evaluation: e.target.value })} />
        </Champ>
        <Champ label="Barème" aide="Note maximale">
          <input type="number" min={1} value={d.bareme} onChange={(e) => maj({ bareme: Number(e.target.value) })} />
        </Champ>
        <Champ label="Poids" aide="Importance dans la moyenne de la matière">
          <input type="number" min={0.5} step={0.5} value={d.poids} onChange={(e) => maj({ poids: Number(e.target.value) })} />
        </Champ>
      </div>
      <Message type="info">        Toutes les notes sont ramenees sur 20 pour le calcul des moyennes, quel que soit le barème choisi ici.      </Message>
    </Modale>
  )
}
