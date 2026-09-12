import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Image, Loader2 } from 'lucide-react'
import { appeler } from '../lib/api'
import { Champ, Message, Selection, useNotifications } from '../components/ui'
import { useSession } from '../store/session'
import { CYCLES, DEVISES } from '@shared/constants'
import type { ModeleStructure } from '@shared/types'

const ETAPES = ['Établissement', 'Identité visuelle', 'Cycles', 'Année scolaire', 'Administrateur']

/**
 * Assistant de premiere configuration.
 * Il doit pouvoir etre suivi par un directeur qui n’a jamais utilise de
 * logiciel de gestion : une decision par ecran, des valeurs pre-remplies
 * partout ou c’est possible.
 */
export default function Installation() {
  const { rafraichir } = useSession()
  const { notifier } = useNotifications()
  const [etape, setEtape] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const [modeles, setModeles] = useState<ModeleStructure[]>([])

  const anneeCourante = new Date().getFullYear()
  const moisCourant = new Date().getMonth()
  // Au-dela de juin, la rentrée qui approche est celle de l’année suivante.
  const anneeDebut = moisCourant >= 6 ? anneeCourante : anneeCourante - 1

  const [donnees, setDonnees] = useState({
    nom: '',
    sigle: '',
    type_etablissement: 'Privé',
    devise_texte: '',
    pays: '',
    province: '',
    commune: '',
    adresse: '',
    telephone: '',
    email: '',
    bp: '',
    code_officiel: '',
    nom_directeur: '',
    autorite_tutelle: '',
    logo: '' as string,
    couleur_primaire: '#0f766e',
    couleur_secondaire: '#f59e0b',
    devise_code: 'BIF',
    bareme_notation: 20,
    seuil_reussite: 10,
    modele_structure: 'FONDAMENTAL_9',
    cycles: ['PRIMAIRE'] as string[],
    annee_libelle: `${anneeDebut}-${anneeDebut + 1}`,
    annee_debut: `${anneeDebut}-09-01`,
    annee_fin: `${anneeDebut + 1}-07-15`,
    decoupage: 'TRIMESTRE' as 'TRIMESTRE' | 'SEMESTRE',
    admin_nom: '',
    admin_login: '',
    admin_mdp: '',
    admin_mdp2: ''
  })

  const maj = (champs: Partial<typeof donnees>) => setDonnees((d) => ({ ...d, ...champs }))

  useEffect(() => {
    appeler<ModeleStructure[]>('installation.modeles').then(setModeles).catch(() => setModeles([]))
  }, [])

  const erreurEtape = (): string | null => {
    if (etape === 0 && !donnees.nom.trim()) return "Le nom de l’établissement est obligatoire."
    if (etape === 2 && donnees.cycles.length === 0) return 'Choisissez au moins un cycle.'
    if (etape === 3) {
      if (!donnees.annee_libelle.trim()) return "Indiquez le libelle de l’année scolaire."
      if (donnees.annee_fin <= donnees.annee_debut) return 'La date de fin doit suivre la date de debut.'
    }
    if (etape === 4) {
      if (!donnees.admin_nom.trim()) return 'Indiquez le nom du responsable.'
      if (!donnees.admin_login.trim()) return "Choisissez un identifiant de connexion."
      if (donnees.admin_mdp.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.'
      if (donnees.admin_mdp !== donnees.admin_mdp2) return 'Les deux mots de passe ne correspondent pas.'
    }
    return null
  }

  const suivant = () => {
    const erreur = erreurEtape()
    if (erreur) return notifier('alerte', erreur)
    setEtape((e) => Math.min(ETAPES.length - 1, e + 1))
  }

  const choisirLogo = async () => {
    const image = await appeler<string | null>('fichier.ouvrir_image')
    if (image) maj({ logo: image })
  }

  const terminer = async () => {
    const erreur = erreurEtape()
    if (erreur) return notifier('alerte', erreur)

    setEnCours(true)
    try {
      await appeler('installation.executer', {
        etablissement: {
          nom: donnees.nom,
          sigle: donnees.sigle || null,
          type_etablissement: donnees.type_etablissement,
          devise_texte: donnees.devise_texte || null,
          pays: donnees.pays || null,
          province: donnees.province || null,
          commune: donnees.commune || null,
          adresse: donnees.adresse || null,
          telephone: donnees.telephone || null,
          email: donnees.email || null,
          bp: donnees.bp || null,
          code_officiel: donnees.code_officiel || null,
          nom_directeur: donnees.nom_directeur || null,
          autorite_tutelle: donnees.autorite_tutelle || null,
          logo: donnees.logo || null,
          couleur_primaire: donnees.couleur_primaire,
          couleur_secondaire: donnees.couleur_secondaire,
          devise_code: donnees.devise_code,
          bareme_notation: Number(donnees.bareme_notation),
          seuil_reussite: Number(donnees.seuil_reussite)
        },
        modele_structure: donnees.modele_structure,
        cycles: donnees.cycles,
        annee: {
          libelle: donnees.annee_libelle,
          date_debut: donnees.annee_debut,
          date_fin: donnees.annee_fin,
          decoupage: donnees.decoupage
        },
        administrateur: {
          nom_complet: donnees.admin_nom,
          login: donnees.admin_login.trim(),
          mot_de_passe: donnees.admin_mdp
        }
      })
      notifier('succes', 'Configuration terminée. Connectez-vous avec votre identifiant.')
      await rafraichir()
    } catch (e) {
      notifier('erreur', (e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="ecran-centre">
      <div className="assistant">
        <div style={{ padding: '20px 26px 14px', borderBottom: '1px solid var(--bordure)' }}>
          <h1 style={{ color: 'var(--primaire)' }}>Bienvenue dans SCOLIA</h1>
          <div className="sous-texte">            Quelques minutes suffisent pour configurer votre établissement. Tout reste modifiable ensuite.          </div>
        </div>

        <div className="etapes">
          {ETAPES.map((libelle, index) => (
            <div
              key={libelle}
              className={`etape ${index === etape ? 'active' : ''} ${index < etape ? 'faite' : ''}`}
            >
              {index < etape ? <Check size={13} style={{ verticalAlign: -2 }} /> : `${index + 1}. `}
              {libelle}
            </div>
          ))}
        </div>

        <div className="corps">
          {etape === 0 && (
            <>
              <Champ label="Nom complet de l’établissement" obligatoire>
                <input
                  autoFocus
                  value={donnees.nom}
                  onChange={(e) => maj({ nom: e.target.value })}
                  placeholder="Ex. : École Fondamentale de la Paix"
                />
              </Champ>
              <div className="ligne-champs c3">
                <Champ label="Sigle" aide="Affiche dans le menu et sur les documents">
                  <input value={donnees.sigle} onChange={(e) => maj({ sigle: e.target.value })} placeholder="EFP" />
                </Champ>
                <Champ label="Statut">
                  <Selection
                    valeur={donnees.type_etablissement}
                    surChangement={(v) => maj({ type_etablissement: v ?? 'Privé' })}
                    options={[
                      { valeur: 'Public', libelle: 'Public' },
                      { valeur: 'Privé', libelle: 'Privé' },
                      { valeur: 'Conventionne', libelle: 'Conventionne' },
                      { valeur: 'Confessionnel', libelle: 'Confessionnel' }
                    ]}
                  />
                </Champ>
                <Champ label="Code officiel" aide="Code attribue par le ministère">
                  <input value={donnees.code_officiel} onChange={(e) => maj({ code_officiel: e.target.value })} />
                </Champ>
              </div>
              <Champ label="Devise ou slogan" aide="Apparaît en bas de l’en-tête des documents">
                <input
                  value={donnees.devise_texte}
                  onChange={(e) => maj({ devise_texte: e.target.value })}
                  placeholder="Discipline — Travail — Réussite"
                />
              </Champ>
              <div className="ligne-champs c3">
                <Champ label="Pays"><input value={donnees.pays} onChange={(e) => maj({ pays: e.target.value })} /></Champ>
                <Champ label="Province / région"><input value={donnees.province} onChange={(e) => maj({ province: e.target.value })} /></Champ>
                <Champ label="Commune"><input value={donnees.commune} onChange={(e) => maj({ commune: e.target.value })} /></Champ>
              </div>
              <div className="ligne-champs c3">
                <Champ label="Téléphone"><input value={donnees.telephone} onChange={(e) => maj({ telephone: e.target.value })} /></Champ>
                <Champ label="Courriel"><input type="email" value={donnees.email} onChange={(e) => maj({ email: e.target.value })} /></Champ>
                <Champ label="Boite postale"><input value={donnees.bp} onChange={(e) => maj({ bp: e.target.value })} /></Champ>
              </div>
              <div className="ligne-champs">
                <Champ label="Nom du directeur"><input value={donnees.nom_directeur} onChange={(e) => maj({ nom_directeur: e.target.value })} /></Champ>
                <Champ label="Autorité de tutelle" aide="Ministère, direction provinciale…">
                  <input value={donnees.autorite_tutelle} onChange={(e) => maj({ autorite_tutelle: e.target.value })} />
                </Champ>
              </div>
            </>
          )}

          {etape === 1 && (
            <>
              <Message type="info">                Ces éléments donnent à l’application et à tous vos documents imprimés l’identité de votre école.              </Message>
              <div className="ligne-champs">
                <Champ label="Logo" aide="PNG ou JPG, de préférence carre">
                  <div className="entre">
                    {donnees.logo ? (
                      <img
                        src={donnees.logo}
                        alt=""
                        style={{ width: 78, height: 78, objectFit: 'contain', border: '1px solid var(--bordure)', borderRadius: 8, background: '#fff' }}
                      />
                    ) : (
                      <div style={{ width: 78, height: 78, display: 'grid', placeItems: 'center', border: '1px dashed var(--bordure-forte)', borderRadius: 8, color: 'var(--texte-faible)' }}>
                        <Image size={26} />
                      </div>
                    )}
                    <div className="pile">
                      <button className="bouton" onClick={choisirLogo}>Choisir une image</button>
                      {donnees.logo && (
                        <button className="bouton discret petit" onClick={() => maj({ logo: '' })}>Retirer</button>
                      )}
                    </div>
                  </div>
                </Champ>
                <div>
                  <div className="ligne-champs">
                    <Champ label="Couleur principale">
                      <input type="color" value={donnees.couleur_primaire} onChange={(e) => maj({ couleur_primaire: e.target.value })} />
                    </Champ>
                    <Champ label="Couleur secondaire">
                      <input type="color" value={donnees.couleur_secondaire} onChange={(e) => maj({ couleur_secondaire: e.target.value })} />
                    </Champ>
                  </div>
                  <div
                    style={{
                      borderRadius: 8, padding: 12, color: '#fff',
                      background: `linear-gradient(135deg, ${donnees.couleur_primaire}, ${donnees.couleur_secondaire})`
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{donnees.sigle || donnees.nom || 'Votre école'}</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>Aperçu des couleurs</div>
                  </div>
                </div>
              </div>
              <div className="ligne-champs c3">
                <Champ label="Monnaie" aide="Utilisée pour la scolarité et la paie">
                  <Selection
                    valeur={donnees.devise_code}
                    surChangement={(v) => maj({ devise_code: v ?? 'BIF' })}
                    options={DEVISES.map((d) => ({ valeur: d.code, libelle: `${d.libelle} (${d.symbole})` }))}
                  />
                </Champ>
                <Champ label="Barème des notes">
                  <Selection
                    valeur={donnees.bareme_notation}
                    surChangement={(v) => maj({ bareme_notation: Number(v ?? 20) })}
                    options={[
                      { valeur: 20, libelle: 'Sur 20' },
                      { valeur: 10, libelle: 'Sur 10' },
                      { valeur: 100, libelle: 'Sur 100' }
                    ]}
                  />
                </Champ>
                <Champ label="Moyenne de réussite" aide="Exprimée sur 20">
                  <input
                    type="number" step="0.5" min="0" max="20"
                    value={donnees.seuil_reussite}
                    onChange={(e) => maj({ seuil_reussite: Number(e.target.value) })}
                  />
                </Champ>
              </div>
            </>
          )}

          {etape === 2 && (
            <>
              <Champ label="Cycles enseignes dans votre établissement" obligatoire>
                <div className="grille c3" style={{ gap: 8 }}>
                  {CYCLES.map((c) => {
                    const choisi = donnees.cycles.includes(c.code)
                    return (
                      <div
                        key={c.code}
                        className={`choix-carte${choisi ? ' choisi' : ''}`}
                        onClick={() =>
                          maj({
                            cycles: choisi
                              ? donnees.cycles.filter((x) => x !== c.code)
                              : [...donnees.cycles, c.code]
                          })
                        }
                      >
                        <div className="entre">
                          <input type="checkbox" checked={choisi} readOnly />
                          <span className="titre">{c.libelle}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Champ>

              <Champ label="Modèle de structure des niveaux" aide="Les niveaux restent entièrement modifiables ensuite">
                <div className="pile">
                  {modeles.map((m) => (
                    <div
                      key={m.code}
                      className={`choix-carte${donnees.modele_structure === m.code ? ' choisi' : ''}`}
                      onClick={() => maj({ modele_structure: m.code })}
                    >
                      <div className="titre">{m.libelle}</div>
                      <div className="description">{m.description}</div>
                    </div>
                  ))}
                </div>
              </Champ>
            </>
          )}

          {etape === 3 && (
            <>
              <div className="ligne-champs c3">
                <Champ label="Année scolaire" obligatoire>
                  <input value={donnees.annee_libelle} onChange={(e) => maj({ annee_libelle: e.target.value })} />
                </Champ>
                <Champ label="Date de rentrée" obligatoire>
                  <input type="date" value={donnees.annee_debut} onChange={(e) => maj({ annee_debut: e.target.value })} />
                </Champ>
                <Champ label="Date de clôture" obligatoire>
                  <input type="date" value={donnees.annee_fin} onChange={(e) => maj({ annee_fin: e.target.value })} />
                </Champ>
              </div>
              <Champ label="Decoupage de l’année">
                <div className="grille c2" style={{ gap: 8 }}>
                  {[
                    { code: 'TRIMESTRE', titre: '3 trimestres', description: 'Decoupage le plus courant en Afrique francophone.' },
                    { code: 'SEMESTRE', titre: '2 semestres', description: 'Utilise dans certains systèmes et dans le technique.' }
                  ].map((o) => (
                    <div
                      key={o.code}
                      className={`choix-carte${donnees.decoupage === o.code ? ' choisi' : ''}`}
                      onClick={() => maj({ decoupage: o.code as 'TRIMESTRE' | 'SEMESTRE' })}
                    >
                      <div className="titre">{o.titre}</div>
                      <div className="description">{o.description}</div>
                    </div>
                  ))}
                </div>
              </Champ>
              <Message type="info">                Les périodes seront créées automatiquement et vous pourrez ajuster leurs dates dans les paramètres.              </Message>
            </>
          )}

          {etape === 4 && (
            <>
              <Message type="alerte">                Ce compte aura tous les droits. Notez soigneusement le mot de passe : il n’existe aucun moyen
                de le recuperer a distance, l’application fonctionnant sans internet.              </Message>
              <Champ label="Nom complet du responsable" obligatoire>
                <input value={donnees.admin_nom} onChange={(e) => maj({ admin_nom: e.target.value })} />
              </Champ>
              <div className="ligne-champs c3">
                <Champ label="Identifiant de connexion" obligatoire>
                  <input
                    value={donnees.admin_login}
                    onChange={(e) => maj({ admin_login: e.target.value })}
                    placeholder="directeur"
                  />
                </Champ>
                <Champ label="Mot de passe" obligatoire aide="6 caractères minimum">
                  <input type="password" value={donnees.admin_mdp} onChange={(e) => maj({ admin_mdp: e.target.value })} />
                </Champ>
                <Champ label="Confirmation" obligatoire>
                  <input type="password" value={donnees.admin_mdp2} onChange={(e) => maj({ admin_mdp2: e.target.value })} />
                </Champ>
              </div>
            </>
          )}
        </div>

        <div className="pied">
          <button className="bouton" onClick={() => setEtape((e) => Math.max(0, e - 1))} disabled={etape === 0}>
            <ChevronLeft size={16} /> Precedent
          </button>
          {etape < ETAPES.length - 1 ? (
            <button className="bouton principal" onClick={suivant}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button className="bouton principal" onClick={terminer} disabled={enCours}>
              {enCours ? <Loader2 size={16} className="rotation" /> : <Check size={16} />}
              Terminer la configuration
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
