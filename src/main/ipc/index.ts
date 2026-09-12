import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readFileSync } from 'node:fs'
import type { Reponse } from '@shared/types'
import { aLaPermission } from '@shared/permissions'

import * as auth from '../services/auth'
import * as etab from '../services/etablissement'
import * as annee from '../services/annee'
import * as structure from '../services/structure'
import * as eleves from '../services/eleves'
import * as enseignants from '../services/enseignants'
import * as notes from '../services/notes'
import * as presences from '../services/presences'
import * as finances from '../services/finances'
import * as momo from '../services/mobilemoney'
import * as paie from '../services/paie'
import * as sms from '../services/sms'
import * as internat from '../services/internat'
import * as activites from '../services/activites'
import * as stats from '../services/statistiques'
import * as sauvegarde from '../services/sauvegarde'
import * as impression from '../services/impression'
import * as journal from '../services/journal'
import { MODELES_STRUCTURE, PRIMES_RETENUES_REFERENCE } from '../db/referentiel'
import { apercuPdf, enregistrerPdf, imprimer } from '../print'

type Methode = { permission?: string; publique?: boolean; fn: (...args: any[]) => unknown }

/**
 * Table des methodes exposees a l’interface.
 *
 * Chaque entree declare la permission requise. Le controle est fait ICI, dans
 * le processus principal : l’interface peut masquer des boutons, mais c’est
 * cette table qui fait foi.
 */
const METHODES: Record<string, Methode> = {
  /* ----------------------------- Session ------------------------------- */
  'session.etat': {
    publique: true,
    fn: () => ({
      installe: etab.estInstalle(),
      session: auth.sessionCourante(),
      etablissement: etab.estInstalle() ? etab.lireEtablissement() : null,
      annee: etab.estInstalle() ? annee.anneeActive() : null
    })
  },
  'session.connexion': { publique: true, fn: (l: string, m: string) => auth.connecter(l, m) },
  'session.deconnexion': { publique: true, fn: () => auth.deconnecter() },
  'session.changer_mot_de_passe': {
    publique: true,
    fn: (a: string, n: string) => auth.changerSonMotDePasse(a, n)
  },

  /* --------------------------- Installation ---------------------------- */
  'installation.modeles': { publique: true, fn: () => MODELES_STRUCTURE },
  'installation.executer': { publique: true, fn: (d: any) => etab.installer(d) },

  /* -------------------------- Etablissement ---------------------------- */
  'etablissement.lire': { fn: () => etab.lireEtablissement() },
  'etablissement.modifier': { permission: 'parametre.ecriture', fn: (d: any) => etab.modifierEtablissement(d) },
  'parametres.lire': { fn: () => etab.lireParametres() },
  'parametres.ecrire': { permission: 'parametre.ecriture', fn: (v: any) => etab.ecrireParametres(v) },

  /* ----------------------------- Annees -------------------------------- */
  'annee.liste': { fn: () => annee.listerAnnees() },
  'annee.active': { fn: () => annee.anneeActive() },
  'annee.activer': { permission: 'annee.ecriture', fn: (id: number) => annee.activerAnnee(id) },
  'annee.periodes': { fn: (id?: number) => annee.listerPeriodes(id) },
  'annee.modifier_periode': { permission: 'annee.ecriture', fn: (id: number, d: any) => annee.modifierPeriode(id, d) },
  'annee.verrouiller_periode': { permission: 'annee.ecriture', fn: (id: number) => annee.verrouillerPeriode(id) },
  'annee.deverrouiller_periode': { permission: 'annee.ecriture', fn: (id: number) => annee.deverrouillerPeriode(id) },
  'annee.bilan': { permission: 'annee.lecture', fn: (id: number) => annee.bilanAnnuel(id) },
  'annee.cloturer': { permission: 'annee.ecriture', fn: (o: any) => annee.cloturerAnnee(o) },

  /* ---------------------------- Structure ------------------------------ */
  'niveau.liste': { fn: () => structure.listerNiveaux() },
  'niveau.creer': { permission: 'classe.ecriture', fn: (d: any) => structure.creerNiveau(d) },
  'niveau.modifier': { permission: 'classe.ecriture', fn: (id: number, d: any) => structure.modifierNiveau(id, d) },
  'niveau.supprimer': { permission: 'classe.ecriture', fn: (id: number) => structure.supprimerNiveau(id) },

  'filiere.liste': { fn: () => structure.listerFilieres() },
  'filiere.creer': { permission: 'classe.ecriture', fn: (d: any) => structure.creerFiliere(d) },
  'filiere.modifier': { permission: 'classe.ecriture', fn: (id: number, d: any) => structure.modifierFiliere(id, d) },
  'filiere.supprimer': { permission: 'classe.ecriture', fn: (id: number) => structure.supprimerFiliere(id) },

  'matiere.liste': { fn: () => structure.listerMatieres() },
  'matiere.creer': { permission: 'matiere.ecriture', fn: (d: any) => structure.creerMatiere(d) },
  'matiere.modifier': { permission: 'matiere.ecriture', fn: (id: number, d: any) => structure.modifierMatiere(id, d) },
  'matiere.supprimer': { permission: 'matiere.ecriture', fn: (id: number) => structure.supprimerMatiere(id) },

  'classe.liste': { fn: (id?: number) => structure.listerClasses(id) },
  'classe.creer': { permission: 'classe.ecriture', fn: (d: any) => structure.creerClasse(d) },
  'classe.modifier': { permission: 'classe.ecriture', fn: (id: number, d: any) => structure.modifierClasse(id, d) },
  'classe.supprimer': { permission: 'classe.ecriture', fn: (id: number) => structure.supprimerClasse(id) },
  'classe.attributions': { fn: (id: number) => structure.listerAttributions(id) },
  'classe.creer_attribution': { permission: 'classe.ecriture', fn: (d: any) => structure.creerAttribution(d) },
  'classe.modifier_attribution': { permission: 'classe.ecriture', fn: (id: number, d: any) => structure.modifierAttribution(id, d) },
  'classe.supprimer_attribution': { permission: 'classe.ecriture', fn: (id: number) => structure.supprimerAttribution(id) },
  'classe.appliquer_grille': { permission: 'classe.ecriture', fn: (c: number, n: number) => structure.appliquerGrilleAuNiveau(c, n) },

  'edt.classe': { fn: (id: number) => structure.emploiDuTempsClasse(id) },
  'edt.enseignant': { fn: (id: number) => structure.emploiDuTempsEnseignant(id) },
  'edt.creer': { permission: 'classe.ecriture', fn: (d: any) => structure.creerSeance(d) },
  'edt.modifier': { permission: 'classe.ecriture', fn: (id: number, d: any) => structure.modifierSeance(id, d) },
  'edt.supprimer': { permission: 'classe.ecriture', fn: (id: number) => structure.supprimerSeance(id) },

  /* ------------------------------ Eleves ------------------------------- */
  'eleve.liste': { permission: 'eleve.lecture', fn: (f: any) => eleves.listerEleves(f) },
  'eleve.lire': { permission: 'eleve.lecture', fn: (id: number) => eleves.lireEleve(id) },
  'eleve.creer': { permission: 'eleve.ecriture', fn: (d: any) => eleves.creerEleve(d) },
  'eleve.modifier': { permission: 'eleve.ecriture', fn: (id: number, d: any) => eleves.modifierEleve(id, d) },
  'eleve.supprimer': { permission: 'eleve.ecriture', fn: (id: number) => eleves.supprimerEleve(id) },
  'eleve.matricule_suivant': { permission: 'eleve.lecture', fn: () => eleves.genererMatricule() },
  'eleve.inscrire': { permission: 'eleve.ecriture', fn: (e: number, c: number, r?: number) => eleves.inscrire(e, c, r) },
  'eleve.transferer': { permission: 'eleve.ecriture', fn: (i: number, c: number, m?: string) => eleves.transfererEleve(i, c, m) },
  'eleve.sortir': { permission: 'eleve.ecriture', fn: (i: number, s: string, m: string, d: string) => eleves.sortirEleve(i, s, m, d) },
  'eleve.rattacher_tuteur': { permission: 'eleve.ecriture', fn: (e: number, d: any, p?: boolean) => eleves.rattacherTuteur(e, d, p) },
  'eleve.modifier_tuteur': { permission: 'eleve.ecriture', fn: (id: number, d: any) => eleves.modifierTuteur(id, d) },
  'eleve.detacher_tuteur': { permission: 'eleve.ecriture', fn: (e: number, t: number) => eleves.detacherTuteur(e, t) },
  'eleve.importer': { permission: 'eleve.ecriture', fn: (l: any[]) => eleves.importerEleves(l) },

  /* --------------------------- Enseignants ----------------------------- */
  'enseignant.liste': { permission: 'enseignant.lecture', fn: (f: any) => enseignants.listerEnseignants(f) },
  'enseignant.lire': { permission: 'enseignant.lecture', fn: (id: number) => enseignants.lireEnseignant(id) },
  'enseignant.creer': { permission: 'enseignant.ecriture', fn: (d: any) => enseignants.creerEnseignant(d) },
  'enseignant.modifier': { permission: 'enseignant.ecriture', fn: (id: number, d: any) => enseignants.modifierEnseignant(id, d) },
  'enseignant.supprimer': { permission: 'enseignant.ecriture', fn: (id: number) => enseignants.supprimerEnseignant(id) },
  'enseignant.regenerer_badge': { permission: 'enseignant.ecriture', fn: (id: number) => enseignants.regenererCodePointage(id) },
  'enseignant.charge': { permission: 'enseignant.lecture', fn: () => enseignants.chargeEnseignants() },
  'enseignant.attributions': { permission: 'enseignant.lecture', fn: (id: number) => structure.attributionsEnseignant(id) },

  /* ------------------------------ Notes -------------------------------- */
  'evaluation.liste': { permission: 'note.lecture', fn: (c: number, p: number) => notes.listerEvaluations(c, p) },
  'evaluation.creer': { permission: 'note.ecriture', fn: (d: any) => notes.creerEvaluation(d) },
  'evaluation.modifier': { permission: 'note.ecriture', fn: (id: number, d: any) => notes.modifierEvaluation(id, d) },
  'evaluation.supprimer': { permission: 'note.ecriture', fn: (id: number) => notes.supprimerEvaluation(id) },
  'note.feuille': { permission: 'note.lecture', fn: (id: number) => notes.feuilleDeNotes(id) },
  'note.enregistrer': { permission: 'note.ecriture', fn: (id: number, s: any[]) => notes.enregistrerNotes(id, s) },
  'bulletin.classe': { permission: 'bulletin.lecture', fn: (c: number, p: number) => notes.calculerClasse(c, p) },
  'bulletin.eleve': { permission: 'bulletin.lecture', fn: (e: number, p: number) => notes.calculerBulletin(e, p) },
  'bulletin.appreciation': { permission: 'bulletin.lecture', fn: (e: number, p: number, d: any) => notes.enregistrerAppreciation(e, p, d) },

  /* ---------------------------- Presences ------------------------------ */
  'presence.feuille': { permission: 'presence.lecture', fn: (c: number, d: string, s: string) => presences.feuilleAppel(c, d, s) },
  'presence.enregistrer': { permission: 'presence.ecriture', fn: (c: number, d: string, s: string, l: any[], m?: number) => presences.enregistrerAppel(c, d, s, l, m ?? null) },
  'presence.synthese': { permission: 'presence.lecture', fn: (c: number, d: string, f: string) => presences.syntheseAssiduiteClasse(c, d, f) },
  'presence.absenteistes': { permission: 'presence.lecture', fn: (d: string, f: string, s?: number) => presences.elevesAbsenteistes(d, f, s) },

  'pointage.registre': { permission: 'pointage.lecture', fn: (d: string) => presences.registrePointage(d) },
  'pointage.enregistrer': { permission: 'pointage.ecriture', fn: (d: string, l: any[]) => presences.enregistrerPointage(d, l) },
  'pointage.par_code': { permission: 'pointage.ecriture', fn: (c: string) => presences.pointerParCode(c) },
  'pointage.valider': { permission: 'pointage.ecriture', fn: (d: string) => presences.validerPointages(d) },
  'pointage.synthese_mois': { permission: 'pointage.lecture', fn: (m: number, a: number) => presences.synthesePointageMois(m, a) },
  'pointage.detail': { permission: 'pointage.lecture', fn: (e: number, d: string, f: string) => presences.detailPointageEnseignant(e, d, f) },

  /* ----------------------------- Finances ------------------------------ */
  'frais.liste': { permission: 'finance.lecture', fn: (a?: number) => finances.listerFrais(a) },
  'frais.creer': { permission: 'finance.ecriture', fn: (d: any) => finances.creerFrais(d) },
  'frais.modifier': { permission: 'finance.ecriture', fn: (id: number, d: any) => finances.modifierFrais(id, d) },
  'frais.supprimer': { permission: 'finance.ecriture', fn: (id: number) => finances.supprimerFrais(id) },
  'frais.appliquer_grille': { permission: 'finance.ecriture', fn: (a?: number) => finances.appliquerGrilleTarifaire(a) },

  'finance.situations': { permission: 'finance.lecture', fn: (f: any) => finances.listerSituations(f) },
  'finance.situation_eleve': { permission: 'finance.lecture', fn: (i: number) => finances.situationEleve(i) },
  'finance.encaisser': { permission: 'finance.ecriture', fn: (d: any) => finances.encaisserPaiement(d) },
  'finance.annuler_paiement': { permission: 'finance.ecriture', fn: (id: number, m: string) => finances.annulerPaiement(id, m) },
  'finance.remise': { permission: 'finance.ecriture', fn: (id: number, r: number, m: string) => finances.accorderRemise(id, r, m) },
  'finance.journal_caisse': { permission: 'finance.lecture', fn: (d: string, f: string) => finances.journalCaisse(d, f) },
  'finance.bilan': { permission: 'finance.lecture', fn: (a?: number) => finances.bilanFinancier(a) },
  'depense.liste': { permission: 'finance.lecture', fn: (a?: number) => finances.listerDepenses(a) },
  'depense.creer': { permission: 'finance.ecriture', fn: (d: any) => finances.creerDepense(d) },
  'depense.supprimer': { permission: 'finance.ecriture', fn: (id: number) => finances.supprimerDepense(id) },

  'momo.liste': { permission: 'finance.lecture', fn: (s?: string) => momo.listerTransactions(s) },
  'momo.enregistrer': { permission: 'finance.ecriture', fn: (d: any) => momo.enregistrerTransaction(d) },
  'momo.importer': { permission: 'finance.ecriture', fn: (o: string, l: any[]) => momo.importerReleve(o, l) },
  'momo.rapprocher': { permission: 'finance.ecriture', fn: (t: number, i: number) => momo.rapprocherTransaction(t, i) },
  'momo.rejeter': { permission: 'finance.ecriture', fn: (t: number, m: string) => momo.rejeterTransaction(t, m) },
  'momo.analyser_sms': { permission: 'finance.lecture', fn: (t: string) => momo.analyserSmsOperateur(t) },

  /* -------------------------------- Paie ------------------------------- */
  'paie.liste': { permission: 'paie.lecture', fn: (m: number, a: number) => paie.listerBulletinsPaie(m, a) },
  'paie.lire': { permission: 'paie.lecture', fn: (id: number) => paie.lireBulletinPaie(id) },
  'paie.preparer': { permission: 'paie.ecriture', fn: (m: number, a: number) => paie.preparerPaieMois(m, a) },
  'paie.ajouter_ligne': { permission: 'paie.ecriture', fn: (b: number, l: any) => paie.ajouterLignePaie(b, l) },
  'paie.supprimer_ligne': { permission: 'paie.ecriture', fn: (id: number) => paie.supprimerLignePaie(id) },
  'paie.valider': { permission: 'paie.ecriture', fn: (m: number, a: number) => paie.validerPaie(m, a) },
  'paie.marquer_paye': { permission: 'paie.ecriture', fn: (id: number, d: any) => paie.marquerPaye(id, d) },
  'paie.etat': { permission: 'paie.lecture', fn: (m: number, a: number) => paie.etatPaieMois(m, a) },
  'paie.elements_reference': { permission: 'paie.lecture', fn: () => PRIMES_RETENUES_REFERENCE },

  /* -------------------------------- SMS -------------------------------- */
  'sms.modeles': { permission: 'sms.lecture', fn: () => sms.listerModeles() },
  'sms.enregistrer_modele': { permission: 'sms.envoyer', fn: (d: any) => sms.enregistrerModele(d) },
  'sms.supprimer_modele': { permission: 'sms.envoyer', fn: (id: number) => sms.supprimerModele(id) },
  'sms.messages': { permission: 'sms.lecture', fn: (f: any) => sms.listerMessages(f) },
  'sms.programmer': { permission: 'sms.envoyer', fn: (d: string, t: string, c: string) => sms.programmerSms(d, t, c) },
  'sms.campagne': { permission: 'sms.envoyer', fn: (m: string, ids: number[], v: any) => sms.programmerCampagne(m, ids, v) },
  'sms.relance_impayes': { permission: 'sms.envoyer', fn: (s?: number) => sms.programmerRelanceImpayes(s) },
  'sms.envoyer_file': { permission: 'sms.envoyer', fn: (l?: number) => sms.envoyerFileAttente(l) },
  'sms.statistiques': { permission: 'sms.lecture', fn: () => sms.statistiquesSms() },
  'sms.supprimer': { permission: 'sms.envoyer', fn: (id: number) => sms.supprimerMessage(id) },
  'sms.reprogrammer_echecs': { permission: 'sms.envoyer', fn: () => sms.reprogrammerEchecs() },

  /* ------------------------------ Internat ----------------------------- */
  'internat.dortoirs': { permission: 'internat.lecture', fn: () => internat.listerDortoirs() },
  'internat.creer_dortoir': { permission: 'internat.ecriture', fn: (d: any) => internat.creerDortoir(d) },
  'internat.modifier_dortoir': { permission: 'internat.ecriture', fn: (id: number, d: any) => internat.modifierDortoir(id, d) },
  'internat.supprimer_dortoir': { permission: 'internat.ecriture', fn: (id: number) => internat.supprimerDortoir(id) },
  'internat.generer_lits': { permission: 'internat.ecriture', fn: (d: number, n: number, p?: string) => internat.genererLits(d, n, p) },
  'internat.lits': { permission: 'internat.lecture', fn: (id: number) => internat.listerLits(id) },
  'internat.modifier_lit': { permission: 'internat.ecriture', fn: (id: number, d: any) => internat.modifierLit(id, d) },
  'internat.supprimer_lit': { permission: 'internat.ecriture', fn: (id: number) => internat.supprimerLit(id) },
  'internat.pensionnaires': { permission: 'internat.lecture', fn: () => internat.listerPensionnaires() },
  'internat.affecter': { permission: 'internat.ecriture', fn: (i: number, l: number) => internat.affecterLit(i, l) },
  'internat.liberer': { permission: 'internat.ecriture', fn: (p: number, d: string) => internat.libererLit(p, d) },
  'internat.feuille_pointage': { permission: 'internat.lecture', fn: (d: string, m: string) => internat.feuillePointageInternat(d, m) },
  'internat.enregistrer_pointage': { permission: 'internat.ecriture', fn: (d: string, m: string, l: any[]) => internat.enregistrerPointageInternat(d, m, l) },
  'internat.statistiques': { permission: 'internat.lecture', fn: () => internat.statistiquesInternat() },
  'internat.effectif_repas': { permission: 'internat.lecture', fn: (d: string, m: string) => internat.effectifRepas(d, m) },

  /* ----------------------------- Activites ----------------------------- */
  'activite.liste': { permission: 'activite.lecture', fn: (a?: number) => activites.listerActivites(a) },
  'activite.creer': { permission: 'activite.ecriture', fn: (d: any) => activites.creerActivite(d) },
  'activite.modifier': { permission: 'activite.ecriture', fn: (id: number, d: any) => activites.modifierActivite(id, d) },
  'activite.supprimer': { permission: 'activite.ecriture', fn: (id: number) => activites.supprimerActivite(id) },
  'activite.participants': { permission: 'activite.lecture', fn: (id: number) => activites.listerParticipants(id) },
  'activite.enregistrer_participants': { permission: 'activite.ecriture', fn: (id: number, l: any[]) => activites.enregistrerParticipants(id, l) },
  'activite.bilan': { permission: 'activite.lecture', fn: (a?: number) => activites.bilanParticipation(a) },

  /* --------------------------- Statistiques ---------------------------- */
  'stats.tableau_bord': { permission: 'tableau_bord.lecture', fn: () => stats.tableauBord() },
  'stats.rapport_tutelle': { permission: 'statistique.lecture', fn: (a?: number) => stats.rapportTutelle(a) },
  'stats.palmares': { permission: 'statistique.lecture', fn: (p: number, o: any) => stats.palmares(p, o) },
  'stats.evolution': { permission: 'statistique.lecture', fn: () => stats.evolutionEffectifs() },

  /* --------------------------- Utilisateurs ---------------------------- */
  'utilisateur.liste': { permission: 'utilisateur.lecture', fn: () => auth.listerUtilisateurs() },
  'utilisateur.creer': { permission: 'utilisateur.ecriture', fn: (d: any) => auth.creerUtilisateur(d) },
  'utilisateur.modifier': { permission: 'utilisateur.ecriture', fn: (id: number, d: any) => auth.modifierUtilisateur(id, d) },
  'utilisateur.reinitialiser': { permission: 'utilisateur.ecriture', fn: (id: number, m: string) => auth.reinitialiserMotDePasse(id, m) },
  'utilisateur.supprimer': { permission: 'utilisateur.ecriture', fn: (id: number) => auth.supprimerUtilisateur(id) },
  'audit.journal': { permission: 'audit.lecture', fn: (l?: number, r?: string) => journal.listerJournal(l, r) },

  /* ---------------------------- Sauvegarde ----------------------------- */
  'sauvegarde.liste': { permission: 'parametre.lecture', fn: () => sauvegarde.listerSauvegardes() },
  'sauvegarde.creer': { permission: 'parametre.ecriture', fn: (d?: string) => sauvegarde.creerSauvegarde(d) },
  'sauvegarde.restaurer': { permission: 'parametre.ecriture', fn: (c: string) => sauvegarde.restaurerSauvegarde(c) },
  'sauvegarde.diagnostic': { permission: 'parametre.lecture', fn: () => sauvegarde.diagnostic() },
  'sauvegarde.exporter_json': { permission: 'parametre.ecriture', fn: (c: string) => sauvegarde.exporterJson(c) },

  /* ---------------------------- Impression ----------------------------- */
  'impression.bulletins_classe': { permission: 'bulletin.lecture', fn: (c: number, p: number) => impression.htmlBulletinsClasse(c, p) },
  'impression.bulletin_eleve': { permission: 'bulletin.lecture', fn: (e: number, p: number) => impression.htmlBulletinEleve(e, p) },
  'impression.recu': { permission: 'finance.lecture', fn: (id: number) => impression.htmlRecu(id) },
  'impression.liste_classe': { permission: 'classe.lecture', fn: (id: number, c?: number) => impression.htmlListeClasse(id, c) },
  'impression.feuille_appel': { permission: 'presence.lecture', fn: (id: number, m: string) => impression.htmlFeuilleAppel(id, m) },
  'impression.badges': { permission: 'enseignant.lecture', fn: (ids: number[]) => impression.htmlBadgesEnseignants(ids) },
  'impression.fiche_eleve': { permission: 'eleve.lecture', fn: (id: number) => impression.htmlFicheEleve(id) },
  'impression.impayes': { permission: 'finance.lecture', fn: (c: number | null) => impression.htmlEtatImpayes(c) },
  'impression.journal_caisse': { permission: 'finance.lecture', fn: (d: string, f: string) => impression.htmlJournalCaisse(d, f) },
  'impression.etat_paie': { permission: 'paie.lecture', fn: (m: number, a: number) => impression.htmlEtatPaie(m, a) },
  'impression.rapport_tutelle': { permission: 'statistique.lecture', fn: () => impression.htmlRapportTutelle() },
  'impression.palmares': { permission: 'statistique.lecture', fn: (p: number, l: any[]) => impression.htmlPalmares(p, l) },

  /* ------------------------- Sortie des documents ---------------------- */
  'document.apercu': { fn: (html: string, nom: string) => apercuPdf(html, nom) },
  'document.enregistrer': { fn: (html: string, nom: string) => enregistrerPdf(html, nom) },
  'document.imprimer': { fn: (html: string) => imprimer(html) },

  /* ------------------------------ Fichiers ----------------------------- */
  'fichier.ouvrir': {
    fn: async (filtres: { name: string; extensions: string[] }[]) => {
      const resultat = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        properties: ['openFile'],
        filters: filtres
      })
      if (resultat.canceled || !resultat.filePaths[0]) return null
      return { chemin: resultat.filePaths[0], contenu: readFileSync(resultat.filePaths[0], 'utf-8') }
    }
  },
  'fichier.ouvrir_image': {
    fn: async () => {
      const resultat = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      })
      if (resultat.canceled || !resultat.filePaths[0]) return null
      const chemin = resultat.filePaths[0]
      const extension = chemin.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpeg'
      return `data:image/${extension};base64,${readFileSync(chemin).toString('base64')}`
    }
  },
  'fichier.choisir_dossier': {
    fn: async () => {
      const resultat = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        properties: ['openDirectory', 'createDirectory']
      })
      return resultat.canceled ? null : resultat.filePaths[0]
    }
  },
  'fichier.enregistrer_texte': {
    fn: async (contenu: string, nomDefaut: string, extension: string) => {
      const resultat = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
        defaultPath: nomDefaut,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
      })
      if (resultat.canceled || !resultat.filePath) return null
      const { writeFileSync } = await import('node:fs')
      writeFileSync(resultat.filePath, '﻿' + contenu, 'utf-8')
      return resultat.filePath
    }
  },
  'systeme.ouvrir_dossier': { fn: (chemin: string) => shell.showItemInFolder(chemin) }
}

export function enregistrerCanaux(): void {
  ipcMain.handle(
    'scolia',
    async (_evenement, methode: string, ...args: unknown[]): Promise<Reponse<unknown>> => {
      const entree = METHODES[methode]
      if (!entree) return { ok: false, erreur: `Methode inconnue : ${methode}`, code: 'INCONNUE' }

      try {
        if (!entree.publique) {
          const session = auth.sessionCourante()
          if (!session) {
            return { ok: false, erreur: 'Session expiree. Veuillez vous reconnecter.', code: 'NON_CONNECTE' }
          }
          if (entree.permission && !aLaPermission(session.permissions, entree.permission)) {
            return {
              ok: false,
              erreur: "Vous n’avez pas l’autorisation d’effectuer cette operation.",
              code: 'INTERDIT'
            }
          }
        }
        const donnees = await entree.fn(...args)
        return { ok: true, donnees }
      } catch (erreur) {
        console.error(`[ipc] ${methode}`, erreur)
        return { ok: false, erreur: (erreur as Error).message, code: 'ERREUR' }
      }
    }
  )
}
