/**
 * Verification de bout en bout de la chaine metier.
 *
 * Ce script s'execute dans un vrai processus Electron (donc avec une vraie base
 * SQLite), sur un dossier de donnees temporaire. Il rejoue le parcours complet
 * d'une ecole : installation, structure, eleves, frais, encaissements, notes,
 * bulletins, presences, pointage, paie, puis cloture de l'annee.
 */
import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Dossier de donnees isole : la verification ne touche jamais une base reelle.
app.setPath('userData', mkdtempSync(join(tmpdir(), 'scolia-verif-')))

let reussites = 0
let echecs = 0

function verifier(intitule: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    reussites++
    console.log(`  OK   ${intitule}`)
  } else {
    echecs++
    console.error(`  ECHEC ${intitule}`, detail ?? '')
  }
}

function section(titre: string): void {
  console.log(`\n=== ${titre} ===`)
}

async function executer(): Promise<void> {
  await app.whenReady()

  const { ouvrirBase } = await import('../src/main/db')
  const etab = await import('../src/main/services/etablissement')
  const auth = await import('../src/main/services/auth')
  const annee = await import('../src/main/services/annee')
  const structure = await import('../src/main/services/structure')
  const eleves = await import('../src/main/services/eleves')
  const enseignants = await import('../src/main/services/enseignants')
  const notes = await import('../src/main/services/notes')
  const presences = await import('../src/main/services/presences')
  const finances = await import('../src/main/services/finances')
  const paie = await import('../src/main/services/paie')
  const sms = await import('../src/main/services/sms')
  const internat = await import('../src/main/services/internat')
  const stats = await import('../src/main/services/statistiques')
  const sauvegarde = await import('../src/main/services/sauvegarde')
  const impression = await import('../src/main/services/impression')

  ouvrirBase()

  /* ------------------------------ Installation --------------------------- */
  section('Installation')
  verifier("l'application n'est pas encore configuree", !etab.estInstalle())

  etab.installer({
    etablissement: {
      nom: 'Ecole Fondamentale Test',
      sigle: 'EFT',
      devise_code: 'BIF',
      couleur_primaire: '#0f766e',
      couleur_secondaire: '#f59e0b',
      seuil_reussite: 10,
      bareme_notation: 20
    },
    modele_structure: 'FONDAMENTAL_9',
    cycles: ['PRIMAIRE', 'COLLEGE'],
    annee: {
      libelle: '2025-2026',
      date_debut: '2025-09-01',
      date_fin: '2026-07-15',
      decoupage: 'TRIMESTRE'
    },
    administrateur: { nom_complet: 'Directeur Test', login: 'directeur', mot_de_passe: 'secret123' }
  })

  verifier("l'etablissement est configure", etab.estInstalle())
  verifier("l'ecole porte le bon nom", etab.lireEtablissement()?.nom === 'Ecole Fondamentale Test')

  const periodes = annee.listerPeriodes()
  verifier('trois trimestres ont ete crees', periodes.length === 3, periodes.length)
  verifier(
    'les niveaux du primaire et du college sont installes',
    structure.listerNiveaux().length === 9,
    structure.listerNiveaux().length
  )

  /* -------------------------------- Session ------------------------------ */
  section('Authentification')
  let refusee = false
  try {
    auth.connecter('directeur', 'mauvais')
  } catch {
    refusee = true
  }
  verifier('un mot de passe errone est refuse', refusee)

  const session = auth.connecter('directeur', 'secret123')
  verifier('la connexion reussit', session.utilisateur.login === 'directeur')
  verifier("l'administrateur a tous les droits", session.permissions.includes('*'))

  /* ------------------------------- Structure ----------------------------- */
  section('Structure pedagogique')
  const niveaux = structure.listerNiveaux()
  const niveauP5 = niveaux.find((n) => n.code === 'P5')!
  const niveauP6 = niveaux.find((n) => n.code === 'P6')!

  const classeA = structure.creerClasse({
    annee_id: 0, niveau_id: niveauP5.id, filiere_id: null,
    libelle: '5eme annee A', capacite: 40, salle: 'B1', titulaire_id: null
  })
  structure.creerClasse({
    annee_id: 0, niveau_id: niveauP6.id, filiere_id: null,
    libelle: '6eme annee A', capacite: 40, salle: 'B2', titulaire_id: null
  })
  verifier('deux classes sont creees', structure.listerClasses().length === 2)

  const professeur = enseignants.creerEnseignant({
    nom: 'NIYONZIMA', prenom: 'Pascal', sexe: 'M', telephone: '79111222',
    type_contrat: 'PERMANENT', salaire_base: 400000, specialite: 'Mathematiques'
  })
  const vacataire = enseignants.creerEnseignant({
    nom: 'KAMIKAZI', prenom: 'Denise', sexe: 'F', telephone: '79333444',
    type_contrat: 'VACATAIRE', taux_horaire: 5000, specialite: 'Francais'
  })
  verifier('le badge de pointage est genere', Boolean(enseignants.lireEnseignant(professeur)?.code_pointage))

  const matieres = structure.listerMatieres()
  const maths = matieres.find((m) => m.code === 'MATH')!
  const francais = matieres.find((m) => m.code === 'FR')!

  const cmMaths = structure.creerAttribution({
    classe_id: classeA, matiere_id: maths.id, enseignant_id: professeur,
    coefficient: 4, volume_horaire: 6
  })
  const cmFrancais = structure.creerAttribution({
    classe_id: classeA, matiere_id: francais.id, enseignant_id: vacataire,
    coefficient: 3, volume_horaire: 5
  })
  verifier('deux matieres sont attribuees', structure.listerAttributions(classeA).length === 2)

  // Un enseignant ne peut pas etre a deux endroits en meme temps
  structure.creerSeance({
    classe_id: classeA, jour: 1, heure_debut: '08:00', heure_fin: '09:00',
    matiere_id: maths.id, enseignant_id: professeur, salle: 'B1'
  })
  let conflitDetecte = false
  try {
    structure.creerSeance({
      classe_id: structure.listerClasses()[1].id, jour: 1, heure_debut: '08:30', heure_fin: '09:30',
      matiere_id: maths.id, enseignant_id: professeur, salle: 'B2'
    })
  } catch {
    conflitDetecte = true
  }
  verifier("un conflit d'emploi du temps est refuse", conflitDetecte)

  /* --------------------------------- Eleves ------------------------------ */
  section('Eleves et inscriptions')
  const eleveA = eleves.creerEleve({
    nom: 'NDAYISHIMIYE', prenom: 'Aline', sexe: 'F', classe_id: classeA,
    tuteur: { nom: 'NDAYISHIMIYE', prenom: 'Jean', telephone: '79123456', lien_parente: 'Pere' }
  })
  const eleveB = eleves.creerEleve({
    nom: 'HAKIZIMANA', prenom: 'Eric', sexe: 'M', classe_id: classeA,
    tuteur: { nom: 'HAKIZIMANA', prenom: 'Marie', telephone: '79654321', lien_parente: 'Mere' }
  })
  const eleveC = eleves.creerEleve({ nom: 'IRAKOZE', prenom: 'Chantal', sexe: 'F', classe_id: classeA })

  verifier('trois eleves sont inscrits', eleves.listerEleves({ classe_id: classeA }).length === 3)
  verifier('les matricules sont uniques', new Set(eleves.listerEleves({}).map((e) => e.matricule)).size === 3)

  const rapportImport = eleves.importerEleves([
    { nom: 'BIGIRIMANA', prenom: 'Yves', sexe: 'M', classe: '5eme annee A' },
    { nom: '', prenom: 'Sans nom', sexe: 'F' },
    { nom: 'MUKESHIMANA', prenom: 'Grace', sexe: 'F', classe: 'Classe inexistante' }
  ])
  verifier(
    "l'import accepte les lignes valides et signale les autres",
    rapportImport.importes === 1 && rapportImport.ignores === 2,
    rapportImport
  )

  const detailA = eleves.lireEleve(eleveA)
  verifier('le tuteur est rattache', detailA?.tuteurs.length === 1)
  verifier(
    'le numero du tuteur est normalise au format international',
    detailA?.tuteurs[0].telephone === '+25779123456',
    detailA?.tuteurs[0].telephone
  )

  /* -------------------------------- Finances ----------------------------- */
  section('Frais et encaissements')
  finances.creerFrais({ libelle: 'Frais d inscription', type: 'INSCRIPTION', montant: 20000 })
  finances.creerFrais({ libelle: 'Scolarite annuelle', type: 'SCOLARITE', montant: 120000 })
  const application = finances.appliquerGrilleTarifaire()
  verifier('la grille est appliquee a tous les inscrits', application.lignes >= 8, application)

  const inscriptionA = eleves.lireEleve(eleveA)!.inscriptions[0].id
  const situationInitiale = finances.situationEleve(inscriptionA).situation
  verifier(
    "le total du correspond a la grille",
    situationInitiale.total_du === 140000,
    situationInitiale.total_du
  )

  // Paiement partiel : doit solder l'inscription d'abord, puis entamer la scolarite
  const recu1 = finances.encaisserPaiement({
    inscription_id: inscriptionA, montant: 50000, mode: 'ESPECES'
  })
  verifier('un numero de recu est genere', recu1.numero_recu.startsWith('REC'), recu1.numero_recu)

  const apresPaiement = finances.situationEleve(inscriptionA)
  const fraisInscription = apresPaiement.frais.find((f) => f.type === 'INSCRIPTION')!
  const fraisScolarite = apresPaiement.frais.find((f) => f.type === 'SCOLARITE')!
  verifier(
    "l'inscription est soldee en priorite",
    fraisInscription.solde === 0 && fraisScolarite.paye === 30000,
    { inscription: fraisInscription.solde, scolarite: fraisScolarite.paye }
  )
  verifier(
    'le solde restant est correct',
    apresPaiement.situation.total_du - apresPaiement.situation.total_paye === 90000,
    apresPaiement.situation
  )

  // Remise sociale puis annulation d'un recu
  finances.accorderRemise(fraisScolarite.eleve_frais_id, 20000, 'Cas social')
  const apresRemise = finances.situationEleve(inscriptionA).situation
  verifier(
    'la remise reduit le montant du',
    apresRemise.total_du - apresRemise.total_remise - apresRemise.total_paye === 70000,
    apresRemise
  )

  const recu2 = finances.encaisserPaiement({
    inscription_id: inscriptionA, montant: 10000, mode: 'MOBILE_MONEY',
    operateur: 'LUMICASH', reference: 'LC000123'
  })
  finances.annulerPaiement(recu2.paiement_id, 'Erreur de saisie')
  const apresAnnulation = finances.situationEleve(inscriptionA).situation
  verifier(
    "un recu annule ne compte plus dans l'encaisse",
    apresAnnulation.total_paye === 50000,
    apresAnnulation.total_paye
  )

  const impayes = finances.listerSituations({ seulement_impayes: true })
  verifier('les impayes sont listes', impayes.length >= 3, impayes.length)

  /* ---------------------------------- Notes ------------------------------ */
  section('Notes et bulletins')
  const periode1 = periodes[0]

  const interro = notes.creerEvaluation({
    classe_matiere_id: cmMaths, periode_id: periode1.id, type: 'INTERRO',
    libelle: 'Interrogation 1', date_evaluation: '2025-10-10', bareme: 10, poids: 1
  })
  const compo = notes.creerEvaluation({
    classe_matiere_id: cmMaths, periode_id: periode1.id, type: 'COMPOSITION',
    libelle: 'Composition', date_evaluation: '2025-11-20', bareme: 20, poids: 3
  })
  const devoirFr = notes.creerEvaluation({
    classe_matiere_id: cmFrancais, periode_id: periode1.id, type: 'DEVOIR',
    libelle: 'Devoir 1', date_evaluation: '2025-10-15', bareme: 20, poids: 2
  })

  // Une note superieure au bareme doit etre refusee
  let noteRefusee = false
  try {
    notes.enregistrerNotes(interro, [{ eleve_id: eleveA, valeur: 15 }])
  } catch {
    noteRefusee = true
  }
  verifier('une note superieure au bareme est refusee', noteRefusee)

  notes.enregistrerNotes(interro, [
    { eleve_id: eleveA, valeur: 8 },   // 16/20 apres mise a l'echelle
    { eleve_id: eleveB, valeur: 5 },   // 10/20
    { eleve_id: eleveC, valeur: null, absent: 1, justifie: 1 } // neutre
  ])
  notes.enregistrerNotes(compo, [
    { eleve_id: eleveA, valeur: 14 },
    { eleve_id: eleveB, valeur: 12 },
    { eleve_id: eleveC, valeur: 9 }
  ])
  notes.enregistrerNotes(devoirFr, [
    { eleve_id: eleveA, valeur: 16 },
    { eleve_id: eleveB, valeur: 11 },
    { eleve_id: eleveC, valeur: 13 }
  ])

  const bulletinA = notes.calculerBulletin(eleveA, periode1.id)!
  const ligneMaths = bulletinA.lignes.find((l) => l.matiere_libelle === 'Mathématiques')!
  // (16 x 1 + 14 x 3) / 4 = 14,5
  verifier(
    'la moyenne de matiere est ponderee par le poids des evaluations',
    ligneMaths.moyenne_sur_20 === 14.5,
    ligneMaths.moyenne_sur_20
  )
  // (14,5 x 4 + 16 x 3) / 7 = 15,14
  verifier(
    'la moyenne generale est ponderee par les coefficients',
    bulletinA.moyenne_sur_20 === 15.14,
    bulletinA.moyenne_sur_20
  )
  verifier('le rang est calcule', bulletinA.rang === 1, bulletinA.rang)
  // 15,14/20 se situe dans la tranche [14 ; 16[ de l'echelle des mentions.
  verifier("la mention suit l'echelle", bulletinA.mention === 'Bien', bulletinA.mention)

  const bulletinC = notes.calculerBulletin(eleveC, periode1.id)!
  const mathsC = bulletinC.lignes.find((l) => l.matiere_libelle === 'Mathématiques')!
  verifier(
    'une absence justifiee est neutre et ne penalise pas',
    mathsC.moyenne_sur_20 === 9,
    mathsC.moyenne_sur_20
  )

  // Une absence NON justifiee doit au contraire compter zero
  notes.enregistrerNotes(interro, [{ eleve_id: eleveC, valeur: null, absent: 1, justifie: 0 }])
  const bulletinC2 = notes.calculerBulletin(eleveC, periode1.id)!
  const mathsC2 = bulletinC2.lignes.find((l) => l.matiere_libelle === 'Mathématiques')!
  verifier(
    'une absence non justifiee compte zero',
    mathsC2.moyenne_sur_20 === 6.75,
    mathsC2.moyenne_sur_20
  )

  const classement = notes.classementClasse(classeA, periode1.id)
  verifier('le classement couvre toute la classe', classement.length === 4, classement.length)
  verifier('le premier de la classe est correct', classement[0].eleve_id === eleveA)

  /* -------------------------------- Presences ---------------------------- */
  section('Presences et pointage')
  const feuille = presences.feuilleAppel(classeA, '2025-10-10', 'MATIN')
  verifier('tout le monde est present par defaut', feuille.every((l) => l.statut === 'PRESENT'))

  presences.enregistrerAppel(classeA, '2025-10-10', 'MATIN', [
    { ...feuille[0], statut: 'ABSENT', justifie: 0, motif: 'Non justifie' },
    { ...feuille[1], statut: 'RETARD' },
    { ...feuille[2], statut: 'PRESENT' },
    { ...feuille[3], statut: 'PRESENT' }
  ])
  const synthese = presences.syntheseAssiduiteClasse(classeA, '2025-10-01', '2025-10-31')
  const absent = synthese.find((s) => s.absences > 0)
  verifier("l'absence est comptabilisee", Boolean(absent), synthese)

  const absenteistes = presences.elevesAbsenteistes('2025-10-01', '2025-10-31', 1)
  verifier('les absenteistes sont reperes', absenteistes.length === 1, absenteistes.length)

  // Pointage par badge : premier scan = arrivee, second = depart
  const codeBadge = enseignants.lireEnseignant(professeur)!.code_pointage!
  const arrivee = presences.pointerParCode(codeBadge)
  verifier('le premier scan enregistre une arrivee', arrivee.action === 'ARRIVEE', arrivee)
  const depart = presences.pointerParCode(codeBadge)
  verifier('le second scan enregistre un depart', depart.action === 'DEPART', depart)

  let badgeRefuse = false
  try {
    presences.pointerParCode('INCONNU1')
  } catch {
    badgeRefuse = true
  }
  verifier('un badge inconnu est refuse', badgeRefuse)

  // Pointage manuel du mois, base de la paie
  const moisPaie = 10
  const anneePaie = 2025
  for (let jour = 1; jour <= 20; jour++) {
    const date = `${anneePaie}-10-${String(jour).padStart(2, '0')}`
    presences.enregistrerPointage(date, [
      {
        enseignant_id: professeur,
        statut: jour <= 18 ? 'PRESENT' : 'ABSENT',
        heure_arrivee: jour <= 18 ? '07:30' : null,
        heure_depart: jour <= 18 ? '13:30' : null
      },
      {
        enseignant_id: vacataire,
        statut: 'PRESENT',
        heure_arrivee: '08:00',
        heure_depart: '12:00'
      }
    ])
  }
  const syntheseMois = presences.synthesePointageMois(moisPaie, anneePaie)
  const lignePermanent = syntheseMois.find((s) => s.enseignant_id === professeur)!
  verifier(
    'le pointage mensuel compte les jours et les heures',
    lignePermanent.jours_presents === 18 && lignePermanent.jours_absents === 2,
    lignePermanent
  )

  /* ---------------------------------- Paie ------------------------------- */
  section('Paie')
  paie.preparerPaieMois(moisPaie, anneePaie)
  const etatPaie = paie.etatPaieMois(moisPaie, anneePaie)
  const bulletinPermanent = etatPaie.lignes.find((l) => l.enseignant_id === professeur)!
  const bulletinVacataire = etatPaie.lignes.find((l) => l.enseignant_id === vacataire)!

  // 400 000 sur 20 jours ouvres, 2 jours d'absence => retenue de 40 000
  verifier(
    "l'absence d'un permanent donne une retenue proportionnelle",
    bulletinPermanent.total_retenues === 40000 && bulletinPermanent.net_a_payer === 360000,
    bulletinPermanent
  )
  // 20 jours x 4 h x 5 000 = 400 000
  verifier(
    'un vacataire est paye sur ses heures reellement pointees',
    bulletinVacataire.net_a_payer === 400000,
    bulletinVacataire
  )

  paie.ajouterLignePaie(bulletinPermanent.id, { libelle: 'Prime de transport', type: 'PRIME', montant: 30000 })
  const apresPrime = paie.lireBulletinPaie(bulletinPermanent.id)!
  verifier(
    'une prime est repercutee sur le net a payer',
    apresPrime.bulletin.net_a_payer === 390000,
    apresPrime.bulletin.net_a_payer
  )

  /* ---------------------------------- SMS -------------------------------- */
  section('Messagerie SMS')
  const campagne = sms.programmerCampagne('RAPPEL_IMPAYE', [eleveA, eleveB, eleveC], {})
  verifier(
    'seuls les eleves ayant un tuteur avec numero sont notifies',
    campagne.programmes === 2 && campagne.ignores === 1,
    campagne
  )
  const messages = sms.listerMessages({ statut: 'EN_ATTENTE' })
  verifier('les messages attendent leur envoi', messages.length === 2, messages.length)
  verifier(
    'les variables du modele sont remplacees',
    messages[0].contenu.includes('Ecole Fondamentale Test') || messages[0].contenu.includes('EFT'),
    messages[0].contenu
  )
  verifier(
    "l'envoi est impossible sans passerelle configuree",
    await sms.envoyerFileAttente().then(() => false).catch(() => true)
  )

  /* -------------------------------- Internat ----------------------------- */
  section('Internat')
  const dortoirFilles = internat.creerDortoir({ libelle: 'Dortoir Sainte-Marie', sexe: 'F', capacite: 10 })
  internat.genererLits(dortoirFilles, 10)
  const lits = internat.listerLits(dortoirFilles)
  verifier('les lits sont generes', lits.length === 10, lits.length)

  internat.affecterLit(inscriptionA, lits[0].id)
  verifier('la pensionnaire est affectee', internat.listerPensionnaires().length === 1)

  let litOccupeRefuse = false
  try {
    const inscriptionB = eleves.lireEleve(eleveB)!.inscriptions[0].id
    internat.affecterLit(inscriptionB, lits[0].id)
  } catch {
    litOccupeRefuse = true
  }
  verifier('un lit deja occupe est refuse', litOccupeRefuse)

  let sexeRefuse = false
  try {
    const inscriptionB = eleves.lireEleve(eleveB)!.inscriptions[0].id
    internat.affecterLit(inscriptionB, lits[1].id)
  } catch {
    sexeRefuse = true
  }
  verifier("un garcon ne peut pas etre place dans un dortoir de filles", sexeRefuse)

  /* ------------------------------ Statistiques --------------------------- */
  section('Statistiques et documents')
  const tableau = stats.tableauBord()
  verifier('le tableau de bord compte les eleves', tableau.effectif_total === 4, tableau.effectif_total)
  verifier('le tableau de bord agrege les recettes', tableau.recettes_total === 50000, tableau.recettes_total)

  const rapport = stats.rapportTutelle()
  verifier("l'etat statistique totalise les effectifs", rapport.totaux.total === 4, rapport.totaux)

  const htmlBulletins = impression.htmlBulletinsClasse(classeA, periode1.id)
  verifier('les bulletins sont generes en HTML', htmlBulletins.includes('Bulletin de notes'))
  verifier("l'en-tete porte le nom de l'ecole", htmlBulletins.includes('Ecole Fondamentale Test'))

  const htmlRecu = impression.htmlRecu(recu1.paiement_id)
  verifier('le recu est genere', htmlRecu.includes(recu1.numero_recu))

  const badges = await impression.htmlBadgesEnseignants([professeur])
  verifier('le badge QR est genere', badges.includes('data:image/png;base64'))

  /* ------------------------ Verrouillage et archivage --------------------- */
  section('Verrouillage des periodes')
  const verrouillage = annee.verrouillerPeriode(periode1.id)
  verifier('les bulletins sont archives', verrouillage.archives === 4, verrouillage)

  let saisieRefusee = false
  try {
    notes.enregistrerNotes(compo, [{ eleve_id: eleveA, valeur: 20 }])
  } catch {
    saisieRefusee = true
  }
  verifier('la saisie est bloquee sur une periode verrouillee', saisieRefusee)

  // L'archive fait foi : modifier un coefficient ne doit pas reecrire le passe
  structure.modifierAttribution(cmMaths, { coefficient: 1 })
  const bulletinArchive = notes.calculerBulletin(eleveA, periode1.id)!
  verifier(
    "l'archive resiste a un changement de coefficient posterieur",
    bulletinArchive.moyenne_sur_20 === 15.14,
    bulletinArchive.moyenne_sur_20
  )
  structure.modifierAttribution(cmMaths, { coefficient: 4 })

  /* ----------------------------- Cloture d'annee ------------------------- */
  section("Cloture de l'annee scolaire")
  const bilan = annee.bilanAnnuel(annee.exigerAnneeActive().id)
  verifier('le bilan annuel couvre tous les inscrits', bilan.length === 4, bilan.length)

  const decisions: Record<number, 'ADMIS' | 'REDOUBLE' | 'SORTIE'> = {}
  for (const ligne of bilan) {
    decisions[ligne.inscription_id] = ligne.eleve_id === eleveB ? 'REDOUBLE' : 'ADMIS'
  }

  const resultatCloture = annee.cloturerAnnee({
    annee_id: annee.exigerAnneeActive().id,
    nouvelle_annee: {
      libelle: '2026-2027', date_debut: '2026-09-01', date_fin: '2027-07-15', decoupage: 'TRIMESTRE'
    },
    reconduire_classes: true,
    reconduire_frais: true,
    reconduire_attributions: true,
    promouvoir: true,
    decisions
  })

  verifier('les classes sont reconduites', resultatCloture.classes_creees === 2, resultatCloture)
  verifier('la grille tarifaire est reconduite', resultatCloture.frais_reconduits === 2, resultatCloture)
  verifier(
    'les eleves changent de niveau ou redoublent',
    resultatCloture.eleves_promus === 3 && resultatCloture.eleves_redoublants === 1,
    resultatCloture
  )

  const nouvelleAnnee = annee.anneeActive()!
  verifier('la nouvelle annee est active', nouvelleAnnee.libelle === '2026-2027', nouvelleAnnee.libelle)

  const classesSuivantes = structure.listerClasses()
  const sixieme = classesSuivantes.find((c) => c.libelle === '6eme annee A')!
  const cinquieme = classesSuivantes.find((c) => c.libelle === '5eme annee A')!
  verifier(
    'les admis montent dans la classe du niveau superieur',
    sixieme.effectif === 3,
    sixieme.effectif
  )
  verifier('le redoublant reste dans sa classe', cinquieme.effectif === 1, cinquieme.effectif)

  const anciennes = annee.listerAnnees()
  verifier(
    "l'ancienne annee est marquee cloturee",
    anciennes.find((a) => a.libelle === '2025-2026')?.cloturee === 1
  )

  /* ------------------------------ Sauvegarde ----------------------------- */
  section('Sauvegarde')
  const fichier = sauvegarde.creerSauvegarde()
  verifier('une sauvegarde est creee', fichier.taille > 0, fichier.taille)
  verifier('le diagnostic confirme une base saine', sauvegarde.diagnostic().integrite === 'ok')

  /* --------------------------------- Bilan ------------------------------- */
  console.log(`\n${'='.repeat(52)}`)
  console.log(`Verifications reussies : ${reussites}`)
  console.log(`Verifications en echec : ${echecs}`)
  console.log('='.repeat(52))
}

executer()
  .then(() => {
    app.exit(echecs === 0 ? 0 : 1)
  })
  .catch((erreur) => {
    console.error('\nERREUR FATALE :', erreur)
    app.exit(1)
  })
