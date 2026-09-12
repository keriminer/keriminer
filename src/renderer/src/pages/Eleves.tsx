import { useMemo, useState } from 'react'
import {
  ArrowRightLeft, FileDown, FileUp, IdCard, Pencil, Plus, Printer, Search, Trash2, UserPlus, Users
} from 'lucide-react'
import type { Classe, Eleve, Niveau, Tuteur } from '@shared/types'
import { useAction, useDebounce, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide, Message, Modale,
  Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { ecrireCsv, lireCsv } from '../lib/csv'
import { formaterDate, formaterMontant } from '@shared/format'

export default function Eleves() {
  const { peut, etablissement } = useSession()
  const { notifier } = useNotifications()
  const document = useDocument()

  const [recherche, setRecherche] = useState('')
  const rechercheRetardee = useDebounce(recherche, 250)
  const [classeId, setClasseId] = useState<number | null>(null)
  const [sexe, setSexe] = useState<string | null>(null)
  const [statut, setStatut] = useState<string | null>('ACTIF')

  const [fiche, setFiche] = useState<Eleve | null>(null)
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [importOuvert, setImportOuvert] = useState(false)
  const [transfert, setTransfert] = useState<Eleve | null>(null)
  const [suppression, setSuppression] = useState<Eleve | null>(null)

  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const eleves = useDonnees<Eleve[]>(
    'eleve.liste',
    [{ recherche: rechercheRetardee, classe_id: classeId, sexe, statut }],
    []
  )
  const { executer } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'

  const exporter = async () => {
    const csv = ecrireCsv(
      [
        { cle: 'matricule', libelle: 'Matricule' },
        { cle: 'nom', libelle: 'Nom' },
        { cle: 'prenom', libelle: 'Prenom' },
        { cle: 'sexe', libelle: 'Sexe' },
        { cle: 'date_naissance', libelle: 'Date de naissance' },
        { cle: 'lieu_naissance', libelle: 'Lieu de naissance' },
        { cle: 'classe_libelle', libelle: 'Classe' },
        { cle: 'tuteur_nom', libelle: 'Tuteur' },
        { cle: 'tuteur_telephone', libelle: 'Téléphone tuteur' },
        { cle: 'statut', libelle: 'Statut' }
      ],
      eleves.donnees as unknown as Record<string, unknown>[]
    )
    const chemin = await appeler<string | null>('fichier.enregistrer_texte', csv, 'eleves.csv', 'csv')
    if (chemin) notifier('succes', `Liste exportee : ${chemin}`)
  }

  const statistiques = useMemo(() => {
    const liste = eleves.donnees
    return {
      total: liste.length,
      garcons: liste.filter((e) => e.sexe === 'M').length,
      filles: liste.filter((e) => e.sexe === 'F').length,
      sansClasse: liste.filter((e) => !e.classe_id).length
    }
  }, [eleves.donnees])

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Élèves</h1>
          <div className="sous-texte">
            {statistiques.total} élève(s) · {statistiques.garcons} garçons · {statistiques.filles} filles
            {statistiques.sansClasse > 0 && ` · ${statistiques.sansClasse} sans classe`}
          </div>
        </div>
        <div className="actions">
          <button className="bouton" onClick={exporter}>
            <FileDown size={16} /> Exporter
          </button>
          {peut('eleve.ecriture') && (
            <>
              <button className="bouton" onClick={() => setImportOuvert(true)}>
                <FileUp size={16} /> Importer
              </button>
              <button className="bouton principal" onClick={() => { setFiche(null); setFormulaireOuvert(true) }}>
                <UserPlus size={16} /> Nouvel élève
              </button>
            </>
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
              placeholder="Nom, matricule, classe ou téléphone du tuteur…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Toutes les classes"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: `${c.libelle} (${c.effectif ?? 0})` }))}
          />
        </Champ>
        <Champ label="Sexe">
          <Selection
            valeur={sexe}
            surChangement={setSexe}
            vide="Tous"
            options={[{ valeur: 'M', libelle: 'Garçons' }, { valeur: 'F', libelle: 'Filles' }]}
          />
        </Champ>
        <Champ label="Statut">
          <Selection
            valeur={statut}
            surChangement={setStatut}
            vide="Tous"
            options={[
              { valeur: 'ACTIF', libelle: 'Actifs' },
              { valeur: 'TRANSFERE', libelle: 'Transférés' },
              { valeur: 'ABANDON', libelle: 'Abandons' },
              { valeur: 'DIPLOME', libelle: 'Diplomes' }
            ]}
          />
        </Champ>
        {classeId && (
          <button className="bouton" onClick={() => document.apercu('impression.liste_classe', 'liste-classe', classeId, 0)}>
            <Printer size={16} /> Liste de classe
          </button>
        )}
      </div>

      <Carte sansMarge>
        {eleves.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={eleves.donnees}
            cleLigne={(l) => l.id}
            surClicLigne={(l) => setFiche(l)}
            vide={
              <EtatVide
                icone={<Users size={42} />}
                titre="Aucun élève"
                description="Ajoutez vos élèves un par un, ou importez toute une liste depuis un fichier CSV."
                action={
                  peut('eleve.ecriture') ? (
                    <button className="bouton principal" onClick={() => setFormulaireOuvert(true)}>
                      <Plus size={16} /> Ajouter un élève
                    </button>
                  ) : undefined
                }
              />
            }
            colonnes={[
              { cle: 'matricule', titre: 'Matricule', largeur: '120px', rendu: (l) => <span className="mono petit">{l.matricule}</span> },
              { cle: 'nom', titre: 'Nom et prénom', rendu: (l) => (
                <div>
                  <div className="gras">{l.nom} {l.prenom}</div>
                  <div className="petit discret">
                    {l.sexe === 'F' ? 'Fille' : 'Garçon'}
                    {l.date_naissance ? ` · né(e) le ${formaterDate(l.date_naissance)}` : ''}
                  </div>
                </div>
              ) },
              { cle: 'classe_libelle', titre: 'Classe', rendu: (l) =>
                l.classe_libelle ? <Etiquette variante="primaire">{l.classe_libelle}</Etiquette>
                  : <Etiquette variante="alerte">Non inscrit</Etiquette> },
              { cle: 'tuteur', titre: 'Tuteur', rendu: (l) => (
                <div>
                  <div>{l.tuteur_nom ?? '—'}</div>
                  <div className="petit discret mono">{l.tuteur_telephone ?? ''}</div>
                </div>
              ) },
              { cle: 'statut', titre: 'Statut', rendu: (l) => (
                <Etiquette variante={l.statut === 'ACTIF' ? 'succes' : l.statut === 'DIPLOME' ? 'info' : 'danger'}>
                  {l.statut}
                </Etiquette>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (l) => (
                <div className="entre fin" onClick={(e) => e.stopPropagation()}>
                  <button className="bouton discret petit" title="Fiche PDF"
                    onClick={() => document.apercu('impression.fiche_eleve', `fiche-${l.matricule}`, l.id)}>
                    <IdCard size={15} />
                  </button>
                  {peut('eleve.ecriture') && (
                    <>
                      <button className="bouton discret petit" title="Modifier"
                        onClick={() => { setFiche(l); setFormulaireOuvert(true) }}>
                        <Pencil size={15} />
                      </button>
                      <button className="bouton discret petit" title="Transférer de classe"
                        onClick={() => setTransfert(l)}>
                        <ArrowRightLeft size={15} />
                      </button>
                      <button className="bouton discret petit" title="Supprimer"
                        onClick={() => setSuppression(l)}>
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

      {fiche && !formulaireOuvert && !transfert && !suppression && (
        <FicheEleve eleve={fiche} surFermeture={() => setFiche(null)} devise={devise} />
      )}

      {formulaireOuvert && (
        <FormulaireEleve
          eleve={fiche}
          classes={classes.donnees}
          surFermeture={() => setFormulaireOuvert(false)}
          surEnregistrement={() => { setFormulaireOuvert(false); setFiche(null); eleves.recharger(); classes.recharger() }}
        />
      )}

      {transfert && (
        <Transfert
          eleve={transfert}
          classes={classes.donnees}
          surFermeture={() => setTransfert(null)}
          surEnregistrement={() => { setTransfert(null); eleves.recharger(); classes.recharger() }}
        />
      )}

      {importOuvert && (
        <ImportEleves surFermeture={() => setImportOuvert(false)} surImport={() => { setImportOuvert(false); eleves.recharger() }} />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer cet élève ?"
        libelleConfirmation="Supprimer définitivement"
        message={
          <>
            <p>
              La fiche de <b>{suppression?.nom} {suppression?.prenom}</b> sera definitivement supprimee,
              ainsi que ses notes et ses presences.
            </p>
            <p className="petit discret">              Si l’élève a quitte l’école, preferez le bouton « Transférer » et le statut « Transféré » :
              vous conserverez son historique.            </p>
          </>
        }
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('eleve.supprimer', suppression!.id), {
            succes: 'Élève supprimé.',
            surSucces: () => { setSuppression(null); setFiche(null); eleves.recharger() }
          })
        }
      />
    </>
  )
}

/* ----------------------------- Formulaire eleve --------------------------- */

function FormulaireEleve({
  eleve, classes, surFermeture, surEnregistrement
}: {
  eleve: Eleve | null
  classes: Classe[]
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [donnees, setDonnees] = useState({
    matricule: eleve?.matricule ?? '',
    nom: eleve?.nom ?? '',
    prenom: eleve?.prenom ?? '',
    sexe: (eleve?.sexe ?? 'M') as 'M' | 'F',
    date_naissance: eleve?.date_naissance ?? '',
    lieu_naissance: eleve?.lieu_naissance ?? '',
    nationalite: eleve?.nationalite ?? '',
    adresse: eleve?.adresse ?? '',
    telephone: eleve?.telephone ?? '',
    groupe_sanguin: eleve?.groupe_sanguin ?? '',
    besoins_particuliers: eleve?.besoins_particuliers ?? '',
    ecole_provenance: eleve?.ecole_provenance ?? '',
    photo: eleve?.photo ?? '',
    classe_id: eleve?.classe_id ?? null,
    tuteur_nom: '',
    tuteur_prenom: '',
    tuteur_lien: 'Père',
    tuteur_telephone: ''
  })
  const maj = (c: Partial<typeof donnees>) => setDonnees((d) => ({ ...d, ...c }))

  const enregistrer = () =>
    executer(
      async () => {
        if (eleve) {
          await appeler('eleve.modifier', eleve.id, {
            matricule: donnees.matricule, nom: donnees.nom, prenom: donnees.prenom, sexe: donnees.sexe,
            date_naissance: donnees.date_naissance || null, lieu_naissance: donnees.lieu_naissance || null,
            nationalite: donnees.nationalite || null, adresse: donnees.adresse || null,
            telephone: donnees.telephone || null, groupe_sanguin: donnees.groupe_sanguin || null,
            besoins_particuliers: donnees.besoins_particuliers || null,
            ecole_provenance: donnees.ecole_provenance || null, photo: donnees.photo || null
          })
          if (donnees.classe_id && donnees.classe_id !== eleve.classe_id) {
            await appeler('eleve.inscrire', eleve.id, donnees.classe_id)
          }
          if (donnees.tuteur_nom && donnees.tuteur_telephone) {
            await appeler('eleve.rattacher_tuteur', eleve.id, {
              nom: donnees.tuteur_nom, prenom: donnees.tuteur_prenom,
              lien_parente: donnees.tuteur_lien, telephone: donnees.tuteur_telephone
            }, true)
          }
        } else {
          await appeler('eleve.creer', {
            ...donnees,
            matricule: donnees.matricule || undefined,
            date_naissance: donnees.date_naissance || null,
            tuteur: donnees.tuteur_nom && donnees.tuteur_telephone
              ? {
                  nom: donnees.tuteur_nom, prenom: donnees.tuteur_prenom,
                  lien_parente: donnees.tuteur_lien, telephone: donnees.tuteur_telephone
                }
              : undefined
          })
        }
      },
      { succes: eleve ? 'Fiche mise à jour.' : 'Élève enregistré.', surSucces: surEnregistrement }
    )

  const choisirPhoto = async () => {
    const image = await appeler<string | null>('fichier.ouvrir_image')
    if (image) maj({ photo: image })
  }

  return (
    <Modale
      ouverte
      taille="large"
      titre={eleve ? `Modifier — ${eleve.nom} ${eleve.prenom}` : 'Nouvel élève'}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={enregistrer} disabled={enCours}>Enregistrer</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 18 }}>
        <div style={{ width: 130, flexShrink: 0 }}>
          {donnees.photo ? (
            <img
              src={donnees.photo}
              alt=""
              style={{ width: 130, height: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bordure)' }}
            />
          ) : (
            <div style={{ width: 130, height: 160, display: 'grid', placeItems: 'center', border: '1px dashed var(--bordure-forte)', borderRadius: 6, color: 'var(--texte-faible)' }}>
              <Users size={30} />
            </div>
          )}
          <button className="bouton petit bloc mt-8" onClick={choisirPhoto}>Photo</button>
          {donnees.photo && (
            <button className="bouton discret petit bloc" onClick={() => maj({ photo: '' })}>Retirer</button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ligne-champs c3">
            <Champ label="Nom" obligatoire>
              <input autoFocus value={donnees.nom} onChange={(e) => maj({ nom: e.target.value })} />
            </Champ>
            <Champ label="Prenom" obligatoire>
              <input value={donnees.prenom} onChange={(e) => maj({ prenom: e.target.value })} />
            </Champ>
            <Champ label="Sexe" obligatoire>
              <Selection
                valeur={donnees.sexe}
                surChangement={(v) => maj({ sexe: (v ?? 'M') as 'M' | 'F' })}
                options={[{ valeur: 'M', libelle: 'Masculin' }, { valeur: 'F', libelle: 'Feminin' }]}
              />
            </Champ>
          </div>
          <div className="ligne-champs c3">
            <Champ label="Matricule" aide={eleve ? undefined : 'Généré automatiquement si vide'}>
              <input value={donnees.matricule} onChange={(e) => maj({ matricule: e.target.value })} />
            </Champ>
            <Champ label="Date de naissance">
              <input type="date" value={donnees.date_naissance} onChange={(e) => maj({ date_naissance: e.target.value })} />
            </Champ>
            <Champ label="Lieu de naissance">
              <input value={donnees.lieu_naissance} onChange={(e) => maj({ lieu_naissance: e.target.value })} />
            </Champ>
          </div>
          <div className="ligne-champs c3">
            <Champ label="Classe">
              <Selection
                valeur={donnees.classe_id}
                surChangement={(v) => maj({ classe_id: v })}
                vide="Non inscrit"
                options={classes.map((c) => ({ valeur: c.id, libelle: `${c.libelle} — ${c.effectif ?? 0}/${c.capacite}` }))}
              />
            </Champ>
            <Champ label="Nationalite">
              <input value={donnees.nationalite} onChange={(e) => maj({ nationalite: e.target.value })} />
            </Champ>
            <Champ label="Groupe sanguin">
              <input value={donnees.groupe_sanguin} onChange={(e) => maj({ groupe_sanguin: e.target.value })} placeholder="O+" />
            </Champ>
          </div>
          <div className="ligne-champs">
            <Champ label="Adresse">
              <input value={donnees.adresse} onChange={(e) => maj({ adresse: e.target.value })} />
            </Champ>
            <Champ label="École de provenance">
              <input value={donnees.ecole_provenance} onChange={(e) => maj({ ecole_provenance: e.target.value })} />
            </Champ>
          </div>
          <Champ label="Besoins particuliers" aide="Santé, handicap, suivi spécifique…">
            <textarea
              value={donnees.besoins_particuliers}
              onChange={(e) => maj({ besoins_particuliers: e.target.value })}
              rows={2}
            />
          </Champ>

          <h3 className="mt-16 mb-8">Tuteur principal</h3>
          <div className="ligne-champs c4">
            <Champ label="Nom">
              <input value={donnees.tuteur_nom} onChange={(e) => maj({ tuteur_nom: e.target.value })} />
            </Champ>
            <Champ label="Prenom">
              <input value={donnees.tuteur_prenom} onChange={(e) => maj({ tuteur_prenom: e.target.value })} />
            </Champ>
            <Champ label="Lien">
              <Selection
                valeur={donnees.tuteur_lien}
                surChangement={(v) => maj({ tuteur_lien: v ?? 'Père' })}
                options={['Père', 'Mère', 'Oncle', 'Tante', 'Grand-parent', 'Frère/Sœur', 'Tuteur légal'].map((l) => ({ valeur: l, libelle: l }))}
              />
            </Champ>
            <Champ label="Téléphone" aide="Recevra les SMS">
              <input value={donnees.tuteur_telephone} onChange={(e) => maj({ tuteur_telephone: e.target.value })} placeholder="79 12 34 56" />
            </Champ>
          </div>
        </div>
      </div>
    </Modale>
  )
}

/* -------------------------------- Fiche eleve ---------------------------- */

function FicheEleve({
  eleve, surFermeture, devise
}: {
  eleve: Eleve
  surFermeture: () => void
  devise: string
}) {
  const detail = useDonnees<{ eleve: Eleve; tuteurs: (Tuteur & { principal: number })[]; inscriptions: any[] } | null>(
    'eleve.lire', [eleve.id], null
  )
  const situation = useDonnees<any>(
    eleve.inscription_id ? 'finance.situation_eleve' : null, [eleve.inscription_id], null
  )
  const document = useDocument()

  return (
    <Modale
      ouverte
      taille="large"
      titre={`${eleve.nom} ${eleve.prenom}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={() => document.apercu('impression.fiche_eleve', `fiche-${eleve.matricule}`, eleve.id)}>
            <Printer size={16} /> Imprimer la fiche
          </button>
          <button className="bouton principal" onClick={surFermeture}>Fermer</button>
        </>
      }
    >
      {detail.chargement ? (
        <Chargement />
      ) : (
        <>
          <div className="ligne-champs c3 mb-16">
            <Info etiquette="Matricule" valeur={eleve.matricule} />
            <Info etiquette="Classe" valeur={eleve.classe_libelle ?? 'Non inscrit'} />
            <Info etiquette="Statut" valeur={eleve.statut} />
            <Info etiquette="Naissance" valeur={`${formaterDate(eleve.date_naissance)} ${eleve.lieu_naissance ? `à ${eleve.lieu_naissance}` : ''}`} />
            <Info etiquette="Sexe" valeur={eleve.sexe === 'F' ? 'Feminin' : 'Masculin'} />
            <Info etiquette="Téléphone" valeur={eleve.telephone ?? '—'} />
          </div>

          {situation.donnees?.situation && (
            <Carte titre="Situation financière" style={{ marginBottom: 14 }}>
              <div className="ligne-champs c3">
                <Info etiquette="Total dû" valeur={formaterMontant(
                  situation.donnees.situation.total_du - situation.donnees.situation.total_remise, devise
                )} />
                <Info etiquette="Versé" valeur={formaterMontant(situation.donnees.situation.total_paye, devise)} />
                <Info
                  etiquette="Solde"
                  valeur={formaterMontant(
                    situation.donnees.situation.total_du -
                      situation.donnees.situation.total_remise -
                      situation.donnees.situation.total_paye,
                    devise
                  )}
                />
              </div>
            </Carte>
          )}

          <h3 className="mb-8">Tuteurs</h3>
          {detail.donnees?.tuteurs.length ? (
            <Tableau
              compacte
              lignes={detail.donnees.tuteurs}
              cleLigne={(t) => t.id}
              colonnes={[
                { cle: 'nom', titre: 'Nom', rendu: (t) => `${t.nom} ${t.prenom ?? ''}` },
                { cle: 'lien_parente', titre: 'Lien' },
                { cle: 'telephone', titre: 'Téléphone' },
                { cle: 'principal', titre: '', rendu: (t) => t.principal ? <Etiquette variante="primaire">Principal</Etiquette> : null }
              ]}
            />
          ) : (
            <Message type="alerte">Aucun tuteur enregistré : les SMS ne pourront pas être envoyés.</Message>
          )}

          <h3 className="mt-16 mb-8">Parcours scolaire</h3>
          <Tableau
            compacte
            lignes={detail.donnees?.inscriptions ?? []}
            cleLigne={(i) => i.id}
            colonnes={[
              { cle: 'annee_libelle', titre: 'Année' },
              { cle: 'classe_libelle', titre: 'Classe' },
              { cle: 'statut', titre: 'Statut' },
              { cle: 'redoublant', titre: 'Redoublant', rendu: (i) => (i.redoublant ? 'Oui' : 'Non') }
            ]}
          />
        </>
      )}
    </Modale>
  )
}

function Info({ etiquette, valeur }: { etiquette: string; valeur: React.ReactNode }) {
  return (
    <div className="champ">
      <label>{etiquette}</label>
      <div className="gras">{valeur}</div>
    </div>
  )
}

/* -------------------------------- Transfert ------------------------------ */

function Transfert({
  eleve, classes, surFermeture, surEnregistrement
}: {
  eleve: Eleve
  classes: Classe[]
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [mode, setMode] = useState<'CLASSE' | 'SORTIE'>('CLASSE')
  const [classeId, setClasseId] = useState<number | null>(null)
  const [statutSortie, setStatutSortie] = useState('TRANSFERE')
  const [motif, setMotif] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const valider = () =>
    executer(
      async () => {
        if (!eleve.inscription_id) throw new Error("Cet élève n’est inscrit dans aucune classe cette année.")
        if (mode === 'CLASSE') {
          if (!classeId) throw new Error('Choisissez la classe de destination.')
          await appeler('eleve.transferer', eleve.inscription_id, classeId, motif)
        } else {
          if (!motif.trim()) throw new Error('Indiquez le motif de sortie.')
          await appeler('eleve.sortir', eleve.inscription_id, statutSortie, motif, date)
        }
      },
      { succes: 'Opération enregistrée.', surSucces: surEnregistrement }
    )

  return (
    <Modale
      ouverte
      titre={`Mouvement — ${eleve.nom} ${eleve.prenom}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={valider} disabled={enCours}>Valider</button>
        </>
      }
    >
      <div className="groupe-boutons mb-16">
        <button className={mode === 'CLASSE' ? 'actif' : ''} onClick={() => setMode('CLASSE')}>          Changer de classe        </button>
        <button className={mode === 'SORTIE' ? 'actif' : ''} onClick={() => setMode('SORTIE')}>          Sortie de l’école        </button>
      </div>

      <div className="doux mb-12">Classe actuelle : <b>{eleve.classe_libelle ?? 'aucune'}</b></div>

      {mode === 'CLASSE' ? (
        <>
          <Champ label="Nouvelle classe" obligatoire>
            <Selection
              valeur={classeId}
              surChangement={setClasseId}
              vide="Choisir…"
              options={classes
                .filter((c) => c.id !== eleve.classe_id)
                .map((c) => ({ valeur: c.id, libelle: `${c.libelle} — ${c.effectif ?? 0}/${c.capacite}` }))}
            />
          </Champ>
          <Champ label="Motif" aide="Conserve dans le journal">
            <input value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Champ>
          <Message type="info">            Les notes et les présences déjà enregistrées restent attachees à l’élève. Les frais de la nouvelle
            classe lui seront appliques automatiquement.          </Message>
        </>
      ) : (
        <>
          <div className="ligne-champs">
            <Champ label="Type de sortie" obligatoire>
              <Selection
                valeur={statutSortie}
                surChangement={(v) => setStatutSortie(v ?? 'TRANSFERE')}
                options={[
                  { valeur: 'TRANSFERE', libelle: 'Transféré vers une autre école' },
                  { valeur: 'ABANDON', libelle: 'Abandon' },
                  { valeur: 'EXCLU', libelle: 'Exclusion' }
                ]}
              />
            </Champ>
            <Champ label="Date de sortie" obligatoire>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Champ>
          </div>
          <Champ label="Motif" obligatoire>
            <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
          </Champ>
        </>
      )}
    </Modale>
  )
}

/* ------------------------------ Import CSV ------------------------------- */

function ImportEleves({ surFermeture, surImport }: { surFermeture: () => void; surImport: () => void }) {
  const { notifier } = useNotifications()
  const { executer, enCours } = useAction()
  const [lignes, setLignes] = useState<Record<string, string>[]>([])
  const [rapport, setRapport] = useState<any>(null)

  const choisirFichier = async () => {
    const fichier = await appeler<{ chemin: string; contenu: string } | null>('fichier.ouvrir', [
      { name: 'Fichier CSV', extensions: ['csv', 'txt'] }
    ])
    if (!fichier) return
    const analysees = lireCsv(fichier.contenu)
    if (analysees.length === 0) return notifier('alerte', 'Le fichier ne contient aucune ligne exploitable.')
    setLignes(analysees)
    setRapport(null)
  }

  const importer = () =>
    executer(async () => {
      const resultat = await appeler('eleve.importer', lignes)
      setRapport(resultat)
    })

  const modeleCsv = async () => {
    const csv = ecrireCsv(
      [
        { cle: 'nom', libelle: 'nom' },
        { cle: 'prenom', libelle: 'prenom' },
        { cle: 'sexe', libelle: 'sexe' },
        { cle: 'date_naissance', libelle: 'date_naissance' },
        { cle: 'lieu_naissance', libelle: 'lieu_naissance' },
        { cle: 'classe', libelle: 'classe' },
        { cle: 'tuteur_nom', libelle: 'tuteur_nom' },
        { cle: 'tuteur_telephone', libelle: 'tuteur_telephone' },
        { cle: 'tuteur_lien', libelle: 'tuteur_lien' }
      ],
      [
        {
          nom: 'NDAYISHIMIYE', prenom: 'Aline', sexe: 'F', date_naissance: '2012-04-18',
          lieu_naissance: 'Gitega', classe: '5ème année A', tuteur_nom: 'NDAYISHIMIYE Jean',
          tuteur_telephone: '79123456', tuteur_lien: 'Père'
        }
      ]
    )
    const chemin = await appeler<string | null>('fichier.enregistrer_texte', csv, 'modèle-élèves.csv', 'csv')
    if (chemin) notifier('succes', `Modèle enregistré : ${chemin}`)
  }

  return (
    <Modale
      ouverte
      taille="large"
      titre="Importer une liste d’élèves"
      surFermeture={surFermeture}
      pied={
        rapport ? (
          <button className="bouton principal" onClick={surImport}>Terminer</button>
        ) : (
          <>
            <button className="bouton" onClick={surFermeture}>Annuler</button>
            <button className="bouton principal" onClick={importer} disabled={enCours || lignes.length === 0}>
              Importer {lignes.length > 0 ? `${lignes.length} ligne(s)` : ''}
            </button>
          </>
        )
      }
    >
      {rapport ? (
        <>
          <Message type={rapport.ignores > 0 ? 'alerte' : 'succes'}>
            {rapport.importes} élève(s) importé(s), {rapport.ignores} ignoré(s).
          </Message>
          {rapport.erreurs.length > 0 && (
            <Tableau
              compacte
              lignes={rapport.erreurs}
              cleLigne={(e: any, i: number) => i}
              colonnes={[
                { cle: 'ligne', titre: 'Ligne', largeur: '80px' },
                { cle: 'message', titre: 'Problème rencontre' }
              ]}
            />
          )}
        </>
      ) : (
        <>
          <Message type="info">
            Le fichier doit comporter une premiere ligne d’en-tetes. Colonnes reconnues : <b>nom</b>,
            <b> prenom</b>, <b>sexe</b>, date_naissance, lieu_naissance, matricule, <b>classe</b>,
            tuteur_nom, tuteur_telephone, tuteur_lien. Le nom de la classe doit correspondre exactement
            a une classe existante.
          </Message>
          <div className="entre mb-16">
            <button className="bouton" onClick={choisirFichier}>
              <FileUp size={16} /> Choisir un fichier CSV
            </button>
            <button className="bouton discret" onClick={modeleCsv}>
              <FileDown size={16} /> Telecharger un modele
            </button>
          </div>

          {lignes.length > 0 && (
            <>
              <h3 className="mb-8">Aperçu ({lignes.length} lignes)</h3>
              <Tableau
                compacte
                lignes={lignes.slice(0, 12)}
                cleLigne={(_, i) => i}
                colonnes={Object.keys(lignes[0]).slice(0, 7).map((cle) => ({ cle, titre: cle }))}
              />
            </>
          )}
        </>
      )}
    </Modale>
  )
}
