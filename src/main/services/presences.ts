import { base } from '../db'
import type { PointageEnseignant, PresenceEleve } from '@shared/types'
import { exigerAnneeActive } from './annee'
import { lireParametre } from './etablissement'
import { sessionCourante } from './auth'
import { tracer } from './journal'
import { fileAttenteDepuisModele } from './sms'
import { aujourdHui } from '@shared/format'

/* =========================================================================
 * Presence des eleves
 * ====================================================================== */

export interface LignePresence {
  eleve_id: number
  matricule: string
  nom_complet: string
  sexe: string
  statut: string
  justifie: number
  motif: string | null
  heure_arrivee: string | null
}

/**
 * Feuille d’appel d’une classe.
 * Par defaut tout le monde est marque PRESENT : le surveillant ne touche que
 * les exceptions. C’est la seule facon de faire l’appel de 60 eleves en une
 * minute avec une souris fatiguee.
 */
export function feuilleAppel(classeId: number, date: string, seance: string): LignePresence[] {
  const eleves = base()
    .prepare(
      `SELECT e.id AS eleve_id, e.matricule, e.nom, e.prenom, e.sexe
       FROM inscription i JOIN eleve e ON e.id = i.eleve_id
       WHERE i.classe_id = ? AND i.statut = 'INSCRIT'
       ORDER BY e.nom, e.prenom`
    )
    .all(classeId) as any[]

  const existantes = base()
    .prepare('SELECT * FROM presence_eleve WHERE classe_id = ? AND date_presence = ? AND seance = ?')
    .all(classeId, date, seance) as PresenceEleve[]
  const parEleve = new Map(existantes.map((p) => [p.eleve_id, p]))

  return eleves.map((e) => {
    const existante = parEleve.get(e.eleve_id)
    return {
      eleve_id: e.eleve_id,
      matricule: e.matricule,
      nom_complet: `${e.nom} ${e.prenom}`.trim(),
      sexe: e.sexe,
      statut: existante?.statut ?? 'PRESENT',
      justifie: existante?.justifie ?? 0,
      motif: existante?.motif ?? null,
      heure_arrivee: existante?.heure_arrivee ?? null
    }
  })
}

/**
 * Enregistre une feuille d’appel complete.
 * Les SMS d’alerte aux parents sont mis en file d’attente pour les absences non
 * justifiees, une seule fois par eleve et par seance (colonne `sms_envoye`).
 */
export function enregistrerAppel(
  classeId: number,
  date: string,
  seance: string,
  lignes: LignePresence[],
  matiereId: number | null = null
): { enregistrees: number; sms_programmes: number } {
  const utilisateur = sessionCourante()?.utilisateur.id ?? null
  const smsAuto = lireParametre('sms.auto_absence', '0') === '1'

  const insert = base().prepare(
    `INSERT INTO presence_eleve (eleve_id, classe_id, date_presence, seance, statut, justifie, motif, heure_arrivee, matiere_id, saisi_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (eleve_id, date_presence, seance) DO UPDATE SET
       statut = excluded.statut, justifie = excluded.justifie, motif = excluded.motif,
       heure_arrivee = excluded.heure_arrivee, matiere_id = excluded.matiere_id,
       saisi_par = excluded.saisi_par`
  )

  let smsProgrammes = 0
  const transaction = base().transaction(() => {
    for (const ligne of lignes) {
      insert.run(
        ligne.eleve_id, classeId, date, seance, ligne.statut, ligne.justifie ?? 0,
        ligne.motif ?? null, ligne.heure_arrivee ?? null, matiereId, utilisateur
      )
    }
  })
  transaction()

  if (smsAuto) {
    for (const ligne of lignes) {
      if (ligne.statut !== 'ABSENT' || ligne.justifie) continue
      const enregistree = base()
        .prepare(
          'SELECT id, sms_envoye FROM presence_eleve WHERE eleve_id = ? AND date_presence = ? AND seance = ?'
        )
        .get(ligne.eleve_id, date, seance) as { id: number; sms_envoye: number } | undefined
      if (!enregistree || enregistree.sms_envoye) continue

      const programme = fileAttenteDepuisModele('ABSENCE_ELEVE', ligne.eleve_id, {
        date,
        motif: ligne.motif ?? ''
      })
      if (programme) {
        base().prepare('UPDATE presence_eleve SET sms_envoye = 1 WHERE id = ?').run(enregistree.id)
        smsProgrammes++
      }
    }
  }

  tracer(
    utilisateur,
    sessionCourante()?.utilisateur.nom_complet ?? null,
    'APPEL_CLASSE',
    'classe',
    classeId,
    { date, seance, effectif: lignes.length }
  )
  return { enregistrees: lignes.length, sms_programmes: smsProgrammes }
}

/** Synthese d’assiduite d’une classe sur une periode donnee. */
export function syntheseAssiduiteClasse(
  classeId: number,
  dateDebut: string,
  dateFin: string
): {
  eleve_id: number
  matricule: string
  nom_complet: string
  seances: number
  presences: number
  absences: number
  absences_justifiees: number
  retards: number
  taux_presence: number
}[] {
  return base()
    .prepare(
      `SELECT e.id AS eleve_id, e.matricule, e.nom || ' ' || e.prenom AS nom_complet,
              COUNT(p.id) AS seances,
              SUM(CASE WHEN p.statut = 'PRESENT' THEN 1 ELSE 0 END) AS presences,
              SUM(CASE WHEN p.statut = 'ABSENT' THEN 1 ELSE 0 END) AS absences,
              SUM(CASE WHEN p.statut = 'ABSENT' AND p.justifie = 1 THEN 1 ELSE 0 END) AS absences_justifiees,
              SUM(CASE WHEN p.statut = 'RETARD' THEN 1 ELSE 0 END) AS retards,
              CASE WHEN COUNT(p.id) = 0 THEN 0
                   ELSE ROUND(100.0 * SUM(CASE WHEN p.statut IN ('PRESENT','RETARD') THEN 1 ELSE 0 END) / COUNT(p.id), 1)
              END AS taux_presence
       FROM inscription i
       JOIN eleve e ON e.id = i.eleve_id
       LEFT JOIN presence_eleve p ON p.eleve_id = e.id
            AND p.date_presence BETWEEN ? AND ?
       WHERE i.classe_id = ? AND i.statut = 'INSCRIT'
       GROUP BY e.id
       ORDER BY absences DESC, e.nom`
    )
    .all(dateDebut, dateFin, classeId) as any[]
}

/** Eleves dont l’absenteisme depasse un seuil : liste de suivi pour la direction. */
export function elevesAbsenteistes(
  dateDebut: string,
  dateFin: string,
  seuilAbsences = 5
): { eleve_id: number; nom_complet: string; classe_libelle: string; absences: number; tuteur_telephone: string | null }[] {
  return base()
    .prepare(
      `SELECT e.id AS eleve_id, e.nom || ' ' || e.prenom AS nom_complet, c.libelle AS classe_libelle,
              COUNT(p.id) AS absences, t.telephone AS tuteur_telephone
       FROM presence_eleve p
       JOIN eleve e ON e.id = p.eleve_id
       JOIN classe c ON c.id = p.classe_id
       LEFT JOIN eleve_tuteur et ON et.eleve_id = e.id AND et.principal = 1
       LEFT JOIN tuteur t ON t.id = et.tuteur_id
       WHERE p.statut = 'ABSENT' AND p.justifie = 0 AND p.date_presence BETWEEN ? AND ?
       GROUP BY e.id
       HAVING COUNT(p.id) >= ?
       ORDER BY absences DESC`
    )
    .all(dateDebut, dateFin, seuilAbsences) as any[]
}

/* =========================================================================
 * Pointage des enseignants
 * ====================================================================== */

export interface LignePointage {
  enseignant_id: number
  matricule: string
  nom_complet: string
  statut: string
  heure_arrivee: string | null
  heure_depart: string | null
  heures_faites: number
  motif: string | null
  observation: string | null
  remplacant_id: number | null
  valide: number
  a_cours_aujourdhui: number
}

/**
 * Registre de pointage du jour.
 * `a_cours_aujourdhui` permet de distinguer un enseignant reellement attendu
 * d’un vacataire qui n’a pas cours ce jour-la — une absence n’a pas le meme
 * sens dans les deux cas.
 */
export function registrePointage(date: string): LignePointage[] {
  const jour = new Date(date).getDay() === 0 ? 7 : new Date(date).getDay()
  return base()
    .prepare(
      `SELECT e.id AS enseignant_id, e.matricule, e.nom || ' ' || e.prenom AS nom_complet,
              COALESCE(p.statut, '') AS statut, p.heure_arrivee, p.heure_depart,
              COALESCE(p.heures_faites, 0) AS heures_faites, p.motif, p.observation,
              p.remplacant_id, COALESCE(p.valide, 0) AS valide,
              (SELECT COUNT(*) FROM seance_emploi_temps s
                 JOIN classe c ON c.id = s.classe_id
                 WHERE s.enseignant_id = e.id AND s.jour = ? AND c.annee_id = ?) AS a_cours_aujourdhui
       FROM enseignant e
       LEFT JOIN pointage_enseignant p ON p.enseignant_id = e.id AND p.date_pointage = ?
       WHERE e.statut = 'ACTIF'
       ORDER BY e.nom, e.prenom`
    )
    .all(jour, exigerAnneeActive().id, date) as LignePointage[]
}

function calculerHeures(arrivee: string | null, depart: string | null): number {
  if (!arrivee || !depart) return 0
  const [ha, ma] = arrivee.split(':').map(Number)
  const [hd, md] = depart.split(':').map(Number)
  const minutes = hd * 60 + md - (ha * 60 + ma)
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0
}

export function enregistrerPointage(
  date: string,
  lignes: Partial<LignePointage>[]
): { enregistres: number } {
  const utilisateur = sessionCourante()?.utilisateur.id ?? null
  const insert = base().prepare(
    `INSERT INTO pointage_enseignant
       (enseignant_id, date_pointage, heure_arrivee, heure_depart, statut, source, heures_faites, motif, observation, remplacant_id, saisi_par)
     VALUES (?, ?, ?, ?, ?, 'MANUEL', ?, ?, ?, ?, ?)
     ON CONFLICT (enseignant_id, date_pointage) DO UPDATE SET
       heure_arrivee = excluded.heure_arrivee, heure_depart = excluded.heure_depart,
       statut = excluded.statut, heures_faites = excluded.heures_faites,
       motif = excluded.motif, observation = excluded.observation,
       remplacant_id = excluded.remplacant_id, saisi_par = excluded.saisi_par`
  )

  const transaction = base().transaction(() => {
    for (const l of lignes) {
      if (!l.enseignant_id || !l.statut) continue
      insert.run(
        l.enseignant_id, date, l.heure_arrivee ?? null, l.heure_depart ?? null, l.statut,
        calculerHeures(l.heure_arrivee ?? null, l.heure_depart ?? null),
        l.motif ?? null, l.observation ?? null, l.remplacant_id ?? null, utilisateur
      )
    }
  })
  transaction()

  tracer(
    utilisateur,
    sessionCourante()?.utilisateur.nom_complet ?? null,
    'POINTAGE_ENSEIGNANTS',
    'pointage_enseignant',
    null,
    { date, nombre: lignes.length }
  )
  return { enregistres: lignes.length }
}

/**
 * Pointage par badge QR : un seul scan fait l’arrivee puis le depart.
 * Le retard est determine par comparaison a l’heure d’arrivee prevue, elle-meme
 * parametrable par l’ecole.
 */
export function pointerParCode(code: string): {
  enseignant: string
  action: 'ARRIVEE' | 'DEPART'
  heure: string
  statut: string
  heures_faites: number
} {
  const enseignant = base()
    .prepare("SELECT * FROM enseignant WHERE code_pointage = ? AND statut = 'ACTIF'")
    .get(code.trim().toUpperCase()) as { id: number; nom: string; prenom: string } | undefined
  if (!enseignant) throw new Error('Badge inconnu ou enseignant inactif.')

  const date = aujourdHui()
  const heure = new Date().toTimeString().slice(0, 5)
  const existant = base()
    .prepare('SELECT * FROM pointage_enseignant WHERE enseignant_id = ? AND date_pointage = ?')
    .get(enseignant.id, date) as PointageEnseignant | undefined

  const nomComplet = `${enseignant.nom} ${enseignant.prenom}`.trim()

  if (!existant || !existant.heure_arrivee) {
    const heureLimite = lireParametre('pointage.heure_arrivee_prevue', '07:30')
    const statut = heure > heureLimite ? 'RETARD' : 'PRESENT'
    base()
      .prepare(
        `INSERT INTO pointage_enseignant (enseignant_id, date_pointage, heure_arrivee, statut, source)
         VALUES (?, ?, ?, ?, 'QR')
         ON CONFLICT (enseignant_id, date_pointage) DO UPDATE SET
           heure_arrivee = excluded.heure_arrivee, statut = excluded.statut, source = 'QR'`
      )
      .run(enseignant.id, date, heure, statut)
    return { enseignant: nomComplet, action: 'ARRIVEE', heure, statut, heures_faites: 0 }
  }

  const heures = calculerHeures(existant.heure_arrivee, heure)
  base()
    .prepare('UPDATE pointage_enseignant SET heure_depart = ?, heures_faites = ? WHERE id = ?')
    .run(heure, heures, existant.id)
  return {
    enseignant: nomComplet,
    action: 'DEPART',
    heure,
    statut: existant.statut,
    heures_faites: heures
  }
}

export function validerPointages(date: string): { valides: number } {
  const utilisateur = sessionCourante()?.utilisateur.id ?? null
  const r = base()
    .prepare('UPDATE pointage_enseignant SET valide = 1, valide_par = ? WHERE date_pointage = ?')
    .run(utilisateur, date)
  return { valides: r.changes }
}

/**
 * Synthese mensuelle du pointage d’un enseignant : c’est cette table qui
 * alimente la paie (jours travailles, heures faites, absences a retenir).
 */
export function synthesePointageMois(
  mois: number,
  annee: number
): {
  enseignant_id: number
  matricule: string
  nom_complet: string
  jours_presents: number
  jours_absents: number
  jours_retard: number
  jours_conge: number
  heures_faites: number
  taux_presence: number
}[] {
  const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
  const fin = `${annee}-${String(mois).padStart(2, '0')}-31`
  return base()
    .prepare(
      `SELECT e.id AS enseignant_id, e.matricule, e.nom || ' ' || e.prenom AS nom_complet,
              SUM(CASE WHEN p.statut IN ('PRESENT','RETARD') THEN 1 ELSE 0 END) AS jours_presents,
              SUM(CASE WHEN p.statut = 'ABSENT' THEN 1 ELSE 0 END) AS jours_absents,
              SUM(CASE WHEN p.statut = 'RETARD' THEN 1 ELSE 0 END) AS jours_retard,
              SUM(CASE WHEN p.statut IN ('CONGE','MISSION') THEN 1 ELSE 0 END) AS jours_conge,
              COALESCE(SUM(p.heures_faites), 0) AS heures_faites,
              CASE WHEN COUNT(p.id) = 0 THEN 0
                   ELSE ROUND(100.0 * SUM(CASE WHEN p.statut IN ('PRESENT','RETARD') THEN 1 ELSE 0 END) / COUNT(p.id), 1)
              END AS taux_presence
       FROM enseignant e
       LEFT JOIN pointage_enseignant p ON p.enseignant_id = e.id
            AND p.date_pointage BETWEEN ? AND ?
       WHERE e.statut = 'ACTIF'
       GROUP BY e.id
       ORDER BY e.nom`
    )
    .all(debut, fin) as any[]
}

/** Detail jour par jour, pour justifier une retenue sur salaire. */
export function detailPointageEnseignant(
  enseignantId: number,
  dateDebut: string,
  dateFin: string
): PointageEnseignant[] {
  return base()
    .prepare(
      `SELECT * FROM pointage_enseignant
       WHERE enseignant_id = ? AND date_pointage BETWEEN ? AND ?
       ORDER BY date_pointage DESC`
    )
    .all(enseignantId, dateDebut, dateFin) as PointageEnseignant[]
}
