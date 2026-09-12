import { useEffect, useState } from 'react'
import { BedDouble, Plus, Save, Trash2, UtensilsCrossed } from 'lucide-react'
import type { Dortoir, Enseignant, Lit, SituationFinanciere } from '@shared/types'
import { useAction, useDonnees } from '../hooks'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Indicateur,
  Message, Modale, Onglets, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { aujourdHui } from '@shared/format'

export default function Internat() {
  const [onglet, setOnglet] = useState('pensionnaires')
  const stats = useDonnees<any>('internat.statistiques', [], {
    capacite: 0, lits: 0, occupes: 0, libres: 0, hors_service: 0, taux_occupation: 0
  })

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Internat</h1>
          <div className="sous-texte">Dortoirs, affectation des lits, repas et pointage de nuit</div>
        </div>
      </div>

      <div className="grille c4 mb-16">
        <Indicateur icone={<BedDouble size={20} />} valeur={stats.donnees.occupes} etiquette="Pensionnaires hébergés" />
        <Indicateur valeur={stats.donnees.libres} etiquette="Lits libres" couleurIcone="var(--succes)" />
        <Indicateur valeur={stats.donnees.hors_service} etiquette="Lits hors service" couleurIcone="var(--danger)" />
        <Carte>
          <div className="indicateur">
            <div style={{ width: '100%' }}>
              <div className="valeur">{stats.donnees.taux_occupation} %</div>
              <div className="etiquette">Taux d’occupation</div>
              <div className="mt-8"><BarreProgression pourcentage={stats.donnees.taux_occupation} /></div>
            </div>
          </div>
        </Carte>
      </div>

      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'pensionnaires', libelle: 'Pensionnaires' },
          { cle: 'dortoirs', libelle: 'Dortoirs et lits' },
          { cle: 'pointage', libelle: 'Repas et pointage' }
        ]}
      />

      {onglet === 'pensionnaires' && <OngletPensionnaires surChangement={stats.recharger} />}
      {onglet === 'dortoirs' && <OngletDortoirs surChangement={stats.recharger} />}
      {onglet === 'pointage' && <OngletPointage />}
    </>
  )
}

function OngletPensionnaires({ surChangement }: { surChangement: () => void }) {
  const { executer } = useAction()
  const pensionnaires = useDonnees<any[]>('internat.pensionnaires', [], [])
  const [affectation, setAffectation] = useState(false)

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">{pensionnaires.donnees.length} pensionnaire(s)</div>
        <button className="bouton principal" onClick={() => setAffectation(true)}>
          <Plus size={16} /> Affecter un élève
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={pensionnaires.donnees}
          cleLigne={(p) => p.id}
          vide={
            <EtatVide
              icone={<BedDouble size={42} />}
              titre="Aucun pensionnaire"
              description="Créez d’abord vos dortoirs et leurs lits, puis affectez les élèves internes."
            />
          }
          colonnes={[
            { cle: 'nom_complet', titre: 'Élève', rendu: (p) => (
              <div>
                <div className="gras">{p.nom_complet}</div>
                <div className="petit discret">
                  <span className="mono">{p.matricule}</span> · {p.classe_libelle}
                </div>
              </div>
            ) },
            { cle: 'sexe', titre: 'Sexe', alignement: 'centre', rendu: (p) => (p.sexe === 'F' ? 'F' : 'M') },
            { cle: 'dortoir_libelle', titre: 'Dortoir', rendu: (p) =>
              p.dortoir_libelle ? <Etiquette variante="primaire">{p.dortoir_libelle}</Etiquette> : <Etiquette variante="alerte">Sans lit</Etiquette> },
            { cle: 'lit_numero', titre: 'Lit', alignement: 'centre' },
            { cle: 'date_entree', titre: 'Entrée' },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (p) => (
              <button
                className="bouton discret petit"
                onClick={() =>
                  executer(() => appeler('internat.liberer', p.id, aujourdHui()), {
                    succes: 'Lit libéré.',
                    surSucces: () => { pensionnaires.recharger(); surChangement() }
                  })
                }
              >Libérer</button>
            ) }
          ]}
        />
      </Carte>

      {affectation && (
        <AffectationLit
          surFermeture={() => setAffectation(false)}
          surEnregistrement={() => { setAffectation(false); pensionnaires.recharger(); surChangement() }}
        />
      )}
    </>
  )
}

function AffectationLit({
  surFermeture, surEnregistrement
}: {
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const situations = useDonnees<SituationFinanciere[]>('finance.situations', [{}], [])
  const dortoirs = useDonnees<Dortoir[]>('internat.dortoirs', [], [])
  const [dortoirId, setDortoirId] = useState<number | null>(null)
  const [inscriptionId, setInscriptionId] = useState<number | null>(null)
  const [litId, setLitId] = useState<number | null>(null)
  const lits = useDonnees<Lit[]>(dortoirId ? 'internat.lits' : null, [dortoirId], [])

  return (
    <Modale
      ouverte
      titre="Affecter un élève à un lit"
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(
                async () => {
                  if (!inscriptionId) throw new Error('Choisissez un élève.')
                  if (!litId) throw new Error('Choisissez un lit.')
                  await appeler('internat.affecter', inscriptionId, litId)
                },
                { succes: 'Élève affecté.', surSucces: surEnregistrement }
              )
            }
          >            Affecter          </button>
        </>
      }
    >
      <Champ label="Élève" obligatoire>
        <Selection
          valeur={inscriptionId}
          surChangement={setInscriptionId}
          vide="Choisir…"
          options={situations.donnees.map((s) => ({
            valeur: s.inscription_id,
            libelle: `${s.nom_complet} — ${s.classe_libelle}`
          }))}
        />
      </Champ>
      <div className="ligne-champs">
        <Champ label="Dortoir" obligatoire>
          <Selection
            valeur={dortoirId}
            surChangement={(v) => { setDortoirId(v); setLitId(null) }}
            vide="Choisir…"
            options={dortoirs.donnees.map((d) => ({
              valeur: d.id,
              libelle: `${d.libelle} (${d.sexe === 'F' ? 'filles' : d.sexe === 'M' ? 'garçons' : 'mixte'})`
            }))}
          />
        </Champ>
        <Champ label="Lit" obligatoire>
          <Selection
            valeur={litId}
            surChangement={setLitId}
            vide={dortoirId ? 'Choisir…' : 'Choisissez un dortoir'}
            options={lits.donnees
              .filter((l) => !l.occupant && l.etat !== 'HORS_SERVICE')
              .map((l) => ({ valeur: l.id, libelle: `Lit ${l.numero}` }))}
          />
        </Champ>
      </div>
      <Message type="info">        Un lit déjà occupé ou hors service n’apparaît pas dans la liste. L’application refuse aussi
        d’affecter un élève à un dortoir réservé à l’autre sexe.      </Message>
    </Modale>
  )
}

function OngletDortoirs({ surChangement }: { surChangement: () => void }) {
  const { executer } = useAction()
  const dortoirs = useDonnees<Dortoir[]>('internat.dortoirs', [], [])
  const enseignants = useDonnees<Enseignant[]>('enseignant.liste', [{}], [])
  const [dortoirOuvert, setDortoirOuvert] = useState<Dortoir | null>(null)
  const [nouveau, setNouveau] = useState({ libelle: '', batiment: '', sexe: 'M', capacite: 20, responsable_id: null as number | null })

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Nom du dortoir">
          <input value={nouveau.libelle} onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })} placeholder="Dortoir Saint-Joseph" />
        </Champ>
        <Champ label="Batiment">
          <input style={{ width: 120 }} value={nouveau.batiment} onChange={(e) => setNouveau({ ...nouveau, batiment: e.target.value })} />
        </Champ>
        <Champ label="Réservé aux">
          <Selection
            valeur={nouveau.sexe}
            surChangement={(v) => setNouveau({ ...nouveau, sexe: v ?? 'M' })}
            options={[
              { valeur: 'M', libelle: 'Garçons' },
              { valeur: 'F', libelle: 'Filles' },
              { valeur: 'MIXTE', libelle: 'Mixte' }
            ]}
          />
        </Champ>
        <Champ label="Capacité">
          <input type="number" style={{ width: 90 }} value={nouveau.capacite} onChange={(e) => setNouveau({ ...nouveau, capacite: Number(e.target.value) })} />
        </Champ>
        <Champ label="Responsable">
          <Selection
            valeur={nouveau.responsable_id}
            surChangement={(v) => setNouveau({ ...nouveau, responsable_id: v })}
            vide="Aucun"
            options={enseignants.donnees.map((e) => ({ valeur: e.id, libelle: `${e.nom} ${e.prenom}` }))}
          />
        </Champ>
        <button
          className="bouton principal"
          onClick={() =>
            executer(
              async () => {
                if (!nouveau.libelle.trim()) throw new Error('Le nom du dortoir est obligatoire.')
                const id = await appeler<number>('internat.creer_dortoir', nouveau)
                if (nouveau.capacite > 0) await appeler('internat.generer_lits', id, nouveau.capacite)
              },
              {
                succes: 'Dortoir créé avec ses lits.',
                surSucces: () => { setNouveau({ ...nouveau, libelle: '', batiment: '' }); dortoirs.recharger(); surChangement() }
              }
            )
          }
        >
          <Plus size={16} /> Creer
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={dortoirs.donnees}
          cleLigne={(d) => d.id}
          surClicLigne={setDortoirOuvert}
          vide={<EtatVide icone={<BedDouble size={42} />} titre="Aucun dortoir" description="Créez vos dortoirs pour pouvoir affecter les pensionnaires." />}
          colonnes={[
            { cle: 'libelle', titre: 'Dortoir', rendu: (d) => (
              <div>
                <div className="gras">{d.libelle}</div>
                <div className="petit discret">{d.batiment ?? ''}</div>
              </div>
            ) },
            { cle: 'sexe', titre: 'Réservé aux', rendu: (d) => (
              <Etiquette>{d.sexe === 'F' ? 'Filles' : d.sexe === 'M' ? 'Garçons' : 'Mixte'}</Etiquette>
            ) },
            { cle: 'responsable_nom', titre: 'Responsable', rendu: (d: any) => d.responsable_nom ?? '—' },
            { cle: 'occupes', titre: 'Occupation', alignement: 'centre', rendu: (d: any) => (
              <Etiquette variante={(d.occupes ?? 0) >= (d.nb_lits ?? 0) ? 'danger' : 'succes'}>
                {d.occupes ?? 0} / {d.nb_lits ?? 0} lits
              </Etiquette>
            ) },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (d) => (
              <button
                className="bouton discret petit"
                onClick={(e) => {
                  e.stopPropagation()
                  executer(() => appeler('internat.supprimer_dortoir', d.id), {
                    succes: 'Dortoir supprimé.',
                    surSucces: () => { dortoirs.recharger(); surChangement() }
                  })
                }}
              >
                <Trash2 size={15} color="var(--danger)" />
              </button>
            ) }
          ]}
        />
      </Carte>

      {dortoirOuvert && (
        <GestionLits
          dortoir={dortoirOuvert}
          surFermeture={() => setDortoirOuvert(null)}
          surChangement={() => { dortoirs.recharger(); surChangement() }}
        />
      )}
    </>
  )
}

function GestionLits({
  dortoir, surFermeture, surChangement
}: {
  dortoir: Dortoir
  surFermeture: () => void
  surChangement: () => void
}) {
  const { executer } = useAction()
  const lits = useDonnees<Lit[]>('internat.lits', [dortoir.id], [])
  const [nombre, setNombre] = useState(5)

  return (
    <Modale
      ouverte
      taille="large"
      titre={`Lits — ${dortoir.libelle}`}
      surFermeture={surFermeture}
      pied={<button className="bouton principal" onClick={surFermeture}>Fermer</button>}
    >
      <div className="barre-filtres">
        <Champ label="Ajouter des lits">
          <input type="number" min={1} style={{ width: 90 }} value={nombre} onChange={(e) => setNombre(Number(e.target.value))} />
        </Champ>
        <button
          className="bouton principal"
          onClick={() =>
            executer(() => appeler('internat.generer_lits', dortoir.id, nombre), {
              succes: 'Lits ajoutés.',
              surSucces: () => { lits.recharger(); surChangement() }
            })
          }
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <Tableau
        compacte
        lignes={lits.donnees}
        cleLigne={(l) => l.id}
        vide={<EtatVide titre="Aucun lit" description="Ajoutez des lits à ce dortoir." />}
        colonnes={[
          { cle: 'numero', titre: 'Lit', rendu: (l) => <b>N° {l.numero}</b> },
          { cle: 'occupant', titre: 'Occupant', rendu: (l) =>
            l.occupant ? l.occupant : <span className="discret">Libre</span> },
          { cle: 'etat', titre: 'Etat', rendu: (l) => (
            <Selection
              valeur={l.etat}
              surChangement={(v) =>
                executer(() => appeler('internat.modifier_lit', l.id, { etat: v }), { surSucces: lits.recharger })
              }
              options={[
                { valeur: 'BON', libelle: 'Bon etat' },
                { valeur: 'A_REPARER', libelle: 'A réparer' },
                { valeur: 'HORS_SERVICE', libelle: 'Hors service' }
              ]}
            />
          ) },
          { cle: 'actions', titre: '', alignement: 'droite', rendu: (l) =>            !l.occupant ? (              <button
                className="bouton discret petit"
                onClick={() =>
                  executer(() => appeler('internat.supprimer_lit', l.id), {
                    surSucces: () => { lits.recharger(); surChangement() }
                  })
                }
              >
                <Trash2 size={15} color="var(--danger)" />
              </button>
            ) : null }
        ]}
      />
    </Modale>
  )
}

const MOMENTS = [
  { code: 'PETIT_DEJEUNER', libelle: 'Petit-déjeuner' },
  { code: 'DEJEUNER', libelle: 'Déjeuner' },
  { code: 'DINER', libelle: 'Diner' },
  { code: 'NUIT', libelle: 'Appel de nuit' }
]

function OngletPointage() {
  const { executer, enCours } = useAction()
  const [date, setDate] = useState(aujourdHui())
  const [moment, setMoment] = useState('DEJEUNER')
  const [lignes, setLignes] = useState<any[]>([])
  const [modifiee, setModifiee] = useState(false)

  const feuille = useDonnees<any[]>('internat.feuille_pointage', [date, moment], [])

  useEffect(() => {
    setLignes(feuille.donnees)
    setModifiee(false)
  }, [feuille.donnees])

  const presents = lignes.filter((l) => l.present).length

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={aujourdHui()} />
        </Champ>
        <Champ label="Moment">
          <Selection
            valeur={moment}
            surChangement={(v) => setMoment(v ?? 'DEJEUNER')}
            options={MOMENTS.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
          />
        </Champ>
        <button
          className="bouton"
          onClick={() => { setLignes(lignes.map((l) => ({ ...l, present: 1 }))); setModifiee(true) }}
        >          Tous présents        </button>
        <button
          className="bouton principal"
          disabled={enCours || !modifiee}
          onClick={() =>
            executer(() => appeler('internat.enregistrer_pointage', date, moment, lignes), {
              succes: 'Pointage enregistré.',
              surSucces: () => { setModifiee(false); feuille.recharger() }
            })
          }
        >
          <Save size={16} /> Enregistrer{modifiee ? ' *' : ''}
        </button>
      </div>

      <div className="entre mb-12" style={{ gap: 16 }}>
        <span className="etiquette succes">
          <UtensilsCrossed size={13} /> Présents : <b style={{ marginLeft: 4 }}>{presents}</b>
        </span>
        <span className="etiquette danger">Absents : <b style={{ marginLeft: 4 }}>{lignes.length - presents}</b></span>
        <span className="doux petit pousse">
          Effectif à servir pour ce repas : <b>{presents}</b>
        </span>
      </div>

      {feuille.chargement ? (
        <Chargement />
      ) : (
        <Carte sansMarge>
          <Tableau
            lignes={lignes}
            cleLigne={(l) => l.pensionnaire_id}
            vide={<EtatVide titre="Aucun pensionnaire" />}
            colonnes={[
              { cle: 'nom_complet', titre: 'Pensionnaire', rendu: (l) => (
                <div>
                  <div className="gras">{l.nom_complet}</div>
                  <div className="petit discret">
                    {l.classe_libelle}
                    {l.dortoir_libelle ? ` · ${l.dortoir_libelle} lit ${l.lit_numero}` : ''}
                  </div>
                </div>
              ) },
              { cle: 'present', titre: 'Présent', alignement: 'centre', largeur: '110px', rendu: (l) => (
                <input
                  type="checkbox"
                  checked={Boolean(l.present)}
                  onChange={(e) => {
                    setLignes((v) =>
                      v.map((x) =>
                        x.pensionnaire_id === l.pensionnaire_id ? { ...x, present: e.target.checked ? 1 : 0 } : x
                      )
                    )
                    setModifiee(true)
                  }}
                />
              ) },
              { cle: 'observation', titre: 'Observation', rendu: (l) => (
                <input
                  value={l.observation ?? ''}
                  placeholder="Permission, infirmerie…"
                  onChange={(e) => {
                    setLignes((v) =>
                      v.map((x) =>
                        x.pensionnaire_id === l.pensionnaire_id ? { ...x, observation: e.target.value } : x
                      )
                    )
                    setModifiee(true)
                  }}
                />
              ) }
            ]}
          />
        </Carte>
      )}
    </>
  )
}
