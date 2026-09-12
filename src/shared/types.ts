/** Modele de domaine partage entre le processus principal et l’interface. */

export interface Reponse<T> {
  ok: boolean
  donnees?: T
  erreur?: string
  code?: string
}

export interface Etablissement {
  id: number
  nom: string
  sigle: string | null
  devise_texte: string | null
  type_etablissement: string | null
  cycles: string | null
  pays: string | null
  province: string | null
  commune: string | null
  adresse: string | null
  telephone: string | null
  telephone2: string | null
  email: string | null
  site_web: string | null
  bp: string | null
  code_officiel: string | null
  nom_directeur: string | null
  logo: string | null
  filigrane: string | null
  couleur_primaire: string
  couleur_secondaire: string
  devise_code: string
  langue: string
  bareme_notation: number
  seuil_reussite: number
  autorite_tutelle: string | null
  signature_directeur: string | null
}

export interface AnneeScolaire {
  id: number
  libelle: string
  date_debut: string
  date_fin: string
  active: number
  cloturee: number
  date_cloture: string | null
}

export interface Periode {
  id: number
  annee_id: number
  libelle: string
  code: string
  ordre: number
  date_debut: string
  date_fin: string
  verrouillee: number
  poids: number
}

export interface Niveau {
  id: number
  cycle: string
  libelle: string
  code: string
  ordre: number
  actif: number
}

export interface Filiere {
  id: number
  libelle: string
  code: string
  cycle: string | null
  actif: number
}

export interface Classe {
  id: number
  annee_id: number
  niveau_id: number
  filiere_id: number | null
  libelle: string
  capacite: number
  salle: string | null
  titulaire_id: number | null
  // champs joints
  niveau_libelle?: string
  cycle?: string
  filiere_libelle?: string
  titulaire_nom?: string
  effectif?: number
}

export interface Eleve {
  id: number
  matricule: string
  nom: string
  prenom: string
  sexe: 'M' | 'F'
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  adresse: string | null
  telephone: string | null
  photo: string | null
  statut: string
  groupe_sanguin: string | null
  besoins_particuliers: string | null
  ecole_provenance: string | null
  date_creation: string
  // champs joints
  classe_libelle?: string
  classe_id?: number
  inscription_id?: number
  tuteur_nom?: string
  tuteur_telephone?: string
}

export interface Tuteur {
  id: number
  nom: string
  prenom: string | null
  lien_parente: string | null
  telephone: string
  telephone2: string | null
  email: string | null
  profession: string | null
  adresse: string | null
  recevoir_sms: number
}

export interface Inscription {
  id: number
  eleve_id: number
  classe_id: number
  annee_id: number
  date_inscription: string
  redoublant: number
  statut: string
  numero_ordre: number | null
  date_sortie: string | null
  motif_sortie: string | null
}

export interface Enseignant {
  id: number
  matricule: string
  nom: string
  prenom: string
  sexe: 'M' | 'F'
  date_naissance: string | null
  telephone: string
  telephone2: string | null
  email: string | null
  adresse: string | null
  photo: string | null
  diplome: string | null
  specialite: string | null
  date_embauche: string | null
  type_contrat: string
  statut: string
  salaire_base: number
  taux_horaire: number
  numero_compte: string | null
  numero_mobile_money: string | null
  code_pointage: string | null
  utilisateur_id: number | null
}

export interface Matiere {
  id: number
  code: string
  libelle: string
  cycle: string | null
  categorie: string | null
  actif: number
}

export interface ClasseMatiere {
  id: number
  classe_id: number
  matiere_id: number
  enseignant_id: number | null
  coefficient: number
  volume_horaire: number
  matiere_libelle?: string
  matiere_code?: string
  enseignant_nom?: string
  classe_libelle?: string
}

export interface Evaluation {
  id: number
  classe_matiere_id: number
  periode_id: number
  type: string
  libelle: string
  date_evaluation: string
  bareme: number
  poids: number
  publiee: number
  matiere_libelle?: string
  classe_libelle?: string
  nb_notes?: number
}

export interface Note {
  id: number
  evaluation_id: number
  eleve_id: number
  valeur: number | null
  absent: number
  justifie: number
  observation: string | null
}

export interface LigneBulletin {
  matiere_id: number
  matiere_libelle: string
  coefficient: number
  moyenne: number | null
  moyenne_sur_20: number | null
  total_points: number | null
  rang: number | null
  moyenne_classe: number | null
  note_min: number | null
  note_max: number | null
  appreciation: string
  enseignant_nom: string | null
  details: { libelle: string; valeur: number | null; bareme: number; absent: number }[]
}

export interface Bulletin {
  eleve: Eleve
  classe: Classe
  periode: Periode
  lignes: LigneBulletin[]
  total_coefficients: number
  total_points: number
  moyenne_generale: number | null
  moyenne_sur_20: number | null
  rang: number | null
  effectif: number
  mention: string
  decision: string
  moyenne_classe: number | null
  moyenne_premier: number | null
  moyenne_dernier: number | null
  conduite: string | null
  absences: number
  retards: number
  observation: string | null
  cumul_annuel?: number | null
}

export interface Frais {
  id: number
  annee_id: number
  libelle: string
  type: string
  montant: number
  obligatoire: number
  niveau_id: number | null
  classe_id: number | null
  periodicite: string
  date_echeance: string | null
  actif: number
  niveau_libelle?: string
  classe_libelle?: string
}

export interface Paiement {
  id: number
  numero_recu: string
  inscription_id: number
  montant: number
  date_paiement: string
  mode: string
  operateur: string | null
  reference: string | null
  encaisse_par: number | null
  annule: number
  motif_annulation: string | null
  observation: string | null
  eleve_nom?: string
  matricule?: string
  classe_libelle?: string
  caissier?: string
}

export interface SituationFinanciere {
  inscription_id: number
  eleve_id: number
  matricule: string
  nom_complet: string
  classe_libelle: string
  tuteur_telephone: string | null
  total_du: number
  total_remise: number
  total_paye: number
  solde: number
  taux: number
  dernier_paiement: string | null
}

export interface PresenceEleve {
  id: number
  eleve_id: number
  classe_id: number
  date_presence: string
  seance: string
  statut: string
  justifie: number
  motif: string | null
  heure_arrivee: string | null
  saisi_par: number | null
  sms_envoye: number
}

export interface PointageEnseignant {
  id: number
  enseignant_id: number
  date_pointage: string
  heure_arrivee: string | null
  heure_depart: string | null
  statut: string
  source: string
  heures_faites: number
  observation: string | null
  valide: number
  valide_par: number | null
  enseignant_nom?: string
  matricule?: string
}

export interface Utilisateur {
  id: number
  login: string
  nom_complet: string
  role: string
  actif: number
  telephone: string | null
  email: string | null
  enseignant_id: number | null
  dernier_login: string | null
  doit_changer_mdp: number
}

export interface SessionUtilisateur {
  utilisateur: Utilisateur
  permissions: string[]
}

export interface MessageSms {
  id: number
  destinataire: string
  telephone: string
  contenu: string
  statut: string
  tentatives: number
  date_creation: string
  date_envoi: string | null
  erreur: string | null
  contexte_type: string | null
  contexte_id: number | null
  cout: number
}

export interface Dortoir {
  id: number
  libelle: string
  batiment: string | null
  sexe: string
  capacite: number
  responsable_id: number | null
  actif: number
  occupes?: number
}

export interface Lit {
  id: number
  dortoir_id: number
  numero: string
  etat: string
  dortoir_libelle?: string
  occupant?: string | null
  pensionnaire_id?: number | null
}

export interface ActivitePedagogique {
  id: number
  libelle: string
  type: string
  date_debut: string
  date_fin: string | null
  heure_debut: string | null
  heure_fin: string | null
  lieu: string | null
  animateur: string | null
  objectifs: string | null
  statut: string
  rapport: string | null
  annee_id: number
  nb_participants?: number
  nb_presents?: number
}

export interface BulletinPaie {
  id: number
  enseignant_id: number
  mois: number
  annee: number
  salaire_base: number
  heures_prevues: number
  heures_faites: number
  jours_absence: number
  montant_heures_sup: number
  total_primes: number
  total_retenues: number
  net_a_payer: number
  statut: string
  date_paiement: string | null
  mode_paiement: string | null
  reference: string | null
  enseignant_nom?: string
  matricule?: string
}

export interface StatsTableauBord {
  effectif_total: number
  effectif_garcons: number
  effectif_filles: number
  nb_classes: number
  nb_enseignants: number
  nb_pensionnaires: number
  recettes_total: number
  attendu_total: number
  impayes_total: number
  taux_recouvrement: number
  presents_jour: number
  absents_jour: number
  taux_presence_jour: number
  enseignants_pointes: number
  effectif_par_niveau: { libelle: string; garcons: number; filles: number; total: number }[]
  recettes_par_mois: { mois: string; montant: number }[]
  top_impayes: SituationFinanciere[]
  alertes: { niveau: string; message: string; lien?: string }[]
}

/** Modele de structure des niveaux propose a l’installation. */
export interface ModeleStructure {
  code: string
  libelle: string
  description: string
  niveaux: { cycle: string; code: string; libelle: string; ordre: number }[]
}
