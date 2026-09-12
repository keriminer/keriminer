import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity, BadgeCheck, BedDouble, BookOpen, CalendarDays, ClipboardCheck, Clock,
  GraduationCap, LayoutDashboard, LogOut, MessageSquare, PieChart, ReceiptText,
  Settings, UserCog, Users, Wallet
} from 'lucide-react'
import { useSession } from '../store/session'
import { initiales } from '@shared/format'
import { ROLES } from '@shared/permissions'
import { useEffect, useState } from 'react'
import { appelerOuDefaut } from '../lib/api'

interface Entree {
  chemin: string
  libelle: string
  icone: React.ReactNode
  permission: string
  groupe: string
}

const ENTREES: Entree[] = [
  { chemin: '/', libelle: 'Tableau de bord', icone: <LayoutDashboard size={17} />, permission: 'tableau_bord.lecture', groupe: 'Pilotage' },
  { chemin: '/statistiques', libelle: 'Statistiques', icone: <PieChart size={17} />, permission: 'statistique.lecture', groupe: 'Pilotage' },

  { chemin: '/eleves', libelle: 'Élèves', icone: <Users size={17} />, permission: 'eleve.lecture', groupe: 'Scolarité' },
  { chemin: '/classes', libelle: 'Classes et matières', icone: <BookOpen size={17} />, permission: 'classe.lecture', groupe: 'Scolarité' },
  { chemin: '/notes', libelle: 'Notes', icone: <ClipboardCheck size={17} />, permission: 'note.lecture', groupe: 'Scolarité' },
  { chemin: '/bulletins', libelle: 'Bulletins', icone: <GraduationCap size={17} />, permission: 'bulletin.lecture', groupe: 'Scolarité' },
  { chemin: '/presences', libelle: 'Présences élèves', icone: <CalendarDays size={17} />, permission: 'presence.lecture', groupe: 'Scolarité' },

  { chemin: '/enseignants', libelle: 'Enseignants', icone: <UserCog size={17} />, permission: 'enseignant.lecture', groupe: 'Personnel' },
  { chemin: '/pointage', libelle: 'Pointage', icone: <Clock size={17} />, permission: 'pointage.lecture', groupe: 'Personnel' },
  { chemin: '/paie', libelle: 'Paie', icone: <BadgeCheck size={17} />, permission: 'paie.lecture', groupe: 'Personnel' },
  { chemin: '/activites', libelle: 'Journées pédagogiques', icone: <Activity size={17} />, permission: 'activite.lecture', groupe: 'Personnel' },

  { chemin: '/finances', libelle: 'Caisse et scolarité', icone: <Wallet size={17} />, permission: 'finance.lecture', groupe: 'Finances' },
  { chemin: '/finances/impayes', libelle: 'Impayés', icone: <ReceiptText size={17} />, permission: 'finance.lecture', groupe: 'Finances' },

  { chemin: '/sms', libelle: 'SMS aux parents', icone: <MessageSquare size={17} />, permission: 'sms.lecture', groupe: 'Communication' },
  { chemin: '/internat', libelle: 'Internat', icone: <BedDouble size={17} />, permission: 'internat.lecture', groupe: 'Vie scolaire' },

  { chemin: '/parametres', libelle: 'Paramètres', icone: <Settings size={17} />, permission: 'parametre.lecture', groupe: 'Administration' }
]

export default function Disposition() {
  const { etablissement, annee, session, deconnecter, peut, parametres } = useSession()
  const emplacement = useLocation()
  const [smsEnAttente, setSmsEnAttente] = useState(0)

  // Compteur discret de SMS en attente : rappelle qu’il reste des messages à envoyer.
  useEffect(() => {
    if (!peut('sms.lecture')) return
    let actif = true
    const charger = () =>
      appelerOuDefaut({ en_attente: 0 }, 'sms.statistiques').then(
        (s: any) => actif && setSmsEnAttente(s?.en_attente ?? 0)
      )
    charger()
    const minuteur = setInterval(charger, 60000)
    return () => {
      actif = false
      clearInterval(minuteur)
    }
  }, [peut, emplacement.pathname])

  const entreesVisibles = ENTREES.filter((e) => peut(e.permission))
  const groupes = [...new Set(entreesVisibles.map((e) => e.groupe))]
  const pageCourante = ENTREES.find((e) =>
    e.chemin === '/' ? emplacement.pathname === '/' : emplacement.pathname.startsWith(e.chemin)
  )
  const libelleRole = ROLES.find((r) => r.code === session?.utilisateur.role)?.libelle ?? ''

  return (
    <div className="application">
      <aside className="barre-laterale">
        <div className="marque">
          {etablissement?.logo ? (
            <img src={etablissement.logo} alt="" />
          ) : (
            <div className="initiales">{initiales(etablissement?.nom ?? 'SC')}</div>
          )}
          <div className="texte">
            <div className="nom" title={etablissement?.nom}>
              {etablissement?.sigle || etablissement?.nom || 'SCOLIA'}
            </div>
            <div className="annee">{annee?.libelle ?? 'Aucune année active'}</div>
          </div>
        </div>

        <nav className="navigation">
          {groupes.map((groupe) => (
            <div key={groupe}>
              <div className="groupe">{groupe}</div>
              {entreesVisibles
                .filter((e) => e.groupe === groupe)
                .map((e) => (
                  <NavLink
                    key={e.chemin}
                    to={e.chemin}
                    end={e.chemin === '/' || e.chemin === '/finances'}
                    className={({ isActive }) => (isActive ? 'actif' : '')}
                  >
                    {e.icone}
                    <span>{e.libelle}</span>
                    {e.chemin === '/sms' && smsEnAttente > 0 && (
                      <span className="pastille">{smsEnAttente}</span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="zone-principale">
        <header className="barre-superieure">
          <div className="titre-page">{pageCourante?.libelle ?? 'SCOLIA'}</div>
          <div className="fil">
            <div className="utilisateur">
              <div className="avatar">{initiales(session?.utilisateur.nom_complet ?? '')}</div>
              <div className="infos">
                <div className="nom">{session?.utilisateur.nom_complet}</div>
                <div className="role">{libelleRole}</div>
              </div>
            </div>
            <button className="bouton discret" onClick={() => deconnecter()} title="Se déconnecter">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="contenu">
          <Outlet context={{ parametres }} />
        </main>
      </div>
    </div>
  )
}
