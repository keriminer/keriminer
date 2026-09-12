import QRCode from 'qrcode'
import type { Bulletin, Etablissement, Paiement } from '@shared/types'
import { formaterDate, formaterMontant, formaterNote } from '@shared/format'
import { stylesDocument, echapper as e } from './styles'

/* Les documents sont produits en HTML puis convertis en PDF par Electron.
   Avantage : la mise en page est exactement celle affichee a l’ecran, sans
   bibliotheque PDF supplementaire, et l’ecole peut imprimer ou envoyer le PDF. */

function enveloppe(etablissement: Etablissement, titre: string, contenu: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>${e(titre)}</title>
  <style>${stylesDocument(etablissement.couleur_primaire, etablissement.couleur_secondaire)}</style>
  </head><body>${contenu}</body></html>`
}

function entete(etablissement: Etablissement, sousTitre?: string): string {
  const coordonnees = [etablissement.adresse, etablissement.commune, etablissement.province, etablissement.pays]
    .filter(Boolean)
    .join(' · ')
  const contacts = [etablissement.telephone, etablissement.email, etablissement.bp && `B.P. ${etablissement.bp}`]
    .filter(Boolean)
    .join(' · ')

  return `<div class="entete">
    ${etablissement.logo ? `<img src="${etablissement.logo}" alt="">` : '<div style="width:70px"></div>'}
    <div class="identite">
      ${etablissement.autorite_tutelle ? `<div class="tutelle">${e(etablissement.autorite_tutelle)}</div>` : ''}
      <div class="nom">${e(etablissement.nom)}</div>
      <div class="coordonnees">${e(coordonnees)}</div>
      <div class="coordonnees">${e(contacts)}</div>
      ${etablissement.devise_texte ? `<div class="devise">« ${e(etablissement.devise_texte)} »</div>` : ''}
    </div>
    <div style="width:70px;text-align:right">
      ${etablissement.code_officiel ? `<div style="font-size:8pt;color:#6b7280">Code<br><b>${e(etablissement.code_officiel)}</b></div>` : ''}
    </div>
  </div>
  ${sousTitre ? `<div class="sous-titre">${e(sousTitre)}</div>` : ''}`
}

function pied(etablissement: Etablissement, mention = ''): string {
  return `<div class="pied">
    <span>${e(etablissement.nom)}${mention ? ` — ${e(mention)}` : ''}</span>
    <span>Edite le ${formaterDate(new Date().toISOString())} · SCOLIA</span>
  </div>`
}

/* ------------------------------- Bulletin -------------------------------- */

export function documentBulletins(
  etablissement: Etablissement,
  bulletins: Bulletin[],
  options: { afficher_rang: boolean; afficher_moyenne_classe: boolean; afficher_details: boolean }
): string {
  const pages = bulletins.map((b) => pageBulletin(etablissement, b, options)).join('')
  return enveloppe(etablissement, 'Bulletins', pages)
}

function pageBulletin(
  etablissement: Etablissement,
  b: Bulletin,
  options: { afficher_rang: boolean; afficher_moyenne_classe: boolean; afficher_details: boolean }
): string {
  const colonnesSupplementaires =
    (options.afficher_rang ? 1 : 0) + (options.afficher_moyenne_classe ? 3 : 0)

  const lignes = b.lignes
    .map(
      (l) => `<tr>
        <td>${e(l.matiere_libelle)}</td>
        <td class="centre">${l.coefficient}</td>
        <td class="num">${formaterNote(l.moyenne_sur_20)}</td>
        <td class="num">${formaterNote(l.total_points)}</td>
        ${options.afficher_rang ? `<td class="centre">${l.rang ?? '—'}</td>` : ''}
        ${
          options.afficher_moyenne_classe
            ? `<td class="num">${formaterNote(l.moyenne_classe)}</td>
               <td class="num">${formaterNote(l.note_min)}</td>
               <td class="num">${formaterNote(l.note_max)}</td>`
            : ''
        }
        <td>${e(l.appreciation)}</td>
        <td style="font-size:8.5pt">${e(l.enseignant_nom ?? '')}</td>
      </tr>`
    )
    .join('')

  return `<div class="page">
    ${etablissement.filigrane ? `<div class="filigrane"><img src="${etablissement.filigrane}"></div>` : ''}
    ${entete(etablissement)}
    <div class="titre-document">Bulletin de notes — ${e(b.periode.libelle)}</div>

    <div class="grille">
      <div class="champ"><span class="etiquette">Eleve</span><br><span class="valeur">${e(b.eleve.nom)} ${e(b.eleve.prenom)}</span></div>
      <div class="champ"><span class="etiquette">Matricule</span><br><span class="valeur">${e(b.eleve.matricule)}</span></div>
      <div class="champ"><span class="etiquette">Classe</span><br><span class="valeur">${e(b.classe.libelle)}${b.classe.filiere_libelle ? ` — ${e(b.classe.filiere_libelle)}` : ''}</span></div>
      <div class="champ"><span class="etiquette">Effectif</span><br><span class="valeur">${b.effectif} eleve(s)</span></div>
      <div class="champ"><span class="etiquette">Ne(e) le</span><br><span class="valeur">${formaterDate(b.eleve.date_naissance)}${b.eleve.lieu_naissance ? ` a ${e(b.eleve.lieu_naissance)}` : ''}</span></div>
      <div class="champ"><span class="etiquette">Annee scolaire</span><br><span class="valeur">${e(b.periode.libelle)}</span></div>
    </div>

    <table>
      <thead><tr>
        <th style="width:22%">Matiere</th>
        <th class="centre" style="width:5%">Coef.</th>
        <th class="num" style="width:8%">Moy. /20</th>
        <th class="num" style="width:8%">Points</th>
        ${options.afficher_rang ? '<th class="centre" style="width:6%">Rang</th>' : ''}
        ${options.afficher_moyenne_classe ? '<th class="num" style="width:7%">Moy. cl.</th><th class="num" style="width:6%">Min</th><th class="num" style="width:6%">Max</th>' : ''}
        <th style="width:14%">Appreciation</th>
        <th>Enseignant</th>
      </tr></thead>
      <tbody>${lignes}</tbody>
      <tfoot><tr>
        <td>TOTAL</td>
        <td class="centre">${b.total_coefficients}</td>
        <td class="num">—</td>
        <td class="num">${formaterNote(b.total_points)}</td>
        <td colspan="${colonnesSupplementaires + 2}"></td>
      </tr></tfoot>
    </table>

    <div style="display:flex;gap:10px;margin-top:10px">
      <div class="encadre" style="flex:1">
        <div style="font-size:9pt;color:#6b7280;text-transform:uppercase">Moyenne generale</div>
        <div style="font-size:22pt;font-weight:700;color:${etablissement.couleur_primaire}">
          ${formaterNote(b.moyenne_sur_20)}<span style="font-size:11pt;color:#6b7280">/20</span>
        </div>
        <div>Mention : <b>${e(b.mention)}</b></div>
      </div>
      <div class="encadre" style="flex:1">
        <div style="font-size:9pt;color:#6b7280;text-transform:uppercase">Rang</div>
        <div style="font-size:22pt;font-weight:700">${b.rang ?? '—'}<span style="font-size:11pt;color:#6b7280">/${b.effectif}</span></div>
        <div>Moyenne de la classe : <b>${formaterNote(b.moyenne_classe)}</b></div>
      </div>
      <div class="encadre" style="flex:1.2">
        <div style="font-size:9pt;color:#6b7280;text-transform:uppercase">Assiduite</div>
        <div>Absences : <b>${b.absences}</b> · Retards : <b>${b.retards}</b></div>
        <div>Conduite : <b>${e(b.conduite ?? '—')}</b></div>
        <div style="margin-top:4px">1er de la classe : <b>${formaterNote(b.moyenne_premier)}</b> · dernier : <b>${formaterNote(b.moyenne_dernier)}</b></div>
      </div>
    </div>

    <div class="encadre">
      <b>Decision du conseil :</b> ${e(b.decision)}
      ${b.observation ? `<div style="margin-top:4px"><b>Observation :</b> ${e(b.observation)}</div>` : ''}
    </div>

    <div class="signatures">
      <div class="signature"><div class="ligne">Le titulaire de classe</div></div>
      <div class="signature"><div class="ligne">Le parent / tuteur</div></div>
      <div class="signature">
        ${etablissement.signature_directeur ? `<img src="${etablissement.signature_directeur}">` : ''}
        <div class="ligne">${e(etablissement.nom_directeur ?? 'La Direction')}</div>
      </div>
    </div>
    ${pied(etablissement, 'Bulletin')}
  </div>`
}

/* --------------------------------- Recu ---------------------------------- */

export function documentRecu(
  etablissement: Etablissement,
  paiement: Paiement,
  situation: { total_du: number; total_remise: number; total_paye: number },
  mentionsLegales: string,
  enDouble = true
): string {
  const solde = situation.total_du - situation.total_remise - situation.total_paye
  const exemplaire = (mention: string) => `<div style="border:1px dashed #9ca3af;padding:10px;margin-bottom:8px">
    ${entete(etablissement)}
    <div class="titre-document" style="margin:8px 0">Recu de paiement</div>
    <div style="display:flex;justify-content:space-between;font-size:9pt;color:#6b7280">
      <span>Exemplaire : <b>${e(mention)}</b></span>
      <span>N° <b style="font-size:12pt;color:${etablissement.couleur_primaire}">${e(paiement.numero_recu)}</b></span>
    </div>
    <div class="grille" style="margin:8px 0">
      <div class="champ"><span class="etiquette">Recu de</span><br><span class="valeur">${e(paiement.eleve_nom)}</span></div>
      <div class="champ"><span class="etiquette">Matricule</span><br><span class="valeur">${e(paiement.matricule)}</span></div>
      <div class="champ"><span class="etiquette">Classe</span><br><span class="valeur">${e(paiement.classe_libelle)}</span></div>
      <div class="champ"><span class="etiquette">Date</span><br><span class="valeur">${formaterDate(paiement.date_paiement)}</span></div>
      <div class="champ"><span class="etiquette">Mode de paiement</span><br><span class="valeur">${e(paiement.mode)}${paiement.operateur ? ` (${e(paiement.operateur)})` : ''}</span></div>
      <div class="champ"><span class="etiquette">Reference</span><br><span class="valeur">${e(paiement.reference ?? '—')}</span></div>
    </div>
    <div class="bandeau" style="display:flex;justify-content:space-between;align-items:center">
      <span>MONTANT VERSE</span>
      <span style="font-size:16pt">${formaterMontant(paiement.montant, etablissement.devise_code)}</span>
    </div>
    <table style="margin-top:8px">
      <tbody>
        <tr><td>Total du (apres remise)</td><td class="num">${formaterMontant(situation.total_du - situation.total_remise, etablissement.devise_code)}</td></tr>
        <tr><td>Total deja verse</td><td class="num">${formaterMontant(situation.total_paye, etablissement.devise_code)}</td></tr>
        <tr><td><b>Reste a payer</b></td><td class="num"><b>${formaterMontant(Math.max(0, solde), etablissement.devise_code)}</b></td></tr>
      </tbody>
    </table>
    ${mentionsLegales ? `<div style="font-size:8pt;color:#6b7280;margin-top:6px">${e(mentionsLegales)}</div>` : ''}
    <div class="signatures" style="margin-top:14px">
      <div class="signature"><div class="ligne">Le payeur</div></div>
      <div class="signature"><div class="ligne">${e(paiement.caissier ?? 'Le caissier')}</div></div>
    </div>
  </div>`

  return enveloppe(
    etablissement,
    `Recu ${paiement.numero_recu}`,
    `<div class="page">${exemplaire('Client')}${enDouble ? exemplaire('Ecole') : ''}</div>`
  )
}

/* ---------------------------- Listes et registres ------------------------ */

export function documentListeClasse(
  etablissement: Etablissement,
  classe: { libelle: string; niveau_libelle?: string; titulaire_nom?: string },
  eleves: any[],
  annee: string,
  colonnesVides: number
): string {
  const lignes = eleves
    .map(
      (el, i) => `<tr>
      <td class="centre">${i + 1}</td>
      <td>${e(el.matricule)}</td>
      <td>${e(el.nom)} ${e(el.prenom)}</td>
      <td class="centre">${e(el.sexe)}</td>
      <td class="centre">${formaterDate(el.date_naissance)}</td>
      <td>${e(el.tuteur_nom ?? '')}</td>
      <td>${e(el.tuteur_telephone ?? '')}</td>
      ${Array.from({ length: colonnesVides }, () => '<td></td>').join('')}
    </tr>`
    )
    .join('')

  const garcons = eleves.filter((el) => el.sexe === 'M').length

  return enveloppe(
    etablissement,
    `Liste ${classe.libelle}`,
    `<div class="page">
      ${entete(etablissement, `Annee scolaire ${e(annee)}`)}
      <div class="titre-document">Liste des eleves — ${e(classe.libelle)}</div>
      <div style="display:flex;justify-content:space-between;font-size:9.5pt;margin-bottom:6px">
        <span>Niveau : <b>${e(classe.niveau_libelle ?? '')}</b></span>
        <span>Titulaire : <b>${e(classe.titulaire_nom ?? '—')}</b></span>
        <span>Effectif : <b>${eleves.length}</b> (${garcons} G / ${eleves.length - garcons} F)</span>
      </div>
      <table>
        <thead><tr>
          <th class="centre" style="width:4%">N°</th>
          <th style="width:12%">Matricule</th>
          <th>Nom et prenom</th>
          <th class="centre" style="width:5%">Sexe</th>
          <th class="centre" style="width:11%">Naissance</th>
          <th style="width:16%">Tuteur</th>
          <th style="width:12%">Telephone</th>
          ${Array.from({ length: colonnesVides }, () => '<th></th>').join('')}
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      ${pied(etablissement, 'Liste de classe')}
    </div>`
  )
}

export function documentFeuilleAppel(
  etablissement: Etablissement,
  classe: string,
  eleves: { matricule: string; nom_complet: string; sexe: string }[],
  periode: string,
  nbColonnes = 24
): string {
  const entetes = Array.from({ length: nbColonnes }, (_, i) => `<th style="width:2.4%">${i + 1}</th>`).join('')
  const lignes = eleves
    .map(
      (el, i) => `<tr>
      <td class="centre">${i + 1}</td>
      <td style="font-size:9pt">${e(el.nom_complet)}</td>
      ${Array.from({ length: nbColonnes }, () => '<td></td>').join('')}
    </tr>`
    )
    .join('')

  return enveloppe(
    etablissement,
    `Appel ${classe}`,
    `<div class="page">
      ${entete(etablissement)}
      <div class="titre-document">Fiche de presence — ${e(classe)}</div>
      <div class="sous-titre">${e(periode)} — cocher : P present, A absent, R retard</div>
      <table style="font-size:8pt">
        <thead><tr><th style="width:4%">N°</th><th style="width:24%">Nom et prenom</th>${entetes}</tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      ${pied(etablissement, "Fiche d’appel")}
    </div>`
  )
}

/* ------------------------------ Badges QR -------------------------------- */

export async function documentBadges(
  etablissement: Etablissement,
  enseignants: { nom: string; prenom: string; matricule: string; code_pointage: string | null; photo: string | null }[]
): Promise<string> {
  const cartes: string[] = []
  for (const ens of enseignants) {
    if (!ens.code_pointage) continue
    const qr = await QRCode.toDataURL(ens.code_pointage, { margin: 1, width: 240 })
    cartes.push(`<div style="width:85mm;height:54mm;border:1px solid #d1d5db;border-radius:3mm;
        padding:4mm;display:flex;gap:3mm;align-items:center;page-break-inside:avoid;overflow:hidden">
      <div style="flex:1;min-width:0">
        <div style="font-size:7pt;text-transform:uppercase;color:${etablissement.couleur_primaire};font-weight:700">
          ${e(etablissement.sigle || etablissement.nom)}
        </div>
        <div style="font-size:11pt;font-weight:700;margin-top:2mm;line-height:1.15">${e(ens.nom)}<br>${e(ens.prenom)}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:1mm">Mat. ${e(ens.matricule)}</div>
        <div style="font-size:7pt;color:#9ca3af;margin-top:2mm">Badge de pointage</div>
        <div style="font-family:monospace;font-size:9pt;letter-spacing:.1em">${e(ens.code_pointage)}</div>
      </div>
      <img src="${qr}" style="width:28mm;height:28mm">
    </div>`)
  }

  return enveloppe(
    etablissement,
    'Badges de pointage',
    `<div class="page" style="display:flex;flex-wrap:wrap;gap:4mm">${cartes.join('')}</div>`
  )
}

/* ----------------------------- Etats de gestion -------------------------- */

export function documentTableau(
  etablissement: Etablissement,
  titre: string,
  sousTitre: string,
  colonnes: { cle: string; libelle: string; type?: 'texte' | 'nombre' | 'montant' | 'date' }[],
  lignes: Record<string, unknown>[],
  totaux?: Record<string, unknown>
): string {
  const formater = (valeur: unknown, type?: string): string => {
    if (valeur === null || valeur === undefined) return '—'
    if (type === 'montant') return formaterMontant(Number(valeur), etablissement.devise_code, false)
    if (type === 'date') return formaterDate(String(valeur))
    return e(valeur)
  }

  const corps = lignes
    .map(
      (l, i) => `<tr>
      <td class="centre">${i + 1}</td>
      ${colonnes
        .map(
          (c) =>
            `<td class="${c.type === 'nombre' || c.type === 'montant' ? 'num' : c.type === 'date' ? 'centre' : ''}">${formater(l[c.cle], c.type)}</td>`
        )
        .join('')}
    </tr>`
    )
    .join('')

  const piedTableau = totaux
    ? `<tfoot><tr><td>—</td>${colonnes
        .map((c) => `<td class="${c.type === 'montant' || c.type === 'nombre' ? 'num' : ''}">${totaux[c.cle] !== undefined ? formater(totaux[c.cle], c.type) : ''}</td>`)
        .join('')}</tr></tfoot>`
    : ''

  return enveloppe(
    etablissement,
    titre,
    `<div class="page">
      ${entete(etablissement, sousTitre)}
      <div class="titre-document">${e(titre)}</div>
      <table>
        <thead><tr><th style="width:4%">N°</th>${colonnes.map((c) => `<th>${e(c.libelle)}</th>`).join('')}</tr></thead>
        <tbody>${corps}</tbody>
        ${piedTableau}
      </table>
      <div class="signatures">
        <div class="signature"><div class="ligne">Le responsable</div></div>
        <div class="signature"><div class="ligne">${e(etablissement.nom_directeur ?? 'La Direction')}</div></div>
      </div>
      ${pied(etablissement, titre)}
    </div>`
  )
}

/* ------------------------------ Fiche eleve ------------------------------ */

export function documentFicheEleve(
  etablissement: Etablissement,
  eleve: any,
  tuteurs: any[],
  inscriptions: any[],
  situation: { total_du: number; total_remise: number; total_paye: number } | null
): string {
  const champ = (etiquette: string, valeur: unknown) =>
    `<div class="champ"><span class="etiquette">${e(etiquette)}</span><br><span class="valeur">${e(valeur ?? '—')}</span></div>`

  return enveloppe(
    etablissement,
    `Fiche ${eleve.nom}`,
    `<div class="page">
      ${entete(etablissement)}
      <div class="titre-document">Fiche individuelle de l eleve</div>
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${eleve.photo ? `<img src="${eleve.photo}" style="width:30mm;height:38mm;object-fit:cover;border:1px solid #d1d5db">` : ''}
        <div class="grille" style="flex:1;margin:0">
          ${champ('Matricule', eleve.matricule)}
          ${champ('Nom et prenom', `${eleve.nom} ${eleve.prenom}`)}
          ${champ('Sexe', eleve.sexe === 'F' ? 'Feminin' : 'Masculin')}
          ${champ('Date de naissance', formaterDate(eleve.date_naissance))}
          ${champ('Lieu de naissance', eleve.lieu_naissance)}
          ${champ('Nationalite', eleve.nationalite)}
          ${champ('Adresse', eleve.adresse)}
          ${champ('Groupe sanguin', eleve.groupe_sanguin)}
          ${champ('Ecole de provenance', eleve.ecole_provenance)}
          ${champ('Statut', eleve.statut)}
        </div>
      </div>
      ${eleve.besoins_particuliers ? `<div class="encadre"><b>Besoins particuliers :</b> ${e(eleve.besoins_particuliers)}</div>` : ''}

      <div class="bandeau" style="margin-top:10px">Tuteurs</div>
      <table><thead><tr><th>Nom</th><th>Lien</th><th>Telephone</th><th>Profession</th></tr></thead>
      <tbody>${tuteurs
        .map(
          (t) =>
            `<tr><td>${e(t.nom)} ${e(t.prenom ?? '')}</td><td>${e(t.lien_parente ?? '—')}</td><td>${e(t.telephone)}</td><td>${e(t.profession ?? '—')}</td></tr>`
        )
        .join('')}</tbody></table>

      <div class="bandeau" style="margin-top:10px">Parcours scolaire</div>
      <table><thead><tr><th>Annee</th><th>Classe</th><th>Statut</th><th class="centre">Redoublant</th></tr></thead>
      <tbody>${inscriptions
        .map(
          (i) =>
            `<tr><td>${e(i.annee_libelle)}</td><td>${e(i.classe_libelle)}</td><td>${e(i.statut)}</td><td class="centre">${i.redoublant ? 'Oui' : 'Non'}</td></tr>`
        )
        .join('')}</tbody></table>

      ${
        situation
          ? `<div class="bandeau" style="margin-top:10px">Situation financiere (annee en cours)</div>
             <table><tbody>
               <tr><td>Total du</td><td class="num">${formaterMontant(situation.total_du - situation.total_remise, etablissement.devise_code)}</td></tr>
               <tr><td>Total verse</td><td class="num">${formaterMontant(situation.total_paye, etablissement.devise_code)}</td></tr>
               <tr><td><b>Solde</b></td><td class="num"><b>${formaterMontant(situation.total_du - situation.total_remise - situation.total_paye, etablissement.devise_code)}</b></td></tr>
             </tbody></table>`
          : ''
      }
      ${pied(etablissement, 'Fiche eleve')}
    </div>`
  )
}
