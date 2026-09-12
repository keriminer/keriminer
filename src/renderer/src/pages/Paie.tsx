import { useState } from 'react'
import { BadgeCheck, Calculator, Plus, Printer, Trash2, Wallet } from 'lucide-react'
import type { BulletinPaie } from '@shared/types'
import { useAction, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  Carte, Champ, Chargement, Etiquette, EtatVide, Indicateur, Message, Modale,
  Selection, Tableau
} from '../components/ui'
import { appeler } from '../lib/api'
import { MODES_PAIEMENT } from '@shared/constants'
import { aujourdHui, formaterDate, formaterMontant } from '@shared/format'

export default function Paie() {
  const { etablissement, peut } = useSession()
  const document = useDocument()
  const { executer, enCours } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'

  const maintenant = new Date()
  const [mois, setMois] = useState(maintenant.getMonth() + 1)
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [detail, setDetail] = useState<BulletinPaie | null>(null)

  const etat = useDonnees<any>('paie.etat', [mois, annee], {
    lignes: [], total_brut: 0, total_primes: 0, total_retenues: 0, total_net: 0, nb_payes: 0
  })

  const preparer = () =>
    executer(
      async () => {
        const resultat = await appeler<{ crees: number; mis_a_jour: number; ignores: number }>(
          'paie.preparer', mois, annee
        )
        return resultat
      },
      { succes: 'Paie préparée à partir du pointage du mois.', surSucces: etat.recharger }
    )

  const valider = () =>
    executer(() => appeler('paie.valider', mois, annee), {
      succes: 'Bulletins validés.',
      surSucces: etat.recharger
    })

  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Paie du personnel</h1>
          <div className="sous-texte">Calculée à partir des heures et des absences réellement pointées</div>
        </div>
        <div className="actions">
          <button className="bouton" onClick={() => document.apercu('impression.etat_paie', 'etat-paie', mois, annee)}>
            <Printer size={16} /> État de paie
          </button>
          {peut('paie.ecriture') && (
            <>
              <button className="bouton" onClick={valider} disabled={enCours}>
                <BadgeCheck size={16} /> Valider le mois
              </button>
              <button className="bouton principal" onClick={preparer} disabled={enCours}>
                <Calculator size={16} /> Préparer la paie
              </button>
            </>
          )}
        </div>
      </div>

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

      <div className="grille c4 mb-16">
        <Indicateur icone={<Wallet size={20} />} valeur={formaterMontant(etat.donnees.total_brut, devise)} etiquette="Masse salariale brute" />
        <Indicateur valeur={formaterMontant(etat.donnees.total_primes, devise)} etiquette="Primes" couleurIcone="var(--succes)" />
        <Indicateur valeur={formaterMontant(etat.donnees.total_retenues, devise)} etiquette="Retenues" couleurIcone="var(--danger)" />
        <Indicateur
          valeur={formaterMontant(etat.donnees.total_net, devise)}
          etiquette="Net à payer"
          detail={`${etat.donnees.nb_payes} bulletin(s) déjà payés sur ${etat.donnees.lignes.length}`}
        />
      </div>

      <Message type="info">        « Préparer la paie » recalcule chaque bulletin à partir du pointage du mois : heures faites pour les
        vacataires, retenue proportionnelle aux absences pour les permanents. Les bulletins déjà payés ne sont
        jamais recalculés.      </Message>

      <Carte sansMarge>
        {etat.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={etat.donnees.lignes}
            cleLigne={(b: BulletinPaie) => b.id}
            surClicLigne={setDetail}
            vide={
              <EtatVide
                icone={<Calculator size={42} />}
                titre="Aucun bulletin pour ce mois"
                description="Cliquez sur « Préparer la paie » pour générer les bulletins à partir du pointage."
              />
            }
            colonnes={[
              { cle: 'enseignant_nom', titre: 'Agent', rendu: (b: BulletinPaie) => (
                <div>
                  <div className="gras">{b.enseignant_nom}</div>
                  <div className="petit discret mono">{b.matricule}</div>
                </div>
              ) },
              { cle: 'heures_faites', titre: 'Heures', alignement: 'centre', rendu: (b: BulletinPaie) => (
                <span className="nombre">{b.heures_faites.toFixed(1)} h</span>
              ) },
              { cle: 'jours_absence', titre: 'Absences', alignement: 'centre', rendu: (b: BulletinPaie) =>
                b.jours_absence > 0 ? <b style={{ color: 'var(--danger)' }}>{b.jours_absence}</b> : '0' },
              { cle: 'salaire_base', titre: 'Base', alignement: 'droite', rendu: (b: BulletinPaie) =>
                formaterMontant(b.salaire_base, devise) },
              { cle: 'total_primes', titre: 'Primes', alignement: 'droite', rendu: (b: BulletinPaie) =>
                b.total_primes > 0 ? <span style={{ color: 'var(--succes)' }}>+{formaterMontant(b.total_primes, devise)}</span> : '—' },
              { cle: 'total_retenues', titre: 'Retenues', alignement: 'droite', rendu: (b: BulletinPaie) =>
                b.total_retenues > 0 ? <span style={{ color: 'var(--danger)' }}>-{formaterMontant(b.total_retenues, devise)}</span> : '—' },
              { cle: 'net_a_payer', titre: 'Net à payer', alignement: 'droite', rendu: (b: BulletinPaie) => (
                <b>{formaterMontant(b.net_a_payer, devise)}</b>
              ) },
              { cle: 'statut', titre: 'Statut', rendu: (b: BulletinPaie) => (
                <Etiquette variante={b.statut === 'PAYE' ? 'succes' : b.statut === 'VALIDE' ? 'info' : ''}>
                  {b.statut}
                </Etiquette>
              ) }
            ]}
          />
        )}
      </Carte>

      {detail && (
        <DetailBulletinPaie
          bulletinId={detail.id}
          devise={devise}
          surFermeture={() => setDetail(null)}
          surChangement={etat.recharger}
        />
      )}
    </>
  )
}

function DetailBulletinPaie({
  bulletinId, devise, surFermeture, surChangement
}: {
  bulletinId: number
  devise: string
  surFermeture: () => void
  surChangement: () => void
}) {
  const { executer, enCours } = useAction()
  const donnees = useDonnees<any>('paie.lire', [bulletinId], null)
  const elements = useDonnees<{ libelle: string; type: string }[]>('paie.elements_reference', [], [])
  const [ligne, setLigne] = useState({ libelle: '', type: 'PRIME' as 'PRIME' | 'RETENUE', montant: '' })
  const [paiement, setPaiement] = useState({ date_paiement: aujourdHui(), mode_paiement: 'ESPECES', reference: '' })

  const b = donnees.donnees?.bulletin

  const ajouter = () =>
    executer(
      async () => {
        if (!ligne.libelle.trim() || !Number(ligne.montant)) throw new Error('Libelle et montant obligatoires.')
        await appeler('paie.ajouter_ligne', bulletinId, { ...ligne, montant: Number(ligne.montant) })
      },
      {
        succes: 'Ligne ajoutée.',
        surSucces: () => { setLigne({ libelle: '', type: 'PRIME', montant: '' }); donnees.recharger(); surChangement() }
      }
    )

  return (
    <Modale
      ouverte
      taille="large"
      titre={b ? `Bulletin de paie — ${b.enseignant_nom}` : 'Bulletin de paie'}
      surFermeture={surFermeture}
      pied={
        b?.statut !== 'PAYE' ? (
          <>
            <button className="bouton" onClick={surFermeture}>Fermer</button>
            <button
              className="bouton principal"
              disabled={enCours}
              onClick={() =>
                executer(() => appeler('paie.marquer_paye', bulletinId, paiement), {
                  succes: 'Salaire marqué comme payé.',
                  surSucces: () => { donnees.recharger(); surChangement() }
                })
              }
            >Marquer comme payé</button>
          </>
        ) : (
          <button className="bouton principal" onClick={surFermeture}>Fermer</button>
        )
      }
    >
      {donnees.chargement || !b ? (
        <Chargement />
      ) : (
        <>
          <div className="grille c4 mb-16">
            <Indicateur valeur={formaterMontant(b.salaire_base, devise)} etiquette="Salaire de base" />
            <Indicateur valeur={`${b.heures_faites.toFixed(1)} h`} etiquette="Heures pointées" detail={`sur ${b.heures_prevues} h prévues`} />
            <Indicateur valeur={b.jours_absence} etiquette="Jours d’absence" />
            <Indicateur valeur={formaterMontant(b.net_a_payer, devise)} etiquette="Net à payer" />
          </div>

          <h3 className="mb-8">Primes et retenues</h3>
          <Tableau
            compacte
            lignes={donnees.donnees.lignes}
            cleLigne={(l: any) => l.id}
            vide={<EtatVide titre="Aucune prime ni retenue" />}
            colonnes={[
              { cle: 'libelle', titre: 'Libelle' },
              { cle: 'type', titre: 'Type', rendu: (l: any) => (
                <Etiquette variante={l.type === 'PRIME' ? 'succes' : 'danger'}>{l.type}</Etiquette>
              ) },
              { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (l: any) => (
                <b style={{ color: l.type === 'PRIME' ? 'var(--succes)' : 'var(--danger)' }}>
                  {l.type === 'PRIME' ? '+' : '-'}{formaterMontant(l.montant, devise)}
                </b>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (l: any) =>                b.statut !== 'PAYE' ? (                  <button
                    className="bouton discret petit"
                    onClick={() =>
                      executer(() => appeler('paie.supprimer_ligne', l.id), {
                        surSucces: () => { donnees.recharger(); surChangement() }
                      })
                    }
                  >
                    <Trash2 size={15} color="var(--danger)" />
                  </button>
                ) : null }
            ]}
          />

          {b.statut !== 'PAYE' && (
            <>
              <div className="barre-filtres mt-12">
                <Champ label="Libelle">
                  <Selection
                    valeur={ligne.libelle}
                    surChangement={(v) => {
                      const reference = elements.donnees.find((e) => e.libelle === v)
                      setLigne({
                        ...ligne,
                        libelle: v ?? '',
                        type: (reference?.type as 'PRIME' | 'RETENUE') ?? ligne.type
                      })
                    }}
                    vide="Choisir ou saisir…"
                    options={elements.donnees.map((e) => ({ valeur: e.libelle, libelle: e.libelle }))}
                  />
                </Champ>
                <Champ label="Type">
                  <Selection
                    valeur={ligne.type}
                    surChangement={(v) => setLigne({ ...ligne, type: (v ?? 'PRIME') as 'PRIME' | 'RETENUE' })}
                    options={[
                      { valeur: 'PRIME', libelle: 'Prime' },
                      { valeur: 'RETENUE', libelle: 'Retenue' }
                    ]}
                  />
                </Champ>
                <Champ label={`Montant (${devise})`}>
                  <input
                    type="number" style={{ width: 130 }}
                    value={ligne.montant}
                    onChange={(e) => setLigne({ ...ligne, montant: e.target.value })}
                  />
                </Champ>
                <button className="bouton principal" onClick={ajouter}>
                  <Plus size={16} /> Ajouter
                </button>
              </div>

              <h3 className="mt-16 mb-8">Règlement</h3>
              <div className="ligne-champs c3">
                <Champ label="Date de paiement">
                  <input
                    type="date" value={paiement.date_paiement}
                    onChange={(e) => setPaiement({ ...paiement, date_paiement: e.target.value })}
                  />
                </Champ>
                <Champ label="Mode">
                  <Selection
                    valeur={paiement.mode_paiement}
                    surChangement={(v) => setPaiement({ ...paiement, mode_paiement: v ?? 'ESPECES' })}
                    options={MODES_PAIEMENT.filter((m) => m.code !== 'BOURSE').map((m) => ({ valeur: m.code, libelle: m.libelle }))}
                  />
                </Champ>
                <Champ label="Référence">
                  <input value={paiement.reference} onChange={(e) => setPaiement({ ...paiement, reference: e.target.value })} />
                </Champ>
              </div>
            </>
          )}

          {b.statut === 'PAYE' && (
            <Message type="succes">
              Salaire payé le {formaterDate(b.date_paiement)} par {b.mode_paiement}
              {b.reference ? ` (référence ${b.reference})` : ''}.
            </Message>
          )}
        </>
      )}
    </Modale>
  )
}
