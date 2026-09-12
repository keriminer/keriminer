import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { useSession } from '../store/session'
import { Champ } from '../components/ui'
import { APP_TAGLINE } from '@shared/constants'

export default function Connexion() {
  const { connecter, etablissement } = useSession()
  const [login, setLogin] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setEnCours(true)
    try {
      await connecter(login, motDePasse)
    } catch (erreurConnexion) {
      setErreur((erreurConnexion as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="ecran-centre">
      <form className="panneau-connexion" onSubmit={soumettre}>
        <div className="logo">
          {etablissement?.logo ? (
            <img src={etablissement.logo} alt="" />
          ) : (
            <div className="marque">SCOLIA</div>
          )}
          <div style={{ fontWeight: 650, marginTop: 6 }}>{etablissement?.nom}</div>
          <div className="slogan">{etablissement?.devise_texte || APP_TAGLINE}</div>
        </div>

        {erreur && <div className="message erreur" style={{ marginBottom: 14 }}>{erreur}</div>}

        <Champ label="Identifiant">
          <input autoFocus value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
        </Champ>
        <Champ label="Mot de passe">
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
          />
        </Champ>

        <button className="bouton principal bloc large mt-8" type="submit" disabled={enCours}>
          {enCours ? <Loader2 size={17} className="rotation" /> : <LogIn size={17} />}
          Se connecter
        </button>

        <div className="centre-texte petit discret mt-16">          SCOLIA — fonctionne hors ligne, vos donnees restent sur cet ordinateur.        </div>
      </form>
    </div>
  )
}
