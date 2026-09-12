import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './store/session'
import { Chargement, FournisseurNotifications, Champ, Modale, Message, useNotifications } from './components/ui'
import Disposition from './components/Disposition'
import Installation from './pages/Installation'
import Connexion from './pages/Connexion'
import TableauBord from './pages/TableauBord'
import Eleves from './pages/Eleves'
import Classes from './pages/Classes'
import Enseignants from './pages/Enseignants'
import Notes from './pages/Notes'
import Bulletins from './pages/Bulletins'
import Presences from './pages/Presences'
import Pointage from './pages/Pointage'
import Finances from './pages/Finances'
import Impayes from './pages/Impayes'
import Paie from './pages/Paie'
import Sms from './pages/Sms'
import Internat from './pages/Internat'
import Activites from './pages/Activites'
import Statistiques from './pages/Statistiques'
import Parametres from './pages/Parametres'
import { appeler } from './lib/api'

export default function App() {
  return (
    <FournisseurNotifications>
      <Racine />
    </FournisseurNotifications>
  )
}

function Racine() {
  const { chargement, installe, session, rafraichir } = useSession()

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  if (chargement) {
    return (
      <div className="ecran-centre">
        <div className="panneau-connexion centre-texte">
          <Chargement texte="Démarrage de SCOLIA…" />
        </div>
      </div>
    )
  }

  if (!installe) return <Installation />
  if (!session) return <Connexion />

  return (
    <>
      {session.utilisateur.doit_changer_mdp === 1 && <ChangementMotDePasseObligatoire />}
      <HashRouter>
        <Routes>
          <Route element={<Disposition />}>
            <Route path="/" element={<TableauBord />} />
            <Route path="/statistiques" element={<Statistiques />} />
            <Route path="/eleves" element={<Eleves />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/bulletins" element={<Bulletins />} />
            <Route path="/presences" element={<Presences />} />
            <Route path="/enseignants" element={<Enseignants />} />
            <Route path="/pointage" element={<Pointage />} />
            <Route path="/paie" element={<Paie />} />
            <Route path="/activites" element={<Activites />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/finances/impayes" element={<Impayes />} />
            <Route path="/sms" element={<Sms />} />
            <Route path="/internat" element={<Internat />} />
            <Route path="/parametres" element={<Parametres />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  )
}

/**
 * Un compte cree par l’administrateur arrive avec un mot de passe provisoire.
 * Tant qu’il n’est pas change, l’application reste bloquée : c’est la seule
 * protection realiste quand plusieurs personnes partagent un meme poste.
 */
function ChangementMotDePasseObligatoire() {
  const { rafraichir } = useSession()
  const { notifier } = useNotifications()
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [enCours, setEnCours] = useState(false)

  const valider = async () => {
    if (nouveau.length < 6) return notifier('alerte', 'Le mot de passe doit contenir au moins 6 caractères.')
    if (nouveau !== confirmation) return notifier('alerte', 'Les deux mots de passe ne correspondent pas.')
    setEnCours(true)
    try {
      await appeler('session.changer_mot_de_passe', actuel, nouveau)
      notifier('succes', 'Mot de passe modifie.')
      await rafraichir()
    } catch (e) {
      notifier('erreur', (e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      titre="Changement de mot de passe requis"
      ouverte
      surFermeture={() => {}}
      taille="petite"
      pied={
        <button className="bouton principal" onClick={valider} disabled={enCours}>          Enregistrer        </button>
      }
    >
      <Message type="alerte">        Votre mot de passe a été défini par l’administrateur. Choisissez-en un personnel avant de continuer.      </Message>
      <Champ label="Mot de passe actuel">
        <input type="password" autoFocus value={actuel} onChange={(e) => setActuel(e.target.value)} />
      </Champ>
      <Champ label="Nouveau mot de passe">
        <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
      </Champ>
      <Champ label="Confirmation">
        <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      </Champ>
    </Modale>
  )
}
