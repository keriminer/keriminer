import { useEffect, useState } from 'react'
import {
  BookOpen, Copy, GraduationCap, Layers, Pencil, Plus, Printer, Trash2, Users
} from 'lucide-react'
import type { Classe, ClasseMatiere, Enseignant, Filiere, Matiere, Niveau } from '@shared/types'
import { useAction, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide, Message, Modale,
  Onglets, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { CYCLES, JOURS_SEMAINE } from '@shared/constants'

export default function Classes() {
  const [onglet, setOnglet] = useState('classes')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Classes et matières</h1>
          <div className="sous-texte">Structure pédagogique de l’année scolaire en cours</div>
        </div>
      </div>

      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'classes', libelle: 'Classes' },
          { cle: 'niveaux', libelle: 'Niveaux et filières' },
          { cle: 'matieres', libelle: 'Matières' },
          { cle: 'horaires', libelle: 'Emplois du temps' }
        ]}
      />

      {onglet === 'classes' && <OngletClasses />}
      {onglet === 'niveaux' && <OngletNiveaux />}
      {onglet === 'matieres' && <OngletMatieres />}
      {onglet === 'horaires' && <OngletHoraires />}
    </>
  )
}

/* --------------------------------- Classes ------------------------------- */

function OngletClasses() {
  const { peut } = useSession()
  const document = useDocument()
  const { executer } = useAction()
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const niveaux = useDonnees<Niveau[]>('niveau.liste', [], [])
  const filieres = useDonnees<Filiere[]>('filiere.liste', [], [])
  const enseignants = useDonnees<Enseignant[]>('enseignant.liste', [{}], [])

  const [edition, setEdition] = useState<Classe | null | 'nouvelle'>(null)
  const [attributions, setAttributions] = useState<Classe | null>(null)
  const [suppression, setSuppression] = useState<Classe | null>(null)

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">
          {classes.donnees.length} classe(s) ·{' '}
          {classes.donnees.reduce((s, c) => s + (c.effectif ?? 0), 0)} élève(s) inscrits
        </div>
        {peut('classe.ecriture') && (
          <button className="bouton principal" onClick={() => setEdition('nouvelle')}>
            <Plus size={16} /> Nouvelle classe
          </button>
        )}
      </div>

      <Carte sansMarge>
        {classes.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={classes.donnees}
            cleLigne={(c) => c.id}
            vide={
              <EtatVide
                icone={<BookOpen size={42} />}
                titre="Aucune classe"
                description="Créez vos classes pour pouvoir y inscrire des élèves et saisir des notes."
                action={
                  peut('classe.ecriture') ? (
                    <button className="bouton principal" onClick={() => setEdition('nouvelle')}>
                      <Plus size={16} /> Créer une classe
                    </button>
                  ) : undefined
                }
              />
            }
            colonnes={[
              { cle: 'libelle', titre: 'Classe', rendu: (c) => (
                <div>
                  <div className="gras">{c.libelle}</div>
                  <div className="petit discret">
                    {c.niveau_libelle}
                    {c.filiere_libelle ? ` · ${c.filiere_libelle}` : ''}
                    {c.salle ? ` · salle ${c.salle}` : ''}
                  </div>
                </div>
              ) },
              { cle: 'cycle', titre: 'Cycle', rendu: (c) => (
                <Etiquette>{CYCLES.find((y) => y.code === c.cycle)?.libelle ?? c.cycle}</Etiquette>
              ) },
              { cle: 'titulaire_nom', titre: 'Titulaire', rendu: (c) =>
                c.titulaire_nom ?? <span className="discret">Non désigné</span> },
              { cle: 'effectif', titre: 'Effectif', alignement: 'centre', rendu: (c) => (
                <Etiquette variante={(c.effectif ?? 0) > c.capacite ? 'danger' : 'succes'}>
                  {c.effectif ?? 0} / {c.capacite}
                </Etiquette>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (c) => (
                <div className="entre fin">
                  <button className="bouton petit" onClick={() => setAttributions(c)}>
                    <Layers size={14} /> Matières
                  </button>
                  <button className="bouton discret petit" title="Liste de classe"
                    onClick={() => document.apercu('impression.liste_classe', `liste-${c.libelle}`, c.id, 0)}>
                    <Printer size={15} />
                  </button>
                  {peut('classe.ecriture') && (
                    <>
                      <button className="bouton discret petit" onClick={() => setEdition(c)}>
                        <Pencil size={15} />
                      </button>
                      <button className="bouton discret petit" onClick={() => setSuppression(c)}>
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
        <FormulaireClasse
          classe={edition === 'nouvelle' ? null : edition}
          niveaux={niveaux.donnees}
          filieres={filieres.donnees}
          enseignants={enseignants.donnees}
          surFermeture={() => setEdition(null)}
          surEnregistrement={() => { setEdition(null); classes.recharger() }}
        />
      )}

      {attributions && (
        <GestionAttributions
          classe={attributions}
          surFermeture={() => setAttributions(null)}
        />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer cette classe ?"
        message={<>La classe <b>{suppression?.libelle}</b> sera supprimée, ainsi que ses attributions de matières.</>}
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('classe.supprimer', suppression!.id), {
            succes: 'Classe supprimée.',
            surSucces: () => { setSuppression(null); classes.recharger() }
          })
        }
      />
    </>
  )
}

function FormulaireClasse({
  classe, niveaux, filieres, enseignants, surFermeture, surEnregistrement
}: {
  classe: Classe | null
  niveaux: Niveau[]
  filieres: Filiere[]
  enseignants: Enseignant[]
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState<{
    libelle: string
    niveau_id: number | null
    filiere_id: number | null
    capacite: number
    salle: string
    titulaire_id: number | null
  }>({
    libelle: classe?.libelle ?? '',
    niveau_id: classe?.niveau_id ?? niveaux[0]?.id ?? null,
    filiere_id: classe?.filiere_id ?? null,
    capacite: classe?.capacite ?? 50,
    salle: classe?.salle ?? '',
    titulaire_id: classe?.titulaire_id ?? null
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  const enregistrer = () =>
    executer(
      async () => {
        if (!d.libelle.trim()) throw new Error('Le nom de la classe est obligatoire.')
        if (!d.niveau_id) throw new Error('Choisissez un niveau.')
        const charge = { ...d, salle: d.salle || null, capacite: Number(d.capacite) }
        if (classe) await appeler('classe.modifier', classe.id, charge)
        else await appeler('classe.creer', charge)
      },
      { succes: 'Classe enregistrée.', surSucces: surEnregistrement }
    )

  return (
    <Modale
      ouverte
      titre={classe ? `Modifier — ${classe.libelle}` : 'Nouvelle classe'}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={enregistrer} disabled={enCours}>Enregistrer</button>
        </>
      }
    >
      <Champ label="Nom de la classe" obligatoire aide="Ex. : 5ème année A, 2nde Sciences, 1ere Électricité">
        <input autoFocus value={d.libelle} onChange={(e) => maj({ libelle: e.target.value })} />
      </Champ>
      <div className="ligne-champs">
        <Champ label="Niveau" obligatoire>
          <Selection
            valeur={d.niveau_id}
            surChangement={(v) => maj({ niveau_id: v })}
            vide="Choisir…"
            options={niveaux.map((n) => ({ valeur: n.id, libelle: `${n.libelle} (${n.cycle})` }))}
          />
        </Champ>
        <Champ label="Filière / option" aide="Pour le lycée et le technique">
          <Selection
            valeur={d.filiere_id}
            surChangement={(v) => maj({ filiere_id: v })}
            vide="Aucune"
            options={filieres.map((f) => ({ valeur: f.id, libelle: f.libelle }))}
          />
        </Champ>
      </div>
      <div className="ligne-champs c3">
        <Champ label="Capacité" aide="Alerte si dépassée">
          <input type="number" min={1} value={d.capacite} onChange={(e) => maj({ capacite: Number(e.target.value) })} />
        </Champ>
        <Champ label="Salle">
          <input value={d.salle} onChange={(e) => maj({ salle: e.target.value })} />
        </Champ>
        <Champ label="Titulaire">
          <Selection
            valeur={d.titulaire_id}
            surChangement={(v) => maj({ titulaire_id: v })}
            vide="Non désigné"
            options={enseignants.map((e) => ({ valeur: e.id, libelle: `${e.nom} ${e.prenom}` }))}
          />
        </Champ>
      </div>
    </Modale>
  )
}

/* --------------------------- Attribution matieres ------------------------ */

function GestionAttributions({ classe, surFermeture }: { classe: Classe; surFermeture: () => void }) {
  const { executer } = useAction()
  const attributions = useDonnees<ClasseMatiere[]>('classe.attributions', [classe.id], [])
  const matieres = useDonnees<Matiere[]>('matiere.liste', [], [])
  const enseignants = useDonnees<Enseignant[]>('enseignant.liste', [{}], [])
  const [ajout, setAjout] = useState({ matiere_id: null as number | null, enseignant_id: null as number | null, coefficient: 1, volume_horaire: 0 })

  const attribuees = new Set(attributions.donnees.map((a) => a.matiere_id))
  const totalCoefficients = attributions.donnees.reduce((s, a) => s + a.coefficient, 0)
  const totalHeures = attributions.donnees.reduce((s, a) => s + a.volume_horaire, 0)

  const ajouter = () =>
    executer(
      async () => {
        if (!ajout.matiere_id) throw new Error('Choisissez une matière.')
        await appeler('classe.creer_attribution', { classe_id: classe.id, ...ajout })
      },
      {
        succes: 'Matière attribuée.',
        surSucces: () => {
          setAjout({ matiere_id: null, enseignant_id: null, coefficient: 1, volume_horaire: 0 })
          attributions.recharger()
        }
      }
    )

  const dupliquer = () =>
    executer(
      async () => {
        const nombre = await appeler<number>('classe.appliquer_grille', classe.id, classe.niveau_id)
        if (nombre === 0) throw new Error('Aucune autre classe de ce niveau a mettre à jour.')
      },
      { succes: 'Grille appliquée aux autres classes du niveau.' }
    )

  return (
    <Modale
      ouverte
      taille="large"
      titre={`Matières — ${classe.libelle}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={dupliquer} title="Copier cette grille vers les autres classes du même niveau">
            <Copy size={16} /> Appliquer a tout le niveau
          </button>
          <button className="bouton principal" onClick={surFermeture}>Fermer</button>
        </>
      }
    >
      <Message type="info">        Le coefficient détermine le poids de la matière dans la moyenne générale. Le volume horaire sert au
        calcul de la charge des enseignants et à la paie des vacataires.      </Message>

      <div className="barre-filtres">
        <Champ label="Matière">
          <Selection
            valeur={ajout.matiere_id}
            surChangement={(v) => setAjout({ ...ajout, matiere_id: v })}
            vide="Choisir…"
            options={matieres.donnees
              .filter((m) => !attribuees.has(m.id))
              .map((m) => ({ valeur: m.id, libelle: m.libelle }))}
          />
        </Champ>
        <Champ label="Enseignant">
          <Selection
            valeur={ajout.enseignant_id}
            surChangement={(v) => setAjout({ ...ajout, enseignant_id: v })}
            vide="A désigner"
            options={enseignants.donnees.map((e) => ({ valeur: e.id, libelle: `${e.nom} ${e.prenom}` }))}
          />
        </Champ>
        <Champ label="Coef.">
          <input
            type="number" min={0.5} step={0.5} style={{ width: 80 }}
            value={ajout.coefficient}
            onChange={(e) => setAjout({ ...ajout, coefficient: Number(e.target.value) })}
          />
        </Champ>
        <Champ label="H/sem.">
          <input
            type="number" min={0} style={{ width: 80 }}
            value={ajout.volume_horaire}
            onChange={(e) => setAjout({ ...ajout, volume_horaire: Number(e.target.value) })}
          />
        </Champ>
        <button className="bouton principal" onClick={ajouter}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <Tableau
        compacte
        lignes={attributions.donnees}
        cleLigne={(a) => a.id}
        vide={<EtatVide titre="Aucune matière attribuée" description="Ajoutez les matières enseignées dans cette classe." />}
        colonnes={[
          { cle: 'matiere_libelle', titre: 'Matière' },
          { cle: 'enseignant_nom', titre: 'Enseignant', rendu: (a) => (
            <Selection
              valeur={a.enseignant_id}
              surChangement={(v) =>
                executer(() => appeler('classe.modifier_attribution', a.id, { enseignant_id: v }), {
                  surSucces: attributions.recharger
                })
              }
              vide="A désigner"
              options={enseignants.donnees.map((e) => ({ valeur: e.id, libelle: `${e.nom} ${e.prenom}` }))}
            />
          ) },
          { cle: 'coefficient', titre: 'Coef.', alignement: 'centre', largeur: '90px', rendu: (a) => (
            <input
              type="number" min={0.5} step={0.5} defaultValue={a.coefficient} style={{ width: 70 }}
              onBlur={(e) =>
                Number(e.target.value) !== a.coefficient &&
                executer(() => appeler('classe.modifier_attribution', a.id, { coefficient: Number(e.target.value) }), {
                  surSucces: attributions.recharger
                })
              }
            />
          ) },
          { cle: 'volume_horaire', titre: 'H/sem.', alignement: 'centre', largeur: '90px', rendu: (a) => (
            <input
              type="number" min={0} defaultValue={a.volume_horaire} style={{ width: 70 }}
              onBlur={(e) =>
                Number(e.target.value) !== a.volume_horaire &&
                executer(() => appeler('classe.modifier_attribution', a.id, { volume_horaire: Number(e.target.value) }), {
                  surSucces: attributions.recharger
                })
              }
            />
          ) },
          { cle: 'actions', titre: '', alignement: 'droite', rendu: (a) => (
            <button
              className="bouton discret petit"
              onClick={() =>
                executer(() => appeler('classe.supprimer_attribution', a.id), {
                  succes: 'Matière retirée.',
                  surSucces: attributions.recharger
                })
              }
            >
              <Trash2 size={15} color="var(--danger)" />
            </button>
          ) }
        ]}
      />

      {attributions.donnees.length > 0 && (
        <div className="entre espace mt-12 doux petit">
          <span>Total des coefficients : <b>{totalCoefficients}</b></span>
          <span>Volume horaire hebdomadaire : <b>{totalHeures} h</b></span>
        </div>
      )}
    </Modale>
  )
}

/* --------------------------- Niveaux et filieres ------------------------- */

function OngletNiveaux() {
  const { executer } = useAction()
  const niveaux = useDonnees<Niveau[]>('niveau.liste', [], [])
  const filieres = useDonnees<Filiere[]>('filiere.liste', [], [])
  const [nouveauNiveau, setNouveauNiveau] = useState({ cycle: 'PRIMAIRE', libelle: '', code: '', ordre: 0 })
  const [nouvelleFiliere, setNouvelleFiliere] = useState({ libelle: '', code: '', cycle: null as string | null })

  return (
    <div className="grille c2">
      <Carte titre="Niveaux" sousTitre="Les degrés d’enseignement de votre établissement">
        <div className="barre-filtres" style={{ marginBottom: 12 }}>
          <Champ label="Cycle">
            <Selection
              valeur={nouveauNiveau.cycle}
              surChangement={(v) => setNouveauNiveau({ ...nouveauNiveau, cycle: v ?? 'PRIMAIRE' })}
              options={CYCLES.map((c) => ({ valeur: c.code, libelle: c.libelle }))}
            />
          </Champ>
          <Champ label="Libelle">
            <input value={nouveauNiveau.libelle} onChange={(e) => setNouveauNiveau({ ...nouveauNiveau, libelle: e.target.value })} />
          </Champ>
          <Champ label="Code">
            <input style={{ width: 80 }} value={nouveauNiveau.code} onChange={(e) => setNouveauNiveau({ ...nouveauNiveau, code: e.target.value.toUpperCase() })} />
          </Champ>
          <Champ label="Ordre">
            <input type="number" style={{ width: 70 }} value={nouveauNiveau.ordre} onChange={(e) => setNouveauNiveau({ ...nouveauNiveau, ordre: Number(e.target.value) })} />
          </Champ>
          <button
            className="bouton principal"
            onClick={() =>
              executer(
                async () => {
                  if (!nouveauNiveau.libelle || !nouveauNiveau.code) throw new Error('Libelle et code obligatoires.')
                  await appeler('niveau.creer', nouveauNiveau)
                },
                {
                  succes: 'Niveau ajouté.',
                  surSucces: () => { setNouveauNiveau({ ...nouveauNiveau, libelle: '', code: '' }); niveaux.recharger() }
                }
              )
            }
          >
            <Plus size={16} />
          </button>
        </div>
        <Tableau
          compacte
          lignes={niveaux.donnees}
          cleLigne={(n) => n.id}
          colonnes={[
            { cle: 'ordre', titre: '#', largeur: '50px', alignement: 'centre' },
            { cle: 'libelle', titre: 'Niveau' },
            { cle: 'cycle', titre: 'Cycle', rendu: (n) => <Etiquette>{n.cycle}</Etiquette> },
            { cle: 'code', titre: 'Code', rendu: (n) => <span className="mono petit">{n.code}</span> },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (n) => (
              <button
                className="bouton discret petit"
                onClick={() =>
                  executer(() => appeler('niveau.supprimer', n.id), { succes: 'Niveau supprimé.', surSucces: niveaux.recharger })
                }
              >
                <Trash2 size={15} color="var(--danger)" />
              </button>
            ) }
          ]}
        />
      </Carte>

      <Carte titre="Filières et options" sousTitre="Sections du lycée, du technique et du professionnel">
        <div className="barre-filtres" style={{ marginBottom: 12 }}>
          <Champ label="Libelle">
            <input value={nouvelleFiliere.libelle} onChange={(e) => setNouvelleFiliere({ ...nouvelleFiliere, libelle: e.target.value })} />
          </Champ>
          <Champ label="Code">
            <input style={{ width: 90 }} value={nouvelleFiliere.code} onChange={(e) => setNouvelleFiliere({ ...nouvelleFiliere, code: e.target.value.toUpperCase() })} />
          </Champ>
          <Champ label="Cycle">
            <Selection
              valeur={nouvelleFiliere.cycle}
              surChangement={(v) => setNouvelleFiliere({ ...nouvelleFiliere, cycle: v })}
              vide="Tous"
              options={CYCLES.map((c) => ({ valeur: c.code, libelle: c.libelle }))}
            />
          </Champ>
          <button
            className="bouton principal"
            onClick={() =>
              executer(
                async () => {
                  if (!nouvelleFiliere.libelle || !nouvelleFiliere.code) throw new Error('Libelle et code obligatoires.')
                  await appeler('filiere.creer', nouvelleFiliere)
                },
                {
                  succes: 'Filière ajoutée.',
                  surSucces: () => { setNouvelleFiliere({ libelle: '', code: '', cycle: null }); filieres.recharger() }
                }
              )
            }
          >
            <Plus size={16} />
          </button>
        </div>
        <Tableau
          compacte
          lignes={filieres.donnees}
          cleLigne={(f) => f.id}
          vide={<EtatVide titre="Aucune filière" description="Les filières sont facultatives pour le primaire." />}
          colonnes={[
            { cle: 'libelle', titre: 'Filière' },
            { cle: 'code', titre: 'Code', rendu: (f) => <span className="mono petit">{f.code}</span> },
            { cle: 'cycle', titre: 'Cycle', rendu: (f) => (f.cycle ? <Etiquette>{f.cycle}</Etiquette> : '—') },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (f) => (
              <button
                className="bouton discret petit"
                onClick={() =>
                  executer(() => appeler('filiere.supprimer', f.id), { succes: 'Filière supprimée.', surSucces: filieres.recharger })
                }
              >
                <Trash2 size={15} color="var(--danger)" />
              </button>
            ) }
          ]}
        />
      </Carte>
    </div>
  )
}

/* -------------------------------- Matieres -------------------------------- */

function OngletMatieres() {
  const { executer } = useAction()
  const matieres = useDonnees<Matiere[]>('matiere.liste', [], [])
  const [nouvelle, setNouvelle] = useState({ code: '', libelle: '', cycle: null as string | null, categorie: '' })

  return (
    <Carte titre="Matières enseignées" sousTitre="Catalogue commun à toutes les classes">
      <div className="barre-filtres">
        <Champ label="Libelle">
          <input value={nouvelle.libelle} onChange={(e) => setNouvelle({ ...nouvelle, libelle: e.target.value })} />
        </Champ>
        <Champ label="Code">
          <input style={{ width: 100 }} value={nouvelle.code} onChange={(e) => setNouvelle({ ...nouvelle, code: e.target.value.toUpperCase() })} />
        </Champ>
        <Champ label="Catégorie">
          <input value={nouvelle.categorie} onChange={(e) => setNouvelle({ ...nouvelle, categorie: e.target.value })} placeholder="Sciences, Langues…" />
        </Champ>
        <Champ label="Cycle">
          <Selection
            valeur={nouvelle.cycle}
            surChangement={(v) => setNouvelle({ ...nouvelle, cycle: v })}
            vide="Tous"
            options={CYCLES.map((c) => ({ valeur: c.code, libelle: c.libelle }))}
          />
        </Champ>
        <button
          className="bouton principal"
          onClick={() =>
            executer(
              async () => {
                if (!nouvelle.libelle || !nouvelle.code) throw new Error('Libelle et code obligatoires.')
                await appeler('matiere.creer', nouvelle)
              },
              {
                succes: 'Matière ajoutée.',
                surSucces: () => { setNouvelle({ code: '', libelle: '', cycle: null, categorie: '' }); matieres.recharger() }
              }
            )
          }
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <Tableau
        lignes={matieres.donnees}
        cleLigne={(m) => m.id}
        colonnes={[
          { cle: 'libelle', titre: 'Matière' },
          { cle: 'code', titre: 'Code', rendu: (m) => <span className="mono petit">{m.code}</span> },
          { cle: 'categorie', titre: 'Catégorie' },
          { cle: 'cycle', titre: 'Cycle', rendu: (m) => (m.cycle ? <Etiquette>{m.cycle}</Etiquette> : <span className="discret">Tous</span>) },
          { cle: 'actions', titre: '', alignement: 'droite', rendu: (m) => (
            <button
              className="bouton discret petit"
              onClick={() =>
                executer(() => appeler('matiere.supprimer', m.id), { succes: 'Matière supprimée.', surSucces: matieres.recharger })
              }
            >
              <Trash2 size={15} color="var(--danger)" />
            </button>
          ) }
        ]}
      />
    </Carte>
  )
}

/* ----------------------------- Emploi du temps --------------------------- */

const HEURES = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

function OngletHoraires() {
  const { executer } = useAction()
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const attributions = useDonnees<ClasseMatiere[]>(classeId ? 'classe.attributions' : null, [classeId], [])
  const seances = useDonnees<any[]>(classeId ? 'edt.classe' : null, [classeId], [])

  useEffect(() => {
    if (!classeId && classes.donnees.length) setClasseId(classes.donnees[0].id)
  }, [classes.donnees, classeId])

  const [nouvelle, setNouvelle] = useState({
    jour: 1, heure_debut: '08:00', heure_fin: '09:00',
    matiere_id: null as number | null, salle: ''
  })

  const ajouter = () =>
    executer(
      async () => {
        if (!classeId) throw new Error('Choisissez une classe.')
        if (!nouvelle.matiere_id) throw new Error('Choisissez une matière.')
        if (nouvelle.heure_fin <= nouvelle.heure_debut) throw new Error("L’heure de fin doit suivre l’heure de debut.")
        const attribution = attributions.donnees.find((a) => a.matiere_id === nouvelle.matiere_id)
        await appeler('edt.creer', {
          classe_id: classeId,
          jour: nouvelle.jour,
          heure_debut: nouvelle.heure_debut,
          heure_fin: nouvelle.heure_fin,
          matiere_id: nouvelle.matiere_id,
          enseignant_id: attribution?.enseignant_id ?? null,
          salle: nouvelle.salle || null
        })
      },
      { succes: 'Séance ajoutée.', surSucces: seances.recharger }
    )

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
        <Champ label="Jour">
          <Selection
            valeur={nouvelle.jour}
            surChangement={(v) => setNouvelle({ ...nouvelle, jour: Number(v ?? 1) })}
            options={JOURS_SEMAINE.map((j) => ({ valeur: j.code, libelle: j.libelle }))}
          />
        </Champ>
        <Champ label="De">
          <input type="time" value={nouvelle.heure_debut} onChange={(e) => setNouvelle({ ...nouvelle, heure_debut: e.target.value })} />
        </Champ>
        <Champ label="A">
          <input type="time" value={nouvelle.heure_fin} onChange={(e) => setNouvelle({ ...nouvelle, heure_fin: e.target.value })} />
        </Champ>
        <Champ label="Matière">
          <Selection
            valeur={nouvelle.matiere_id}
            surChangement={(v) => setNouvelle({ ...nouvelle, matiere_id: v })}
            vide="Choisir…"
            options={attributions.donnees.map((a) => ({ valeur: a.matiere_id, libelle: a.matiere_libelle ?? '' }))}
          />
        </Champ>
        <Champ label="Salle">
          <input style={{ width: 90 }} value={nouvelle.salle} onChange={(e) => setNouvelle({ ...nouvelle, salle: e.target.value })} />
        </Champ>
        <button className="bouton principal" onClick={ajouter}>
          <Plus size={16} /> Placer
        </button>
      </div>

      {!classeId ? (
        <Carte><EtatVide icone={<GraduationCap size={42} />} titre="Choisissez une classe" /></Carte>
      ) : (
        <Carte sansMarge>
          <div className="tableau-conteneur">
            <table className="tableau compacte">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Heure</th>
                  {JOURS_SEMAINE.map((j) => <th key={j.code}>{j.libelle}</th>)}
                </tr>
              </thead>
              <tbody>
                {HEURES.map((heure) => (
                  <tr key={heure}>
                    <td className="mono petit">{heure}</td>
                    {JOURS_SEMAINE.map((j) => {
                      const seance = seances.donnees.find(
                        (s) => s.jour === j.code && s.heure_debut <= heure && s.heure_fin > heure
                      )
                      if (!seance) return <td key={j.code} />
                      const premiere = seance.heure_debut === heure
                      return (
                        <td
                          key={j.code}
                          style={{
                            background: 'var(--primaire-clair)',
                            borderLeft: '3px solid var(--primaire)',
                            verticalAlign: 'top'
                          }}
                        >
                          {premiere && (
                            <div className="entre" style={{ alignItems: 'flex-start' }}>
                              <div style={{ minWidth: 0 }}>
                                <div className="gras petit">{seance.matiere_libelle}</div>
                                <div className="petit discret tronque">
                                  {seance.enseignant_nom ?? '—'}{seance.salle ? ` · ${seance.salle}` : ''}
                                </div>
                                <div className="petit discret">{seance.heure_debut}–{seance.heure_fin}</div>
                              </div>
                              <button
                                className="bouton discret petit pousse"
                                onClick={() =>
                                  executer(() => appeler('edt.supprimer', seance.id), { surSucces: seances.recharger })
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
      <Message type="info">        L’application refuse automatiquement de placer un enseignant dans deux classes au même moment,
        ou deux classes dans la même salle.      </Message>
    </>
  )
}
