import { useState } from 'react'
import { MessageSquare, RefreshCw, Save, Send, Trash2 } from 'lucide-react'
import type { Classe, Eleve, MessageSms } from '@shared/types'
import { useAction, useDonnees } from '../hooks'
import {
  Carte, Champ, Chargement, Etiquette, EtatVide, Indicateur, Message, Modale,
  Onglets, Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { VARIABLES_SMS } from '@shared/constants'
import { compterSms, formaterDateHeure } from '@shared/format'

export default function Sms() {
  const [onglet, setOnglet] = useState('file')
  const statistiques = useDonnees<any>('sms.statistiques', [], {
    en_attente: 0, envoyes: 0, echecs: 0, cout_total: 0
  })

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>SMS aux parents</h1>
          <div className="sous-texte">            Les messages sont d’abord écrits localement, puis envoyés quand une connexion est disponible          </div>
        </div>
      </div>

      <div className="grille c4 mb-16">
        <Indicateur
          icone={<MessageSquare size={20} />}
          valeur={statistiques.donnees.en_attente ?? 0}
          etiquette="En attente d’envoi"
          couleurFond="var(--alerte-fond)"
          couleurIcone="var(--alerte)"
        />
        <Indicateur valeur={statistiques.donnees.envoyes ?? 0} etiquette="Envoyés" couleurIcone="var(--succes)" />
        <Indicateur valeur={statistiques.donnees.echecs ?? 0} etiquette="Échecs" couleurIcone="var(--danger)" />
        <Indicateur valeur={statistiques.donnees.cout_total ?? 0} etiquette="SMS facturés" detail="Unités consommees" />
      </div>

      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'file', libelle: "File d’attente", pastille: statistiques.donnees.en_attente },
          { cle: 'campagne', libelle: 'Nouvelle campagne' },
          { cle: 'modeles', libelle: 'Modèles de messages' }
        ]}
      />

      {onglet === 'file' && <OngletFile surChangement={statistiques.recharger} />}
      {onglet === 'campagne' && <OngletCampagne surChangement={statistiques.recharger} />}
      {onglet === 'modeles' && <OngletModeles />}
    </>
  )
}

function OngletFile({ surChangement }: { surChangement: () => void }) {
  const { executer, enCours } = useAction()
  const { notifier } = useNotifications()
  const [statut, setStatut] = useState<string | null>(null)
  const messages = useDonnees<MessageSms[]>('sms.messages', [{ statut, limite: 300 }], [])

  const envoyer = () =>
    executer(
      async () => {
        const resultat = await appeler<{ envoyes: number; echecs: number; details: string[] }>('sms.envoyer_file', 50)
        if (resultat.echecs > 0) {
          notifier('alerte', `${resultat.envoyes} envoyé(s), ${resultat.echecs} échec(s). ${resultat.details[0] ?? ''}`)
        } else {
          notifier('succes', `${resultat.envoyes} message(s) envoyé(s).`)
        }
      },
      { surSucces: () => { messages.recharger(); surChangement() } }
    )

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Statut">
          <Selection
            valeur={statut}
            surChangement={setStatut}
            vide="Tous"
            options={[
              { valeur: 'EN_ATTENTE', libelle: 'En attente' },
              { valeur: 'ENVOYE', libelle: 'Envoyés' },
              { valeur: 'ECHEC', libelle: 'Échecs' }
            ]}
          />
        </Champ>
        <button
          className="bouton"
          onClick={() =>
            executer(() => appeler('sms.reprogrammer_echecs'), {
              succes: 'Échecs remis en file d’attente.',
              surSucces: () => { messages.recharger(); surChangement() }
            })
          }
        >
          <RefreshCw size={16} /> Réessayer les échecs
        </button>
        <button className="bouton principal pousse" onClick={envoyer} disabled={enCours}>
          <Send size={16} /> Envoyer la file d’attente
        </button>
      </div>

      <Message type="info">        L’envoi nécessite une passerelle SMS configurée dans les paramètres. Sans connexion, les messages
        restent en file d’attente : rien n’est perdu.      </Message>

      <Carte sansMarge>
        {messages.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={messages.donnees}
            cleLigne={(m) => m.id}
            vide={<EtatVide icone={<MessageSquare size={42} />} titre="Aucun message" />}
            colonnes={[
              { cle: 'destinataire', titre: 'Destinataire', rendu: (m) => (
                <div>
                  <div className="gras">{m.destinataire}</div>
                  <div className="petit discret mono">{m.telephone}</div>
                </div>
              ) },
              { cle: 'contenu', titre: 'Message', rendu: (m) => (
                <div>
                  <div className="petit">{m.contenu}</div>
                  <div className="petit discret">{m.contenu.length} caracteres · {compterSms(m.contenu)} SMS</div>
                </div>
              ) },
              { cle: 'statut', titre: 'Statut', rendu: (m) => (
                <div>
                  <Etiquette variante={m.statut === 'ENVOYE' ? 'succes' : m.statut === 'ECHEC' ? 'danger' : 'alerte'}>
                    {m.statut}
                  </Etiquette>
                  {m.erreur && <div className="petit discret mt-8">{m.erreur}</div>}
                </div>
              ) },
              { cle: 'date_creation', titre: 'Créé le', rendu: (m) => (
                <span className="petit">{formaterDateHeure(m.date_creation)}</span>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (m) =>
                m.statut !== 'ENVOYE' ? (
                  <button
                    className="bouton discret petit"
                    onClick={() =>
                      executer(() => appeler('sms.supprimer', m.id), {
                        surSucces: () => { messages.recharger(); surChangement() }
                      })
                    }
                  >
                    <Trash2 size={15} color="var(--danger)" />
                  </button>
                ) : null }
            ]}
          />
        )}
      </Carte>
    </>
  )
}

function OngletCampagne({ surChangement }: { surChangement: () => void }) {
  const { executer, enCours } = useAction()
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const modeles = useDonnees<any[]>('sms.modeles', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const [modeleCode, setModeleCode] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [selection, setSelection] = useState<number[]>([])

  const eleves = useDonnees<Eleve[]>('eleve.liste', [{ classe_id: classeId, statut: 'ACTIF' }], [])
  const modele = modeles.donnees.find((m) => m.code === modeleCode)

  const envoyer = () =>
    executer(
      async () => {
        if (!modeleCode) throw new Error('Choisissez un modèle de message.')
        const cibles = selection.length ? selection : eleves.donnees.map((e) => e.id)
        if (cibles.length === 0) throw new Error('Aucun destinataire.')
        const resultat = await appeler<{ programmes: number; ignores: number }>(
          'sms.campagne', modeleCode, cibles, { motif }
        )
        if (resultat.programmes === 0) {
          throw new Error('Aucun message prépare : vérifiez que les tuteurs ont un numéro enregistre.')
        }
        return resultat
      },
      {
        succes: 'Messages mis en file d’attente.',
        surSucces: () => { setSelection([]); surChangement() }
      }
    )

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Modèle de message">
          <Selection
            valeur={modeleCode}
            surChangement={setModeleCode}
            vide="Choisir…"
            options={modeles.donnees.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
          />
        </Champ>
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={(v) => { setClasseId(v); setSelection([]) }}
            vide="Toutes les classes"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
        <div className="champ recherche">
          <label>Texte libre <span className="discret">(variable {'{{motif}}'})</span></label>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Réunion des parents le samedi 14 a 9h" />
        </div>
        <button className="bouton principal" onClick={envoyer} disabled={enCours || !modeleCode}>
          <Send size={16} />
          Preparer {selection.length > 0 ? `${selection.length}` : eleves.donnees.length} message(s)
        </button>
      </div>

      {modele && (
        <Carte titre="Aperçu du message" style={{ marginBottom: 14 }}>
          <div
            style={{
              background: 'var(--primaire-clair)', padding: 12, borderRadius: 8,
              borderLeft: '3px solid var(--primaire)'
            }}
          >
            {modele.contenu.replace('{{motif}}', motif || '…')}
          </div>
          <div className="petit discret mt-8">
            {modele.contenu.length} caractères · {compterSms(modele.contenu)} SMS par destinataire
          </div>
        </Carte>
      )}

      <Carte sansMarge>
        <Tableau
          lignes={eleves.donnees}
          cleLigne={(e) => e.id}
          vide={<EtatVide titre="Aucun élève" />}
          colonnes={[
            { cle: 'selection', titre: '', largeur: '44px', alignement: 'centre', rendu: (e) => (
              <input
                type="checkbox"
                checked={selection.includes(e.id)}
                onChange={(ev) =>
                  setSelection((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))
                }
              />
            ) },
            { cle: 'nom', titre: 'Élève', rendu: (e) => `${e.nom} ${e.prenom}` },
            { cle: 'classe_libelle', titre: 'Classe' },
            { cle: 'tuteur_nom', titre: 'Tuteur' },
            { cle: 'tuteur_telephone', titre: 'Téléphone', rendu: (e) =>              e.tuteur_telephone ? (                <span className="mono petit">{e.tuteur_telephone}</span>
              ) : (
                <Etiquette variante="alerte">Aucun numéro</Etiquette>
              ) }
          ]}
        />
      </Carte>
      <div className="petit discret mt-8">        Sans selection explicite, la campagne s’adresse à tous les élèves affiches ci-dessus.      </div>
    </>
  )
}

function OngletModeles() {
  const { executer } = useAction()
  const modeles = useDonnees<any[]>('sms.modeles', [], [])
  const [edition, setEdition] = useState<any>(null)

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">Personnalisez le texte envoyé aux familles</div>
        <button
          className="bouton principal"
          onClick={() => setEdition({ code: '', libelle: '', contenu: '', actif: 1, automatique: 0 })}
        >          Nouveau modèle        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={modeles.donnees}
          cleLigne={(m) => m.id ?? m.code}
          surClicLigne={setEdition}
          colonnes={[
            { cle: 'libelle', titre: 'Modèle', rendu: (m) => (
              <div>
                <div className="gras">{m.libelle}</div>
                <div className="petit discret mono">{m.code}</div>
              </div>
            ) },
            { cle: 'contenu', titre: 'Contenu', rendu: (m) => <span className="petit">{m.contenu}</span> },
            { cle: 'automatique', titre: 'Automatique', alignement: 'centre', rendu: (m) =>
              m.automatique ? <Etiquette variante="primaire">Auto</Etiquette> : '—' },
            { cle: 'actif', titre: 'Actif', alignement: 'centre', rendu: (m) =>
              m.actif ? <Etiquette variante="succes">Oui</Etiquette> : <Etiquette>Non</Etiquette> }
          ]}
        />
      </Carte>

      {edition && (
        <Modale
          ouverte
          taille="large"
          titre={edition.id ? `Modèle — ${edition.libelle}` : 'Nouveau modèle'}
          surFermeture={() => setEdition(null)}
          pied={
            <>
              <button className="bouton" onClick={() => setEdition(null)}>Annuler</button>
              <button
                className="bouton principal"
                onClick={() =>
                  executer(
                    async () => {
                      if (!edition.code.trim() || !edition.contenu.trim()) {
                        throw new Error('Code et contenu obligatoires.')
                      }
                      await appeler('sms.enregistrer_modele', edition)
                    },
                    { succes: 'Modèle enregistré.', surSucces: () => { setEdition(null); modeles.recharger() } }
                  )
                }
              >
                <Save size={16} /> Enregistrer
              </button>
            </>
          }
        >
          <div className="ligne-champs">
            <Champ label="Code" obligatoire aide="Identifiant technique, en majuscules">
              <input
                value={edition.code}
                disabled={Boolean(edition.id)}
                onChange={(e) => setEdition({ ...edition, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
              />
            </Champ>
            <Champ label="Libelle" obligatoire>
              <input value={edition.libelle} onChange={(e) => setEdition({ ...edition, libelle: e.target.value })} />
            </Champ>
          </div>
          <Champ
            label="Contenu du message"
            obligatoire
            aide={`${edition.contenu.length} caractères · ${compterSms(edition.contenu)} SMS`}
          >
            <textarea rows={4} value={edition.contenu} onChange={(e) => setEdition({ ...edition, contenu: e.target.value })} />
          </Champ>
          <Champ label="Variables disponibles" aide="Cliquez pour insérer">
            <div className="enveloppe">
              {VARIABLES_SMS.map((v) => (
                <button
                  key={v}
                  className="bouton petit"
                  onClick={() => setEdition({ ...edition, contenu: `${edition.contenu}${v}` })}
                >
                  {v}
                </button>
              ))}
            </div>
          </Champ>
          <label className="case-a-cocher">
            <input
              type="checkbox"
              checked={Boolean(edition.actif)}
              onChange={(e) => setEdition({ ...edition, actif: e.target.checked ? 1 : 0 })}
            />            Modèle actif          </label>
          <label className="case-a-cocher mt-8">
            <input
              type="checkbox"
              checked={Boolean(edition.automatique)}
              onChange={(e) => setEdition({ ...edition, automatique: e.target.checked ? 1 : 0 })}
            />            Declenchement automatique (absences, encaissements)          </label>
        </Modale>
      )}
    </>
  )
}
