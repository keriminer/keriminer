import { useEffect, useState } from 'react'
import {
  Banknote, Calculator, Landmark, Plus, Printer, Receipt, Search, Smartphone, Trash2, Wallet
} from 'lucide-react'
import type { Classe, Frais, Niveau, Paiement, SituationFinanciere } from '@shared/types'
import { useAction, useDebounce, useDocument, useDonnees } from '../hooks'
import { useSession } from '../store/session'
import {
  BarreProgression, Carte, Champ, Chargement, Confirmation, Etiquette, EtatVide,
  Indicateur, Message, Modale, Onglets, Selection, Tableau, useNotifications
} from '../components/ui'
import { appeler } from '../lib/api'
import { MODES_PAIEMENT, OPERATEURS_MOBILE_MONEY, TYPES_FRAIS } from '@shared/constants'
import { aujourdHui, formaterDate, formaterMontant } from '@shared/format'

export default function Finances() {
  const [onglet, setOnglet] = useState('caisse')
  return (
    <>
      <div className="en-tete-page">
        <div>
          <h1>Caisse et scolarité</h1>
          <div className="sous-texte">Encaissements, grille tarifaire et suivi du recouvrement</div>
        </div>
      </div>
      <Onglets
        actif={onglet}
        surChangement={setOnglet}
        onglets={[
          { cle: 'caisse', libelle: 'Encaisser' },
          { cle: 'journal', libelle: 'Journal de caisse' },
          { cle: 'frais', libelle: 'Grille tarifaire' },
          { cle: 'momo', libelle: 'Mobile money' },
          { cle: 'depenses', libelle: 'Dépenses' },
          { cle: 'bilan', libelle: 'Bilan' }
        ]}
      />
      {onglet === 'caisse' && <OngletCaisse />}
      {onglet === 'journal' && <OngletJournal />}
      {onglet === 'frais' && <OngletFrais />}
      {onglet === 'momo' && <OngletMobileMoney />}
      {onglet === 'depenses' && <OngletDepenses />}
      {onglet === 'bilan' && <OngletBilan />}
    </>
  )
}

/* -------------------------------- Encaisser ------------------------------- */

function OngletCaisse() {
  const { etablissement } = useSession()
  const devise = etablissement?.devise_code ?? 'BIF'
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [recherche, setRecherche] = useState('')
  const rechercheRetardee = useDebounce(recherche, 250)
  const [classeId, setClasseId] = useState<number | null>(null)
  const [selection, setSelection] = useState<SituationFinanciere | null>(null)

  const situations = useDonnees<SituationFinanciere[]>(
    'finance.situations', [{ recherche: rechercheRetardee, classe_id: classeId }], []
  )

  return (
    <>
      <div className="barre-filtres">
        <div className="champ recherche">
          <label>Rechercher un élève</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--texte-faible)' }} />
            <input
              autoFocus
              style={{ paddingLeft: 30 }}
              placeholder="Nom, matricule ou classe…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>
        <Champ label="Classe">
          <Selection
            valeur={classeId}
            surChangement={setClasseId}
            vide="Toutes"
            options={classes.donnees.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
      </div>

      <Carte sansMarge>
        {situations.chargement ? (
          <Chargement />
        ) : (
          <Tableau
            lignes={situations.donnees.slice(0, 200)}
            cleLigne={(s) => s.inscription_id}
            surClicLigne={setSelection}
            vide={<EtatVide icone={<Wallet size={42} />} titre="Aucun élève inscrit" />}
            colonnes={[
              { cle: 'nom_complet', titre: 'Élève', rendu: (s) => (
                <div>
                  <div className="gras">{s.nom_complet}</div>
                  <div className="petit discret">
                    <span className="mono">{s.matricule}</span> · {s.classe_libelle}
                  </div>
                </div>
              ) },
              { cle: 'total_du', titre: 'Du', alignement: 'droite', rendu: (s) =>
                formaterMontant(s.total_du - s.total_remise, devise) },
              { cle: 'total_paye', titre: 'Versé', alignement: 'droite', rendu: (s) => (
                <span style={{ color: 'var(--succes)' }}>{formaterMontant(s.total_paye, devise)}</span>
              ) },
              { cle: 'solde', titre: 'Solde', alignement: 'droite', rendu: (s) => (
                <b style={{ color: s.solde > 0 ? 'var(--danger)' : 'var(--succes)' }}>
                  {formaterMontant(s.solde, devise)}
                </b>
              ) },
              { cle: 'taux', titre: 'Avancement', alignement: 'droite', largeur: '150px', rendu: (s) => (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="petit nombre">{s.taux} %</span>
                  <BarreProgression pourcentage={s.taux} />
                </div>
              ) },
              { cle: 'actions', titre: '', alignement: 'droite', rendu: (s) => (
                <button className="bouton petit principal" onClick={(e) => { e.stopPropagation(); setSelection(s) }}>
                  <Banknote size={14} /> Encaisser
                </button>
              ) }
            ]}
          />
        )}
      </Carte>

      {selection && (
        <DossierEleve
          situation={selection}
          devise={devise}
          surFermeture={() => setSelection(null)}
          surPaiement={() => situations.recharger()}
        />
      )}
    </>
  )
}

/* ------------------------------ Dossier eleve ----------------------------- */

function DossierEleve({
  situation, devise, surFermeture, surPaiement
}: {
  situation: SituationFinanciere
  devise: string
  surFermeture: () => void
  surPaiement: () => void
}) {
  const document = useDocument()
  const { executer, enCours } = useAction()
  const { notifier } = useNotifications()
  const detail = useDonnees<any>('finance.situation_eleve', [situation.inscription_id], null)
  const [paiementOuvert, setPaiementOuvert] = useState(false)
  const [remise, setRemise] = useState<any>(null)
  const [annulation, setAnnulation] = useState<Paiement | null>(null)

  const s = detail.donnees?.situation ?? situation
  const solde = s.total_du - s.total_remise - s.total_paye

  return (
    <>
      <Modale
        ouverte={!paiementOuvert && !remise && !annulation}
        taille="large"
        titre={`${situation.nom_complet} — ${situation.classe_libelle}`}
        surFermeture={surFermeture}
        pied={
          <>
            <button className="bouton" onClick={surFermeture}>Fermer</button>
            <button className="bouton principal" onClick={() => setPaiementOuvert(true)}>
              <Banknote size={16} /> Enregistrer un versement
            </button>
          </>
        }
      >
        {detail.chargement ? (
          <Chargement />
        ) : (
          <>
            <div className="grille c3 mb-16">
              <Indicateur valeur={formaterMontant(s.total_du - s.total_remise, devise)} etiquette="Total dû" />
              <Indicateur valeur={formaterMontant(s.total_paye, devise)} etiquette="Déjà versé" couleurIcone="var(--succes)" />
              <Indicateur
                valeur={formaterMontant(Math.max(0, solde), devise)}
                etiquette={solde <= 0 ? 'Solde (à jour)' : 'Reste à payer'}
              />
            </div>

            <h3 className="mb-8">Frais applicables</h3>
            <Tableau
              compacte
              lignes={detail.donnees?.frais ?? []}
              cleLigne={(f: any) => f.eleve_frais_id}
              vide={
                <EtatVide
                  titre="Aucun frais applique"
                  description="Définissez la grille tarifaire puis appliquez-la aux inscrits."
                />
              }
              colonnes={[
                { cle: 'libelle', titre: 'Frais' },
                { cle: 'montant_du', titre: 'Montant', alignement: 'droite', rendu: (f: any) => formaterMontant(f.montant_du, devise) },
                { cle: 'remise', titre: 'Remise', alignement: 'droite', rendu: (f: any) =>
                  f.remise > 0 ? (
                    <span title={f.motif_remise ?? ''} style={{ color: 'var(--info)' }}>
                      -{formaterMontant(f.remise, devise)}
                    </span>
                  ) : '—' },
                { cle: 'paye', titre: 'Payé', alignement: 'droite', rendu: (f: any) => formaterMontant(f.paye, devise) },
                { cle: 'solde', titre: 'Solde', alignement: 'droite', rendu: (f: any) => (
                  <b style={{ color: f.solde > 0 ? 'var(--danger)' : 'var(--succes)' }}>
                    {formaterMontant(f.solde, devise)}
                  </b>
                ) },
                { cle: 'actions', titre: '', alignement: 'droite', rendu: (f: any) => (
                  <button className="bouton discret petit" onClick={() => setRemise(f)} title="Accorder une remise">
                    <Calculator size={15} />
                  </button>
                ) }
              ]}
            />

            <h3 className="mt-16 mb-8">Versements</h3>
            <Tableau
              compacte
              lignes={detail.donnees?.paiements ?? []}
              cleLigne={(p: Paiement) => p.id}
              vide={<EtatVide titre="Aucun versement" description="Les reçus apparaîtront ici." />}
              colonnes={[
                { cle: 'numero_recu', titre: 'N° reçu', rendu: (p: Paiement) => (
                  <span className={`mono petit${p.annule ? '' : ''}`} style={p.annule ? { textDecoration: 'line-through' } : undefined}>
                    {p.numero_recu}
                  </span>
                ) },
                { cle: 'date_paiement', titre: 'Date', rendu: (p: Paiement) => formaterDate(p.date_paiement) },
                { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (p: Paiement) => (
                  <b>{formaterMontant(p.montant, devise)}</b>
                ) },
                { cle: 'mode', titre: 'Mode', rendu: (p: Paiement) => (
                  <Etiquette>{MODES_PAIEMENT.find((m) => m.code === p.mode)?.libelle ?? p.mode}</Etiquette>
                ) },
                { cle: 'caissier', titre: 'Encaissé par' },
                { cle: 'actions', titre: '', alignement: 'droite', rendu: (p: Paiement) => (
                  <div className="entre fin">
                    {p.annule ? (
                      <Etiquette variante="danger">Annule</Etiquette>
                    ) : (
                      <>
                        <button
                          className="bouton discret petit"
                          title="Imprimer le reçu"
                          onClick={() => document.apercu('impression.recu', `reçu-${p.numero_recu}`, p.id)}
                        >
                          <Printer size={15} />
                        </button>
                        <button className="bouton discret petit" title="Annuler" onClick={() => setAnnulation(p)}>
                          <Trash2 size={15} color="var(--danger)" />
                        </button>
                      </>
                    )}
                  </div>
                ) }
              ]}
            />
          </>
        )}
      </Modale>

      {paiementOuvert && (
        <FormulairePaiement
          inscriptionId={situation.inscription_id}
          nomEleve={situation.nom_complet}
          solde={solde}
          devise={devise}
          frais={detail.donnees?.frais ?? []}
          surFermeture={() => setPaiementOuvert(false)}
          surEnregistrement={(paiementId) => {
            setPaiementOuvert(false)
            detail.recharger()
            surPaiement()
            document.apercu('impression.recu', 'recu', paiementId)
          }}
        />
      )}

      {remise && (
        <Modale
          ouverte
          taille="petite"
          titre={`Remise — ${remise.libelle}`}
          surFermeture={() => setRemise(null)}
          pied={
            <>
              <button className="bouton" onClick={() => setRemise(null)}>Annuler</button>
              <button
                className="bouton principal"
                disabled={enCours}
                onClick={() =>
                  executer(
                    () => appeler('finance.remise', remise.eleve_frais_id, Number(remise.nouvelleRemise ?? 0), remise.motif ?? ''),
                    { succes: 'Remise enregistrée.', surSucces: () => { setRemise(null); detail.recharger(); surPaiement() } }
                  )
                }
              >                Enregistrer              </button>
            </>
          }
        >
          <Message type="alerte">            Une remise reduit définitivement le montant dû par l’élève. Elle est tracee dans le journal avec
            son motif et le nom de celui qui l’accorde.          </Message>
          <Champ label={`Montant de la remise (${devise})`}>
            <input
              type="number" min={0} max={remise.montant_du} autoFocus
              defaultValue={remise.remise}
              onChange={(e) => setRemise({ ...remise, nouvelleRemise: e.target.value })}
            />
          </Champ>
          <Champ label="Motif" obligatoire aide="Bourse, cas social, personnel de l’école…">
            <input
              defaultValue={remise.motif_remise ?? ''}
              onChange={(e) => setRemise({ ...remise, motif: e.target.value })}
            />
          </Champ>
        </Modale>
      )}

      <Confirmation
        ouverte={Boolean(annulation)}
        danger
        titre="Annuler ce reçu ?"
        libelleConfirmation="Annuler le reçu"
        message={
          <>
            <p>Le reçu <b>{annulation?.numero_recu}</b> sera marque annule et retire du total encaissé.</p>
            <Champ label="Motif de l’annulation" obligatoire>
              <input id="motif-annulation" autoFocus placeholder="Erreur de saisie, chèque impayé…" />
            </Champ>
          </>
        }
        surAnnulation={() => setAnnulation(null)}
        surConfirmation={() => {
          const champ = window.document.getElementById('motif-annulation') as HTMLInputElement | null
          const motif = champ?.value ?? ''
          if (!motif.trim()) return notifier('alerte', "Le motif d’annulation est obligatoire.")
          executer(() => appeler('finance.annuler_paiement', annulation!.id, motif), {
            succes: 'Reçu annulé.',
            surSucces: () => { setAnnulation(null); detail.recharger(); surPaiement() }
          })
        }}
      />
    </>
  )
}

function FormulairePaiement({
  inscriptionId, nomEleve, solde, devise, frais, surFermeture, surEnregistrement
}: {
  inscriptionId: number
  nomEleve: string
  solde: number
  devise: string
  frais: any[]
  surFermeture: () => void
  surEnregistrement: (paiementId: number) => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState({
    montant: '',
    date_paiement: aujourdHui(),
    mode: 'ESPECES',
    operateur: null as string | null,
    reference: '',
    observation: ''
  })
  const [repartitionManuelle, setRepartitionManuelle] = useState(false)
  const [affectations, setAffectations] = useState<Record<number, string>>({})

  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))
  const totalAffecte = Object.values(affectations).reduce((s, v) => s + (Number(v) || 0), 0)

  const enregistrer = () =>
    executer(
      async () => {
        const montant = Number(d.montant)
        if (!montant || montant <= 0) throw new Error('Saisissez un montant validé.')
        if (d.mode === 'MOBILE_MONEY' && !d.reference.trim()) {
          throw new Error('La référence de la transaction mobile money est obligatoire.')
        }
        const charge: any = {
          inscription_id: inscriptionId,
          montant,
          date_paiement: d.date_paiement,
          mode: d.mode,
          operateur: d.operateur,
          reference: d.reference || null,
          observation: d.observation || null
        }
        if (repartitionManuelle) {
          charge.affectations = Object.entries(affectations)
            .filter(([, v]) => Number(v) > 0)
            .map(([id, v]) => ({ eleve_frais_id: Number(id), montant: Number(v) }))
        }
        const resultat = await appeler<{ paiement_id: number; numero_recu: string }>('finance.encaisser', charge)
        surEnregistrement(resultat.paiement_id)
      },
      { succes: 'Versement enregistré.' }
    )

  return (
    <Modale
      ouverte
      taille="large"
      titre={`Versement — ${nomEleve}`}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={enregistrer} disabled={enCours}>
            <Receipt size={16} /> Encaisser et imprimer le recu
          </button>
        </>
      }
    >
      <div className="ligne-champs c3">
        <Champ label={`Montant versé (${devise})`} obligatoire aide={`Solde actuel : ${formaterMontant(Math.max(0, solde), devise)}`}>
          <input
            autoFocus type="number" min={1}
            value={d.montant}
            onChange={(e) => maj({ montant: e.target.value })}
            style={{ fontSize: 18, fontWeight: 600 }}
          />
        </Champ>
        <Champ label="Date">
          <input type="date" value={d.date_paiement} onChange={(e) => maj({ date_paiement: e.target.value })} max={aujourdHui()} />
        </Champ>
        <Champ label="Mode de paiement">
          <Selection
            valeur={d.mode}
            surChangement={(v) => maj({ mode: v ?? 'ESPECES', operateur: null })}
            options={MODES_PAIEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
          />
        </Champ>
      </div>

      {solde > 0 && (
        <div className="enveloppe mb-12">
          <span className="doux petit" style={{ alignSelf: 'center' }}>Raccourcis :</span>
          {[0.25, 0.5, 1].map((part) => (
            <button
              key={part}
              className="bouton petit"
              onClick={() => maj({ montant: String(Math.round(solde * part)) })}
            >
              {part === 1 ? 'Solde entier' : `${part * 100} %`} — {formaterMontant(Math.round(solde * part), devise)}
            </button>
          ))}
        </div>
      )}

      {d.mode === 'MOBILE_MONEY' && (
        <div className="ligne-champs">
          <Champ label="Opérateur" obligatoire>
            <Selection
              valeur={d.operateur}
              surChangement={(v) => maj({ operateur: v })}
              vide="Choisir…"
              options={OPERATEURS_MOBILE_MONEY.map((o) => ({ valeur: o.code, libelle: o.libelle }))}
            />
          </Champ>
          <Champ label="Référence de la transaction" obligatoire aide="Code reçu par SMS de l’opérateur">
            <input value={d.reference} onChange={(e) => maj({ reference: e.target.value })} className="mono" />
          </Champ>
        </div>
      )}

      {(d.mode === 'BANQUE' || d.mode === 'CHEQUE') && (
        <Champ label={d.mode === 'CHEQUE' ? 'Numéro du chèque' : 'Référence du bordereau'}>
          <input value={d.reference} onChange={(e) => maj({ reference: e.target.value })} />
        </Champ>
      )}

      <label className="case-a-cocher mb-12">
        <input
          type="checkbox"
          checked={repartitionManuelle}
          onChange={(e) => setRepartitionManuelle(e.target.checked)}
        />        Repartir manuellement le versement entre les frais      </label>

      {repartitionManuelle ? (
        <>
          <Tableau
            compacte
            lignes={frais.filter((f: any) => f.solde > 0)}
            cleLigne={(f: any) => f.eleve_frais_id}
            colonnes={[
              { cle: 'libelle', titre: 'Frais' },
              { cle: 'solde', titre: 'Reste dû', alignement: 'droite', rendu: (f: any) => formaterMontant(f.solde, devise) },
              { cle: 'affectation', titre: 'A imputer', alignement: 'droite', largeur: '160px', rendu: (f: any) => (
                <input
                  type="number" min={0} max={f.solde} style={{ width: 130, textAlign: 'right' }}
                  value={affectations[f.eleve_frais_id] ?? ''}
                  onChange={(e) => setAffectations({ ...affectations, [f.eleve_frais_id]: e.target.value })}
                />
              ) }
            ]}
          />
          <div className="entre espace mt-8">
            <span className="doux">Total réparti</span>
            <b style={{ color: totalAffecte === Number(d.montant) ? 'var(--succes)' : 'var(--danger)' }}>
              {formaterMontant(totalAffecte, devise)} / {formaterMontant(Number(d.montant) || 0, devise)}
            </b>
          </div>
        </>
      ) : (
        <Message type="info">          Sans répartition manuelle, le versement solde d’abord les frais d’inscription, puis la scolarité,
          puis les autres frais par ordre d’echeance.        </Message>
      )}

      <Champ label="Observation">
        <input value={d.observation} onChange={(e) => maj({ observation: e.target.value })} />
      </Champ>
    </Modale>
  )
}

/* ----------------------------- Journal de caisse -------------------------- */

function OngletJournal() {
  const { etablissement } = useSession()
  const document = useDocument()
  const devise = etablissement?.devise_code ?? 'BIF'
  const [debut, setDebut] = useState(aujourdHui())
  const [fin, setFin] = useState(aujourdHui())
  const journal = useDonnees<any>('finance.journal_caisse', [debut, fin], { paiements: [], total: 0, par_mode: [] })

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Du"><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ>
        <Champ label="Au"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></Champ>
        <div className="enveloppe">
          <button className="bouton petit" onClick={() => { setDebut(aujourdHui()); setFin(aujourdHui()) }}>Aujourd’hui</button>
          <button
            className="bouton petit"
            onClick={() => { setDebut(`${aujourdHui().slice(0, 7)}-01`); setFin(aujourdHui()) }}
          >            Ce mois          </button>
        </div>
        <button className="bouton principal pousse" onClick={() => document.apercu('impression.journal_caisse', 'journal-caisse', debut, fin)}>
          <Printer size={16} /> Imprimer
        </button>
      </div>

      <div className="grille c4 mb-16">
        <Indicateur
          icone={<Wallet size={20} />}
          valeur={formaterMontant(journal.donnees.total, devise)}
          etiquette="Total encaissé"
          detail={`${journal.donnees.paiements.length} opération(s)`}
        />
        {journal.donnees.par_mode.slice(0, 3).map((m: any) => (
          <Indicateur
            key={m.mode}
            valeur={formaterMontant(m.montant, devise)}
            etiquette={MODES_PAIEMENT.find((x) => x.code === m.mode)?.libelle ?? m.mode}
            detail={`${m.nombre} opération(s)`}
          />
        ))}
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={journal.donnees.paiements}
          cleLigne={(p: Paiement) => p.id}
          vide={<EtatVide titre="Aucune opération" description="Aucun encaissement sur la période choisie." />}
          colonnes={[
            { cle: 'numero_recu', titre: 'N° reçu', rendu: (p: Paiement) => <span className="mono petit">{p.numero_recu}</span> },
            { cle: 'date_paiement', titre: 'Date', rendu: (p: Paiement) => formaterDate(p.date_paiement) },
            { cle: 'eleve_nom', titre: 'Élève', rendu: (p: Paiement) => (
              <div>
                <div className="gras">{p.eleve_nom}</div>
                <div className="petit discret">{p.classe_libelle}</div>
              </div>
            ) },
            { cle: 'mode', titre: 'Mode', rendu: (p: Paiement) => (
              <Etiquette>{MODES_PAIEMENT.find((m) => m.code === p.mode)?.libelle ?? p.mode}</Etiquette>
            ) },
            { cle: 'caissier', titre: 'Caissier' },
            { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (p: Paiement) => (
              <b style={p.annule ? { textDecoration: 'line-through', color: 'var(--texte-faible)' } : undefined}>
                {formaterMontant(p.montant, devise)}
              </b>
            ) }
          ]}
        />
      </Carte>
    </>
  )
}

/* ------------------------------ Grille tarifaire -------------------------- */

function OngletFrais() {
  const { etablissement } = useSession()
  const { executer } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'
  const frais = useDonnees<Frais[]>('frais.liste', [], [])
  const niveaux = useDonnees<Niveau[]>('niveau.liste', [], [])
  const classes = useDonnees<Classe[]>('classe.liste', [], [])
  const [edition, setEdition] = useState<Frais | null | 'nouveau'>(null)
  const [suppression, setSuppression] = useState<Frais | null>(null)

  const appliquer = () =>
    executer(
      async () => {
        const resultat = await appeler<{ inscriptions: number; lignes: number }>('frais.appliquer_grille')
        return resultat
      },
      { succes: 'Grille appliquée à tous les élèves inscrits.' }
    )

  return (
    <>
      <div className="entre espace mb-12">
        <div className="doux">
          {frais.donnees.length} ligne(s) tarifaire(s) · total annuel type :{' '}
          <b>{formaterMontant(frais.donnees.filter((f) => !f.classe_id && !f.niveau_id).reduce((s, f) => s + f.montant, 0), devise)}</b>
        </div>
        <div className="enveloppe">
          <button className="bouton" onClick={appliquer}>
            <Calculator size={16} /> Appliquer aux inscrits
          </button>
          <button className="bouton principal" onClick={() => setEdition('nouveau')}>
            <Plus size={16} /> Nouveau frais
          </button>
        </div>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={frais.donnees}
          cleLigne={(f) => f.id}
          vide={
            <EtatVide
              titre="Aucun frais défini"
              description="Définissez les frais d’inscription, de scolarité et les frais annexes de votre établissement."
              action={<button className="bouton principal" onClick={() => setEdition('nouveau')}><Plus size={16} /> Créer</button>}
            />
          }
          colonnes={[
            { cle: 'libelle', titre: 'Libelle', rendu: (f) => (
              <div>
                <div className="gras">{f.libelle}</div>
                <div className="petit discret">
                  {f.niveau_libelle ? `Niveau : ${f.niveau_libelle}` : f.classe_libelle ? `Classe : ${f.classe_libelle}` : 'Tous les élèves'}
                </div>
              </div>
            ) },
            { cle: 'type', titre: 'Type', rendu: (f) => (
              <Etiquette>{TYPES_FRAIS.find((t) => t.code === f.type)?.libelle ?? f.type}</Etiquette>
            ) },
            { cle: 'periodicite', titre: 'Périodicité' },
            { cle: 'obligatoire', titre: 'Obligatoire', alignement: 'centre', rendu: (f) =>
              f.obligatoire ? <Etiquette variante="primaire">Oui</Etiquette> : 'Non' },
            { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (f) => (
              <b>{formaterMontant(f.montant, devise)}</b>
            ) },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (f) => (
              <div className="entre fin">
                <button className="bouton discret petit" onClick={() => setEdition(f)}>Modifier</button>
                <button className="bouton discret petit" onClick={() => setSuppression(f)}>
                  <Trash2 size={15} color="var(--danger)" />
                </button>
              </div>
            ) }
          ]}
        />
      </Carte>

      {edition && (
        <FormulaireFrais
          frais={edition === 'nouveau' ? null : edition}
          niveaux={niveaux.donnees}
          classes={classes.donnees}
          devise={devise}
          surFermeture={() => setEdition(null)}
          surEnregistrement={() => { setEdition(null); frais.recharger() }}
        />
      )}

      <Confirmation
        ouverte={Boolean(suppression)}
        danger
        titre="Supprimer ce frais ?"
        message={<>« {suppression?.libelle} » sera retire de la grille tarifaire.</>}
        surAnnulation={() => setSuppression(null)}
        surConfirmation={() =>
          executer(() => appeler('frais.supprimer', suppression!.id), {
            succes: 'Frais supprimé.',
            surSucces: () => { setSuppression(null); frais.recharger() }
          })
        }
      />
    </>
  )
}

function FormulaireFrais({
  frais, niveaux, classes, devise, surFermeture, surEnregistrement
}: {
  frais: Frais | null
  niveaux: Niveau[]
  classes: Classe[]
  devise: string
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [d, setD] = useState({
    libelle: frais?.libelle ?? '',
    type: frais?.type ?? 'SCOLARITE',
    montant: frais?.montant ?? 0,
    obligatoire: frais?.obligatoire ?? 1,
    periodicite: frais?.periodicite ?? 'ANNUEL',
    portee: frais?.classe_id ? 'CLASSE' : frais?.niveau_id ? 'NIVEAU' : 'TOUS',
    niveau_id: frais?.niveau_id ?? null,
    classe_id: frais?.classe_id ?? null,
    date_echeance: frais?.date_echeance ?? ''
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  const enregistrer = () =>
    executer(
      async () => {
        if (!d.libelle.trim()) throw new Error('Le libelle est obligatoire.')
        if (!d.montant || d.montant <= 0) throw new Error('Le montant doit être supérieur à zéro.')
        const charge = {
          libelle: d.libelle,
          type: d.type,
          montant: Number(d.montant),
          obligatoire: d.obligatoire,
          periodicite: d.periodicite,
          niveau_id: d.portee === 'NIVEAU' ? d.niveau_id : null,
          classe_id: d.portee === 'CLASSE' ? d.classe_id : null,
          date_echeance: d.date_echeance || null
        }
        if (frais) await appeler('frais.modifier', frais.id, charge)
        else await appeler('frais.creer', charge)
      },
      { succes: 'Frais enregistré.', surSucces: surEnregistrement }
    )

  return (
    <Modale
      ouverte
      titre={frais ? `Modifier — ${frais.libelle}` : 'Nouveau frais'}
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button className="bouton principal" onClick={enregistrer} disabled={enCours}>Enregistrer</button>
        </>
      }
    >
      <div className="ligne-champs">
        <Champ label="Libelle" obligatoire>
          <input autoFocus value={d.libelle} onChange={(e) => maj({ libelle: e.target.value })} placeholder="Scolarité 1er trimestre" />
        </Champ>
        <Champ label="Type">
          <Selection
            valeur={d.type}
            surChangement={(v) => maj({ type: v ?? 'SCOLARITE' })}
            options={TYPES_FRAIS.map((t) => ({ valeur: t.code, libelle: t.libelle }))}
          />
        </Champ>
      </div>
      <div className="ligne-champs c3">
        <Champ label={`Montant (${devise})`} obligatoire>
          <input type="number" min={0} value={d.montant} onChange={(e) => maj({ montant: Number(e.target.value) })} />
        </Champ>
        <Champ label="Périodicité">
          <Selection
            valeur={d.periodicite}
            surChangement={(v) => maj({ periodicite: v ?? 'ANNUEL' })}
            options={[
              { valeur: 'ANNUEL', libelle: 'Annuel' },
              { valeur: 'PERIODE', libelle: 'Par période' },
              { valeur: 'MENSUEL', libelle: 'Mensuel' },
              { valeur: 'UNIQUE', libelle: 'Ponctuel' }
            ]}
          />
        </Champ>
        <Champ label="Echeance">
          <input type="date" value={d.date_echeance} onChange={(e) => maj({ date_echeance: e.target.value })} />
        </Champ>
      </div>
      <Champ label="S’applique a">
        <Selection
          valeur={d.portee}
          surChangement={(v) => maj({ portee: v ?? 'TOUS' })}
          options={[
            { valeur: 'TOUS', libelle: 'Tous les élèves' },
            { valeur: 'NIVEAU', libelle: 'Un niveau précis' },
            { valeur: 'CLASSE', libelle: 'Une classe précise' }
          ]}
        />
      </Champ>
      {d.portee === 'NIVEAU' && (
        <Champ label="Niveau" obligatoire>
          <Selection
            valeur={d.niveau_id}
            surChangement={(v) => maj({ niveau_id: v })}
            vide="Choisir…"
            options={niveaux.map((n) => ({ valeur: n.id, libelle: n.libelle }))}
          />
        </Champ>
      )}
      {d.portee === 'CLASSE' && (
        <Champ label="Classe" obligatoire>
          <Selection
            valeur={d.classe_id}
            surChangement={(v) => maj({ classe_id: v })}
            vide="Choisir…"
            options={classes.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
          />
        </Champ>
      )}
      <label className="case-a-cocher">
        <input
          type="checkbox"
          checked={Boolean(d.obligatoire)}
          onChange={(e) => maj({ obligatoire: e.target.checked ? 1 : 0 })}
        />        Frais obligatoire (compte dans le solde de l’élève)      </label>
    </Modale>
  )
}

/* ------------------------------- Mobile money ----------------------------- */

function OngletMobileMoney() {
  const { etablissement } = useSession()
  const { executer } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'
  const transactions = useDonnees<any[]>('momo.liste', [''], [])
  const situations = useDonnees<SituationFinanciere[]>('finance.situations', [{}], [])
  const [saisieOuverte, setSaisieOuverte] = useState(false)
  const [rapprochement, setRapprochement] = useState<any>(null)

  return (
    <>
      <Message type="info">        Deux facons de travailler : saisir la référence du SMS reçu de l’opérateur, ou importer le relevé
        fourni par celui-ci. Une transaction ne devient un reçu qu’après avoir été rattachee à un élève.      </Message>

      <div className="entre espace mb-12">
        <div className="doux">
          {transactions.donnees.filter((t) => t.statut === 'EN_ATTENTE').length} transaction(s) en attente de rapprochement
        </div>
        <button className="bouton principal" onClick={() => setSaisieOuverte(true)}>
          <Smartphone size={16} /> Saisir une transaction
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={transactions.donnees}
          cleLigne={(t) => t.id}
          vide={<EtatVide icone={<Smartphone size={42} />} titre="Aucune transaction enregistrée" />}
          colonnes={[
            { cle: 'reference', titre: 'Référence', rendu: (t) => <span className="mono petit">{t.reference}</span> },
            { cle: 'operateur', titre: 'Opérateur', rendu: (t) => (
              <Etiquette>{OPERATEURS_MOBILE_MONEY.find((o) => o.code === t.operateur)?.libelle ?? t.operateur}</Etiquette>
            ) },
            { cle: 'telephone', titre: 'Numéro payeur', rendu: (t) => <span className="mono petit">{t.telephone ?? '—'}</span> },
            { cle: 'date_transaction', titre: 'Date', rendu: (t) => formaterDate(t.date_transaction) },
            { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (t) => (
              <b>{formaterMontant(t.montant, devise)}</b>
            ) },
            { cle: 'statut', titre: 'Etat', rendu: (t) =>
              t.statut === 'RAPPROCHE' ? (
                <div>
                  <Etiquette variante="succes">Rapproché</Etiquette>
                  <div className="petit discret mt-8">{t.eleve_nom}</div>
                </div>
              ) : t.statut === 'REJETE' ? (
                <Etiquette variante="danger">Rejeté</Etiquette>
              ) : (
                <div>
                  <Etiquette variante="alerte">En attente</Etiquette>
                  {t.suggestion_eleve && (
                    <div className="petit discret mt-8">Suggestion : {t.suggestion_eleve}</div>
                  )}
                </div>
              ) },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (t) =>
              t.statut === 'EN_ATTENTE' ? (
                <div className="entre fin">
                  {t.suggestion_inscription_id && (
                    <button
                      className="bouton petit"
                      onClick={() =>
                        executer(() => appeler('momo.rapprocher', t.id, t.suggestion_inscription_id), {
                          succes: 'Transaction rapprochée et reçu généré.',
                          surSucces: () => { transactions.recharger(); situations.recharger() }
                        })
                      }
                    >                      Valider la suggestion                    </button>
                  )}
                  <button className="bouton petit principal" onClick={() => setRapprochement(t)}>                    Rapprocher                  </button>
                </div>
              ) : null }
          ]}
        />
      </Carte>

      {saisieOuverte && (
        <SaisieTransaction
          devise={devise}
          surFermeture={() => setSaisieOuverte(false)}
          surEnregistrement={() => { setSaisieOuverte(false); transactions.recharger() }}
        />
      )}

      {rapprochement && (
        <Modale
          ouverte
          titre="Rattacher la transaction à un élève"
          surFermeture={() => setRapprochement(null)}
          pied={<button className="bouton" onClick={() => setRapprochement(null)}>Annuler</button>}
        >
          <div className="doux mb-12">
            Transaction <b className="mono">{rapprochement.reference}</b> de{' '}
            <b>{formaterMontant(rapprochement.montant, devise)}</b>
          </div>
          <Champ label="Élève">
            <Selection
              valeur={null}
              surChangement={(v) =>
                v &&
                executer(() => appeler('momo.rapprocher', rapprochement.id, v), {
                  succes: 'Transaction rapprochée et reçu généré.',
                  surSucces: () => { setRapprochement(null); transactions.recharger(); situations.recharger() }
                })
              }
              vide="Choisir un élève…"
              options={situations.donnees.map((s) => ({
                valeur: s.inscription_id,
                libelle: `${s.nom_complet} — ${s.classe_libelle} (solde ${formaterMontant(s.solde, devise)})`
              }))}
            />
          </Champ>
        </Modale>
      )}
    </>
  )
}

function SaisieTransaction({
  devise, surFermeture, surEnregistrement
}: {
  devise: string
  surFermeture: () => void
  surEnregistrement: () => void
}) {
  const { executer, enCours } = useAction()
  const [sms, setSms] = useState('')
  const [d, setD] = useState({
    operateur: 'LUMICASH',
    reference: '',
    telephone: '',
    montant: '',
    date_transaction: aujourdHui()
  })
  const maj = (c: Partial<typeof d>) => setD((v) => ({ ...v, ...c }))

  const analyser = async () => {
    if (!sms.trim()) return
    const resultat = await appeler<any>('momo.analyser_sms', sms)
    maj({
      reference: resultat.reference ?? d.reference,
      montant: resultat.montant ? String(resultat.montant) : d.montant,
      telephone: resultat.telephone ?? d.telephone
    })
  }

  return (
    <Modale
      ouverte
      titre="Nouvelle transaction mobile money"
      surFermeture={surFermeture}
      pied={
        <>
          <button className="bouton" onClick={surFermeture}>Annuler</button>
          <button
            className="bouton principal"
            disabled={enCours}
            onClick={() =>
              executer(
                async () => {
                  if (!d.reference.trim()) throw new Error('La référence est obligatoire.')
                  if (!Number(d.montant)) throw new Error('Le montant est obligatoire.')
                  await appeler('momo.enregistrer', { ...d, montant: Number(d.montant) })
                },
                { succes: 'Transaction enregistrée.', surSucces: surEnregistrement }
              )
            }
          >            Enregistrer          </button>
        </>
      }
    >
      <Champ label="Coller le SMS de l’opérateur" aide="L’application tente d’en extraire la référence et le montant">
        <textarea rows={3} value={sms} onChange={(e) => setSms(e.target.value)} onBlur={analyser} />
      </Champ>
      <div className="ligne-champs">
        <Champ label="Opérateur">
          <Selection
            valeur={d.operateur}
            surChangement={(v) => maj({ operateur: v ?? 'LUMICASH' })}
            options={OPERATEURS_MOBILE_MONEY.map((o) => ({ valeur: o.code, libelle: o.libelle }))}
          />
        </Champ>
        <Champ label="Référence" obligatoire>
          <input value={d.reference} onChange={(e) => maj({ reference: e.target.value })} className="mono" />
        </Champ>
      </div>
      <div className="ligne-champs c3">
        <Champ label={`Montant (${devise})`} obligatoire>
          <input type="number" value={d.montant} onChange={(e) => maj({ montant: e.target.value })} />
        </Champ>
        <Champ label="Numéro du payeur">
          <input value={d.telephone} onChange={(e) => maj({ telephone: e.target.value })} />
        </Champ>
        <Champ label="Date">
          <input type="date" value={d.date_transaction} onChange={(e) => maj({ date_transaction: e.target.value })} />
        </Champ>
      </div>
    </Modale>
  )
}

/* --------------------------------- Depenses ------------------------------- */

function OngletDepenses() {
  const { etablissement } = useSession()
  const { executer } = useAction()
  const devise = etablissement?.devise_code ?? 'BIF'
  const depenses = useDonnees<any[]>('depense.liste', [], [])
  const [d, setD] = useState({ libelle: '', categorie: '', montant: '', date_depense: aujourdHui(), beneficiaire: '' })

  return (
    <>
      <div className="barre-filtres">
        <Champ label="Libelle">
          <input value={d.libelle} onChange={(e) => setD({ ...d, libelle: e.target.value })} placeholder="Achat de craie" />
        </Champ>
        <Champ label="Catégorie">
          <input value={d.categorie} onChange={(e) => setD({ ...d, categorie: e.target.value })} placeholder="Fournitures" />
        </Champ>
        <Champ label="Beneficiaire">
          <input value={d.beneficiaire} onChange={(e) => setD({ ...d, beneficiaire: e.target.value })} />
        </Champ>
        <Champ label={`Montant (${devise})`}>
          <input type="number" style={{ width: 130 }} value={d.montant} onChange={(e) => setD({ ...d, montant: e.target.value })} />
        </Champ>
        <Champ label="Date">
          <input type="date" value={d.date_depense} onChange={(e) => setD({ ...d, date_depense: e.target.value })} />
        </Champ>
        <button
          className="bouton principal"
          onClick={() =>
            executer(
              async () => {
                if (!d.libelle.trim() || !Number(d.montant)) throw new Error('Libelle et montant obligatoires.')
                await appeler('depense.creer', { ...d, montant: Number(d.montant) })
              },
              {
                succes: 'Dépense enregistrée.',
                surSucces: () => { setD({ ...d, libelle: '', montant: '', beneficiaire: '' }); depenses.recharger() }
              }
            )
          }
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <Carte sansMarge>
        <Tableau
          lignes={depenses.donnees}
          cleLigne={(x) => x.id}
          vide={<EtatVide icone={<Landmark size={42} />} titre="Aucune dépense enregistrée" />}
          colonnes={[
            { cle: 'date_depense', titre: 'Date', rendu: (x) => formaterDate(x.date_depense) },
            { cle: 'libelle', titre: 'Libelle' },
            { cle: 'categorie', titre: 'Catégorie', rendu: (x) => (x.categorie ? <Etiquette>{x.categorie}</Etiquette> : '—') },
            { cle: 'beneficiaire', titre: 'Beneficiaire' },
            { cle: 'saisi_par_nom', titre: 'Saisi par' },
            { cle: 'montant', titre: 'Montant', alignement: 'droite', rendu: (x) => (
              <b style={{ color: 'var(--danger)' }}>{formaterMontant(x.montant, devise)}</b>
            ) },
            { cle: 'actions', titre: '', alignement: 'droite', rendu: (x) => (
              <button
                className="bouton discret petit"
                onClick={() =>
                  executer(() => appeler('depense.supprimer', x.id), { succes: 'Dépense supprimée.', surSucces: depenses.recharger })
                }
              >
                <Trash2 size={15} color="var(--danger)" />
              </button>
            ) }
          ]}
        />
      </Carte>
    </>
  )
}

/* ---------------------------------- Bilan --------------------------------- */

function OngletBilan() {
  const { etablissement } = useSession()
  const devise = etablissement?.devise_code ?? 'BIF'
  const bilan = useDonnees<any>('finance.bilan', [], null)

  if (bilan.chargement) return <Chargement />
  const b = bilan.donnees
  if (!b) return <EtatVide titre="Bilan indisponible" />

  return (
    <>
      <div className="grille c4 mb-16">
        <Indicateur icone={<Wallet size={20} />} valeur={formaterMontant(b.recettes, devise)} etiquette="Recettes" />
        <Indicateur
          icone={<Landmark size={20} />}
          valeur={formaterMontant(b.depenses, devise)}
          etiquette="Dépenses"
          couleurFond="var(--danger-fond)"
          couleurIcone="var(--danger)"
        />
        <Indicateur
          valeur={formaterMontant(b.solde, devise)}
          etiquette="Solde de trésorerie"
          couleurFond={b.solde >= 0 ? 'var(--succes-fond)' : 'var(--danger-fond)'}
          couleurIcone={b.solde >= 0 ? 'var(--succes)' : 'var(--danger)'}
        />
        <Indicateur
          valeur={`${b.taux_recouvrement} %`}
          etiquette="Taux de recouvrement"
          detail={`${formaterMontant(b.impayes, devise)} restent à recouvrer`}
        />
      </div>

      <Carte titre="Recouvrement par type de frais" sansMarge>
        <Tableau
          lignes={b.par_type_frais}
          cleLigne={(x: any) => x.type}
          colonnes={[
            { cle: 'type', titre: 'Type de frais', rendu: (x: any) => (
              TYPES_FRAIS.find((t) => t.code === x.type)?.libelle ?? x.type
            ) },
            { cle: 'attendu', titre: 'Attendu', alignement: 'droite', rendu: (x: any) => formaterMontant(x.attendu, devise) },
            { cle: 'encaisse', titre: 'Encaissé', alignement: 'droite', rendu: (x: any) => formaterMontant(x.encaisse, devise) },
            { cle: 'reste', titre: 'Reste', alignement: 'droite', rendu: (x: any) => (
              <b style={{ color: 'var(--danger)' }}>{formaterMontant(x.attendu - x.encaisse, devise)}</b>
            ) },
            { cle: 'taux', titre: 'Taux', alignement: 'droite', largeur: '150px', rendu: (x: any) => {
              const taux = x.attendu > 0 ? (x.encaisse / x.attendu) * 100 : 0
              return (
                <div className="entre fin" style={{ gap: 8 }}>
                  <span className="petit nombre">{taux.toFixed(0)} %</span>
                  <BarreProgression pourcentage={taux} />
                </div>
              )
            } }
          ]}
        />
      </Carte>
    </>
  )
}
