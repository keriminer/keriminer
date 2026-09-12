import { useEffect, useRef, useState } from 'react'
import { CheckCheck, Clock, QrCode, Save, ScanLine, ShieldCheck } from 'lucide-react'
import { useAction, useDonnees } from '../hooks'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Message, Modale,
  Onglets, Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { aujourdHui } from '@shared/format'

interface LignePointage {
  enseignant_id: number
  matricule: string
  nom_complet: string
  statut: string
  heure_arrivee: string | null
  heure_depart: string | null
  heures_faites: number
  motif: string | null
  observation: string | null
  remplacant_id: number | null
  valide: number
  a_cours_aujourdhui: number
}

const STATUTS = [
  { code: 'PRESENT', libelle: 'Présent', couleur: '#16a34a' },
  { code: 'RETARD', libelle: 'Retard', couleur: '#d97706' },
  { code: 'ABSENT', libelle: 'Absent', couleur: '#dc2626' },
  { code: 'CONGE', libelle: 'Congé', couleur: '#0284c7' },
  { code: 'MISSION', libelle: 'Mission', couleur: '#7c3aed' }
]

export default function Pointage() {
  const [onglet, setOnglet] = useState('jour')
  const [scanOuvert, setScanOuvert] = useState(false)

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Pointage des enseignants</h1>
          <div className="sous-texte">Présence quotidienne, heures effectuées et base de la paie</div>
        </div>
        <div className="actions">
          <button className="bouton principal" onClick={() => setScanOuvert(true)}>
            <ScanLine size={16} /> Poste de pointage
          </button>
        </div>
      </div>

      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'jour', libelle: 'Registre du jour' },
          { cle: 'mois', libelle: 'Synthèse mensuelle' }
        ]}
      />

      {onglet === 'jour' && <OngletJour />}
      {onglet === 'mois' && <OngletMois />}
      {scanOuvert && <PosteDePointage surFermeture={() => setScanOuvert(false)} />}
    </>
  )
}

/* ----------------------------- Registre du jour --------------------------- */

function OngletJour() {
  const { executer, enCours } = useAction()
  const [date, setDate] = useState(aujourdHui())
  const [lignes, setLignes] = useState<LignePointage[]>([])
  const [modifiee, setModifiee] = useState(false)

  const registre = useDonnees<LignePointage[]>('pointage.registre', [date], [])
  const parametres = useDonnees<Record<string, string>>('parametres.lire', [], {})

  useEffect(() => {
    setLignes(registre.donnees)
    setModifiee(false)
  }, [registre.donnees])

  const heureArrivee = parametres.donnees['pointage.heure_arrivee_prevue'] ?? '07:30'
  const heureDepart = parametres.donnees['pointage.heure_depart_prevue'] ?? '16:00'

  const maj = (id: number, champs: Partial<LignePointage>) => {
    setLignes((l) => l.map((x) => (x.enseignant_id === id ? { ...x, ...champs } : x)))
    setModifiee(true)
  }

  const toutPresent = () => {
    setLignes((l) =>
      l.map((x) => ({
        ...x,
        statut: 'PRESENT',
        heure_arrivee: x.heure_arrivee ?? heureArrivee,
        heure_depart: x.heure_depart ?? heureDepart
      }))
    )
    setModifiee(true)
  }

  const enregistrer = () =>
    executer(() => appeler('pointage.enregistrer', date, lignes.filter((l) => l.statut)), {
      succes: 'Pointage enregistré.',
      surSucces: () => { setModifiee(false); registre.recharger() }
    })

  const valider = () =>
    executer(() => appeler('pointage.valider', date), {
      succes: 'Pointage de la journée validé.',
      surSucces: registre.recharger
    })

  const compteurs = STATUTS.map((s) => ({ ...s, nombre: lignes.filter((l) => l.statut === s.code).length }))
  const nonPointes = lignes.filter((l) => !l.statut).length

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={aujourdHui()} />
        </Champ>
        <button className="bouton" onClick={toutPresent}>
          <CheckCheck size={16} /> Tous présents
        </button>
        <button className="bouton principal" onClick={enregistrer} disabled={enCours || !modifiee}>
          <Save size={16} /> Enregistrer{modifiee ? ' *' : ''}
        </button>
        <button className="bouton" onClick={valider} title="Verrouille le registre du jour">
          <ShieldCheck size={16} /> Valider la journée
        </button>
      </div>

      <div className="entre mb-12" style={{ gap: 16, flexWrap: 'wrap' }}>
        {compteurs.map((c) => (
          <span key={c.code} className="etiquette" style={{ borderLeft: `3px solid ${c.couleur}` }}>
            {c.libelle} : <b style={{ marginLeft: 4 }}>{c.nombre}</b>
          </span>
        ))}
        {nonPointes > 0 && <span className="etiquette alerte">Non pointes : <b>{nonPointes}</b></span>}
      </div>

      {registre.chargement ? (
        <Chargement />
      ) : (
        <Carte sansMarge>
          <Tableau
            lignes={lignes}
            cleLigne={(l) => l.enseignant_id}
            vide={<EtatVide icone={<Clock size={42} />} titre="Aucun enseignant actif" />}
            colonnes={[
              { cle: 'nom_complet', titre: 'Enseignant', rendu: (l) => (
                <div>
                  <div className="gras">{l.nom_complet}</div>
                  <div className="petit discret">
                    <span className="mono">{l.matricule}</span>
                    {l.a_cours_aujourdhui > 0
                      ? ` · ${l.a_cours_aujourdhui} cours prévu(s)`
                      : ' · aucun cours prévu ce jour'}
                  </div>
                </div>
              ) },
              { cle: 'statut', titre: 'Statut', largeur: '340px', rendu: (l) => (
                <div className="groupe-boutons">
                  {STATUTS.map((s) => (
                    <button
                      key={s.code}
                      className={l.statut === s.code ? 'actif' : ''}
                      style={l.statut === s.code ? { background: s.couleur, color: '#fff' } : undefined}
                      onClick={() =>
                        maj(l.enseignant_id, {
                          statut: s.code,
                          heure_arrivee: s.code === 'PRESENT' || s.code === 'RETARD' ? (l.heure_arrivee ?? heureArrivee) : null,
                          heure_depart: s.code === 'PRESENT' || s.code === 'RETARD' ? (l.heure_depart ?? heureDepart) : null
                        })
                      }
                    >
                      {s.libelle}
                    </button>
                  ))}
                </div>
              ) },
              { cle: 'heure_arrivee', titre: 'Arrivée', alignement: 'centre', largeur: '110px', rendu: (l) => (
                <input
                  type="time" style={{ width: 95 }}
                  value={l.heure_arrivee ?? ''}
                  disabled={!['PRESENT', 'RETARD'].includes(l.statut)}
                  onChange={(e) => maj(l.enseignant_id, { heure_arrivee: e.target.value })}
                />
              ) },
              { cle: 'heure_depart', titre: 'Départ', alignement: 'centre', largeur: '110px', rendu: (l) => (
                <input
                  type="time" style={{ width: 95 }}
                  value={l.heure_depart ?? ''}
                  disabled={!['PRESENT', 'RETARD'].includes(l.statut)}
                  onChange={(e) => maj(l.enseignant_id, { heure_depart: e.target.value })}
                />
              ) },
              { cle: 'motif', titre: 'Motif / observation', rendu: (l) => (
                <input
                  value={l.motif ?? ''}
                  placeholder={l.statut === 'ABSENT' ? 'Motif de l’absence' : ''}
                  disabled={!l.statut || l.statut === 'PRESENT'}
                  onChange={(e) => maj(l.enseignant_id, { motif: e.target.value })}
                />
              ) },
              { cle: 'valide', titre: '', alignement: 'centre', largeur: '60px', rendu: (l) =>
                l.valide ? <Etiquette variante="succes">Validé</Etiquette> : null }
            ]}
          />
        </Carte>
      )}

      <Message type="info">        Les heures saisies ici alimentent directement le calcul de la paie : les vacataires sont payés sur les
        heures effectivement pointées, et les absences des permanents donnent lieu à une retenue proportionnelle.      </Message>
    </>
  )
}

/* ---------------------------- Synthese mensuelle -------------------------- */

function OngletMois() {
  const maintenant = new Date()
  const [mois, setMois] = useState(maintenant.getMonth() + 1)
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const synthese = useDonnees<any[]>('pointage.synthese_mois', [mois, annee], [])

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Mois">
          <Selection
            valeur={mois}
            surChangement={(v) => setMois(Number(v ?? 1))}
            options={Array.from({ length: 12 }, (_, i) => ({
              valeur: i + 1,
              libelle: new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' })
            }))}
          />
        </Champ>
        <Champ label="Année">
          <input type="number" style={{ width: 110 }} value={annee} onChange={(e) => setAnnee(Number(e.target.value))} />
        </Champ>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={synthese.donnees}
          cleLigne={(l) => l.enseignant_id}
          vide={<EtatVide titre="Aucun pointage sur ce mois" />}
          colonnes={[
            { cle: 'nom_complet', titre: 'Enseignant', rendu: (l) => (
              <div>
                <div className="gras">{l.nom_complet}</div>
                <div className="petit discret mono">{l.matricule}</div>
              </div>
            ) },
            { cle: 'jours_presents', titre: 'Jours présents', alignement: 'centre' },
            { cle: 'jours_retard', titre: 'Retards', alignement: 'centre' },
            { cle: 'jours_absents', titre: 'Absences', alignement: 'centre', rendu: (l) =>
              l.jours_absents > 0 ? <b style={{ color: 'var(--danger)' }}>{l.jours_absents}</b> : '0' },
            { cle: 'jours_conge', titre: 'Congés / missions', alignement: 'centre' },
            { cle: 'heures_faites', titre: 'Heures faites', alignement: 'droite', rendu: (l) => (
              <b className="nombre">{Number(l.heures_faites).toFixed(1)} h</b>
            ) },
            { cle: 'taux_presence', titre: 'Assiduité', alignement: 'droite', largeur: '150px', rendu: (l) => (
              <div className="entre fin" style={{ gap: 8 }}>
                <span className="nombre petit">{l.taux_presence} %</span>
                <BarreProgression pourcentage={l.taux_presence} />
              </div>
            ) }
          ]}
        />
      </Carte>
    </>
  )
}

/* ----------------------------- Poste de pointage -------------------------- */

/**
 * Ecran a laisser ouvert a l’entrée de l’ecole. L’enseignant presente son badge
 * a une douchette USB (qui se comporte comme un clavier) ou saisit son code.
 * Un premier passage enregistre l’arrivée, un second le départ.
 */
function PosteDePointage({ surFermeture }: { surFermeture: () => void }) {
  const { notifier } = useNotifications()
  const [code, setCode] = useState('')
  const [dernier, setDernier] = useState<any>(null)
  const [historique, setHistorique] = useState<any[]>([])
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    champ.current?.focus()
  }, [dernier])

  const pointer = async (valeur: string) => {
    if (!valeur.trim()) return
    try {
      const resultat = await appeler<any>('pointage.par_code', valeur.trim())
      setDernier({ ...resultat, succes: true })
      setHistorique((h) => [{ ...resultat, heureAffichee: resultat.heure }, ...h].slice(0, 12))
    } catch (e) {
      setDernier({ succes: false, message: (e as Error).message })
      notifier('erreur', (e as Error).message)
    } finally {
      setCode('')
    }
  }

  return (
    <Modale
      ouverte
      taille="large"
      titre="Poste de pointage"
      surFermeture={surFermeture}
      pied={<button className="bouton principal" onClick={surFermeture}>Fermer le poste</button>}
    >
      <Message type="info">        Presentez le badge devant la douchette, ou saisissez le code a 8 caractères puis validez.
        Le premier passage de la journée enregistre l’arrivée, le second le départ.      </Message>

      <form
        onSubmit={(e) => { e.preventDefault(); pointer(code) }}
        className="entre"
        style={{ gap: 10, marginBottom: 16 }}
      >
        <QrCode size={34} color="var(--primaire)" />
        <input
          ref={champ}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE DU BADGE"
          className="mono"
          style={{ fontSize: 22, letterSpacing: '.18em', textAlign: 'center', flex: 1 }}
        />
        <button className="bouton principal large" type="submit">Pointer</button>
      </form>

      {dernier && (
        <div
          className={`message ${dernier.succes ? 'succes' : 'erreur'}`}
          style={{ fontSize: 16, padding: '14px 16px' }}
        >
          {dernier.succes ? (
            <div>
              <b>{dernier.enseignant}</b> — {dernier.action === 'ARRIVEE' ? 'arrivée' : 'départ'} enregistré(e) à{' '}
              <b>{dernier.heure}</b>
              {dernier.statut === 'RETARD' && ' (retard)'}
              {dernier.action === 'DEPART' && ` · ${dernier.heures_faites} h effectuées`}
            </div>
          ) : (
            <div>{dernier.message}</div>
          )}
        </div>
      )}

      {historique.length > 0 && (
        <>
          <h3 className="mt-16 mb-8">Derniers passages</h3>
          <Tableau
            compacte
            lignes={historique}
            cleLigne={(_, i) => i}
            colonnes={[
              { cle: 'enseignant', titre: 'Enseignant' },
              { cle: 'action', titre: 'Mouvement', rendu: (l) => (
                <Etiquette variante={l.action === 'ARRIVEE' ? 'succes' : 'info'}>
                  {l.action === 'ARRIVEE' ? 'Arrivée' : 'Départ'}
                </Etiquette>
              ) },
              { cle: 'heure', titre: 'Heure', alignement: 'centre', rendu: (l) => <b className="mono">{l.heure}</b> },
              { cle: 'statut', titre: 'Statut', rendu: (l) => (
                <Etiquette variante={l.statut === 'RETARD' ? 'alerte' : ''}>{l.statut}</Etiquette>
              ) }
            ]}
          />
        </>
      )}
    </Modale>
  )
}
