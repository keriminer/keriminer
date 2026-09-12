import { base } from '../db'
import type { StatsTableauBord } from '@shared/types'
import { anneeActive, exigerAnneeActive, listerPeriodes } from './annee'
import { bilanFinancier, listerSituations } from './finances'
import { calculerClasse } from './notes'
import { aujourdHui } from '@shared/format'

/** Tableau de bord de la direction : ce qu’il faut voir en ouvrant le logiciel. */
export function tableauBord(): StatsTableauBord {
  const annee = anneeActive()
  if (!annee) {
    throw new Error('Aucune annee scolaire active.')
  }
  const date = aujourdHui()

  const effectifs = base()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN e.sexe = 'M' THEN 1 ELSE 0 END) AS garcons,
              SUM(CASE WHEN e.sexe = 'F' THEN 1 ELSE 0 END) AS filles
       FROM inscription i JOIN eleve e ON e.id = i.eleve_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'`
    )
    .get(annee.id) as { total: number; garcons: number; filles: number }

  const nbClasses = (
    base().prepare('SELECT COUNT(*) n FROM classe WHERE annee_id = ?').get(annee.id) as { n: number }
  ).n
  const nbEnseignants = (
    base().prepare("SELECT COUNT(*) n FROM enseignant WHERE statut = 'ACTIF'").get() as { n: number }
  ).n
  const nbPensionnaires = (
    base().prepare('SELECT COUNT(*) n FROM pensionnaire WHERE date_sortie IS NULL').get() as {
      n: number
    }
  ).n

  const finances = bilanFinancier(annee.id)

  const presences = base()
    .prepare(
      `SELECT
         SUM(CASE WHEN statut IN ('PRESENT','RETARD') THEN 1 ELSE 0 END) AS presents,
         SUM(CASE WHEN statut = 'ABSENT' THEN 1 ELSE 0 END) AS absents
       FROM presence_eleve WHERE date_presence = ?`
    )
    .get(date) as { presents: number | null; absents: number | null }

  const enseignantsPointes = (
    base()
      .prepare(
        "SELECT COUNT(*) n FROM pointage_enseignant WHERE date_pointage = ? AND statut IN ('PRESENT','RETARD')"
      )
      .get(date) as { n: number }
  ).n

  const effectifParNiveau = base()
    .prepare(
      `SELECT n.libelle,
              SUM(CASE WHEN e.sexe = 'M' THEN 1 ELSE 0 END) AS garcons,
              SUM(CASE WHEN e.sexe = 'F' THEN 1 ELSE 0 END) AS filles,
              COUNT(*) AS total
       FROM inscription i
       JOIN eleve e ON e.id = i.eleve_id
       JOIN classe c ON c.id = i.classe_id
       JOIN niveau n ON n.id = c.niveau_id
       WHERE i.annee_id = ? AND i.statut = 'INSCRIT'
       GROUP BY n.id ORDER BY n.ordre`
    )
    .all(annee.id) as any[]

  const topImpayes = listerSituations({ seulement_impayes: true }).slice(0, 10)

  const totalPresences = (presences.presents ?? 0) + (presences.absents ?? 0)
  const alertes = construireAlertes(annee.id, finances, topImpayes.length, enseignantsPointes, nbEnseignants)

  return {
    effectif_total: effectifs.total ?? 0,
    effectif_garcons: effectifs.garcons ?? 0,
    effectif_filles: effectifs.filles ?? 0,
    nb_classes: nbClasses,
    nb_enseignants: nbEnseignants,
    nb_pensionnaires: nbPensionnaires,
    recettes_total: finances.recettes,
    attendu_total: finances.attendu,
    impayes_total: finances.impayes,
    taux_recouvrement: finances.taux_recouvrement,
    presents_jour: presences.presents ?? 0,
    absents_jour: presences.absents ?? 0,
    taux_presence_jour:
      totalPresences > 0 ? Math.round(((presences.presents ?? 0) / totalPresences) * 1000) / 10 : 0,
    enseignants_pointes: enseignantsPointes,
    effectif_par_niveau: effectifParNiveau,
    recettes_par_mois: finances.par_mois.map((m) => ({ mois: m.mois, montant: m.recettes })),
    top_impayes: topImpayes,
    alertes
  }
}

/** Signale a la direction ce qui demande une decision aujourd’hui. */
function construireAlertes(
  anneeId: number,
  finances: { taux_recouvrement: number },
  nbImpayes: number,
  enseignantsPointes: number,
  nbEnseignants: number
): { niveau: string; message: string; lien?: string }[] {
  const alertes: { niveau: string; message: string; lien?: string }[] = []

  const classesSansTitulaire = (
    base()
      .prepare('SELECT COUNT(*) n FROM classe WHERE annee_id = ? AND titulaire_id IS NULL')
      .get(anneeId) as { n: number }
  ).n
  if (classesSansTitulaire > 0) {
    alertes.push({
      niveau: 'info',
      message: `${classesSansTitulaire} classe(s) sans titulaire designe.`,
      lien: '/classes'
    })
  }

  const matieresSansEnseignant = (
    base()
      .prepare(
        `SELECT COUNT(*) n FROM classe_matiere cm JOIN classe c ON c.id = cm.classe_id
         WHERE c.annee_id = ? AND cm.enseignant_id IS NULL`
      )
      .get(anneeId) as { n: number }
  ).n
  if (matieresSansEnseignant > 0) {
    alertes.push({
      niveau: 'avertissement',
      message: `${matieresSansEnseignant} matiere(s) attribuee(s) a aucun enseignant.`,
      lien: '/classes'
    })
  }

  const elevesSansClasse = (
    base()
      .prepare(
        `SELECT COUNT(*) n FROM eleve e
         WHERE e.statut = 'ACTIF'
           AND NOT EXISTS (SELECT 1 FROM inscription i WHERE i.eleve_id = e.id AND i.annee_id = ?)`
      )
      .get(anneeId) as { n: number }
  ).n
  if (elevesSansClasse > 0) {
    alertes.push({
      niveau: 'avertissement',
      message: `${elevesSansClasse} eleve(s) actif(s) non inscrit(s) cette annee.`,
      lien: '/eleves'
    })
  }

  if (finances.taux_recouvrement < 50 && nbImpayes > 0) {
    alertes.push({
      niveau: 'urgent',
      message: `Taux de recouvrement de ${finances.taux_recouvrement} % : pensez a lancer une relance SMS.`,
      lien: '/finances/impayes'
    })
  }

  if (nbEnseignants > 0 && enseignantsPointes === 0) {
    alertes.push({
      niveau: 'info',
      message: "Aucun pointage enseignant enregistre aujourd’hui.",
      lien: '/pointage'
    })
  }

  const smsEnAttente = (
    base().prepare("SELECT COUNT(*) n FROM message_sms WHERE statut = 'EN_ATTENTE'").get() as {
      n: number
    }
  ).n
  if (smsEnAttente > 0) {
    alertes.push({
      niveau: 'info',
      message: `${smsEnAttente} SMS en attente d’envoi.`,
      lien: '/sms'
    })
  }

  return alertes
}

/* ------------------------- Rapports pour la tutelle ---------------------- */

/**
 * Etat statistique destine a l’autorite de tutelle (DCE, DPE, inspection).
 * Reprend les indicateurs habituellement demandes : effectifs par niveau et par
 * sexe, redoublants, taux de reussite, encadrement.
 */
export function rapportTutelle(anneeId?: number): {
  annee: string
  effectifs: {
    niveau: string
    cycle: string
    classes: number
    garcons: number
    filles: number
    total: number
    redoublants: number
    abandons: number
  }[]
  totaux: { classes: number; garcons: number; filles: number; total: number; redoublants: number; abandons: number }
  encadrement: { enseignants: number; hommes: number; femmes: number; ratio_eleves_enseignant: number }
  reussite: { niveau: string; evalues: number; reussites: number; taux: number }[]
} {
  const id = anneeId ?? exigerAnneeActive().id
  const annee = base().prepare('SELECT libelle FROM annee_scolaire WHERE id = ?').get(id) as {
    libelle: string
  }

  const effectifs = base()
    .prepare(
      `SELECT n.libelle AS niveau, n.cycle,
              COUNT(DISTINCT c.id) AS classes,
              SUM(CASE WHEN e.sexe = 'M' AND i.statut = 'INSCRIT' THEN 1 ELSE 0 END) AS garcons,
              SUM(CASE WHEN e.sexe = 'F' AND i.statut = 'INSCRIT' THEN 1 ELSE 0 END) AS filles,
              SUM(CASE WHEN i.statut = 'INSCRIT' THEN 1 ELSE 0 END) AS total,
              SUM(CASE WHEN i.redoublant = 1 AND i.statut = 'INSCRIT' THEN 1 ELSE 0 END) AS redoublants,
              SUM(CASE WHEN i.statut IN ('ABANDON','EXCLU') THEN 1 ELSE 0 END) AS abandons
       FROM classe c
       JOIN niveau n ON n.id = c.niveau_id
       LEFT JOIN inscription i ON i.classe_id = c.id
       LEFT JOIN eleve e ON e.id = i.eleve_id
       WHERE c.annee_id = ?
       GROUP BY n.id ORDER BY n.ordre`
    )
    .all(id) as any[]

  const encadrement = base()
    .prepare(
      `SELECT COUNT(*) AS enseignants,
              COALESCE(SUM(CASE WHEN sexe = 'M' THEN 1 ELSE 0 END), 0) AS hommes,
              COALESCE(SUM(CASE WHEN sexe = 'F' THEN 1 ELSE 0 END), 0) AS femmes
       FROM enseignant WHERE statut = 'ACTIF'`
    )
    .get() as any

  const totaux = effectifs.reduce(
    (acc, l) => ({
      classes: acc.classes + (l.classes ?? 0),
      garcons: acc.garcons + (l.garcons ?? 0),
      filles: acc.filles + (l.filles ?? 0),
      total: acc.total + (l.total ?? 0),
      redoublants: acc.redoublants + (l.redoublants ?? 0),
      abandons: acc.abandons + (l.abandons ?? 0)
    }),
    { classes: 0, garcons: 0, filles: 0, total: 0, redoublants: 0, abandons: 0 }
  )

  // Taux de reussite sur la derniere periode evaluee
  const periodes = listerPeriodes(id)
  const derniere = [...periodes].reverse().find((p) => p.verrouillee) ?? periodes[periodes.length - 1]
  const reussite: { niveau: string; evalues: number; reussites: number; taux: number }[] = []
  if (derniere) {
    const seuil =
      (base().prepare('SELECT seuil_reussite FROM etablissement WHERE id = 1').get() as any)
        ?.seuil_reussite ?? 10
    const classes = base()
      .prepare(
        `SELECT c.id, n.libelle AS niveau FROM classe c JOIN niveau n ON n.id = c.niveau_id
         WHERE c.annee_id = ? ORDER BY n.ordre`
      )
      .all(id) as { id: number; niveau: string }[]

    const parNiveau = new Map<string, { evalues: number; reussites: number }>()
    for (const classe of classes) {
      try {
        const resultats = calculerClasse(classe.id, derniere.id)
        const moyennes = resultats.eleves
          .map((e) => e.moyenne_sur_20)
          .filter((m): m is number => m !== null)
        const courant = parNiveau.get(classe.niveau) ?? { evalues: 0, reussites: 0 }
        courant.evalues += moyennes.length
        courant.reussites += moyennes.filter((m) => m >= seuil).length
        parNiveau.set(classe.niveau, courant)
      } catch {
        // Une classe sans matiere attribuee n’est pas une erreur bloquante ici.
      }
    }
    for (const [niveau, v] of parNiveau) {
      reussite.push({
        niveau,
        evalues: v.evalues,
        reussites: v.reussites,
        taux: v.evalues > 0 ? Math.round((v.reussites / v.evalues) * 1000) / 10 : 0
      })
    }
  }

  return {
    annee: annee?.libelle ?? '',
    effectifs,
    totaux,
    encadrement: {
      ...encadrement,
      ratio_eleves_enseignant:
        encadrement.enseignants > 0 ? Math.round((totaux.total / encadrement.enseignants) * 10) / 10 : 0
    },
    reussite
  }
}

/** Palmares : meilleurs eleves d’une periode, toutes classes ou par niveau. */
export function palmares(
  periodeId: number,
  options: { niveau_id?: number | null; limite?: number } = {}
): {
  rang: number
  eleve_id: number
  nom_complet: string
  classe_libelle: string
  moyenne: number
}[] {
  const anneeId = (
    base().prepare('SELECT annee_id FROM periode WHERE id = ?').get(periodeId) as {
      annee_id: number
    }
  ).annee_id

  const classes = base()
    .prepare(
      `SELECT c.id, c.libelle FROM classe c
       WHERE c.annee_id = ? AND (? IS NULL OR c.niveau_id = ?)`
    )
    .all(anneeId, options.niveau_id ?? null, options.niveau_id ?? null) as {
    id: number
    libelle: string
  }[]

  const tous: { eleve_id: number; nom_complet: string; classe_libelle: string; moyenne: number }[] = []
  for (const classe of classes) {
    try {
      const resultats = calculerClasse(classe.id, periodeId)
      for (const eleve of resultats.eleves) {
        if (eleve.moyenne_sur_20 === null) continue
        tous.push({
          eleve_id: eleve.eleve.id,
          nom_complet: `${eleve.eleve.nom} ${eleve.eleve.prenom}`.trim(),
          classe_libelle: classe.libelle,
          moyenne: eleve.moyenne_sur_20
        })
      }
    } catch {
      // classe sans grille de matieres
    }
  }

  return tous
    .sort((a, b) => b.moyenne - a.moyenne)
    .slice(0, options.limite ?? 20)
    .map((e, index) => ({ rang: index + 1, ...e }))
}

/** Evolution des effectifs sur toutes les annees enregistrees. */
export function evolutionEffectifs(): { annee: string; garcons: number; filles: number; total: number }[] {
  return base()
    .prepare(
      `SELECT a.libelle AS annee,
              SUM(CASE WHEN e.sexe = 'M' THEN 1 ELSE 0 END) AS garcons,
              SUM(CASE WHEN e.sexe = 'F' THEN 1 ELSE 0 END) AS filles,
              COUNT(*) AS total
       FROM annee_scolaire a
       JOIN inscription i ON i.annee_id = a.id AND i.statut = 'INSCRIT'
       JOIN eleve e ON e.id = i.eleve_id
       GROUP BY a.id ORDER BY a.date_debut`
    )
    .all() as any[]
}
