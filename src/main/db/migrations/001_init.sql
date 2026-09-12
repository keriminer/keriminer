-- =============================================================================
-- SCOLIA — schema initial
-- Base SQLite locale : l'application fonctionne sans aucune connexion internet.
-- Convention : toutes les dates sont stockees en texte ISO (YYYY-MM-DD),
-- les horodatages en YYYY-MM-DD HH:MM:SS, les montants en entier dans la plus
-- petite unite de la devise (pas de flottant sur l'argent).
-- =============================================================================

-- ------------------------------ Etablissement -------------------------------
CREATE TABLE etablissement (
  id                  INTEGER PRIMARY KEY CHECK (id = 1), -- ligne unique
  nom                 TEXT NOT NULL,
  sigle               TEXT,
  devise_texte        TEXT,                 -- devise/slogan de l'ecole
  type_etablissement  TEXT,                 -- Public / Prive / Conventionne
  cycles              TEXT,                 -- liste JSON des cycles actives
  pays                TEXT,
  province            TEXT,
  commune             TEXT,
  adresse             TEXT,
  telephone           TEXT,
  telephone2          TEXT,
  email               TEXT,
  site_web            TEXT,
  bp                  TEXT,
  code_officiel       TEXT,                 -- code attribue par le ministere
  nom_directeur       TEXT,
  logo                TEXT,                 -- image en base64 (data URL)
  filigrane           TEXT,
  signature_directeur TEXT,
  couleur_primaire    TEXT NOT NULL DEFAULT '#0f766e',
  couleur_secondaire  TEXT NOT NULL DEFAULT '#f59e0b',
  devise_code         TEXT NOT NULL DEFAULT 'BIF',
  langue              TEXT NOT NULL DEFAULT 'fr',
  bareme_notation     INTEGER NOT NULL DEFAULT 20,
  seuil_reussite      REAL NOT NULL DEFAULT 10,
  autorite_tutelle    TEXT
);

-- --------------------------- Annees et periodes -----------------------------
CREATE TABLE annee_scolaire (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle      TEXT NOT NULL UNIQUE,        -- ex. 2025-2026
  date_debut   TEXT NOT NULL,
  date_fin     TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 0,
  cloturee     INTEGER NOT NULL DEFAULT 0,
  date_cloture TEXT
);

CREATE TABLE periode (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_id    INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  libelle     TEXT NOT NULL,
  code        TEXT NOT NULL,
  ordre       INTEGER NOT NULL,
  date_debut  TEXT NOT NULL,
  date_fin    TEXT NOT NULL,
  poids       REAL NOT NULL DEFAULT 1,
  verrouillee INTEGER NOT NULL DEFAULT 0,
  UNIQUE (annee_id, code)
);

-- ------------------------ Structure pedagogique -----------------------------
CREATE TABLE niveau (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle   TEXT NOT NULL,
  libelle TEXT NOT NULL,
  code    TEXT NOT NULL UNIQUE,
  ordre   INTEGER NOT NULL DEFAULT 0,
  actif   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE filiere (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL,
  code    TEXT NOT NULL UNIQUE,
  cycle   TEXT,
  actif   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE classe (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_id    INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  niveau_id   INTEGER NOT NULL REFERENCES niveau(id),
  filiere_id  INTEGER REFERENCES filiere(id),
  libelle     TEXT NOT NULL,
  capacite    INTEGER NOT NULL DEFAULT 50,
  salle       TEXT,
  titulaire_id INTEGER REFERENCES enseignant(id) ON DELETE SET NULL,
  UNIQUE (annee_id, libelle)
);
CREATE INDEX idx_classe_annee ON classe(annee_id);

CREATE TABLE matiere (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,
  libelle   TEXT NOT NULL,
  cycle     TEXT,
  categorie TEXT,                            -- Sciences, Langues, Technique...
  actif     INTEGER NOT NULL DEFAULT 1
);

-- ------------------------------- Personnes ----------------------------------
CREATE TABLE eleve (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule           TEXT NOT NULL UNIQUE,
  nom                 TEXT NOT NULL,
  prenom              TEXT NOT NULL,
  sexe                TEXT NOT NULL CHECK (sexe IN ('M','F')),
  date_naissance      TEXT,
  lieu_naissance      TEXT,
  nationalite         TEXT,
  adresse             TEXT,
  telephone           TEXT,
  photo               TEXT,
  statut              TEXT NOT NULL DEFAULT 'ACTIF',  -- ACTIF/TRANSFERE/ABANDON/DIPLOME
  groupe_sanguin      TEXT,
  besoins_particuliers TEXT,
  ecole_provenance    TEXT,
  date_creation       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_eleve_nom ON eleve(nom, prenom);

CREATE TABLE tuteur (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nom           TEXT NOT NULL,
  prenom        TEXT,
  lien_parente  TEXT,                          -- Pere, Mere, Oncle, Tuteur...
  telephone     TEXT NOT NULL,
  telephone2    TEXT,
  email         TEXT,
  profession    TEXT,
  adresse       TEXT,
  recevoir_sms  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_tuteur_tel ON tuteur(telephone);

CREATE TABLE eleve_tuteur (
  eleve_id  INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  tuteur_id INTEGER NOT NULL REFERENCES tuteur(id) ON DELETE CASCADE,
  principal INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (eleve_id, tuteur_id)
);

CREATE TABLE enseignant (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule            TEXT NOT NULL UNIQUE,
  nom                  TEXT NOT NULL,
  prenom               TEXT NOT NULL,
  sexe                 TEXT NOT NULL CHECK (sexe IN ('M','F')),
  date_naissance       TEXT,
  telephone            TEXT NOT NULL,
  telephone2           TEXT,
  email                TEXT,
  adresse              TEXT,
  photo                TEXT,
  diplome              TEXT,
  specialite           TEXT,
  date_embauche        TEXT,
  type_contrat         TEXT NOT NULL DEFAULT 'PERMANENT', -- PERMANENT/VACATAIRE/STAGIAIRE
  statut               TEXT NOT NULL DEFAULT 'ACTIF',
  salaire_base         INTEGER NOT NULL DEFAULT 0,
  taux_horaire         INTEGER NOT NULL DEFAULT 0,
  numero_compte        TEXT,
  numero_mobile_money  TEXT,
  code_pointage        TEXT UNIQUE,           -- identifiant du badge QR
  utilisateur_id       INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL
);

CREATE TABLE inscription (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id         INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  classe_id        INTEGER NOT NULL REFERENCES classe(id) ON DELETE CASCADE,
  annee_id         INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  date_inscription TEXT NOT NULL DEFAULT (date('now','localtime')),
  redoublant       INTEGER NOT NULL DEFAULT 0,
  statut           TEXT NOT NULL DEFAULT 'INSCRIT', -- INSCRIT/TRANSFERE/ABANDON/EXCLU
  numero_ordre     INTEGER,
  date_sortie      TEXT,
  motif_sortie     TEXT,
  UNIQUE (eleve_id, annee_id)
);
CREATE INDEX idx_inscription_classe ON inscription(classe_id);

-- --------------------------- Attributions & horaires ------------------------
CREATE TABLE classe_matiere (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id     INTEGER NOT NULL REFERENCES classe(id) ON DELETE CASCADE,
  matiere_id    INTEGER NOT NULL REFERENCES matiere(id) ON DELETE CASCADE,
  enseignant_id INTEGER REFERENCES enseignant(id) ON DELETE SET NULL,
  coefficient   REAL NOT NULL DEFAULT 1,
  volume_horaire INTEGER NOT NULL DEFAULT 0,  -- heures par semaine
  UNIQUE (classe_id, matiere_id)
);

CREATE TABLE seance_emploi_temps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id     INTEGER NOT NULL REFERENCES classe(id) ON DELETE CASCADE,
  jour          INTEGER NOT NULL,             -- 1 = lundi
  heure_debut   TEXT NOT NULL,
  heure_fin     TEXT NOT NULL,
  matiere_id    INTEGER REFERENCES matiere(id) ON DELETE CASCADE,
  enseignant_id INTEGER REFERENCES enseignant(id) ON DELETE SET NULL,
  salle         TEXT
);
CREATE INDEX idx_edt_classe ON seance_emploi_temps(classe_id, jour);

-- ------------------------------ Evaluations ---------------------------------
CREATE TABLE evaluation (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_matiere_id INTEGER NOT NULL REFERENCES classe_matiere(id) ON DELETE CASCADE,
  periode_id        INTEGER NOT NULL REFERENCES periode(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  libelle           TEXT NOT NULL,
  date_evaluation   TEXT NOT NULL,
  bareme            REAL NOT NULL DEFAULT 20,
  poids             REAL NOT NULL DEFAULT 1,
  publiee           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_eval_cm ON evaluation(classe_matiere_id, periode_id);

CREATE TABLE note (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluation(id) ON DELETE CASCADE,
  eleve_id      INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  valeur        REAL,
  absent        INTEGER NOT NULL DEFAULT 0,
  justifie      INTEGER NOT NULL DEFAULT 0,
  observation   TEXT,
  UNIQUE (evaluation_id, eleve_id)
);
CREATE INDEX idx_note_eleve ON note(eleve_id);

-- Conduite / appreciation du titulaire, par eleve et par periode
CREATE TABLE appreciation_periode (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id    INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  periode_id  INTEGER NOT NULL REFERENCES periode(id) ON DELETE CASCADE,
  conduite    TEXT,
  observation TEXT,
  decision    TEXT,
  UNIQUE (eleve_id, periode_id)
);

-- Bulletins figes au moment du verrouillage d'une periode (archive fidele)
CREATE TABLE bulletin_archive (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id   INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  periode_id INTEGER NOT NULL REFERENCES periode(id) ON DELETE CASCADE,
  classe_id  INTEGER NOT NULL,
  contenu    TEXT NOT NULL,                  -- bulletin complet serialise en JSON
  moyenne    REAL,
  rang       INTEGER,
  date_gel   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (eleve_id, periode_id)
);

-- --------------------------------- Presences --------------------------------
CREATE TABLE presence_eleve (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  eleve_id      INTEGER NOT NULL REFERENCES eleve(id) ON DELETE CASCADE,
  classe_id     INTEGER NOT NULL REFERENCES classe(id) ON DELETE CASCADE,
  date_presence TEXT NOT NULL,
  seance        TEXT NOT NULL DEFAULT 'MATIN', -- MATIN/APRES_MIDI ou code de cours
  statut        TEXT NOT NULL DEFAULT 'PRESENT',
  justifie      INTEGER NOT NULL DEFAULT 0,
  motif         TEXT,
  heure_arrivee TEXT,
  matiere_id    INTEGER REFERENCES matiere(id) ON DELETE SET NULL,
  saisi_par     INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
  sms_envoye    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (eleve_id, date_presence, seance)
);
CREATE INDEX idx_presence_date ON presence_eleve(date_presence, classe_id);

CREATE TABLE pointage_enseignant (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  enseignant_id INTEGER NOT NULL REFERENCES enseignant(id) ON DELETE CASCADE,
  date_pointage TEXT NOT NULL,
  heure_arrivee TEXT,
  heure_depart  TEXT,
  statut        TEXT NOT NULL DEFAULT 'PRESENT', -- PRESENT/RETARD/ABSENT/CONGE/MISSION
  source        TEXT NOT NULL DEFAULT 'MANUEL',  -- MANUEL/QR/IMPORT
  heures_faites REAL NOT NULL DEFAULT 0,
  motif         TEXT,
  observation   TEXT,
  remplacant_id INTEGER REFERENCES enseignant(id) ON DELETE SET NULL,
  valide        INTEGER NOT NULL DEFAULT 0,
  valide_par    INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
  saisi_par     INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
  UNIQUE (enseignant_id, date_pointage)
);
CREATE INDEX idx_pointage_date ON pointage_enseignant(date_pointage);

-- ---------------------------------- Finances --------------------------------
CREATE TABLE frais (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_id     INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  libelle      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'SCOLARITE',
  montant      INTEGER NOT NULL,
  obligatoire  INTEGER NOT NULL DEFAULT 1,
  niveau_id    INTEGER REFERENCES niveau(id) ON DELETE CASCADE,
  classe_id    INTEGER REFERENCES classe(id) ON DELETE CASCADE,
  periodicite  TEXT NOT NULL DEFAULT 'ANNUEL', -- ANNUEL/PERIODE/MENSUEL/UNIQUE
  date_echeance TEXT,
  actif        INTEGER NOT NULL DEFAULT 1
);

-- Frais reellement dus par un eleve inscrit (permet remises et bourses)
CREATE TABLE eleve_frais (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscription(id) ON DELETE CASCADE,
  frais_id       INTEGER NOT NULL REFERENCES frais(id) ON DELETE CASCADE,
  montant_du     INTEGER NOT NULL,
  remise         INTEGER NOT NULL DEFAULT 0,
  motif_remise   TEXT,
  UNIQUE (inscription_id, frais_id)
);

CREATE TABLE paiement (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_recu    TEXT NOT NULL UNIQUE,
  inscription_id INTEGER NOT NULL REFERENCES inscription(id) ON DELETE CASCADE,
  montant        INTEGER NOT NULL,
  date_paiement  TEXT NOT NULL DEFAULT (date('now','localtime')),
  mode           TEXT NOT NULL DEFAULT 'ESPECES',
  operateur      TEXT,
  reference      TEXT,
  encaisse_par   INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
  annule         INTEGER NOT NULL DEFAULT 0,
  motif_annulation TEXT,
  observation    TEXT,
  date_creation  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_paiement_insc ON paiement(inscription_id);
CREATE INDEX idx_paiement_date ON paiement(date_paiement);

CREATE TABLE paiement_ligne (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  paiement_id    INTEGER NOT NULL REFERENCES paiement(id) ON DELETE CASCADE,
  eleve_frais_id INTEGER NOT NULL REFERENCES eleve_frais(id) ON DELETE CASCADE,
  montant        INTEGER NOT NULL
);

CREATE TABLE depense (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_id      INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  libelle       TEXT NOT NULL,
  categorie     TEXT,
  montant       INTEGER NOT NULL,
  date_depense  TEXT NOT NULL,
  beneficiaire  TEXT,
  piece_justificative TEXT,
  saisi_par     INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL
);

CREATE TABLE transaction_mobile_money (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  operateur   TEXT NOT NULL,
  reference   TEXT NOT NULL,
  telephone   TEXT,
  montant     INTEGER NOT NULL,
  date_transaction TEXT NOT NULL,
  statut      TEXT NOT NULL DEFAULT 'EN_ATTENTE', -- EN_ATTENTE/RAPPROCHE/REJETE
  inscription_id INTEGER REFERENCES inscription(id) ON DELETE SET NULL,
  paiement_id INTEGER REFERENCES paiement(id) ON DELETE SET NULL,
  brut        TEXT,                            -- charge utile brute (JSON/SMS)
  UNIQUE (operateur, reference)
);

-- ------------------------------------ Paie ----------------------------------
CREATE TABLE bulletin_paie (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  enseignant_id  INTEGER NOT NULL REFERENCES enseignant(id) ON DELETE CASCADE,
  mois           INTEGER NOT NULL,
  annee          INTEGER NOT NULL,
  salaire_base   INTEGER NOT NULL DEFAULT 0,
  heures_prevues REAL NOT NULL DEFAULT 0,
  heures_faites  REAL NOT NULL DEFAULT 0,
  jours_absence  REAL NOT NULL DEFAULT 0,
  montant_heures_sup INTEGER NOT NULL DEFAULT 0,
  total_primes   INTEGER NOT NULL DEFAULT 0,
  total_retenues INTEGER NOT NULL DEFAULT 0,
  net_a_payer    INTEGER NOT NULL DEFAULT 0,
  statut         TEXT NOT NULL DEFAULT 'BROUILLON', -- BROUILLON/VALIDE/PAYE
  date_paiement  TEXT,
  mode_paiement  TEXT,
  reference      TEXT,
  UNIQUE (enseignant_id, mois, annee)
);

CREATE TABLE ligne_paie (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  bulletin_paie_id INTEGER NOT NULL REFERENCES bulletin_paie(id) ON DELETE CASCADE,
  libelle          TEXT NOT NULL,
  type             TEXT NOT NULL,               -- PRIME / RETENUE
  montant          INTEGER NOT NULL
);

-- ----------------------------------- SMS ------------------------------------
CREATE TABLE modele_sms (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL UNIQUE,
  libelle TEXT NOT NULL,
  contenu TEXT NOT NULL,
  actif   INTEGER NOT NULL DEFAULT 1,
  automatique INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE message_sms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  destinataire  TEXT NOT NULL,
  telephone     TEXT NOT NULL,
  contenu       TEXT NOT NULL,
  statut        TEXT NOT NULL DEFAULT 'EN_ATTENTE', -- EN_ATTENTE/ENVOYE/ECHEC/ANNULE
  tentatives    INTEGER NOT NULL DEFAULT 0,
  date_creation TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  date_envoi    TEXT,
  erreur        TEXT,
  reference     TEXT,
  cout          INTEGER NOT NULL DEFAULT 0,
  contexte_type TEXT,
  contexte_id   INTEGER
);
CREATE INDEX idx_sms_statut ON message_sms(statut);

-- --------------------------------- Internat ---------------------------------
CREATE TABLE dortoir (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle       TEXT NOT NULL UNIQUE,
  batiment      TEXT,
  sexe          TEXT NOT NULL DEFAULT 'M',
  capacite      INTEGER NOT NULL DEFAULT 0,
  responsable_id INTEGER REFERENCES enseignant(id) ON DELETE SET NULL,
  actif         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE lit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dortoir_id INTEGER NOT NULL REFERENCES dortoir(id) ON DELETE CASCADE,
  numero     TEXT NOT NULL,
  etat       TEXT NOT NULL DEFAULT 'BON',     -- BON / A_REPARER / HORS_SERVICE
  UNIQUE (dortoir_id, numero)
);

CREATE TABLE pensionnaire (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id INTEGER NOT NULL REFERENCES inscription(id) ON DELETE CASCADE,
  lit_id         INTEGER REFERENCES lit(id) ON DELETE SET NULL,
  date_entree    TEXT NOT NULL DEFAULT (date('now','localtime')),
  date_sortie    TEXT,
  observation    TEXT,
  UNIQUE (inscription_id)
);

CREATE TABLE pointage_internat (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pensionnaire_id INTEGER NOT NULL REFERENCES pensionnaire(id) ON DELETE CASCADE,
  date_pointage   TEXT NOT NULL,
  moment          TEXT NOT NULL,               -- PETIT_DEJEUNER/DEJEUNER/DINER/NUIT
  present         INTEGER NOT NULL DEFAULT 1,
  observation     TEXT,
  UNIQUE (pensionnaire_id, date_pointage, moment)
);

-- -------------------------- Journees pedagogiques ---------------------------
CREATE TABLE activite_pedagogique (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  annee_id    INTEGER NOT NULL REFERENCES annee_scolaire(id) ON DELETE CASCADE,
  libelle     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'JOURNEE_PEDAGOGIQUE',
  date_debut  TEXT NOT NULL,
  date_fin    TEXT,
  heure_debut TEXT,
  heure_fin   TEXT,
  lieu        TEXT,
  animateur   TEXT,
  objectifs   TEXT,
  statut      TEXT NOT NULL DEFAULT 'PLANIFIEE', -- PLANIFIEE/EN_COURS/TERMINEE/ANNULEE
  rapport     TEXT
);

CREATE TABLE participation_activite (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  activite_id   INTEGER NOT NULL REFERENCES activite_pedagogique(id) ON DELETE CASCADE,
  enseignant_id INTEGER NOT NULL REFERENCES enseignant(id) ON DELETE CASCADE,
  present       INTEGER NOT NULL DEFAULT 0,
  observation   TEXT,
  UNIQUE (activite_id, enseignant_id)
);

-- --------------------------------- Systeme ----------------------------------
CREATE TABLE utilisateur (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  login            TEXT NOT NULL UNIQUE,
  nom_complet      TEXT NOT NULL,
  mot_de_passe     TEXT NOT NULL,
  role             TEXT NOT NULL,
  actif            INTEGER NOT NULL DEFAULT 1,
  telephone        TEXT,
  email            TEXT,
  enseignant_id    INTEGER,
  dernier_login    TEXT,
  doit_changer_mdp INTEGER NOT NULL DEFAULT 0,
  date_creation    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE journal_audit (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id INTEGER REFERENCES utilisateur(id) ON DELETE SET NULL,
  utilisateur_nom TEXT,
  action         TEXT NOT NULL,
  entite         TEXT,
  entite_id      INTEGER,
  details        TEXT,
  date_action    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_audit_date ON journal_audit(date_action);

CREATE TABLE parametre (
  cle    TEXT PRIMARY KEY,
  valeur TEXT
);

CREATE TABLE licence (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  cle             TEXT,
  titulaire       TEXT,
  date_activation TEXT,
  date_expiration TEXT,
  max_eleves      INTEGER,
  modules         TEXT,
  signature       TEXT
);
