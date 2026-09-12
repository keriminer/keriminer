import { useEffect, useState } from 'react'
import {
  AlertTriangle, Database, HardDriveDownload, Image, Lock, LockOpen, Plus,
  RefreshCw, Save, Trash2, Upload
} from 'lucide-react'
import type { AnneeScolaire, Etablissement, Periode, Utilisateur } from '@shared/types'
import { useAction, useDonnees } from '../hooks'
import { useSession, appliquerIdentiteVisuelle } from '../store/session'
import {
  Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide, Message, Modale,
  Onglets, Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { DEVISES, PASSERELLES_SMS } from '@shared/constants'
import { ROLES } from '@shared/permissions'
import { formaterDate, formaterDateHeure } from '@shared/format'

export default function Parametres() {
  const [onglet, setOnglet] = useState('etablissement')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Paramètres</h1>
          <div className="sous-texte">Configuration de l’établissement, des années scolaires et du système</div>
        </div>
      </div>
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'etablissement', libelle: 'Établissement' },
          { cle: 'annees', libelle: 'Années et périodes' },
          { cle: 'cloture', libelle: "Clôture de l’année" },
          { cle: 'sms', libelle: 'Passerelle SMS' },
          { cle: 'documents', libelle: 'Documents' },
          { cle: 'utilisateurs', libelle: 'Utilisateurs' },
          { cle: 'sauvegarde', libelle: 'Sauvegarde' },
          { cle: 'journal', libelle: 'Journal' }
        ]}
      />
      {onglet === 'etablissement' && <OngletEtablissement />}
      {onglet === 'annees' && <OngletAnnees />}
      {onglet === 'cloture' && <OngletCloture />}
      {onglet === 'sms' && <OngletSms />}
      {onglet === 'documents' && <OngletDocuments />}
      {onglet === 'utilisateurs' && <OngletUtilisateurs />}
      {onglet === 'sauvegarde' && <OngletSauvegarde />}
      {onglet === 'journal' && <OngletJournal />}
    </>
  )
}

/* ----------------------------- Etablissement ------------------------------ */

function OngletEtablissement() {
  const { etablissement, rafraichir } = useSession()
  const { executer, enCours } = useAction()
  const [d, setD] = useState<Partial<Etablissement>>(etablissement ?? {})

  useEffect(() => setD(etablissement ?? {}), [etablissement])
  const maj = (c: Partial<Etablissement>) => {
    const suivant = { ...d, ...c }
    setD(suivant)
    // Aperçu immediat des couleurs, sans attendre l’enregistrement.
    if (c.couleur_primaire || c.couleur_secondaire) {
      appliquerIdentiteVisuelle(suivant as Etablissement)
    }
  }

  const choisirImage = async (champ: 'logo' | 'filigrane' | 'signature_directeur') => {
    const image = await appeler<string | null>('fichier.ouvrir_image')
    if (image) maj({ [champ]: image } as Partial<Etablissement>)
  }

  return (
    <div className="grille c2">
      <Carte
        titre="Identité"
        actions={
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(() => appeler('etablissement.modifier', d), {
                succes: 'Fiche établissement mise à jour.',
                surSucces: rafraichir
              })
            }
          >
            <Save size={16} /> Enregistrer
          </button>
        }
      >
        <div className="ligne-champs">
          <Champ label="Nom de l’établissement" obligatoire>
            <input value={d.nom ?? ''} onChange={(e) => maj({ nom: e.target.value })} />
          </Champ>
          <Champ label="Sigle">
            <input value={d.sigle ?? ''} onChange={(e) => maj({ sigle: e.target.value })} />
          </Champ>
        </div>
        <Champ label="Devise ou slogan">
          <input value={d.devise_texte ?? ''} onChange={(e) => maj({ devise_texte: e.target.value })} />
        </Champ>
        <div className="ligne-champs c3">
          <Champ label="Pays"><input value={d.pays ?? ''} onChange={(e) => maj({ pays: e.target.value })} /></Champ>
          <Champ label="Province"><input value={d.province ?? ''} onChange={(e) => maj({ province: e.target.value })} /></Champ>
          <Champ label="Commune"><input value={d.commune ?? ''} onChange={(e) => maj({ commune: e.target.value })} /></Champ>
        </div>
        <div className="ligne-champs c3">
          <Champ label="Téléphone"><input value={d.telephone ?? ''} onChange={(e) => maj({ telephone: e.target.value })} /></Champ>
          <Champ label="Courriel"><input value={d.email ?? ''} onChange={(e) => maj({ email: e.target.value })} /></Champ>
          <Champ label="Boite postale"><input value={d.bp ?? ''} onChange={(e) => maj({ bp: e.target.value })} /></Champ>
        </div>
        <div className="ligne-champs c3">
          <Champ label="Adresse"><input value={d.adresse ?? ''} onChange={(e) => maj({ adresse: e.target.value })} /></Champ>
          <Champ label="Code officiel"><input value={d.code_officiel ?? ''} onChange={(e) => maj({ code_officiel: e.target.value })} /></Champ>
          <Champ label="Directeur"><input value={d.nom_directeur ?? ''} onChange={(e) => maj({ nom_directeur: e.target.value })} /></Champ>
        </div>
        <Champ label="Autorité de tutelle" aide="Apparaît en tête des documents officiels">
          <input value={d.autorite_tutelle ?? ''} onChange={(e) => maj({ autorite_tutelle: e.target.value })} />
        </Champ>
      </Carte>

      <div className="pile" style={{ gap: 14 }}>
        <Carte titre="Identité visuelle" sousTitre="Ces éléments apparaissent dans l’application et sur tous les documents">
          <div className="ligne-champs">
            <Champ label="Couleur principale">
              <input type="color" value={d.couleur_primaire ?? '#0f766e'} onChange={(e) => maj({ couleur_primaire: e.target.value })} />
            </Champ>
            <Champ label="Couleur secondaire">
              <input type="color" value={d.couleur_secondaire ?? '#f59e0b'} onChange={(e) => maj({ couleur_secondaire: e.target.value })} />
            </Champ>
          </div>
          <div className="grille c3" style={{ gap: 10 }}>
            {([
              { champ: 'logo' as const, libelle: 'Logo' },
              { champ: 'filigrane' as const, libelle: 'Filigrane' },
              { champ: 'signature_directeur' as const, libelle: 'Signature' }
            ]).map((x) => (
              <div key={x.champ}>
                <label style={{ fontSize: 12.5, color: 'var(--texte-doux)' }}>{x.libelle}</label>
                <div
                  style={{
                    height: 84, border: '1px dashed var(--bordure-forte)', borderRadius: 6,
                    display: 'grid', placeItems: 'center', marginTop: 4, background: '#fff'
                  }}
                >
                  {d[x.champ] ? (
                    <img src={d[x.champ] as string} alt="" style={{ maxHeight: 76, maxWidth: '90%', objectFit: 'contain' }} />
                  ) : (
                    <Image size={22} color="var(--texte-faible)" />
                  )}
                </div>
                <div className="entre mt-8">
                  <button className="bouton petit" onClick={() => choisirImage(x.champ)}>Choisir</button>
                  {d[x.champ] && (
                    <button
                      className="bouton discret petit"
                      onClick={() => maj({ [x.champ]: null } as Partial<Etablissement>)}
                    >                      Retirer                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Carte>

        <Carte titre="Règles de notation et monnaie">
          <div className="ligne-champs c3">
            <Champ label="Monnaie">
              <Selection
                valeur={d.devise_code ?? 'BIF'}
                surChangement={(v) => maj({ devise_code: v ?? 'BIF' })}
                options={DEVISES.map((x) => ({ valeur: x.code, libelle: `${x.libelle} (${x.symbole})` }))}
              />
            </Champ>
            <Champ label="Barème">
              <Selection
                valeur={d.bareme_notation ?? 20}
                surChangement={(v) => maj({ bareme_notation: Number(v ?? 20) })}
                options={[
                  { valeur: 20, libelle: 'Sur 20' },
                  { valeur: 10, libelle: 'Sur 10' },
                  { valeur: 100, libelle: 'Sur 100' }
                ]}
              />
            </Champ>
            <Champ label="Moyenne de réussite" aide="Sur 20">
              <input
                type="number" step="0.5" min={0} max={20}
                value={d.seuil_reussite ?? 10}
                onChange={(e) => maj({ seuil_reussite: Number(e.target.value) })}
              />
            </Champ>
          </div>
        </Carte>
      </div>
    </div>
  )
}

/* -------------------------- Annees et periodes ---------------------------- */

function OngletAnnees() {
  const { rafraichir } = useSession()
  const { executer } = useAction()
  const annees = useDonnees<AnneeScolaire[]>('annee.liste', [], [])
  const periodes = useDonnees<Periode[]>('annee.periodes', [], [])
  const [verrouillage, setVerrouillage] = useState<Periode | null>(null)

  return (
    <div className="grille c2">
      <Carte titre="Années scolaires" sansMarge>
        <Tableau
          lignes={annees.donnees}
          cleLigne={(a) => a.id}
          colonnes={[
            { cle: 'libelle', titre: 'Année', rendu: (a) => (
              <div>
                <div className="gras">{a.libelle}</div>
                <div className="petit discret">{formaterDate(a.date_debut)} → {formaterDate(a.date_fin)}</div>
              </div>
            ) },
            { cle: 'statut', titre: 'Etat', rendu: (a) =>
              a.active ? <Etiquette variante="succes">Active</Etiquette>
                : a.cloturee ? <Etiquette>Clôturée</Etiquette>
                : <Etiquette variante="info">Ouverte</Etiquette> },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (a) =>              !a.active ? (                <button
                  className="bouton petit"
                  onClick={() =>
                    executer(() => appeler('annee.activer', a.id), {
                      succes: 'Année activée.',
                      surSucces: () => { annees.recharger(); periodes.recharger(); rafraichir() }
                    })
                  }
                >                  Activer                </button>
              ) : null }
          ]}
        />
      </Carte>

      <Carte titre="Périodes de l’année active" sousTitre="Verrouiller une période figé définitivement ses bulletins" sansMarge>
        <Tableau
          lignes={periodes.donnees}
          cleLigne={(p) => p.id}
          colonnes={[
            { cle: 'libelle', titre: 'Période' },
            { cle: 'date_debut', titre: 'Du', rendu: (p) => (
              <input
                type="date" defaultValue={p.date_debut}
                onBlur={(e) =>
                  e.target.value !== p.date_debut &&
                  executer(() => appeler('annee.modifier_periode', p.id, { date_debut: e.target.value }), {
                    surSucces: periodes.recharger
                  })
                }
              />
            ) },
            { cle: 'date_fin', titre: 'Au', rendu: (p) => (
              <input
                type="date" defaultValue={p.date_fin}
                onBlur={(e) =>
                  e.target.value !== p.date_fin &&
                  executer(() => appeler('annee.modifier_periode', p.id, { date_fin: e.target.value }), {
                    surSucces: periodes.recharger
                  })
                }
              />
            ) },
            { cle: 'verrouillee', titre: 'Etat', alignement: 'centre', rendu: (p) =>
              p.verrouillee ? <Etiquette variante="danger">Verrouillée</Etiquette> : <Etiquette variante="succes">Ouverte</Etiquette> },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (p) =>
              p.verrouillee ? (
                <button
                  className="bouton petit"
                  onClick={() =>
                    executer(() => appeler('annee.deverrouiller_periode', p.id), {
                      succes: 'Période déverrouillée.',
                      surSucces: periodes.recharger
                    })
                  }
                >
                  <LockOpen size={14} /> Deverrouiller
                </button>
              ) : (
                <button className="bouton petit" onClick={() => setVerrouillage(p)}>
                  <Lock size={14} /> Verrouiller
                </button>
              ) }
          ]}
        />
      </Carte>

      <Confirmation
        ouverte={Boolean(verrouillage)}
        titre="Verrouiller cette période ?"
        libelleConfirmation="Verrouiller et archiver"
        message={
          <>
            <p>
              Les notes de « <b>{verrouillage?.libelle}</b> » ne seront plus modifiables et les bulletins de
              tous les eleves seront archives dans leur etat actuel.
            </p>
            <p className="petit discret">              C’est cette archive qui fera foi ensuite : un changement futur de coefficient ne modifiera pas
              les bulletins déjà remis aux familles.            </p>
          </>
        }
        surAnnulation={() => setVerrouillage(null)}
        surConfirmation={() =>
          executer(() => appeler('annee.verrouiller_periode', verrouillage!.id), {
            succes: 'Période verrouillée et bulletins archivés.',
            surSucces: () => { setVerrouillage(null); periodes.recharger() }
          })
        }
      />
    </div>
  )
}

/* --------------------------- Cloture de l’annee --------------------------- */

/**
 * L’opération la plus sensible de l’application : elle ferme l’annee, archive
 * tous les bulletins, cree l’annee suivante et fait passer les eleves de classe.
 * Chaque decision de passage reste modifiable individuellement avant validation.
 */
function OngletCloture() {
  const { annee, rafraichir } = useSession()
  const { executer, enCours } = useAction()
  const { notifier } = useNotifications()
  const [etape, setEtape] = useState<'bilan' | 'confirmation'>('bilan')
  const [decisions, setDecisions] = useState<Record<number, string>>({})
  const [resultat, setResultat] = useState<any>(null)

  const anneeSuivante = annee
    ? (() => {
        const debut = Number(annee.libelle.slice(0, 4)) + 1
        return {
          libelle: `${debut}-${debut + 1}`,
          date_debut: `${debut}-09-01`,
          date_fin: `${debut + 1}-07-15`
        }
      })()
    : null

  const [options, setOptions] = useState({
    libelle: anneeSuivante?.libelle ?? '',
    date_debut: anneeSuivante?.date_debut ?? '',
    date_fin: anneeSuivante?.date_fin ?? '',
    decoupage: 'TRIMESTRE' as 'TRIMESTRE' | 'SEMESTRE',
    reconduire_classes: true,
    reconduire_frais: true,
    reconduire_attributions: true,
    promouvoir: true
  })

  const bilan = useDonnees<any[]>(annee ? 'annee.bilan' : null, [annee?.id], [])

  useEffect(() => {
    if (bilan.donnees.length && Object.keys(decisions).length === 0) {
      setDecisions(
        Object.fromEntries(
          bilan.donnees.map((b) => [b.inscription_id, b.decision === 'REDOUBLE' ? 'REDOUBLE' : 'ADMIS'])
        )
      )
    }
  }, [bilan.donnees, decisions])

  if (!annee) return <Message type="alerte">Aucune année scolaire active.</Message>
  if (annee.cloturee) return <Message type="info">Cette année est déjà clôturée.</Message>

  const admis = Object.values(decisions).filter((d) => d === 'ADMIS').length
  const redoublants = Object.values(decisions).filter((d) => d === 'REDOUBLE').length
  const sorties = Object.values(decisions).filter((d) => d === 'SORTIE').length
  const soldesImpayes = bilan.donnees.filter((b) => b.solde > 0).length

  if (resultat) {
    return (
      <Carte titre="Clôture terminée">
        <Message type="succes">L’année a été clôturée et la nouvelle année est désormais active.</Message>
        <ul>
          <li>{resultat.classes_creees} classe(s) reconduite(s)</li>
          <li>{resultat.frais_reconduits} ligne(s) tarifaire(s) reconduite(s)</li>
          <li>{resultat.eleves_promus} élève(s) promu(s) au niveau supérieur</li>
          <li>{resultat.eleves_redoublants} redoublant(s)</li>
          <li>{resultat.eleves_sortis} élève(s) sorti(s) ou diplômé(s)</li>
        </ul>
        <button className="bouton principal mt-12" onClick={() => window.location.reload()}>          Recharger l’application        </button>
      </Carte>
    )
  }

  return (
    <>
      <Message type="alerte">        La clôture est irreversible. Elle verrouille toutes les périodes, archive les bulletins, créé l’année
        suivante et y inscrit les élèves. Faites une sauvegarde avant de continuer.      </Message>

      {etape === 'bilan' ? (
        <>
          <div className="grille c4 mb-16">
            <Carte><div className="indicateur"><div>
              <div className="valeur">{bilan.donnees.length}</div><div className="etiquette">Élèves inscrits</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur" style={{ color: 'var(--succes)' }}>{admis}</div>
              <div className="etiquette">Admis au niveau supérieur</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur" style={{ color: 'var(--alerte)' }}>{redoublants}</div>
              <div className="etiquette">Redoublants</div>
            </div></div></Carte>
            <Carte><div className="indicateur"><div>
              <div className="valeur" style={{ color: 'var(--danger)' }}>{soldesImpayes}</div>
              <div className="etiquette">Élèves avec impayé</div>
            </div></div></Carte>
          </div>

          <Carte
            titre="Decisions de passage"
            sousTitre="Pre-remplies à partir de la moyenne annuelle ; ajustez-les au besoin"
            actions={<button className="bouton principal" onClick={() => setEtape('confirmation')}>Continuer</button>}
            sansMarge
          >
            {bilan.chargement ? (
              <Chargement />
            ) : (
              <Tableau
                compacte
                lignes={bilan.donnees}
                cleLigne={(b) => b.inscription_id}
                vide={<EtatVide titre="Aucun élève inscrit" />}
                colonnes={[
                  { cle: 'nom_complet', titre: 'Élève', rendu: (b) => (
                    <div>
                      <div className="gras">{b.nom_complet}</div>
                      <div className="petit discret">{b.classe_libelle}</div>
                    </div>
                  ) },
                  { cle: 'moyenne_annuelle', titre: 'Moyenne annuelle', alignement: 'droite', rendu: (b) =>                    b.moyenne_annuelle !== null ? (                      <b>{b.moyenne_annuelle.toFixed(2).replace('.', ',')}</b>
                    ) : (
                      <span className="discret">Non évalué</span>
                    ) },
                  { cle: 'solde', titre: 'Solde', alignement: 'droite', rendu: (b) =>
                    b.solde > 0 ? <b style={{ color: 'var(--danger)' }}>{b.solde.toLocaleString('fr-FR')}</b> : '—' },
                  { cle: 'decision', titre: 'Decision', largeur: '330px', rendu: (b) => (
                    <div className="groupe-boutons">
                      {[
                        { code: 'ADMIS', libelle: 'Passe' },
                        { code: 'REDOUBLE', libelle: 'Redouble' },
                        { code: 'SORTIE', libelle: 'Sortie' }
                      ].map((o) => (
                        <button
                          key={o.code}
                          className={decisions[b.inscription_id] === o.code ? 'actif' : ''}
                          onClick={() => setDecisions({ ...decisions, [b.inscription_id]: o.code })}
                        >
                          {o.libelle}
                        </button>
                      ))}
                    </div>
                  ) }
                ]}
              />
            )}
          </Carte>
        </>
      ) : (
        <Carte
          titre="Nouvelle année scolaire"
          actions={<button className="bouton" onClick={() => setEtape('bilan')}>Retour aux decisions</button>}
        >
          <div className="ligne-champs c4">
            <Champ label="Libelle" obligatoire>
              <input value={options.libelle} onChange={(e) => setOptions({ ...options, libelle: e.target.value })} />
            </Champ>
            <Champ label="Rentrée" obligatoire>
              <input type="date" value={options.date_debut} onChange={(e) => setOptions({ ...options, date_debut: e.target.value })} />
            </Champ>
            <Champ label="Fin" obligatoire>
              <input type="date" value={options.date_fin} onChange={(e) => setOptions({ ...options, date_fin: e.target.value })} />
            </Champ>
            <Champ label="Decoupage">
              <Selection
                valeur={options.decoupage}
                surChangement={(v) => setOptions({ ...options, decoupage: (v ?? 'TRIMESTRE') as 'TRIMESTRE' | 'SEMESTRE' })}
                options={[
                  { valeur: 'TRIMESTRE', libelle: '3 trimestres' },
                  { valeur: 'SEMESTRE', libelle: '2 semestres' }
                ]}
              />
            </Champ>
          </div>

          <h3 className="mt-16 mb-8">Ce qui sera repris dans la nouvelle année</h3>
          {([
            { cle: 'reconduire_classes' as const, libelle: 'Recreer les mêmes classes', aide: 'Mêmes noms, niveaux, capacités et titulaires' },
            { cle: 'reconduire_attributions' as const, libelle: 'Reconduire les matières et coefficients', aide: 'Avec les mêmes enseignants' },
            { cle: 'reconduire_frais' as const, libelle: 'Reconduire la grille tarifaire', aide: 'Les montants restent modifiables ensuite' },
            { cle: 'promouvoir' as const, libelle: 'Inscrire les élèves selon les decisions', aide: 'Passage, redoublement ou sortie' }
          ]).map((o) => (
            <label key={o.cle} className="case-a-cocher mb-8">
              <input
                type="checkbox"
                checked={options[o.cle]}
                onChange={(e) => setOptions({ ...options, [o.cle]: e.target.checked })}
              />
              <span>
                {o.libelle} <span className="petit discret">— {o.aide}</span>
              </span>
            </label>
          ))}

          <Message type="alerte">
            Recapitulatif : <b>{admis}</b> passage(s), <b>{redoublants}</b> redoublement(s), <b>{sorties}</b> sortie(s).
            Les eleves en derniere annee de cycle sont automatiquement marques diplomes.
          </Message>

          <button
            className="bouton danger large mt-12"
            disabled={enCours}
            onClick={() => {
              if (!options.libelle || !options.date_debut || !options.date_fin) {
                return notifier('alerte', 'Completez les informations de la nouvelle année.')
              }
              executer(
                async () => {
                  const r = await appeler('annee.cloturer', {
                    annee_id: annee.id,
                    nouvelle_annee: {
                      libelle: options.libelle,
                      date_debut: options.date_debut,
                      date_fin: options.date_fin,
                      decoupage: options.decoupage
                    },
                    reconduire_classes: options.reconduire_classes,
                    reconduire_frais: options.reconduire_frais,
                    reconduire_attributions: options.reconduire_attributions,
                    promouvoir: options.promouvoir,
                    decisions
                  })
                  setResultat(r)
                },
                { succes: 'Année clôturée.', surSucces: rafraichir }
              )
            }}
          >
            <AlertTriangle size={18} /> Cloturer definitivement l’annee {annee.libelle}
          </button>
        </Carte>
      )}
    </>
  )
}

/* -------------------------------- SMS ------------------------------------- */

function OngletSms() {
  const { executer, enCours } = useAction()
  const parametres = useDonnees<Record<string, string>>('parametres.lire', [], {})
  const [p, setP] = useState<Record<string, string>>({})

  useEffect(() => setP(parametres.donnees), [parametres.donnees])
  const maj = (c: Record<string, string>) => setP((v) => ({ ...v, ...c }))
  const passerelle = p['sms.passerelle'] ?? 'AUCUNE'

  return (
    <div className="grille c2">
      <Carte
        titre="Passerelle d’envoi"
        actions={
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(() => appeler('parametres.ecrire', p), {
                succes: 'Paramètres enregistrés.',
                surSucces: parametres.recharger
              })
            }
          >
            <Save size={16} /> Enregistrer
          </button>
        }
      >
        <Champ label="Fournisseur" aide="L’envoi reste manuel : rien ne part sans votre action">
          <Selection
            valeur={passerelle}
            surChangement={(v) => maj({ 'sms.passerelle': v ?? 'AUCUNE' })}
            options={PASSERELLES_SMS.map((x) => ({ valeur: x.code, libelle: x.libelle }))}
          />
        </Champ>

        {passerelle === 'MODEM_GSM' && (
          <Message type="info">
            Le modem GSM permet d’envoyer des SMS <b>sans internet</b>, avec une carte SIM locale placee dans
            une cle USB GSM. C’est souvent la solution la moins chere et la plus fiable en zone rurale.
          </Message>
        )}

        {passerelle !== 'AUCUNE' && passerelle !== 'MODEM_GSM' && (
          <>
            <div className="ligne-champs">
              <Champ label="Identifiant / compte">
                <input value={p['sms.identifiant'] ?? ''} onChange={(e) => maj({ 'sms.identifiant': e.target.value })} />
              </Champ>
              <Champ label="Clé d’API">
                <input type="password" value={p['sms.cle_api'] ?? ''} onChange={(e) => maj({ 'sms.cle_api': e.target.value })} />
              </Champ>
            </div>
            <Champ label="Nom de l’expéditeur" aide="Affiche sur le téléphone du parent, 11 caractères maximum">
              <input maxLength={11} value={p['sms.expediteur'] ?? ''} onChange={(e) => maj({ 'sms.expediteur': e.target.value })} />
            </Champ>
          </>
        )}

        {(passerelle === 'HTTP_GENERIQUE' || passerelle === 'INFOBIP') && (
          <Champ
            label="Adresse de la passerelle"
            aide="Jetons remplacés automatiquement : {telephone}, {message}, {expediteur}, {cle}"
          >
            <input
              value={p['sms.url'] ?? ''}
              onChange={(e) => maj({ 'sms.url': e.target.value })}
              placeholder="https://sms.operateur.bi/envoi?to={telephone}&text={message}&key={cle}"
            />
          </Champ>
        )}

        <Champ label="Indicatif pays" aide="Ajoute automatiquement aux numéros locaux">
          <input
            style={{ width: 110 }}
            value={p['sms.indicatif_pays'] ?? '257'}
            onChange={(e) => maj({ 'sms.indicatif_pays': e.target.value.replace(/\D/g, '') })}
          />
        </Champ>
      </Carte>

      <Carte titre="Envois automatiques" sousTitre="Messages declenches sans intervention">
        <label className="case-a-cocher mb-12">
          <input
            type="checkbox"
            checked={p['sms.auto_absence'] === '1'}
            onChange={(e) => maj({ 'sms.auto_absence': e.target.checked ? '1' : '0' })}
          />
          <span>            Alerter le tuteur à chaque absence non justifiée            <span className="petit discret"> — un seul message par élève et par séance</span>
          </span>
        </label>
        <label className="case-a-cocher mb-12">
          <input
            type="checkbox"
            checked={p['sms.auto_paiement'] === '1'}
            onChange={(e) => maj({ 'sms.auto_paiement': e.target.checked ? '1' : '0' })}
          />
          <span>            Accuser réception de chaque paiement            <span className="petit discret"> — rassure les familles et limite les contestations</span>
          </span>
        </label>
        <Message type="info">          Même automatiques, les messages sont d’abord places en file d’attente. Ils ne partent qu’à l’envoi,
          ce qui vous laisse un dernier controle et evite toute mauvaise surprise sur le credit SMS.        </Message>
        <button
          className="bouton principal mt-12"
          disabled={enCours}
          onClick={() =>
            executer(() => appeler('parametres.ecrire', p), {
              succes: 'Paramètres enregistrés.',
              surSucces: parametres.recharger
            })
          }
        >
          <Save size={16} /> Enregistrer
        </button>
      </Carte>
    </div>
  )
}

/* ------------------------------- Documents -------------------------------- */

function OngletDocuments() {
  const { executer, enCours } = useAction()
  const parametres = useDonnees<Record<string, string>>('parametres.lire', [], {})
  const [p, setP] = useState<Record<string, string>>({})
  useEffect(() => setP(parametres.donnees), [parametres.donnees])
  const maj = (c: Record<string, string>) => setP((v) => ({ ...v, ...c }))

  return (
    <div className="grille c2">
      <Carte titre="Bulletins">
        {([
          { cle: 'bulletin.afficher_rang', libelle: 'Afficher le rang de l’élève' },
          { cle: 'bulletin.afficher_moyenne_classe', libelle: 'Afficher la moyenne de la classe, le minimum et le maximum' },
          { cle: 'bulletin.afficher_appreciation', libelle: 'Afficher les appréciations par matière' }
        ]).map((o) => (
          <label key={o.cle} className="case-a-cocher mb-8">
            <input
              type="checkbox"
              checked={p[o.cle] === '1'}
              onChange={(e) => maj({ [o.cle]: e.target.checked ? '1' : '0' })}
            />
            {o.libelle}
          </label>
        ))}
      </Carte>

      <Carte titre="Reçus et matricules">
        <div className="ligne-champs">
          <Champ label="Préfixe des reçus" aide="Ex. : REC2026-00001">
            <input value={p['recu.prefixe'] ?? 'REC'} onChange={(e) => maj({ 'recu.prefixe': e.target.value })} />
          </Champ>
          <Champ label="Préfixe des matricules" aide="Ex. : STJ26-0001">
            <input value={p['matricule.prefixe'] ?? ''} onChange={(e) => maj({ 'matricule.prefixe': e.target.value })} />
          </Champ>
        </div>
        <Champ label="Mentions légales sur les reçus" aide="Imprimée en bas de chaque reçu">
          <textarea
            rows={2}
            value={p['recu.mentions_legales'] ?? ''}
            onChange={(e) => maj({ 'recu.mentions_legales': e.target.value })}
            placeholder="Aucun remboursement après la rentrée. Conservez ce reçu."
          />
        </Champ>
      </Carte>

      <Carte titre="Horaires de référence" sousTitre="Servent au calcul des retards et des heures">
        <div className="ligne-champs c3">
          <Champ label="Arrivée prévue des enseignants">
            <input
              type="time"
              value={p['pointage.heure_arrivee_prevue'] ?? '07:30'}
              onChange={(e) => maj({ 'pointage.heure_arrivee_prevue': e.target.value })}
            />
          </Champ>
          <Champ label="Départ prévu">
            <input
              type="time"
              value={p['pointage.heure_depart_prevue'] ?? '16:00'}
              onChange={(e) => maj({ 'pointage.heure_depart_prevue': e.target.value })}
            />
          </Champ>
          <Champ label="Heures par jour" aide="Base du calcul de la paie">
            <input
              type="number" min={1} max={12}
              value={p['pointage.heures_par_jour'] ?? '6'}
              onChange={(e) => maj({ 'pointage.heures_par_jour': e.target.value })}
            />
          </Champ>
        </div>
        <button
          className="bouton principal mt-12"
          disabled={enCours}
          onClick={() =>
            executer(() => appeler('parametres.ecrire', p), {
              succes: 'Paramètres enregistrés.',
              surSucces: parametres.recharger
            })
          }
        >
          <Save size={16} /> Enregistrer tous les parametres
        </button>
      </Carte>
    </div>
  )
}

/* ------------------------------ Utilisateurs ------------------------------ */

function OngletUtilisateurs() {
  const { executer } = useAction()
  const utilisateurs = useDonnees<Utilisateur[]>('utilisateur.liste', [], [])
  const [edition, setEdition] = useState<Utilisateur | null | 'nouveau'>(null)
  const [suppression, setSuppression] = useState<Utilisateur | null>(null)

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">          Chaque personne doit avoir son propre compte : c’est ce qui permet de savoir qui a encaissé,
          modifie une note ou accorde une remise.        </div>
        <button className="bouton principal" onClick={() => setEdition('nouveau')}>
          <Plus size={16} /> Nouvel utilisateur
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={utilisateurs.donnees}
          cleLigne={(u) => u.id}
          colonnes={[
            { cle: 'nom_complet', titre: 'Utilisateur', rendu: (u) => (
              <div>
                <div className="gras">{u.nom_complet}</div>
                <div className="petit discret mono">{u.login}</div>
              </div>
            ) },
            { cle: 'role', titre: 'Role', rendu: (u) => (
              <Etiquette variante="primaire">{ROLES.find((r) => r.code === u.role)?.libelle ?? u.role}</Etiquette>
            ) },
            { cle: 'telephone', titre: 'Téléphone' },
            { cle: 'dernier_login', titre: 'Dernière connexion', rendu: (u) =>
              u.dernier_login ? formaterDateHeure(u.dernier_login) : <span className="discret">Jamais</span> },
            { cle: 'actif', titre: 'Etat', rendu: (u) =>
              u.actif ? <Etiquette variante="succes">Actif</Etiquette> : <Etiquette variante="danger">Désactivé</Etiquette> },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (u) => (
              <div className="entre fin">
                <button className="bouton discret petit" onClick={() => setEdition(u)}>Modifier</button>
                <button className="bouton discret petit" onClick={() => setSuppression(u)}>
                  <Trash2 size={15} color="var(--danger)" />
                </button>
              </div>
            ) }
          ]}
        />
      </Carte>

      {edition && (
        <FormulaireUtilisateur
          utilisateur={edition === 'nouveau' ? null : edition}
          surFermeture={() => setEdition(null)}
          surEnregistrement={() => { setEdition(null); utilisateurs.recharger() }}
        />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer cet utilisateur ?"
        message={<>Le compte de <b>{suppression?.nom_complet}</b> sera supprime. Ses actions passées restent tracees dans le journal.</>}
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('utilisateur.supprimer', suppression!.id), {
            succes: 'Utilisateur supprimé.',
            surSucces: () => { setSuppression(null); utilisateurs.recharger() }
          })
        }
      />
    </>
  )
}

function FormulaireUtilisateur({
  utilisateur, surFermeture, surEnregistrement
}: {
  utilisateur: Utilisateur | null
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState({
    login: utilisateur?.login ?? '',
    nom_complet: utilisateur?.nom_complet ?? '',
    role: utilisateur?.role ?? 'SECRETAIRE',
    telephone: utilisateur?.telephone ?? '',
    email: utilisateur?.email ?? '',
    actif: utilisateur?.actif ?? 1,
    mot_de_passe: ''
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  return (
    <Modale
      ouverte
      titre={utilisateur ? `Modifier — ${utilisateur.nom_complet}` : 'Nouvel utilisateur'}
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
                  if (!d.nom_complet.trim()) throw new Error('Le nom est obligatoire.')
                  if (utilisateur) {
                    await appeler('utilisateur.modifier', utilisateur.id, {
                      nom_complet: d.nom_complet, role: d.role, actif: d.actif,
                      telephone: d.telephone || null, email: d.email || null
                    })
                    if (d.mot_de_passe) {
                      await appeler('utilisateur.reinitialiser', utilisateur.id, d.mot_de_passe)
                    }
                  } else {
                    if (!d.login.trim()) throw new Error("L’identifiant est obligatoire.")
                    if (d.mot_de_passe.length < 6) throw new Error('Mot de passe : 6 caractères minimum.')
                    await appeler('utilisateur.creer', d)
                  }
                },
                { succes: 'Utilisateur enregistré.', surSucces: surEnregistrement }
              )
            }
          >            Enregistrer          </button>
        </>
      }
    >
      <div className="ligne-champs">
        <Champ label="Nom complet" obligatoire>
          <input autoFocus value={d.nom_complet} onChange={(e) => maj({ nom_complet: e.target.value })} />
        </Champ>
        <Champ label="Identifiant de connexion" obligatoire>
          <input
            value={d.login}
            disabled={Boolean(utilisateur)}
            onChange={(e) => maj({ login: e.target.value.trim() })}
          />
        </Champ>
      </div>
      <Champ label="Role" aide="Détermine ce que la personne peut voir et modifier">
        <Selection
          valeur={d.role}
          surChangement={(v) => maj({ role: v ?? 'SECRETAIRE' })}
          options={ROLES.map((r) => ({ valeur: r.code, libelle: r.libelle }))}
        />
      </Champ>
      <div className="ligne-champs">
        <Champ label="Téléphone">
          <input value={d.telephone} onChange={(e) => maj({ telephone: e.target.value })} />
        </Champ>
        <Champ label="Courriel">
          <input type="email" value={d.email} onChange={(e) => maj({ email: e.target.value })} />
        </Champ>
      </div>
      <Champ
        label={utilisateur ? 'Nouveau mot de passe' : 'Mot de passe'}
        obligatoire={!utilisateur}
        aide={utilisateur ? 'Laisser vide pour ne pas le changer' : "L’utilisateur devra le changer a sa première connexion"}
      >
        <input type="password" value={d.mot_de_passe} onChange={(e) => maj({ mot_de_passe: e.target.value })} />
      </Champ>
      {utilisateur && (
        <label className="case-a-cocher">
          <input type="checkbox" checked={Boolean(d.actif)} onChange={(e) => maj({ actif: e.target.checked ? 1 : 0 })} />          Compte actif        </label>
      )}
    </Modale>
  )
}

/* ------------------------------- Sauvegarde ------------------------------- */

function OngletSauvegarde() {
  const { executer, enCours } = useAction()
  const { notifier } = useNotifications()
  const sauvegardes = useDonnees<any[]>('sauvegarde.liste', [], [])
  const diagnostic = useDonnees<any>('sauvegarde.diagnostic', [], null)
  const [restauration, setRestauration] = useState<any>(null)

  const formaterTaille = (octets: number) =>
    octets > 1048576 ? `${(octets / 1048576).toFixed(1)} Mo` : `${(octets / 1024).toFixed(0)} Ko`

  return (
    <div className="grille c2">
      <Carte
        titre="Sauvegardes"
        sousTitre="Une sauvegarde automatique est créée à chaque ouverture et fermeture"
        actions={
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(() => appeler('sauvegarde.creer'), {
                succes: 'Sauvegarde créée.',
                surSucces: sauvegardes.recharger
              })
            }
          >
            <HardDriveDownload size={16} /> Sauvegarder maintenant
          </button>
        }
        sansMarge
      >
        <Tableau
          compacte
          lignes={sauvegardes.donnees.slice(0, 25)}
          cleLigne={(s) => s.nom}
          vide={<EtatVide titre="Aucune sauvegarde" />}
          colonnes={[
            { cle: 'nom', titre: 'Fichier', rendu: (s) => (
              <div>
                <div className="mono petit">{s.nom}</div>
                <div className="petit discret">{formaterDateHeure(s.date.replace('T', ' '))}</div>
              </div>
            ) },
            { cle: 'taille', titre: 'Taille', alignement: 'droite', rendu: (s) => formaterTaille(s.taille) },
            { cle: 'automatique', titre: 'Type', rendu: (s) =>
              s.automatique ? <Etiquette>Automatique</Etiquette> : <Etiquette variante="primaire">Manuelle</Etiquette> },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (s) => (
              <button className="bouton discret petit" onClick={() => setRestauration(s)}>
                <Upload size={15} /> Restaurer
              </button>
            ) }
          ]}
        />
      </Carte>

      <div className="pile" style={{ gap: 14 }}>
        <Carte titre="État de la base de données">
          {diagnostic.chargement || !diagnostic.donnees ? (
            <Chargement />
          ) : (
            <>
              <div className="entre espace mb-8">
                <span className="doux">Intégrité</span>
                <Etiquette variante={diagnostic.donnees.integrite === 'ok' ? 'succes' : 'danger'}>
                  {diagnostic.donnees.integrite === 'ok' ? 'Base saine' : diagnostic.donnees.integrite}
                </Etiquette>
              </div>
              <div className="entre espace mb-8">
                <span className="doux">Taille</span>
                <b>{formaterTaille(diagnostic.donnees.taille)}</b>
              </div>
              <div className="entre espace mb-8">
                <span className="doux">Tables</span>
                <b>{diagnostic.donnees.tables}</b>
              </div>
              <div className="petit discret mt-8" style={{ wordBreak: 'break-all' }}>
                <Database size={13} style={{ verticalAlign: -2 }} /> {diagnostic.donnees.chemin}
              </div>
              <button className="bouton petit mt-12" onClick={diagnostic.recharger}>
                <RefreshCw size={14} /> Verifier a nouveau
              </button>
            </>
          )}
        </Carte>

        <Carte titre="Conseils">
          <Message type="alerte">            Copiez regulierement le dernier fichier de sauvegarde sur une clé USB conservee hors de l’école.
            Un ordinateur peut être volé ou detruit ; une clé USB dans un autre batiment sauve une année de
            travail.          </Message>
          <button
            className="bouton"
            onClick={async () => {
              const chemin = await appeler<string | null>('fichier.choisir_dossier')
              if (!chemin) return
              await appeler('parametres.ecrire', { 'sauvegarde.dossier_externe': chemin })
              notifier('succes', `Copie automatique activée vers ${chemin}`)
            }}
          >            Choisir un dossier de copie automatique          </button>
        </Carte>
      </div>

      <Confirmation
        ouverte={Boolean(restauration)}
        danger
        titre="Restaurer cette sauvegarde ?"
        libelleConfirmation="Restaurer"
        message={
          <>
            <p>
              Toutes les donnees actuelles seront remplacees par celles du fichier{' '}
              <b className="mono">{restauration?.nom}</b>.
            </p>
            <p className="petit discret">              Une copie de sécurité de l’etat actuel est créée automatiquement avant la restauration.            </p>
          </>
        }
        surAnnulation={() => setRestauration(null)}
        surConfirmation={() =>
          executer(() => appeler('sauvegarde.restaurer', restauration.chemin), {
            succes: 'Sauvegarde restaurée. Rechargez l’application.',
            surSucces: () => { setRestauration(null); setTimeout(() => window.location.reload(), 1200) }
          })
        }
      />
    </div>
  )
}

/* -------------------------------- Journal --------------------------------- */

function OngletJournal() {
  const [recherche, setRecherche] = useState('')
  const journal = useDonnees<any[]>('audit.journal', [300, recherche], [])

  return (
    <>
      <div className="barre-filtres">
        <div className="champ recherche">
          <label>Rechercher</label>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Action, utilisateur ou entite…"
          />
        </div>
      </div>

      <Message type="info">        Toutes les opérations sensibles sont tracees : encaissements, annulations de reçus, remises,
        modifications de notes, clôture d’année, gestion des comptes.      </Message>

      <Carte sansMarge>
        <Tableau
          lignes={journal.donnees}
          cleLigne={(l) => l.id}
          vide={<EtatVide titre="Journal vide" />}
          colonnes={[
            { cle: 'date_action', titre: 'Date', largeur: '160px', rendu: (l) => (
              <span className="petit">{formaterDateHeure(l.date_action)}</span>
            ) },
            { cle: 'utilisateur_nom', titre: 'Utilisateur' },
            { cle: 'action', titre: 'Action', rendu: (l) => <Etiquette>{l.action}</Etiquette> },
            { cle: 'entite', titre: 'Entite', rendu: (l) =>
              l.entite ? `${l.entite}${l.entite_id ? ` #${l.entite_id}` : ''}` : '—' },
            { cle: 'details', titre: 'Détails', rendu: (l) =>
              l.details ? <span className="petit discret">{l.details.slice(0, 120)}</span> : '—' }
          ]}
        />
      </Carte>
    </>
  )
}
