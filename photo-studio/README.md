# TwinShoot Studio

Séance photo professionnelle à la demande : l'utilisatrice crée sa **jumelle IA** à partir de ses propres photos, puis génère des portraits pour son site, ses campagnes, ses réseaux et son métier.

Inspiré du fonctionnement du « Photo Studio » de BukoFlow (analysé via son bundle JS public), avec un code, un design, des textes et un catalogue entièrement originaux.

## Démarrer

```bash
cd photo-studio
npm install
cp .env.example .env.local   # IMAGE_PROVIDER=mock par défaut (aucune clé requise)
npm run dev                  # http://localhost:3000
```

Pour de vraies images : `IMAGE_PROVIDER=gemini` + `GEMINI_API_KEY` dans `.env.local`.

## Fonctionnalités

| Bloc | Détail |
|---|---|
| **Assistant jumelle** | Accueil → conseils « venez prête » → 2 jumelles → upload souriante (face obligatoire, 45°, profil, en pied) → neutre (optionnelle) |
| **Studio · Collections** | 4 usages (Site, Campagne, Social, Métier) · 18 collections + 10 secteurs × 3 scènes. Chaque collection choisit automatiquement la jumelle souriante ou neutre |
| **Studio · Miroir** | Photo d'inspiration → analyse IA du décor, de la lumière et du cadrage (jamais de l'identité) → brief modifiable |
| **Studio · Prompt libre** | Brief personnalisé + choix de la jumelle |
| **Paramètres** | Format 4:5 / 9:16 / 1:1 / 16:9 · 1 à 4 photos · aperçu et copie du brief |
| **Réglages jumelles** | Couleurs de marque injectées dans tenues et décors · coiffure et maquillage (aucun changement / selon collection / personnalisé) · réinitialisation |
| **Médiathèque** | Galerie, favoris, visionneuse au clavier, téléchargement, suppression, « Générer dans ce style » |
| **Crédits** | 1 crédit = 1 photo, réservés à la demande, remboursés automatiquement en cas d'échec |

## Architecture

```
src/
  app/api/
    catalog/            GET   catalogue (usages, collections, secteurs, formats)
    twin/               GET/PATCH profil + réglages
    twin/photos/        POST/DELETE photos de référence (JPG/PNG/WebP, 10 Mo)
    twin/reset/         POST  réinitialise une jumelle
    prompt/preview/     POST  brief exact envoyé à l'IA
    reference/analyze/  POST  mode Miroir
    generate/           POST  crée un job asynchrone (202)
    jobs/[id]/          GET   statut du job (le front interroge toutes les 2 s)
    media/, media/[id]  GET / PATCH favori / DELETE
    files/[...path]     fichiers servis (protection contre le path traversal, CSP sandbox)
  lib/
    catalog.ts          données métier des collections
    prompt.ts           construction du brief (verrou d'identité, réalisme, aucun texte ni logo)
    generation.ts       validation, réservation et remboursement des crédits, file de jobs (3 max en parallèle)
    providers/          gemini.ts (réel) · mock.ts (démo) : interface commune ImageProvider
    store.ts            base JSON + fichiers locaux, écritures sérialisées et atomiques
  components/           Studio, TwinWizard, TwinSlots, TwinDrawer, GenerateView, MediaLibrary
```

Stack : Next.js 16 (App Router), React 19, Tailwind 4, TypeScript strict, `@google/genai`.

## Limites de ce MVP (à traiter avant production)

1. **Mono-utilisateur, sans authentification.** Il faut ajouter Auth (Clerk, Supabase Auth ou Auth.js) et rattacher `profile`, `media` et `jobs` à un `userId`.
2. **Stockage local.** Il faut remplacer `store.ts` par PostgreSQL (Supabase ou Neon) et un stockage objet (S3 ou R2) avec URL signées. L'interface `read`/`mutate` isole déjà ce changement.
3. **Jobs en mémoire.** Ils fonctionnent avec `next start` (serveur Node persistant), pas en serverless. Pour Vercel, il faut une file (Inngest, Trigger.dev, QStash). Les jobs interrompus sont remboursés au redémarrage.
4. **Paiement.** Pas de Stripe pour l'instant : les crédits sont un simple compteur.
5. **Données biométriques (RGPD).** Les photos de visage sont des données sensibles. Il faut un consentement explicite, une suppression à la demande (la base existe déjà) et une politique de conservation.
6. **iPhone HEIC.** Les fichiers HEIC sont refusés avec un message explicite. On peut ajouter une conversion côté client (`heic2any`).
