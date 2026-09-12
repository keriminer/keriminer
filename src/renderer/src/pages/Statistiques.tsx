import { useEffect, useState } from 'react'
import { Award, FileDown, Printer, TrendingUp } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import type { Niveau, Periode } from '@shared/types'
import { useDocument, useDonnees } from '../hooks'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Indicateur,
  Onglets, Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { ecrireCsv } from '../lib/csv'

export default function Statistiques() {
  const [onglet, setOnglet] = useState('tutelle')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Statistiques et rapports</h1>
          <div className="sous-texte">États destinés à la direction et à l’autorité de tutelle</div>
        </div>
      </div>
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'tutelle', libelle: 'État statistique' },
          { cle: 'palmares', libelle: 'Palmarès' },
          { cle: 'evolution', libelle: 'Évolution' }
        ]}
      />
      {onglet === 'tutelle' && <OngletTutelle />}
      {onglet === 'palmares' && <OngletPalmares />}
      {onglet === 'evolution' && <OngletEvolution />}
    </>
  )
}

function OngletTutelle() {
  const document = useDocument()
  const { notifier } = useNotifications()
  const rapport = useDonnees<any>('stats.rapport_tutelle', [], null)

  const exporter = async () => {
    if (!rapport.donnees) return
    const csv = ecrireCsv(
      [
        { cle: 'niveau', libelle: 'Niveau' },
        { cle: 'cycle', libelle: 'Cycle' },
        { cle: 'classes', libelle: 'Classes' },
        { cle: 'garcons', libelle: 'Garçons' },
        { cle: 'filles', libelle: 'Filles' },
        { cle: 'total', libelle: 'Total' },
        { cle: 'redoublants', libelle: 'Redoublants' },
        { cle: 'abandons', libelle: 'Abandons' }
      ],
      rapport.donnees.effectifs
    )
    const chemin = await appeler<string | null>('fichier.enregistrer_texte', csv, 'etat-statistique.csv', 'csv')
    if (chemin) notifier('succes', `Etat exporte : ${chemin}`)
  }

  if (rapport.chargement) return <Chargement />
  const r = rapport.donnees
  if (!r) return <EtatVide titre="Rapport indisponible" />

  const repartitionSexe = [
    { nom: 'Garçons', valeur: r.totaux.garcons },
    { nom: 'Filles', valeur: r.totaux.filles }
  ]

  return (
    <>
      <div className="entre espace mb-16">
        <div className="doux">Année scolaire {r.annee}</div>
        <div className="enveloppe">
          <button className="bouton" onClick={exporter}><FileDown size={16} /> Exporter en CSV</button>
          <button className="bouton principal" onClick={() => document.apercu('impression.rapport_tutelle', 'etat-statistique')}>
            <Printer size={16} /> Imprimer l’etat officiel
          </button>
        </div>
      </div>

      <div className="grille c4 mb-16">
        <Indicateur valeur={r.totaux.total} etiquette="Effectif total" detail={`${r.totaux.classes} classes`} />
        <Indicateur
          valeur={`${r.totaux.total > 0 ? ((r.totaux.filles / r.totaux.total) * 100).toFixed(1) : 0} %`}
          etiquette="Part des filles"
          detail={`${r.totaux.filles} filles sur ${r.totaux.total}`}
        />
        <Indicateur
          valeur={r.encadrement.enseignants}
          etiquette="Enseignants"
          detail={`${r.encadrement.hommes} H / ${r.encadrement.femmes} F`}
        />
        <Indicateur
          valeur={r.encadrement.ratio_eleves_enseignant}
          etiquette="Élèves par enseignant"
          detail={r.encadrement.ratio_eleves_enseignant > 45 ? 'Encadrement tendu' : 'Encadrement correct'}
        />
      </div>

      <div className="grille c2 mb-16">
        <Carte titre="Effectifs par niveau">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={r.effectifs}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure)" vertical={false} />
              <XAxis dataKey="niveau" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="garcons" name="Garçons" stackId="a" fill="var(--primaire)" />
              <Bar dataKey="filles" name="Filles" stackId="a" fill="var(--secondaire)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Carte>

        <Carte titre="Répartition par sexe">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={repartitionSexe} dataKey="valeur" nameKey="nom" outerRadius={100} label>
                <Cell fill="var(--primaire)" />
                <Cell fill="var(--secondaire)" />
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Carte>
      </div>

      <Carte titre="Détail par niveau" sansMarge style={{ marginBottom: 14 }}>
        <Tableau
          lignes={r.effectifs}
          cleLigne={(l: any, i: number) => `${l.niveau}-${i}`}
          colonnes={[
            { cle: 'niveau', titre: 'Niveau' },
            { cle: 'cycle', titre: 'Cycle', rendu: (l: any) => <Etiquette>{l.cycle}</Etiquette> },
            { cle: 'classes', titre: 'Classes', alignement: 'centre' },
            { cle: 'garcons', titre: 'Garçons', alignement: 'centre' },
            { cle: 'filles', titre: 'Filles', alignement: 'centre' },
            { cle: 'total', titre: 'Total', alignement: 'centre', rendu: (l: any) => <b>{l.total}</b> },
            { cle: 'redoublants', titre: 'Redoublants', alignement: 'centre' },
            { cle: 'abandons', titre: 'Abandons', alignement: 'centre', rendu: (l: any) =>
              l.abandons > 0 ? <b style={{ color: 'var(--danger)' }}>{l.abandons}</b> : '0' }
          ]}
        />
      </Carte>

      {r.reussite.length > 0 && (
        <Carte titre="Taux de réussite par niveau" sousTitre="Sur la dernière période évaluée" sansMarge>
          <Tableau
            lignes={r.reussite}
            cleLigne={(l: any) => l.niveau}
            colonnes={[
              { cle: 'niveau', titre: 'Niveau' },
              { cle: 'evalues', titre: 'Élèves évalués', alignement: 'centre' },
              { cle: 'reussites', titre: 'Réussites', alignement: 'centre' },
              { cle: 'taux', titre: 'Taux', alignement: 'droite', largeur: '190px', rendu: (l: any) => (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="nombre petit">{l.taux} %</span>
                  <BarreProgression pourcentage={l.taux} />
                </div>
              ) }
            ]}
          />
        </Carte>
      )}
    </>
  )
}

function OngletPalmares() {
  const document = useDocument()
  const periodes = useDonnees<Periode[]>('annee.periodes', [], [])
  const niveaux = useDonnees<Niveau[]>('niveau.liste', [], [])
  const [periodeId, setPeriodeId] = useState<number | null>(null)
  const [niveauId, setNiveauId] = useState<number | null>(null)
  const [limite, setLimite] = useState(20)

  useEffect(() => {
    if (!periodeId && periodes.donnees.length) setPeriodeId(periodes.donnees[0].id)
  }, [periodes.donnees, periodeId])

  const palmares = useDonnees<any[]>(
    periodeId ? 'stats.palmares' : null,
    [periodeId, { niveau_id: niveauId, limite }],
    []
  )

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Période">
          <Selection
            valeur={periodeId}
            surChangement={setPeriodeId}
            vide="Choisir…"
            options={periodes.donnees.map((p) => ({ valeur: p.id, libelle: p.libelle }))}
          />
        </Champ>
        <Champ label="Niveau">
          <Selection
            valeur={niveauId}
            surChangement={setNiveauId}
            vide="Tous les niveaux"
            options={niveaux.donnees.map((n) => ({ valeur: n.id, libelle: n.libelle }))}
          />
        </Champ>
        <Champ label="Nombre">
          <input type="number" min={3} max={100} style={{ width: 90 }} value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
        </Champ>
        <button
          className="bouton principal pousse"
          disabled={!periodeId || palmares.donnees.length === 0}
          onClick={() => document.apercu('impression.palmares', 'palmares', periodeId, palmares.donnees)}
        >
          <Printer size={16} /> Imprimer le palmares
        </button>
      </div>

      <Carte sansMarge>
        {palmares.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={palmares.donnees}
            cleLigne={(l) => l.eleve_id}
            vide={
              <EtatVide
                icone={<Award size={42} />}
                titre="Palmarès indisponible"
                description="Saisissez des notes pour que le classement général puisse être calculé."
              />
            }
            colonnes={[
              { cle: 'rang', titre: 'Rang', largeur: '80px', alignement: 'centre', rendu: (l) => (
                <b style={{ fontSize: l.rang <= 3 ? 17 : undefined, color: l.rang <= 3 ? 'var(--secondaire)' : undefined }}>
                  {l.rang}
                </b>
              ) },
              { cle: 'nom_complet', titre: 'Élève', rendu: (l) => <b>{l.nom_complet}</b> },
              { cle: 'classe_libelle', titre: 'Classe', rendu: (l) => <Etiquette variante="primaire">{l.classe_libelle}</Etiquette> },
              { cle: 'moyenne', titre: 'Moyenne /20', alignement: 'droite', rendu: (l) => (
                <b>{l.moyenne.toFixed(2).replace('.', ',')}</b>
              ) }
            ]}
          />
        )}
      </Carte>
    </>
  )
}

function OngletEvolution() {
  const evolution = useDonnees<any[]>('stats.evolution', [], [])

  return (
    <Carte titre="Évolution des effectifs" sousTitre="Sur toutes les années scolaires enregistrées">
      {evolution.donnees.length === 0 ? (
        <EtatVide
          icone={<TrendingUp size={42} />}
          titre="Pas encore d’historique"
          description="Cette courbe se remplira au fil des années scolaires clôturées."
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={evolution.donnees}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure)" vertical={false} />
              <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Effectif total" stroke="var(--primaire)" strokeWidth={2.6} />
              <Line type="monotone" dataKey="garcons" name="Garçons" stroke="#64748b" strokeWidth={1.6} />
              <Line type="monotone" dataKey="filles" name="Filles" stroke="var(--secondaire)" strokeWidth={1.6} />
            </LineChart>
          </ResponsiveContainer>
          <Tableau
            compacte
            lignes={evolution.donnees}
            cleLigne={(l) => l.annee}
            colonnes={[
              { cle: 'annee', titre: 'Année scolaire' },
              { cle: 'garcons', titre: 'Garçons', alignement: 'centre' },
              { cle: 'filles', titre: 'Filles', alignement: 'centre' },
              { cle: 'total', titre: 'Total', alignement: 'centre', rendu: (l) => <b>{l.total}</b> }
            ]}
          />
        </>
      )}
    </Carte>
  )
}
