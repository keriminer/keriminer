import { useState } from 'react'
import {
  IdCard, Pencil, Plus, QrCode, RefreshCw, Search, Trash2, UserCog
} from 'lucide-react'
import type { ClasseMatiere, Enseignant } from '@shared/types'
import { useAction, useDebounce, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide, Message, Modale,
  Onglets, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { formaterDate, formaterMontant } from '@shared/format'

export default function Enseignants() {
  const { peut, etablissement } = useSession()
  const document = useDocument()
  const { executer } = useAction()

  const [recherche, setRecherche] = useState('')
  const rechercheRetardee = useDebounce(recherche, 250)
  const [statut, setStatut] = useState<string | null>('ACTIF')
  const [edition, setEdition] = useState<Enseignant | null | 'nouveau'>(null)
  const [detail, setDetail] = useState<Enseignant | null>(null)
  const [suppression, setSuppression] = useState<Enseignant | null>(null)

  const enseignants = useDonnees<(Enseignant & { heures_semaine?: number })[]>(
    'enseignant.liste', [{ recherche: rechercheRetardee, statut }], []
  )
  const devise = etablissement?.devise_code ?? 'BIF'

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Enseignants et personnel</h1>
          <div className="sous-texte">
            {enseignants.donnees.length} agent(s) ·{' '}
            {enseignants.donnees.filter((e) => e.type_contrat === 'VACATAIRE').length} vacataire(s)
          </div>
        </div>
        <div className="actions">
          <button className="bouton" onClick={() => document.apercu('impression.badges', 'badges-pointage', [])}>
            <QrCode size={16} /> Imprimer les badges
          </button>
          {peut('enseignant.ecriture') && (
            <button className="bouton principal" onClick={() => setEdition('nouveau')}>
              <Plus size={16} /> Nouvel enseignant
            </button>
          )}
        </div>
      </div>

      <div className="barre-filtres">
        <div className="champ recherche">
          <label>Rechercher</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--texte-faible)' }} />
            <input
              style={{ paddingLeft: 30 }}
              placeholder="Nom, matricule, spécialité, téléphone…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>
        <Champ label="Statut">
          <Selection
            valeur={statut}
            surChangement={setStatut}
            vide="Tous"
            options={[
              { valeur: 'ACTIF', libelle: 'En service' },
              { valeur: 'CONGE', libelle: 'En congé' },
              { valeur: 'INACTIF', libelle: 'Hors service' }
            ]}
          />
        </Champ>
      </div>

      <Carte sansMarge>
        {enseignants.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={enseignants.donnees}
            cleLigne={(e) => e.id}
            surClicLigne={setDetail}
            vide={
              <EtatVide
                icone={<UserCog size={42} />}
                titre="Aucun enseignant"
                description="Enregistrez votre personnel enseignant pour lui attribuer des matières et suivre son pointage."
                action={
                  peut('enseignant.ecriture') ? (
                    <button className="bouton principal" onClick={() => setEdition('nouveau')}>
                      <Plus size={16} /> Ajouter
                    </button>
                  ) : undefined
                }
              />
            }
            colonnes={[
              { cle: 'matricule', titre: 'Matricule', largeur: '110px', rendu: (e) => <span className="mono petit">{e.matricule}</span> },
              { cle: 'nom', titre: 'Nom et prénom', rendu: (e) => (
                <div>
                  <div className="gras">{e.nom} {e.prenom}</div>
                  <div className="petit discret">{e.specialite ?? 'Spécialité non précisée'}</div>
                </div>
              ) },
              { cle: 'telephone', titre: 'Téléphone', rendu: (e) => <span className="mono petit">{e.telephone}</span> },
              { cle: 'type_contrat', titre: 'Contrat', rendu: (e) => (
                <Etiquette variante={e.type_contrat === 'PERMANENT' ? 'primaire' : ''}>{e.type_contrat}</Etiquette>
              ) },
              { cle: 'heures_semaine', titre: 'H/sem.', alignement: 'centre', rendu: (e) => e.heures_semaine ?? 0 },
              { cle: 'salaire_base', titre: 'Rémunération', alignement: 'droite', rendu: (e) =>
                e.type_contrat === 'VACATAIRE'
                  ? <span className="petit">{formaterMontant(e.taux_horaire, devise)} / h</span>
                  : <span className="petit">{formaterMontant(e.salaire_base, devise)}</span> },
              { cle: 'statut', titre: 'Statut', rendu: (e) => (
                <Etiquette variante={e.statut === 'ACTIF' ? 'succes' : 'alerte'}>{e.statut}</Etiquette>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (e) => (
                <div className="entre fin" onClick={(ev) => ev.stopPropagation()}>
                  <button
                    className="bouton discret petit" title="Badge de pointage"
                    onClick={() => document.apercu('impression.badges', `badge-${e.matricule}`, [e.id])}
                  >
                    <IdCard size={15} />
                  </button>
                  {peut('enseignant.ecriture') && (
                    <>
                      <button className="bouton discret petit" onClick={() => setEdition(e)}>
                        <Pencil size={15} />
                      </button>
                      <button className="bouton discret petit" onClick={() => setSuppression(e)}>
                        <Trash2 size={15} color="var(--danger)" />
                      </button>
                    </>
                  )}
                </div>
              ) }
            ]}
          />
        )}
      </Carte>

      {edition && (
        <FormulaireEnseignant
          enseignant={edition === 'nouveau' ? null : edition}
          devise={devise}
          surFermeture={() => setEdition(null)}
          surEnregistrement={() => { setEdition(null); enseignants.recharger() }}
        />
      )}

      {detail && !edition && !suppression && (
        <DetailEnseignant enseignant={detail} surFermeture={() => setDetail(null)} devise={devise} />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer cet enseignant ?"
        message={<>La fiche de <b>{suppression?.nom} {suppression?.prenom}</b> sera supprimée.</>}
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('enseignant.supprimer', suppression!.id), {
            succes: 'Enseignant supprimé.',
            surSucces: () => { setSuppression(null); enseignants.recharger() }
          })
        }
      />
    </>
  )
}

function FormulaireEnseignant({
  enseignant, devise, surFermeture, surEnregistrement
}: {
  enseignant: Enseignant | null
  devise: string
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [onglet, setOnglet] = useState('identite')
  const [d, setD] = useState({
    matricule: enseignant?.matricule ?? '',
    nom: enseignant?.nom ?? '',
    prenom: enseignant?.prenom ?? '',
    sexe: (enseignant?.sexe ?? 'M') as 'M' | 'F',
    date_naissance: enseignant?.date_naissance ?? '',
    telephone: enseignant?.telephone ?? '',
    telephone2: enseignant?.telephone2 ?? '',
    email: enseignant?.email ?? '',
    adresse: enseignant?.adresse ?? '',
    diplome: enseignant?.diplome ?? '',
    specialite: enseignant?.specialite ?? '',
    date_embauche: enseignant?.date_embauche ?? '',
    type_contrat: enseignant?.type_contrat ?? 'PERMANENT',
    statut: enseignant?.statut ?? 'ACTIF',
    salaire_base: enseignant?.salaire_base ?? 0,
    taux_horaire: enseignant?.taux_horaire ?? 0,
    numero_compte: enseignant?.numero_compte ?? '',
    numero_mobile_money: enseignant?.numero_mobile_money ?? ''
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  const enregistrer = () =>
    executer(
      async () => {
        if (!d.nom.trim() || !d.prenom.trim()) throw new Error('Nom et prénom obligatoires.')
        if (!d.telephone.trim()) throw new Error('Le téléphone est obligatoire.')
        const charge = {
          ...d,
          matricule: d.matricule || undefined,
          salaire_base: Number(d.salaire_base),
          taux_horaire: Number(d.taux_horaire),
          date_naissance: d.date_naissance || null,
          date_embauche: d.date_embauche || null
        }
        if (enseignant) await appeler('enseignant.modifier', enseignant.id, charge)
        else await appeler('enseignant.creer', charge)
      },
      { succes: 'Fiche enregistrée.', surSucces: surEnregistrement }
    )

  return (
    <Modale
      ouverte
      taille="large"
      titre={enseignant ? `Modifier — ${enseignant.nom} ${enseignant.prenom}` : 'Nouvel enseignant'}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={enregistrer} disabled={enCours}>Enregistrer</button>
        </>
      }
    >
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'identite', libelle: 'Identité' },
          { cle: 'carriere', libelle: 'Carriere' },
          { cle: 'remuneration', libelle: 'Rémunération' }
        ]}
      />

      {onglet === 'identite' && (
        <>
          <div className="ligne-champs c3">
            <Champ label="Nom" obligatoire>
              <input autoFocus value={d.nom} onChange={(e) => maj({ nom: e.target.value })} />
            </Champ>
            <Champ label="Prenom" obligatoire>
              <input value={d.prenom} onChange={(e) => maj({ prenom: e.target.value })} />
            </Champ>
            <Champ label="Sexe">
              <Selection
                valeur={d.sexe}
                surChangement={(v) => maj({ sexe: (v ?? 'M') as 'M' | 'F' })}
                options={[{ valeur: 'M', libelle: 'Masculin' }, { valeur: 'F', libelle: 'Feminin' }]}
              />
            </Champ>
          </div>
          <div className="ligne-champs c3">
            <Champ label="Matricule" aide={enseignant ? undefined : 'Généré si vide'}>
              <input value={d.matricule} onChange={(e) => maj({ matricule: e.target.value })} />
            </Champ>
            <Champ label="Date de naissance">
              <input type="date" value={d.date_naissance} onChange={(e) => maj({ date_naissance: e.target.value })} />
            </Champ>
            <Champ label="Téléphone" obligatoire>
              <input value={d.telephone} onChange={(e) => maj({ telephone: e.target.value })} />
            </Champ>
          </div>
          <div className="ligne-champs c3">
            <Champ label="Second téléphone">
              <input value={d.telephone2} onChange={(e) => maj({ telephone2: e.target.value })} />
            </Champ>
            <Champ label="Courriel">
              <input type="email" value={d.email} onChange={(e) => maj({ email: e.target.value })} />
            </Champ>
            <Champ label="Adresse">
              <input value={d.adresse} onChange={(e) => maj({ adresse: e.target.value })} />
            </Champ>
          </div>
        </>
      )}

      {onglet === 'carriere' && (
        <>
          <div className="ligne-champs">
            <Champ label="Diplôme le plus élève">
              <input value={d.diplome} onChange={(e) => maj({ diplome: e.target.value })} placeholder="Licence en mathématiques" />
            </Champ>
            <Champ label="Spécialité / matière principale">
              <input value={d.specialite} onChange={(e) => maj({ specialite: e.target.value })} />
            </Champ>
          </div>
          <div className="ligne-champs c3">
            <Champ label="Date d’embauche">
              <input type="date" value={d.date_embauche} onChange={(e) => maj({ date_embauche: e.target.value })} />
            </Champ>
            <Champ label="Type de contrat">
              <Selection
                valeur={d.type_contrat}
                surChangement={(v) => maj({ type_contrat: v ?? 'PERMANENT' })}
                options={[
                  { valeur: 'PERMANENT', libelle: 'Permanent (salaire fixe)' },
                  { valeur: 'VACATAIRE', libelle: 'Vacataire (paye à l’heure)' },
                  { valeur: 'STAGIAIRE', libelle: 'Stagiaire' },
                  { valeur: 'CONTRACTUEL', libelle: 'Contractuel' }
                ]}
              />
            </Champ>
            <Champ label="Statut">
              <Selection
                valeur={d.statut}
                surChangement={(v) => maj({ statut: v ?? 'ACTIF' })}
                options={[
                  { valeur: 'ACTIF', libelle: 'En service' },
                  { valeur: 'CONGE', libelle: 'En congé' },
                  { valeur: 'INACTIF', libelle: 'Hors service' }
                ]}
              />
            </Champ>
          </div>
        </>
      )}

      {onglet === 'remuneration' && (
        <>
          <Message type="info">
            Pour un <b>permanent</b>, saisissez le salaire mensuel de base. Pour un <b>vacataire</b>, saisissez le
            taux horaire : la paie sera calculee a partir des heures reellement pointees.
          </Message>
          <div className="ligne-champs">
            <Champ label={`Salaire mensuel de base (${devise})`}>
              <input
                type="number" min={0}
                value={d.salaire_base}
                onChange={(e) => maj({ salaire_base: Number(e.target.value) })}
                disabled={d.type_contrat === 'VACATAIRE'}
              />
            </Champ>
            <Champ label={`Taux horaire (${devise})`}>
              <input
                type="number" min={0}
                value={d.taux_horaire}
                onChange={(e) => maj({ taux_horaire: Number(e.target.value) })}
              />
            </Champ>
          </div>
          <div className="ligne-champs">
            <Champ label="Numéro de compte bancaire">
              <input value={d.numero_compte} onChange={(e) => maj({ numero_compte: e.target.value })} />
            </Champ>
            <Champ label="Numéro mobile money" aide="Pour le paiement du salaire">
              <input value={d.numero_mobile_money} onChange={(e) => maj({ numero_mobile_money: e.target.value })} />
            </Champ>
          </div>
        </>
      )}
    </Modale>
  )
}

function DetailEnseignant({
  enseignant, surFermeture, devise
}: {
  enseignant: Enseignant
  surFermeture: () => void
  devise: string
}) {
  const document = useDocument()
  const { executer } = useAction()
  const attributions = useDonnees<ClasseMatiere[]>('enseignant.attributions', [enseignant.id], [])
  const [code, setCode] = useState(enseignant.code_pointage)

  return (
    <Modale
      ouverte
      taille="large"
      titre={`${enseignant.nom} ${enseignant.prenom}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={() => document.apercu('impression.badges', `badge-${enseignant.matricule}`, [enseignant.id])}>
            <IdCard size={16} /> Imprimer le badge
          </button>
          <button className="bouton principal" onClick={surFermeture}>Fermer</button>
        </>
      }
    >
      <div className="ligne-champs c3 mb-16">
        <InfoLigne etiquette="Matricule" valeur={enseignant.matricule} />
        <InfoLigne etiquette="Téléphone" valeur={enseignant.telephone} />
        <InfoLigne etiquette="Spécialité" valeur={enseignant.specialite ?? '—'} />
        <InfoLigne etiquette="Diplôme" valeur={enseignant.diplome ?? '—'} />
        <InfoLigne etiquette="Embauche" valeur={formaterDate(enseignant.date_embauche)} />
        <InfoLigne
          etiquette="Rémunération"
          valeur={
            enseignant.type_contrat === 'VACATAIRE'
              ? `${formaterMontant(enseignant.taux_horaire, devise)} / heure`
              : formaterMontant(enseignant.salaire_base, devise)
          }
        />
      </div>

      <Carte titre="Badge de pointage" style={{ marginBottom: 14 }}>
        <div className="entre espace">
          <div>
            <div className="doux petit">Code du badge QR</div>
            <div className="mono" style={{ fontSize: 19, letterSpacing: '.12em' }}>{code ?? '—'}</div>
          </div>
          <button
            className="bouton"
            onClick={() =>
              executer(
                async () => {
                  const nouveau = await appeler<string>('enseignant.regenerer_badge', enseignant.id)
                  setCode(nouveau)
                },
                { succes: 'Nouveau badge généré. Réimprimez-le et détruisez l’ancien.' }
              )
            }
          >
            <RefreshCw size={16} /> Regenerer
          </button>
        </div>
      </Carte>

      <h3 className="mb-8">Service de l’année</h3>
      <Tableau
        compacte
        lignes={attributions.donnees}
        cleLigne={(a) => a.id}
        vide={<EtatVide titre="Aucune matière attribuée" description="Attribuez-lui des matières depuis la page Classes." />}
        colonnes={[
          { cle: 'classe_libelle', titre: 'Classe' },
          { cle: 'matiere_libelle', titre: 'Matière' },
          { cle: 'coefficient', titre: 'Coef.', alignement: 'centre' },
          { cle: 'volume_horaire', titre: 'H/sem.', alignement: 'centre' }
        ]}
      />
      {attributions.donnees.length > 0 && (
        <div className="mt-8 doux petit">
          Charge totale : <b>{attributions.donnees.reduce((s, a) => s + a.volume_horaire, 0)} h par semaine</b>
        </div>
      )}
    </Modale>
  )
}

function InfoLigne({ etiquette, valeur }: { etiquette: string; valeur: React.ReactNode }) {
  return (
    <div className="champ">
      <label>{etiquette}</label>
      <div className="gras">{valeur}</div>
    </div>
  )
}
