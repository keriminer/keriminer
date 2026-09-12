/** Feuille de style commune a tous les documents imprimables. */
export function stylesDocument(couleurPrimaire: string, couleurSecondaire: string): string {
  return `
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt; color: #111827; margin: 0; -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .entete { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid ${couleurPrimaire}; padding-bottom: 8px; }
  .entete img { height: 70px; width: 70px; object-fit: contain; }
  .entete .identite { flex: 1; text-align: center; }
  .entete .identite .tutelle { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
  .entete .identite .nom { font-size: 15pt; font-weight: 700; color: ${couleurPrimaire}; margin: 2px 0; }
  .entete .identite .coordonnees { font-size: 8.5pt; color: #4b5563; }
  .entete .devise { font-size: 8pt; font-style: italic; color: ${couleurSecondaire}; }

  .titre-document {
    text-align: center; margin: 14px 0 10px; font-size: 13pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: .06em; color: ${couleurPrimaire};
  }
  .sous-titre { text-align: center; font-size: 10pt; color: #4b5563; margin-top: -6px; margin-bottom: 10px; }

  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 4px 6px; }
  th { background: ${couleurPrimaire}; color: #fff; font-size: 9pt; text-transform: uppercase; letter-spacing: .02em; }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.centre, th.centre { text-align: center; }
  tfoot td { font-weight: 700; background: #f3f4f6; }

  .grille { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 18px; margin: 10px 0; }
  .champ { font-size: 10pt; }
  .champ .etiquette { color: #6b7280; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em; }
  .champ .valeur { font-weight: 600; }

  .encadre { border: 1px solid #d1d5db; border-left: 4px solid ${couleurSecondaire}; padding: 8px 10px; margin: 8px 0; background: #fafafa; }
  .bandeau { background: ${couleurPrimaire}; color: #fff; padding: 5px 10px; font-weight: 700; font-size: 10pt; }

  .signatures { display: flex; justify-content: space-between; margin-top: 26px; }
  .signature { text-align: center; width: 30%; font-size: 9pt; }
  .signature .ligne { border-top: 1px solid #6b7280; margin-top: 38px; padding-top: 3px; color: #4b5563; }
  .signature img { height: 40px; object-fit: contain; }

  .pied { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 5px; font-size: 7.5pt; color: #9ca3af; display: flex; justify-content: space-between; }

  .filigrane {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    opacity: .05; z-index: -1; pointer-events: none;
  }
  .filigrane img { width: 60%; }

  .badge { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 8.5pt; font-weight: 600; }
  .badge.vert { background: #dcfce7; color: #166534; }
  .badge.rouge { background: #fee2e2; color: #991b1b; }
  .badge.orange { background: #ffedd5; color: #9a3412; }
  `
}

export function echapper(texte: unknown): string {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
