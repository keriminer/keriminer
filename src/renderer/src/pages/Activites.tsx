import { useState } from 'react'
import { Activity, CheckCheck, Plus, Save, Trash2 } from 'lucide-react'
import type { ActivitePedagogique } from '@shared/types'
import { useAction, useDonnees } from '../hooks'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Message,
  Modale, Onglets, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { aujourdHui, formaterDate } from '@shared/format'

const TYPES = [
  { code: 'JOURNEE_PEDAGOGIQUE', libelle: 'Journee pédagogique' },
  { code: 'FORMATION', libelle: 'Formation' },
  { code: 'CONSEIL_CLASSE', libelle: 'Conseil de classe' },
  { code: 'REUNION_PARENTS', libelle: 'Réunion de parents' },
  { code: 'REUNION_PERSONNEL', libelle: 'Réunion du personnel' },
  { code: 'EVENEMENT', libelle: 'Événement scolaire' }
]

export default function Activites() {
  const [onglet, setOnglet] = useState('activites')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Journees pédagogiques et activités</h1>
          <div className="sous-texte">            Planification, liste de présence et rapport archive — la trace exigee lors des inspections          </div>
        </div>
      </div>
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'activites', libelle: 'Activités' },
          { cle: 'bilan', libelle: 'Participation des enseignants' }
        ]}
      />
      {onglet === 'activites' && <OngletActivites />}
      {onglet === 'bilan' && <OngletBilan />}
    </>
  )
}

function OngletActivites() {
  const { executer } = useAction()
  const activites = useDonnees<ActivitePedagogique[]>('activite.liste', [], [])
  const [edition, setEdition] = useState<ActivitePedagogique | null | 'nouvelle'>(null)
  const [presence, setPresence] = useState<ActivitePedagogique | null>(null)

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">{activites.donnees.length} activité(s) planifiée(s) cette année</div>
        <button className="bouton principal" onClick={() => setEdition('nouvelle')}>
          <Plus size={16} /> Planifier une activité
        </button>
      </div>

      <Carte sansMarge>
        {activites.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={activites.donnees}
            cleLigne={(a) => a.id}
            surClicLigne={setPresence}
            vide={
              <EtatVide
                icone={<Activity size={42} />}
                titre="Aucune activité planifiée"
                description="Planifiez vos journees pédagogiques, formations et conseils de classe."
                action={
                  <button className="bouton principal" onClick={() => setEdition('nouvelle')}>
                    <Plus size={16} /> Planifier
                  </button>
                }
              />
            }
            colonnes={[
              { cle: 'libelle', titre: 'Activité', rendu: (a) => (
                <div>
                  <div className="gras">{a.libelle}</div>
                  <div className="petit discret">
                    {a.lieu ?? 'Lieu non précise'}{a.animateur ? ` · anime par ${a.animateur}` : ''}
                  </div>
                </div>
              ) },
              { cle: 'type', titre: 'Type', rendu: (a) => (
                <Etiquette>{TYPES.find((t) => t.code === a.type)?.libelle ?? a.type}</Etiquette>
              ) },
              { cle: 'date_debut', titre: 'Date', rendu: (a) => (
                <div>
                  <div>{formaterDate(a.date_debut)}</div>
                  {a.heure_debut && <div className="petit discret">{a.heure_debut}–{a.heure_fin ?? ''}</div>}
                </div>
              ) },
              { cle: 'participation', titre: 'Participation', alignement: 'droite', largeur: '170px', rendu: (a) => {
                const taux = (a.nb_participants ?? 0) > 0 ? ((a.nb_presents ?? 0) / (a.nb_participants ?? 1)) * 100 : 0
                return (
                  <div className="entre fin" style={{ gap: 8 }}>
                    <span className="petit nombre">{a.nb_presents ?? 0}/{a.nb_participants ?? 0}</span>
                    <BarreProgression pourcentage={taux} />
                  </div>
                )
              } },
              { cle: 'statut', titre: 'Statut', rendu: (a) => (
                <Etiquette
                  variante={
                    a.statut === 'TERMINEE' ? 'succes' : a.statut === 'ANNULEE' ? 'danger' :
                    a.statut === 'EN_COURS' ? 'info' : ''
                  }
                >
                  {a.statut}
                </Etiquette>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (a) => (
                <div className="entre fin" onClick={(e) => e.stopPropagation()}>
                  <button className="bouton petit" onClick={() => setPresence(a)}>Présences</button>
                  <button className="bouton discret petit" onClick={() => setEdition(a)}>Modifier</button>
                  <button
                    className="bouton discret petit"
                    onClick={() =>
                      executer(() => appeler('activite.supprimer', a.id), {
                        succes: 'Activité supprimée.',
                        surSucces: activites.recharger
                      })
                    }
                  >
                    <Trash2 size={15} color="var(--danger)" />
                  </button>
                </div>
              ) }
            ]}
          />
        )}
      </Carte>

      {edition && (
        <FormulaireActivite
          activite={edition === 'nouvelle' ? null : edition}
          surFermeture={() => setEdition(null)}
          surEnregistrement={() => { setEdition(null); activites.recharger() }}
        />
      )}

      {presence && !edition && (
        <FeuillePresence
          activite={presence}
          surFermeture={() => setPresence(null)}
          surChangement={activites.recharger}
        />
      )}
    </>
  )
}

function FormulaireActivite({
  activite, surFermeture, surEnregistrement
}: {
  activite: ActivitePedagogique | null
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState({
    libelle: activite?.libelle ?? '',
    type: activite?.type ?? 'JOURNEE_PEDAGOGIQUE',
    date_debut: activite?.date_debut ?? aujourdHui(),
    date_fin: activite?.date_fin ?? '',
    heure_debut: activite?.heure_debut ?? '08:00',
    heure_fin: activite?.heure_fin ?? '16:00',
    lieu: activite?.lieu ?? '',
    animateur: activite?.animateur ?? '',
    objectifs: activite?.objectifs ?? '',
    statut: activite?.statut ?? 'PLANIFIEE',
    rapport: activite?.rapport ?? ''
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  return (
    <Modale
      ouverte
      taille="large"
      titre={activite ? `Modifier — ${activite.libelle}` : 'Nouvelle activité'}
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
                  if (!d.libelle.trim()) throw new Error("L’intitulé est obligatoire.")
                  const charge = { ...d, date_fin: d.date_fin || null }
                  if (activite) await appeler('activite.modifier', activite.id, charge)
                  else await appeler('activite.creer', charge)
                },
                { succes: 'Activité enregistrée.', surSucces: surEnregistrement }
              )
            }
          >
            <Save size={16} /> Enregistrer
          </button>
        </>
      }
    >
      <div className="ligne-champs">
        <Champ label="Intitulé" obligatoire>
          <input autoFocus value={d.libelle} onChange={(e) => maj({ libelle: e.target.value })} />
        </Champ>
        <Champ label="Type">
          <Selection
            valeur={d.type}
            surChangement={(v) => maj({ type: v ?? 'JOURNEE_PEDAGOGIQUE' })}
            options={TYPES.map((t) => ({ valeur: t.code, libelle: t.libelle }))}
          />
        </Champ>
      </div>
      <div className="ligne-champs c4">
        <Champ label="Date de debut" obligatoire>
          <input type="date" value={d.date_debut} onChange={(e) => maj({ date_debut: e.target.value })} />
        </Champ>
        <Champ label="Date de fin" aide="Si plusieurs jours">
          <input type="date" value={d.date_fin} onChange={(e) => maj({ date_fin: e.target.value })} />
        </Champ>
        <Champ label="De">
          <input type="time" value={d.heure_debut} onChange={(e) => maj({ heure_debut: e.target.value })} />
        </Champ>
        <Champ label="A">
          <input type="time" value={d.heure_fin} onChange={(e) => maj({ heure_fin: e.target.value })} />
        </Champ>
      </div>
      <div className="ligne-champs c3">
        <Champ label="Lieu">
          <input value={d.lieu} onChange={(e) => maj({ lieu: e.target.value })} />
        </Champ>
        <Champ label="Animateur / formateur">
          <input value={d.animateur} onChange={(e) => maj({ animateur: e.target.value })} />
        </Champ>
        <Champ label="Statut">
          <Selection
            valeur={d.statut}
            surChangement={(v) => maj({ statut: v ?? 'PLANIFIEE' })}
            options={[
              { valeur: 'PLANIFIEE', libelle: 'Planifiée' },
              { valeur: 'EN_COURS', libelle: 'En cours' },
              { valeur: 'TERMINEE', libelle: 'Terminée' },
              { valeur: 'ANNULEE', libelle: 'Annulée' }
            ]}
          />
        </Champ>
      </div>
      <Champ label="Objectifs">
        <textarea rows={2} value={d.objectifs} onChange={(e) => maj({ objectifs: e.target.value })} />
      </Champ>
      <Champ label="Rapport" aide="A completer une fois l’activité terminée ; il reste archive">
        <textarea rows={4} value={d.rapport} onChange={(e) => maj({ rapport: e.target.value })} />
      </Champ>
    </Modale>
  )
}

function FeuillePresence({
  activite, surFermeture, surChangement
}: {
  activite: ActivitePedagogique
  surFermeture: () => void
  surChangement: () => void
}) {
  const { executer, enCours } = useAction()
  const participants = useDonnees<any[]>('activite.participants', [activite.id], [])
  const [lignes, setLignes] = useState<any[]>([])
  const [initialise, setInitialise] = useState(false)

  if (!initialise && participants.donnees.length > 0) {
    setLignes(participants.donnees)
    setInitialise(true)
  }

  const maj = (id: number, champs: any) =>
    setLignes((l) => l.map((x) => (x.enseignant_id === id ? { ...x, ...champs } : x)))

  return (
    <Modale
      ouverte
      taille="large"
      titre={`Présences — ${activite.libelle}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={() => setLignes(lignes.map((l) => ({ ...l, invite: 1, present: 1 })))}>
            <CheckCheck size={16} /> Tous invités et présents
          </button>
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(() => appeler('activite.enregistrer_participants', activite.id, lignes), {
                succes: 'Liste de présence enregistrée.',
                surSucces: () => { participants.recharger(); surChangement() }
              })
            }
          >
            <Save size={16} /> Enregistrer
          </button>
        </>
      }
    >
      <Message type="info">        Cochez d’abord les enseignants concernés (« Invité »), puis leur présence effective le jour de
        l’activité.      </Message>
      {participants.chargement ? (
        <Chargement />
      ) : (
        <Tableau
          compacte
          lignes={lignes}
          cleLigne={(l) => l.enseignant_id}
          colonnes={[
            { cle: 'nom_complet', titre: 'Enseignant', rendu: (l) => (
              <div>
                <div className="gras">{l.nom_complet}</div>
                <div className="petit discret">{l.specialite ?? ''}</div>
              </div>
            ) },
            { cle: 'invite', titre: 'Invite', alignement: 'centre', largeur: '90px', rendu: (l) => (
              <input
                type="checkbox"
                checked={Boolean(l.invite)}
                onChange={(e) => maj(l.enseignant_id, { invite: e.target.checked ? 1 : 0, present: 0 })}
              />
            ) },
            { cle: 'present', titre: 'Présent', alignement: 'centre', largeur: '90px', rendu: (l) => (
              <input
                type="checkbox"
                disabled={!l.invite}
                checked={Boolean(l.present)}
                onChange={(e) => maj(l.enseignant_id, { present: e.target.checked ? 1 : 0 })}
              />
            ) },
            { cle: 'observation', titre: 'Observation', rendu: (l) => (
              <input
                value={l.observation ?? ''}
                disabled={!l.invite}
                onChange={(e) => maj(l.enseignant_id, { observation: e.target.value })}
              />
            ) }
          ]}
        />
      )}
    </Modale>
  )
}

function OngletBilan() {
  const bilan = useDonnees<any[]>('activite.bilan', [], [])
  return (
    <Carte titre="Taux de participation" sousTitre="Présence de chaque enseignant aux activités de l’année" sansMarge>
      <Tableau
        lignes={bilan.donnees}
        cleLigne={(l) => l.enseignant_id}
        vide={<EtatVide titre="Aucune donnee" description="Les participations apparaîtront après la première activité." />}
        colonnes={[
          { cle: 'nom_complet', titre: 'Enseignant' },
          { cle: 'invitations', titre: 'Invitations', alignement: 'centre' },
          { cle: 'presences', titre: 'Présences', alignement: 'centre' },
          { cle: 'taux', titre: 'Taux', alignement: 'droite', largeur: '170px', rendu: (l) => (
            <div className="entre fin" style={{ gap: 8 }}>
              <span className="petit nombre">{l.taux} %</span>
              <BarreProgression pourcentage={l.taux} />
            </div>
          ) }
        ]}
      />
    </Carte>
  )
}
