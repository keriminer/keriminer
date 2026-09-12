/**
 * Donnees de reference proposees a l’installation.
 * Elles ne sont qu’un point de départ : tout est modifiable dans l’application,
 * car les structures scolaires varient d’un pays à l’autre.
 */

import type { ModeleStructure } from '@shared/types'

export const MODELES_STRUCTURE: ModeleStructure[] = [
  {
    code: 'FONDAMENTAL_9',
    libelle: 'École fondamentale (9 ans) + post-fondamental',
    description:
      "Structure de type Burundi / RDC : 6 années de base, 3 années de tronc commun, puis 4 années post-fondamentales.",
    niveaux: [
      { cycle: 'MATERNELLE', code: 'MAT1', libelle: 'Petite section', ordre: 1 },
      { cycle: 'MATERNELLE', code: 'MAT2', libelle: 'Moyenne section', ordre: 2 },
      { cycle: 'MATERNELLE', code: 'MAT3', libelle: 'Grande section', ordre: 3 },
      { cycle: 'PRIMAIRE', code: 'P1', libelle: '1ere année', ordre: 11 },
      { cycle: 'PRIMAIRE', code: 'P2', libelle: '2ème année', ordre: 12 },
      { cycle: 'PRIMAIRE', code: 'P3', libelle: '3ème année', ordre: 13 },
      { cycle: 'PRIMAIRE', code: 'P4', libelle: '4ème année', ordre: 14 },
      { cycle: 'PRIMAIRE', code: 'P5', libelle: '5ème année', ordre: 15 },
      { cycle: 'PRIMAIRE', code: 'P6', libelle: '6ème année', ordre: 16 },
      { cycle: 'COLLEGE', code: 'F7', libelle: '7ème année', ordre: 21 },
      { cycle: 'COLLEGE', code: 'F8', libelle: '8ème année', ordre: 22 },
      { cycle: 'COLLEGE', code: 'F9', libelle: '9ème année', ordre: 23 },
      { cycle: 'LYCEE', code: 'PF1', libelle: '1ere post-fondamentale', ordre: 31 },
      { cycle: 'LYCEE', code: 'PF2', libelle: '2ème post-fondamentale', ordre: 32 },
      { cycle: 'LYCEE', code: 'PF3', libelle: '3ème post-fondamentale', ordre: 33 },
      { cycle: 'LYCEE', code: 'PF4', libelle: '4ème post-fondamentale', ordre: 34 }
    ]
  },
  {
    code: 'FRANCOPHONE_CLASSIQUE',
    libelle: 'Système francophone classique',
    description:
      "Structure de type CP1 a CM2, puis 6ème a 3ème au collège, et 2nde a Terminale au lycée.",
    niveaux: [
      { cycle: 'MATERNELLE', code: 'MAT1', libelle: 'Petite section', ordre: 1 },
      { cycle: 'MATERNELLE', code: 'MAT2', libelle: 'Moyenne section', ordre: 2 },
      { cycle: 'MATERNELLE', code: 'MAT3', libelle: 'Grande section', ordre: 3 },
      { cycle: 'PRIMAIRE', code: 'CP1', libelle: 'CP1', ordre: 11 },
      { cycle: 'PRIMAIRE', code: 'CP2', libelle: 'CP2', ordre: 12 },
      { cycle: 'PRIMAIRE', code: 'CE1', libelle: 'CE1', ordre: 13 },
      { cycle: 'PRIMAIRE', code: 'CE2', libelle: 'CE2', ordre: 14 },
      { cycle: 'PRIMAIRE', code: 'CM1', libelle: 'CM1', ordre: 15 },
      { cycle: 'PRIMAIRE', code: 'CM2', libelle: 'CM2', ordre: 16 },
      { cycle: 'COLLEGE', code: 'C6', libelle: '6eme', ordre: 21 },
      { cycle: 'COLLEGE', code: 'C5', libelle: '5eme', ordre: 22 },
      { cycle: 'COLLEGE', code: 'C4', libelle: '4eme', ordre: 23 },
      { cycle: 'COLLEGE', code: 'C3', libelle: '3eme', ordre: 24 },
      { cycle: 'LYCEE', code: 'L2', libelle: 'Seconde', ordre: 31 },
      { cycle: 'LYCEE', code: 'L1', libelle: 'Première', ordre: 32 },
      { cycle: 'LYCEE', code: 'LT', libelle: 'Terminale', ordre: 33 }
    ]
  },
  {
    code: 'TECHNIQUE_PRO',
    libelle: 'Enseignement technique et professionnel',
    description:
      "Structure en années de formation (A1 a A4) adaptée aux écoles techniques et aux centres de métiers.",
    niveaux: [
      { cycle: 'TECHNIQUE', code: 'T1', libelle: '1ere année technique', ordre: 41 },
      { cycle: 'TECHNIQUE', code: 'T2', libelle: '2ème année technique', ordre: 42 },
      { cycle: 'TECHNIQUE', code: 'T3', libelle: '3ème année technique', ordre: 43 },
      { cycle: 'TECHNIQUE', code: 'T4', libelle: '4ème année technique', ordre: 44 },
      { cycle: 'PROFESSIONNEL', code: 'PRO1', libelle: '1ere année métiers', ordre: 51 },
      { cycle: 'PROFESSIONNEL', code: 'PRO2', libelle: '2ème année métiers', ordre: 52 },
      { cycle: 'PROFESSIONNEL', code: 'PRO3', libelle: '3ème année métiers', ordre: 53 }
    ]
  }
]

export const MATIERES_REFERENCE: {
  code: string
  libelle: string
  cycle: string | null
  categorie: string
}[] = [
  // Éveil / maternelle
  { code: 'EVEIL', libelle: 'Activités d’éveil', cycle: 'MATERNELLE', categorie: 'Éveil' },
  { code: 'GRAPH', libelle: 'Graphisme et écriture', cycle: 'MATERNELLE', categorie: 'Éveil' },
  // Langues
  { code: 'LANG_NAT', libelle: 'Langue nationale', cycle: null, categorie: 'Langues' },
  { code: 'FR', libelle: 'Français', cycle: null, categorie: 'Langues' },
  { code: 'ANG', libelle: 'Anglais', cycle: null, categorie: 'Langues' },
  { code: 'SWA', libelle: 'Kiswahili', cycle: null, categorie: 'Langues' },
  // Sciences
  { code: 'MATH', libelle: 'Mathématiques', cycle: null, categorie: 'Sciences' },
  { code: 'PHY', libelle: 'Physique', cycle: null, categorie: 'Sciences' },
  { code: 'CHIM', libelle: 'Chimie', cycle: null, categorie: 'Sciences' },
  { code: 'BIO', libelle: 'Biologie', cycle: null, categorie: 'Sciences' },
  { code: 'SCI', libelle: 'Sciences et technologie', cycle: 'PRIMAIRE', categorie: 'Sciences' },
  // Humanités
  { code: 'HIST', libelle: 'Histoire', cycle: null, categorie: 'Humanités' },
  { code: 'GEO', libelle: 'Géographie', cycle: null, categorie: 'Humanités' },
  { code: 'CIV', libelle: 'Éducation civique et morale', cycle: null, categorie: 'Humanités' },
  { code: 'PHILO', libelle: 'Philosophie', cycle: 'LYCEE', categorie: 'Humanités' },
  { code: 'REL', libelle: 'Religion', cycle: null, categorie: 'Humanités' },
  { code: 'ECO', libelle: 'Économie', cycle: 'LYCEE', categorie: 'Humanités' },
  // Arts et sport
  { code: 'EPS', libelle: 'Éducation physique et sportive', cycle: null, categorie: 'Arts et sport' },
  { code: 'MUS', libelle: 'Musique et chant', cycle: null, categorie: 'Arts et sport' },
  { code: 'DESS', libelle: 'Dessin', cycle: null, categorie: 'Arts et sport' },
  // Technique
  { code: 'INFO', libelle: 'Informatique', cycle: null, categorie: 'Technique' },
  { code: 'DESS_TECH', libelle: 'Dessin technique', cycle: 'TECHNIQUE', categorie: 'Technique' },
  { code: 'ATEL', libelle: 'Atelier / pratique professionnelle', cycle: 'TECHNIQUE', categorie: 'Technique' },
  { code: 'ELEC', libelle: 'Électricité', cycle: 'TECHNIQUE', categorie: 'Technique' },
  { code: 'MECA', libelle: 'Mécanique', cycle: 'TECHNIQUE', categorie: 'Technique' },
  { code: 'CONSTR', libelle: 'Construction / maçonnerie', cycle: 'TECHNIQUE', categorie: 'Technique' },
  { code: 'COUTURE', libelle: 'Coupe et couture', cycle: 'PROFESSIONNEL', categorie: 'Technique' },
  { code: 'COMPTA', libelle: 'Comptabilité', cycle: 'TECHNIQUE', categorie: 'Gestion' },
  { code: 'GEST', libelle: 'Gestion et entrepreneuriat', cycle: 'TECHNIQUE', categorie: 'Gestion' },
  { code: 'AGRI', libelle: 'Agronomie', cycle: 'TECHNIQUE', categorie: 'Technique' }
]

export const FILIERES_REFERENCE = [
  { code: 'SCI', libelle: 'Sciences', cycle: 'LYCEE' },
  { code: 'LET', libelle: 'Lettres et sciences humaines', cycle: 'LYCEE' },
  { code: 'LANG', libelle: 'Langues', cycle: 'LYCEE' },
  { code: 'ECOGEST', libelle: 'Économie et gestion', cycle: 'TECHNIQUE' },
  { code: 'ELECT', libelle: 'Électricité', cycle: 'TECHNIQUE' },
  { code: 'CONST', libelle: 'Construction', cycle: 'TECHNIQUE' },
  { code: 'MECAN', libelle: 'Mécanique', cycle: 'TECHNIQUE' },
  { code: 'INFOR', libelle: 'Informatique', cycle: 'TECHNIQUE' },
  { code: 'AGRON', libelle: 'Agronomie', cycle: 'TECHNIQUE' },
  { code: 'HOTEL', libelle: 'Hôtellerie et restauration', cycle: 'PROFESSIONNEL' },
  { code: 'COUT', libelle: 'Coupe et couture', cycle: 'PROFESSIONNEL' }
]

/** Modeles SMS pre-remplis. Volontairement courts : un SMS = 160 caracteres. */
export const MODELES_SMS_REFERENCE = [
  {
    code: 'RECU_PAIEMENT',
    libelle: 'Accusé de réception de paiement',
    contenu:
      '{{ecole}} : nous accusons réception de {{montant}} pour {{eleve}} ({{classe}}). Reçu N{{recu}}. Reste à payer : {{reste}}. Merci.',
    automatique: 1
  },
  {
    code: 'RAPPEL_IMPAYE',
    libelle: 'Relance des impayés',
    contenu:
      '{{ecole}} : le solde de scolarité de {{eleve}} ({{classe}}) est de {{reste}}. Merci de régulariser. Info : {{telephone_ecole}}',
    automatique: 0
  },
  {
    code: 'ABSENCE_ELEVE',
    libelle: 'Alerte absence',
    contenu:
      '{{ecole}} : votre enfant {{eleve}} ({{classe}}) a été absent le {{date}}. Merci de justifier aupres de la direction.',
    automatique: 1
  },
  {
    code: 'RETARD_ELEVE',
    libelle: 'Alerte retard',
    contenu: '{{ecole}} : {{eleve}} ({{classe}}) est arrivé en retard le {{date}}.',
    automatique: 0
  },
  {
    code: 'BULLETIN_DISPO',
    libelle: 'Bulletin disponible',
    contenu:
      '{{ecole}} : bulletin {{periode}} de {{eleve}} disponible. Moyenne {{moyenne}}/20, rang {{rang}}/{{effectif}}. Retrait au secrétariat.',
    automatique: 0
  },
  {
    code: 'CONVOCATION',
    libelle: 'Convocation du tuteur',
    contenu:
      '{{ecole}} : vous êtes invite(e) a passer à l’école au sujet de {{eleve}} ({{classe}}). Motif : {{motif}}.',
    automatique: 0
  },
  {
    code: 'INFO_GENERALE',
    libelle: 'Communique général',
    contenu: '{{ecole}} : {{motif}}',
    automatique: 0
  }
]

export const PRIMES_RETENUES_REFERENCE = [
  { libelle: 'Prime de transport', type: 'PRIME' },
  { libelle: 'Prime de logement', type: 'PRIME' },
  { libelle: 'Prime de rendement', type: 'PRIME' },
  { libelle: 'Indemnite de titulariat', type: 'PRIME' },
  { libelle: 'Retenue pour absence', type: 'RETENUE' },
  { libelle: 'Avance sur salaire', type: 'RETENUE' },
  { libelle: 'Cotisation sociale', type: 'RETENUE' },
  { libelle: 'Impôt professionnel', type: 'RETENUE' }
]
