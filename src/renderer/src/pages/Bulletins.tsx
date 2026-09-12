import { useEffect, useState } from 'react'
import { Award, FileText, Printer, Save, Send } from 'lucide-react'
import type { Bulletin, Classe, Periode } from '@shared/types'
import { useAction, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Message, Modale,
  Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { formaterNote } from '@shared/format'

interface ResultatsClasse {
  classe: Classe
  periode: Periode
  eleves: {
    eleve: { id: number; nom: string; prenom: string; matricule: string }
    lignes: any[]
    total_coefficients: number
    total_points: number
    moyenne_sur_20: number | null
    rang: number | null
  }[]
  moyenne_classe: number | null
  moyenne_premier: number | null
  moyenne_dernier: number | null
  taux_reussite: number
}

export default function Bulletins() {
  const { etablissement, peut } = useSession()
  const document = useDocument()
  const { executer } = useAction()

  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const periodes = useDonnees<Periode[]>('annee.periodes', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const [periodeId, setPeriodeId] = useState<number | null>(null)
  const [bulletinOuvert, setBulletinOuvert] = useState<number | null>(null)

  useEffect(() => {
    if (!periodeId && periodes.donnees.length) {
      const aujourdHui = new Date().toISOString().slice(0, 10)
      const courante = periodes.donnees.find((p) => p.date_debut <= aujourdHui && p.date_fin >= aujourdHui)
      setPeriodeId((courante ?? periodes.donnees[0]).id)
    }
  }, [periodes.donnees, periodeId])

  const resultats = useDonnees<ResultatsClasse | null>(
    classeId && periodeId ? 'bulletin.classe' : null,
    [classeId, periodeId],
    null
  )

  const seuil = etablissement?.seuil_reussite ?? 10
  const classement = [...(resultats.donnees?.eleves ?? [])].sort(
    (a, b) => (a.rang ?? 9999) - (b.rang ?? 9999)
  )

  const envoyerSmsBulletins = () =>
    executer(
      async () => {
        const cibles = classement.filter((e) => e.moyenne_sur_20 !== null)
        if (cibles.length === 0) throw new Error('Aucun bulletin a notifier.')
        const resultat = await appeler<{ programmes: number; ignores: number }>(
          'sms.campagne',
          'BULLETIN_DISPO',
          cibles.map((e) => e.eleve.id),
          { periode: resultats.donnees?.periode.libelle ?? '' }
        )
        return resultat
      },
      { succes: 'SMS mis en file d’attente. Envoyez-les depuis la page SMS.' }
    )

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Bulletins</h1>
          <div className="sous-texte">Calcul automatique des moyennes, des rangs et des mentions</div>
        </div>
        {classeId && periodeId && classement.length > 0 && (
          <div className="actions">
            {peut('sms.envoyer') && (
              <button className="bouton" onClick={envoyerSmsBulletins}>
                <Send size={16} /> Prevenir les parents
              </button>
            )}
            <button
              className="bouton"
              onClick={() => document.enregistrer('impression.bulletins_classe', 'bulletins', classeId, periodeId)}
            >
              <FileText size={16} /> Enregistrer en PDF
            </button>
            <button
              className="bouton principal"
              onClick={() => document.apercu('impression.bulletins_classe', 'bulletins', classeId, periodeId)}
            >
              <Printer size={16} /> Imprimer la classe
            </button>
          </div>
        )}
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
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: `${c.libelle} (${c.effectif ?? 0})` }))}
          />
        </Champ>
      </div>

      {!classeId || !periodeId ? (
        <Carte>
          <EtatVide
            icone={<Award size={42} />}
            titre="Choisissez une classe et une période"
            description="Le classement complet et les bulletins individuels s’afficheront ici."
          />
        </Carte>
      ) : resultats.chargement ? (
        <Chargement />
      ) : resultats.erreur ? (
        <Message type="erreur">{resultats.erreur}</Message>
      ) : (
        <>
          <div className="grille c4 mb-16">
            <Carte><div className="indicateur">
              <div><div className="valeur">{formaterNote(resultats.donnees?.moyenne_classe ?? null)}</div>
              <div className="etiquette">Moyenne de la classe</div></div>
            </div></Carte>
            <Carte><div className="indicateur">
              <div><div className="valeur">{formaterNote(resultats.donnees?.moyenne_premier ?? null)}</div>
              <div className="etiquette">Meilleure moyenne</div></div>
            </div></Carte>
            <Carte><div className="indicateur">
              <div><div className="valeur">{formaterNote(resultats.donnees?.moyenne_dernier ?? null)}</div>
              <div className="etiquette">Moyenne la plus faible</div></div>
            </div></Carte>
            <Carte><div className="indicateur">
              <div style={{ width: '100%' }}>
                <div className="valeur">{resultats.donnees?.taux_reussite ?? 0} %</div>
                <div className="etiquette">Taux de réussite</div>
                <div className="mt-8"><BarreProgression pourcentage={resultats.donnees?.taux_reussite ?? 0} /></div>
              </div>
            </div></Carte>
          </div>

          <Carte titre="Classement" sousTitre={`${classement.length} élève(s) évalué(s)`} sansMarge>
            <Tableau
              lignes={classement}
              cleLigne={(e) => e.eleve.id}
              surClicLigne={(e) => setBulletinOuvert(e.eleve.id)}
              vide={
                <EtatVide
                  titre="Aucune note saisie"
                  description="Saisissez des notes dans la page « Notes » pour générer les bulletins."
                />
              }
              colonnes={[
                { cle: 'rang', titre: 'Rang', largeur: '70px', alignement: 'centre', rendu: (e) =>                  e.rang ? (                    <b style={{ color: e.rang <= 3 ? 'var(--secondaire)' : undefined }}>{e.rang}</b>
                  ) : '—' },
                { cle: 'eleve', titre: 'Élève', rendu: (e) => (
                  <div>
                    <div className="gras">{e.eleve.nom} {e.eleve.prenom}</div>
                    <div className="petit discret mono">{e.eleve.matricule}</div>
                  </div>
                ) },
                { cle: 'total_points', titre: 'Points', alignement: 'droite', rendu: (e) => formaterNote(e.total_points) },
                { cle: 'total_coefficients', titre: 'Coef.', alignement: 'centre' },
                { cle: 'moyenne_sur_20', titre: 'Moyenne /20', alignement: 'droite', rendu: (e) => (
                  <b style={{ color: (e.moyenne_sur_20 ?? 0) >= seuil ? 'var(--succes)' : 'var(--danger)' }}>
                    {formaterNote(e.moyenne_sur_20)}
                  </b>
                ) },
                { cle: 'statut', titre: 'Résultat', rendu: (e) =>                  e.moyenne_sur_20 === null ? (                    <Etiquette>Non évalué</Etiquette>
                  ) : (
                    <Etiquette variante={e.moyenne_sur_20 >= seuil ? 'succes' : 'danger'}>
                      {e.moyenne_sur_20 >= seuil ? 'Réussite' : 'Échec'}
                    </Etiquette>
                  ) },
                { cle: 'actions', titre: '', alignement: 'droite', rendu: (e) => (
                  <button
                    className="bouton discret petit"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      document.apercu('impression.bulletin_eleve', `bulletin-${e.eleve.matricule}`, e.eleve.id, periodeId)
                    }}
                  >
                    <Printer size={15} />
                  </button>
                ) }
              ]}
            />
          </Carte>
        </>
      )}

      {bulletinOuvert && periodeId && (
        <ApercuBulletin
          eleveId={bulletinOuvert}
          periodeId={periodeId}
          surFermeture={() => setBulletinOuvert(null)}
        />
      )}
    </>
  )
}

function ApercuBulletin({
  eleveId, periodeId, surFermeture
}: {
  eleveId: number
  periodeId: number
  surFermeture: () => void
}) {
  const document = useDocument()
  const { executer, enCours } = useAction()
  const bulletin = useDonnees<Bulletin | null>('bulletin.eleve', [eleveId, periodeId], null)
  const [conduite, setConduite] = useState('')
  const [observation, setObservation] = useState('')

  useEffect(() => {
    if (bulletin.donnees) {
      setConduite(bulletin.donnees.conduite ?? '')
      setObservation(bulletin.donnees.observation ?? '')
    }
  }, [bulletin.donnees])

  const b = bulletin.donnees

  return (
    <Modale
      ouverte
      taille="tres-large"
      titre={b ? `Bulletin — ${b.eleve.nom} ${b.eleve.prenom}` : 'Bulletin'}
      surFermeture={surFermeture}
      pied={
        <>
          <button
            className="bouton"
            onClick={() =>
              executer(
                () => appeler('bulletin.appreciation', eleveId, periodeId, { conduite, observation }),
                { succes: 'Appréciation enregistrée.', surSucces: bulletin.recharger }
              )
            }
            disabled={enCours}
          >
            <Save size={16} /> Enregistrer l’appreciation
          </button>
          <button
            className="bouton principal"
            onClick={() => document.apercu('impression.bulletin_eleve', `bulletin-${b?.eleve.matricule}`, eleveId, periodeId)}
          >
            <Printer size={16} /> Imprimer
          </button>
        </>
      }
    >
      {bulletin.chargement ? (
        <Chargement />
      ) : !b ? (
        <EtatVide titre="Bulletin indisponible" description="Aucune note n’a été saisie pour cet élève." />
      ) : (
        <>
          <div className="grille c4 mb-16">
            <Carte><div className="indicateur"><div>
              <div className="valeur">{formaterNote(b.moyenne_sur_20)}<span className="petit discret">/20</span></div>
              <div className="etiquette">Moyenne générale</div>
              <div className="detail">{b.mention}</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur">{b.rang ?? '—'}<span className="petit discret">/{b.effectif}</span></div>
              <div className="etiquette">Rang dans la classe</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur">{formaterNote(b.moyenne_classe)}</div>
              <div className="etiquette">Moyenne de la classe</div>
              <div className="detail">1er : {formaterNote(b.moyenne_premier)} · dernier : {formaterNote(b.moyenne_dernier)}</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur">{b.absences}</div>
              <div className="etiquette">Absences</div>
              <div className="detail">{b.retards} retard(s)</div>
            </div></div></Carte>
          </div>

          <Tableau
            compacte
            lignes={b.lignes}
            cleLigne={(l) => l.matiere_id}
            colonnes={[
              { cle: 'matiere_libelle', titre: 'Matière' },
              { cle: 'coefficient', titre: 'Coef.', alignement: 'centre' },
              { cle: 'moyenne_sur_20', titre: 'Moyenne', alignement: 'droite', rendu: (l) => (
                <b>{formaterNote(l.moyenne_sur_20)}</b>
              ) },
              { cle: 'total_points', titre: 'Points', alignement: 'droite', rendu: (l) => formaterNote(l.total_points) },
              { cle: 'rang', titre: 'Rang', alignement: 'centre' },
              { cle: 'moyenne_classe', titre: 'Moy. classe', alignement: 'droite', rendu: (l) => formaterNote(l.moyenne_classe) },
              { cle: 'appreciation', titre: 'Appréciation' },
              { cle: 'enseignant_nom', titre: 'Enseignant' }
            ]}
          />

          <div className="entre espace mt-12 doux">
            <span>Total des coefficients : <b>{b.total_coefficients}</b></span>
            <span>Total des points : <b>{formaterNote(b.total_points)}</b></span>
            <span>Decision : <b>{b.decision}</b></span>
          </div>

          <div className="ligne-champs mt-16">
            <Champ label="Conduite">
              <Selection
                valeur={conduite}
                surChangement={(v) => setConduite(v ?? '')}
                vide="Non renseignée"
                options={['Excellente', 'Très bonne', 'Bonne', 'Assez bonne', 'Passable', 'Mauvaise'].map((c) => ({ valeur: c, libelle: c }))}
              />
            </Champ>
            <Champ label="Observation du titulaire">
              <textarea rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} />
            </Champ>
          </div>
        </>
      )}
    </Modale>
  )
}
