import { Link } from 'react-router-dom'
import {
  AlertTriangle, BedDouble, CalendarCheck, GraduationCap, Info, TrendingUp, UserCog, Wallet
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import type { StatsTableauBord } from '@shared/types'
import { useDonnees } from '../hooks'
import { useSession } from '../store/session'
import { BarreProgression, Carte, Chargement, EtatVide, Indicateur, Message, Tableau } from '../components/ui'
import { formaterMontant } from '@shared/format'

const VIDE: StatsTableauBord = {
  effectif_total: 0, effectif_garcons: 0, effectif_filles: 0, nb_classes: 0, nb_enseignants: 0,
  nb_pensionnaires: 0, recettes_total: 0, attendu_total: 0, impayes_total: 0, taux_recouvrement: 0,
  presents_jour: 0, absents_jour: 0, taux_presence_jour: 0, enseignants_pointes: 0,
  effectif_par_niveau: [], recettes_par_mois: [], top_impayes: [], alertes: []
}

export default function TableauBord() {
  const { etablissement } = useSession()
  const { donnees: stats, chargement, erreur } = useDonnees<StatsTableauBord>('stats.tableau_bord', [], VIDE)
  const devise = etablissement?.devise_code ?? 'BIF'

  if (chargement) return <Chargement />
  if (erreur) return <Message type="erreur">{erreur}</Message>

  const couleurs = ['var(--primaire)', 'var(--secondaire)']

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>{etablissement?.nom}</h1>
          <div className="sous-texte">
            {etablissement?.commune ? `${etablissement.commune} · ` : ''}
            Situation au {new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}
          </div>
        </div>
      </div>

      {stats.alertes.length > 0 && (
        <div className="mb-16">
          {stats.alertes.map((a, i) => (
            <div
              key={i}
              className={`message ${a.niveau === 'urgent' ? 'erreur' : a.niveau === 'avertissement' ? 'alerte' : 'info'}`}
            >
              {a.niveau === 'info' ? <Info size={17} /> : <AlertTriangle size={17} />}
              <div className="entre" style={{ width: '100%' }}>
                <span>{a.message}</span>
                {a.lien && (
                  <Link to={a.lien} className="bouton petit pousse">Ouvrir</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grille c4 mb-16">
        <Indicateur
          icone={<GraduationCap size={20} />}
          valeur={stats.effectif_total}
          etiquette="Élèves inscrits"
          detail={`${stats.effectif_garcons} garçons · ${stats.effectif_filles} filles · ${stats.nb_classes} classes`}
        />
        <Indicateur
          icone={<UserCog size={20} />}
          valeur={stats.nb_enseignants}
          etiquette="Enseignants actifs"
          detail={`${stats.enseignants_pointes} pointe(s) aujourd’hui`}
          couleurFond="#eef2ff"
          couleurIcone="#4338ca"
        />
        <Indicateur
          icone={<Wallet size={20} />}
          valeur={formaterMontant(stats.recettes_total, devise)}
          etiquette="Recettes encaissées"
          detail={
            <span>
              {stats.taux_recouvrement} % de recouvrement ·{' '}
              <b style={{ color: 'var(--danger)' }}>{formaterMontant(stats.impayes_total, devise)}</b> d’impayes
            </span>
          }
          couleurFond="var(--succes-fond)"
          couleurIcone="var(--succes)"
        />
        <Indicateur
          icone={<CalendarCheck size={20} />}
          valeur={`${stats.taux_presence_jour} %`}
          etiquette="Présence du jour"
          detail={`${stats.presents_jour} présents · ${stats.absents_jour} absents`}
          couleurFond="var(--alerte-fond)"
          couleurIcone="var(--alerte)"
        />
      </div>

      <div className="grille c2 mb-16">
        <Carte titre="Effectifs par niveau" sousTitre="Répartition garçons / filles">
          {stats.effectif_par_niveau.length === 0 ? (
            <EtatVide titre="Aucun élève inscrit" description="Commencez par créer vos classes puis inscrire les élèves." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.effectif_par_niveau}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure)" vertical={false} />
                <XAxis dataKey="libelle" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="garcons" name="Garçons" fill={couleurs[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="filles" name="Filles" fill={couleurs[1]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Carte>

        <Carte titre="Recettes par mois" sousTitre="Encaissements de l’année en cours">
          {stats.recettes_par_mois.length === 0 ? (
            <EtatVide titre="Aucun encaissement" description="Les paiements enregistrés apparaîtront ici." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.recettes_par_mois}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bordure)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                />
                <Tooltip formatter={(v: number) => formaterMontant(v, devise)} />
                <Line
                  type="monotone" dataKey="montant" name="Recettes"
                  stroke="var(--primaire)" strokeWidth={2.4} dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Carte>
      </div>

      <div className="grille c2">
        <Carte
          titre="Recouvrement de la scolarité"
          actions={<Link to="/finances/impayes" className="bouton petit">Voir les impayés</Link>}
        >
          <div className="entre espace mb-8">
            <span className="doux">Attendu</span>
            <b className="nombre">{formaterMontant(stats.attendu_total, devise)}</b>
          </div>
          <div className="entre espace mb-8">
            <span className="doux">Encaissé</span>
            <b className="nombre" style={{ color: 'var(--succes)' }}>{formaterMontant(stats.recettes_total, devise)}</b>
          </div>
          <div className="entre espace mb-12">
            <span className="doux">Reste à recouvrer</span>
            <b className="nombre" style={{ color: 'var(--danger)' }}>{formaterMontant(stats.impayes_total, devise)}</b>
          </div>
          <BarreProgression pourcentage={stats.taux_recouvrement} />
          <div className="petit discret mt-8">{stats.taux_recouvrement} % du montant attendu</div>

          {stats.nb_pensionnaires > 0 && (
            <div className="entre mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--bordure)' }}>
              <BedDouble size={17} color="var(--texte-faible)" />
              <span className="doux">{stats.nb_pensionnaires} pensionnaire(s) a l’internat</span>
            </div>
          )}
        </Carte>

        <Carte titre="Principaux impayés" sousTitre="Les dix soldes les plus élevés" sansMarge>
          <Tableau
            compacte
            lignes={stats.top_impayes}
            cleLigne={(l) => l.inscription_id}
            vide={<EtatVide titre="Aucun impayé" description="Toutes les scolarités sont à jour." icone={<TrendingUp size={40} />} />}
            colonnes={[
              { cle: 'nom_complet', titre: 'Élève', rendu: (l) => (
                <div>
                  <div className="gras">{l.nom_complet}</div>
                  <div className="petit discret">{l.classe_libelle}</div>
                </div>
              ) },
              { cle: 'solde', titre: 'Solde', alignement: 'droite', rendu: (l) => (
                <b style={{ color: 'var(--danger)' }}>{formaterMontant(l.solde, devise)}</b>
              ) },
              { cle: 'taux', titre: 'Paye', alignement: 'droite', largeur: '110px', rendu: (l) => (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="petit discret nombre">{l.taux} %</span>
                  <BarreProgression pourcentage={l.taux} />
                </div>
              ) }
            ]}
          />
        </Carte>
      </div>
    </>
  )
}
