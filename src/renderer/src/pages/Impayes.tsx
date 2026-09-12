import { useState } from 'react'
import { Printer, Send, Wallet } from 'lucide-react'
import type { Classe, SituationFinanciere } from '@shared/types'
import { useAction, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  BarreProgression, Carte, Champ, Chargement, Etiquette, EtatVide, Indicateur,
  Message, Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { formaterDate, formaterMontant } from '@shared/format'

export default function Impayes() {
  const { etablissement, peut } = useSession()
  const document = useDocument()
  const { executer, enCours } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'

  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [classeId, setClasseId] = useState<number | null>(null)
  const [seuil, setSeuil] = useState(1)
  const [selection, setSelection] = useState<number[]>([])

  const situations = useDonnees<SituationFinanciere[]>(
    'finance.situations',
    [{ classe_id: classeId, seulement_impayes: true, seuil_solde: seuil - 1 }],
    []
  )

  const total = situations.donnees.reduce((s, l) => s + l.solde, 0)
  const sansTelephone = situations.donnees.filter((l) => !l.tuteur_telephone).length

  const relancer = () =>
    executer(
      async () => {
        const cibles = selection.length
          ? situations.donnees.filter((s) => selection.includes(s.inscription_id))
          : situations.donnees
        if (cibles.length === 0) throw new Error('Aucun élève a relancer.')
        const resultat = await appeler<{ programmes: number; ignores: number }>(
          'sms.campagne',
          'RAPPEL_IMPAYE',
          cibles.map((c) => c.eleve_id),
          {}
        )
        if (resultat.programmes === 0) {
          throw new Error("Aucun message n’a pu être prépare : vérifiez les numéros des tuteurs.")
        }
        return resultat
      },
      {
        succes: 'Relances mises en file d’attente. Envoyez-les depuis la page SMS.',
        surSucces: () => setSelection([])
      }
    )

  const toutSelectionner = () =>
    setSelection(
      selection.length === situations.donnees.length ? [] : situations.donnees.map((s) => s.inscription_id)
    )

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Impayés</h1>
          <div className="sous-texte">Suivi des soldes restant à recouvrer et relance des tuteurs</div>
        </div>
        <div className="actions">
          <button className="bouton" onClick={() => document.apercu('impression.impayes', 'etat-impayés', classeId)}>
            <Printer size={16} /> Imprimer l’etat
          </button>
          {peut('sms.envoyer') && (
            <button className="bouton principal" onClick={relancer} disabled={enCours}>
              <Send size={16} />
              {selection.length > 0 ? `Relancer ${selection.length} tuteur(s)` : 'Relancer tout le monde'}
            </button>
          )}
        </div>
      </div>

      <div className="grille c3 mb-16">
        <Indicateur
          icone={<Wallet size={20} />}
          valeur={formaterMontant(total, devise)}
          etiquette="Total des impayés"
          couleurFond="var(--danger-fond)"
          couleurIcone="var(--danger)"
        />
        <Indicateur valeur={situations.donnees.length} etiquette="Élèves concernés" />
        <Indicateur
          valeur={sansTelephone}
          etiquette="Sans numéro de tuteur"
          detail="Ces familles ne peuvent pas être relancées par SMS"
        />
      </div>

      <div className="barre-filtres">
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Toutes les classes"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
        <Champ label="Solde minimum" aide={`En ${devise}`}>
          <input type="number" min={1} style={{ width: 130 }} value={seuil} onChange={(e) => setSeuil(Number(e.target.value) || 1)} />
        </Champ>
        <button className="bouton" onClick={toutSelectionner}>
          {selection.length === situations.donnees.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>

      {sansTelephone > 0 && (
        <Message type="alerte">
          {sansTelephone} élève(s) n’ont pas de numéro de tuteur enregistré : complétez leur fiche pour pouvoir
          les relancer par SMS.
        </Message>
      )}

      <Carte sansMarge>
        {situations.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={situations.donnees}
            cleLigne={(s) => s.inscription_id}
            vide={
              <EtatVide
                titre="Aucun impayé"
                description="Toutes les scolarités sont à jour pour le filtre choisi."
              />
            }
            colonnes={[
              { cle: 'selection', titre: '', largeur: '44px', alignement: 'centre', rendu: (s) => (
                <input
                  type="checkbox"
                  checked={selection.includes(s.inscription_id)}
                  onChange={(e) =>
                    setSelection((sel) =>
                      e.target.checked ? [...sel, s.inscription_id] : sel.filter((x) => x !== s.inscription_id)
                    )
                  }
                />
              ) },
              { cle: 'nom_complet', titre: 'Élève', rendu: (s) => (
                <div>
                  <div className="gras">{s.nom_complet}</div>
                  <div className="petit discret">
                    <span className="mono">{s.matricule}</span> · {s.classe_libelle}
                  </div>
                </div>
              ) },
              { cle: 'tuteur_telephone', titre: 'Tuteur', rendu: (s) =>                s.tuteur_telephone ? (                  <span className="mono petit">{s.tuteur_telephone}</span>
                ) : (
                  <Etiquette variante="alerte">Aucun numéro</Etiquette>
                ) },
              { cle: 'total_du', titre: 'Du', alignement: 'droite', rendu: (s) =>
                formaterMontant(s.total_du - s.total_remise, devise) },
              { cle: 'total_paye', titre: 'Versé', alignement: 'droite', rendu: (s) => formaterMontant(s.total_paye, devise) },
              { cle: 'solde', titre: 'Solde', alignement: 'droite', rendu: (s) => (
                <b style={{ color: 'var(--danger)' }}>{formaterMontant(s.solde, devise)}</b>
              ) },
              { cle: 'taux', titre: 'Avancement', alignement: 'droite', largeur: '150px', rendu: (s) => (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="petit nombre">{s.taux} %</span>
                  <BarreProgression pourcentage={s.taux} />
                </div>
              ) },
              { cle: 'dernier_paiement', titre: 'Dernier versement', rendu: (s) =>
                s.dernier_paiement ? formaterDate(s.dernier_paiement) : <span className="discret">Jamais</span> }
            ]}
          />
        )}
      </Carte>
    </>
  )
}
