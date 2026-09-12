/**
 * Referentiels metier partages entre le processus principal et l’interface.
 * Tout ce qui est ici est volontairement « donnee » et non « code » : ces listes
 * sont destinees a etre etendues par pays sans toucher a la logique.
 */

export const APP_NAME = 'SCOLIA'
export const APP_TAGLINE = "La gestion scolaire pensée pour l’Afrique"

/** Cycles d’enseignement couverts. Un etablissement peut en activer plusieurs. */
export const CYCLES = [
  { code: 'MATERNELLE', libelle: 'Maternelle / Préscolaire', ordre: 1 },
  { code: 'PRIMAIRE', libelle: 'Primaire', ordre: 2 },
  { code: 'COLLEGE', libelle: 'Collège / Tronc commun', ordre: 3 },
  { code: 'LYCEE', libelle: 'Lycée / Humanités', ordre: 4 },
  { code: 'TECHNIQUE', libelle: 'Technique', ordre: 5 },
  { code: 'PROFESSIONNEL', libelle: 'Professionnel / Métiers', ordre: 6 }
] as const

export type CycleCode = (typeof CYCLES)[number]['code']

/**
 * Devises d’Afrique subsaharienne les plus courantes.
 * `decimales: 0` pour les monnaies ou le centime n’a pas cours (BIF, FC, FCFA...).
 */
export const DEVISES = [
  { code: 'BIF', libelle: 'Franc burundais', symbole: 'FBu', decimales: 0 },
  { code: 'CDF', libelle: 'Franc congolais', symbole: 'FC', decimales: 0 },
  { code: 'XOF', libelle: 'Franc CFA (UEMOA)', symbole: 'FCFA', decimales: 0 },
  { code: 'XAF', libelle: 'Franc CFA (CEMAC)', symbole: 'FCFA', decimales: 0 },
  { code: 'RWF', libelle: 'Franc rwandais', symbole: 'FRw', decimales: 0 },
  { code: 'GNF', libelle: 'Franc guinéen', symbole: 'FG', decimales: 0 },
  { code: 'KES', libelle: 'Shilling kenyan', symbole: 'KSh', decimales: 2 },
  { code: 'TZS', libelle: 'Shilling tanzanien', symbole: 'TSh', decimales: 0 },
  { code: 'UGX', libelle: 'Shilling ougandais', symbole: 'USh', decimales: 0 },
  { code: 'MGA', libelle: 'Ariary malgache', symbole: 'Ar', decimales: 0 },
  { code: 'MAD', libelle: 'Dirham marocain', symbole: 'DH', decimales: 2 },
  { code: 'USD', libelle: 'Dollar américain', symbole: '$', decimales: 2 },
  { code: 'EUR', libelle: 'Euro', symbole: '€', decimales: 2 }
] as const

/**
 * Operateurs de mobile money. `adaptateur` designe l’implementation technique :
 * - `manuel`   : aucun appel reseau, le caissier saisit la reference du SMS de l’operateur.
 * - autres     : connecteur API a activer avec les identifiants marchand de l’ecole.
 */
export const OPERATEURS_MOBILE_MONEY = [
  { code: 'LUMICASH', libelle: 'Lumicash', pays: 'BI', adaptateur: 'manuel' },
  { code: 'ECOCASH', libelle: 'EcoCash', pays: 'BI', adaptateur: 'manuel' },
  { code: 'MPESA_BI', libelle: 'M-Pesa Burundi', pays: 'BI', adaptateur: 'manuel' },
  { code: 'ORANGE_MONEY', libelle: 'Orange Money', pays: 'MULTI', adaptateur: 'manuel' },
  { code: 'MTN_MOMO', libelle: 'MTN Mobile Money', pays: 'MULTI', adaptateur: 'mtn_momo' },
  { code: 'AIRTEL_MONEY', libelle: 'Airtel Money', pays: 'MULTI', adaptateur: 'manuel' },
  { code: 'MPESA', libelle: 'M-Pesa (Safaricom)', pays: 'KE', adaptateur: 'manuel' },
  { code: 'WAVE', libelle: 'Wave', pays: 'MULTI', adaptateur: 'manuel' },
  { code: 'MOOV_MONEY', libelle: 'Moov Money', pays: 'MULTI', adaptateur: 'manuel' }
] as const

/** Passerelles SMS. `modem_gsm` fonctionne sans internet, via une cle GSM sur le PC. */
export const PASSERELLES_SMS = [
  { code: 'AUCUNE', libelle: 'Désactivé' },
  { code: 'MODEM_GSM', libelle: 'Modem / clé GSM locale (sans internet)' },
  { code: 'HTTP_GENERIQUE', libelle: 'Passerelle HTTP générique (opérateur local)' },
  { code: 'TWILIO', libelle: 'Twilio' },
  { code: 'AFRICASTALKING', libelle: "Africa’s Talking" },
  { code: 'INFOBIP', libelle: 'Infobip' }
] as const

export const TYPES_EVALUATION = [
  { code: 'INTERRO', libelle: 'Interrogation', poidsDefaut: 1 },
  { code: 'DEVOIR', libelle: 'Devoir', poidsDefaut: 2 },
  { code: 'TP', libelle: 'Travaux pratiques', poidsDefaut: 2 },
  { code: 'COMPOSITION', libelle: 'Composition', poidsDefaut: 3 },
  { code: 'EXAMEN', libelle: 'Examen', poidsDefaut: 4 }
] as const

export const TYPES_FRAIS = [
  { code: 'INSCRIPTION', libelle: 'Frais d’inscription' },
  { code: 'SCOLARITE', libelle: 'Frais de scolarité' },
  { code: 'EXAMEN', libelle: 'Frais d’examen' },
  { code: 'UNIFORME', libelle: 'Uniforme / tenue' },
  { code: 'FOURNITURE', libelle: 'Fournitures' },
  { code: 'INTERNAT', libelle: 'Internat / pension' },
  { code: 'TRANSPORT', libelle: 'Transport' },
  { code: 'CANTINE', libelle: 'Cantine' },
  { code: 'AUTRE', libelle: 'Autre' }
] as const

export const MODES_PAIEMENT = [
  { code: 'ESPECES', libelle: 'Espèces' },
  { code: 'MOBILE_MONEY', libelle: 'Mobile money' },
  { code: 'BANQUE', libelle: 'Virement / dépôt bancaire' },
  { code: 'CHEQUE', libelle: 'Chèque' },
  { code: 'BOURSE', libelle: 'Bourse / prise en charge' }
] as const

export const STATUTS_PRESENCE = [
  { code: 'PRESENT', libelle: 'Présent', couleur: '#16a34a' },
  { code: 'RETARD', libelle: 'Retard', couleur: '#d97706' },
  { code: 'ABSENT', libelle: 'Absent', couleur: '#dc2626' },
  { code: 'EXCLU', libelle: 'Exclu du cours', couleur: '#7c3aed' },
  { code: 'PERMISSION', libelle: 'Permission', couleur: '#0284c7' }
] as const

/** Mentions francophones, appliquees sur une echelle ramenee sur 20. */
export const MENTIONS = [
  { min: 18, libelle: 'Excellent' },
  { min: 16, libelle: 'Très bien' },
  { min: 14, libelle: 'Bien' },
  { min: 12, libelle: 'Assez bien' },
  { min: 10, libelle: 'Passable' },
  { min: 8, libelle: 'Insuffisant' },
  { min: 0, libelle: 'Très insuffisant' }
] as const

export const JOURS_SEMAINE = [
  { code: 1, libelle: 'Lundi', court: 'Lun' },
  { code: 2, libelle: 'Mardi', court: 'Mar' },
  { code: 3, libelle: 'Mercredi', court: 'Mer' },
  { code: 4, libelle: 'Jeudi', court: 'Jeu' },
  { code: 5, libelle: 'Vendredi', court: 'Ven' },
  { code: 6, libelle: 'Samedi', court: 'Sam' }
] as const

/** Variables utilisables dans les modeles SMS. */
export const VARIABLES_SMS = [
  '{{eleve}}', '{{classe}}', '{{ecole}}', '{{montant}}', '{{reste}}',
  '{{date}}', '{{periode}}', '{{moyenne}}', '{{rang}}', '{{effectif}}',
  '{{recu}}', '{{tuteur}}', '{{motif}}', '{{telephone_ecole}}'
] as const
