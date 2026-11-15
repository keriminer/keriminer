# TwinShoot Studio

Séance photo professionnelle à la demande : l'utilisatrice crée sa **jumelle IA** à partir de ses propres photos, puis génère des portraits pour son site, ses campagnes, ses réseaux et son métier.

Inspiré du fonctionnement du « Photo Studio » de BukoFlow (analysé via son bundle JS public), avec un code, un design, des textes et un catalogue entièrement originaux.

## Démarrer

```bash
cd photo-studio
npm install
cp .env.example .env.local
# Renseignez BETTER_AUTH_SECRET (openssl rand -base64 32), le reste a des valeurs par défaut
npm run dev                  # http://localhost:3000 → page de connexion
```

- **Base de données** : sans `DATABASE_URL`, un Postgres embarqué (PGlite) est créé dans `data/pglite`. Aucune installation n'est nécessaire. Les migrations s'appliquent automatiquement au démarrage.
- **Production** : `DATABASE_URL=postgres://…` (Supabase, Neon, RDS…). Même schéma, mêmes migrations.
- **Vraies images** : `IMAGE_PROVIDER=gemini` + `GEMINI_API_KEY`.
- **Google** (optionnel) : `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Le bouton n'apparaît que si les deux sont définis.
- **Modifier le schéma** : éditez `src/db/schema.ts`, puis `npm run db:generate`.

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
| **Comptes** | Inscription et connexion par email + mot de passe (8 caractères min.), Google en option, sessions de 30 jours, limitation des tentatives (5 connexions/min) |
| **Isolation** | Chaque requête est filtrée par `userId` : photos, médias, jobs et fichiers. Un fichier d'un autre compte renvoie 404, un visiteur non connecté 401 |
| **RGPD** | Consentement explicite avant tout import de visage · export JSON de toutes les données · suppression du compte en cascade (base + fichiers) |
| **Crédits** | 20 offerts à l'inscription · débit atomique (verrou de ligne) · remboursement automatique en cas d'échec · journal `credit_ledger` |
| **Paiement** | Packs 10 / 40 / 100 crédits (2 500 / 7 500 / 15 000 FCFA) · **PayDunya** : Orange Money et Moov au Mali, MTN, Moov et Celtiis au Bénin, Wave, cartes, plus la Côte d'Ivoire, le Sénégal, le Burkina, le Togo et le Cameroun · **Stripe** en option pour les cartes internationales · historique des commandes |

## Architecture

```
drizzle/                migrations SQL versionnées
src/
  db/schema.ts          tables Better Auth (user, session, account, verification) + twin_profile, twin_photo, job, media, credit_ledger
  db/index.ts           Postgres (DATABASE_URL) ou PGlite, migrations au démarrage
  proxy                 aucun : chaque page et chaque route vérifient la session côté serveur
  app/login/            connexion / inscription
  app/api/auth/[...all] Better Auth
  app/api/account/      DELETE suppression du compte · GET export/ (JSON)
  app/api/twin/consent  POST consentement RGPD
  app/api/billing/      GET catalogue et historique · checkout/ · orders/[id] (vérification) · webhooks/paydunya · webhooks/stripe · mock/[id]
  app/billing/          recharge · return/ (confirmation) · mock/ (simulation en développement)
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
    auth.ts             Better Auth, requireUser(), crédits offerts à l'inscription
    repo.ts             requêtes base de données, toutes filtrées par userId
    storage.ts          fichiers sous users/{userId}/ (prochaine étape : S3/R2)
    billing/            packs.ts (prix FCFA/EUR) · service.ts (commandes, idempotence) · providers/ (paydunya, stripe, mock)
  components/           Studio, TwinWizard, TwinSlots, TwinDrawer, GenerateView, MediaLibrary
```

Stack : Next.js 16 (App Router), React 19, Tailwind 4, TypeScript strict, Better Auth, Drizzle ORM, Postgres / PGlite, `@google/genai`.

## Paiement : fonctionnement et sécurité

```
Client → /billing → POST /api/billing/checkout → commande "pending" en base → page du prestataire
Prestataire → IPN / webhook → on vérifie la signature → on REDEMANDE le statut à l'API → crédit
Client → /billing/return → la page vérifie elle-même le statut (secours si l'IPN n'arrive pas)
```

- **On ne croit jamais le contenu d'une notification.** PayDunya : vérification du hash SHA-512 de la Master Key, puis appel à `checkout-invoice/confirm`. Stripe : signature du webhook, puis lecture de la session.
- **Idempotence.** Un paiement ne crédite qu'une seule fois (`UPDATE … WHERE status = 'pending'` dans une transaction), même si plusieurs IPN arrivent en même temps.
- **Contrôle du montant.** Si le montant ou la devise reçus diffèrent de la commande, celle-ci est refusée et rien n'est crédité.
- **Anti-abus.** 5 commandes en attente maximum par heure. Une commande non payée expire au bout de 24 h.

**Mise en route PayDunya**
1. Créez un compte marchand sur paydunya.com, puis une application (*Intégrez notre API*).
2. Copiez les 3 clés dans `.env.local` (`PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`) et laissez `PAYDUNYA_MODE=test`.
3. L'IPN exige une URL publique en HTTPS : `{APP_URL}/api/billing/webhooks/paydunya`. En local, utilisez un tunnel (cloudflared, ngrok) et mettez son URL dans `APP_URL`.
4. Une fois les tests réussis, passez `PAYDUNYA_MODE=live` avec les clés de production.

**Stripe (optionnel, diaspora)** : `STRIPE_SECRET_KEY`, puis un webhook vers `{APP_URL}/api/billing/webhooks/stripe` (événements `checkout.session.*`) et `STRIPE_WEBHOOK_SECRET`. Il faut une entité juridique dans un pays où Stripe est disponible.

**Ajouter un prestataire** (FedaPay, Wave Business, Orange Money direct…) : un fichier dans `src/lib/billing/providers/` qui implémente `createCheckout` et `fetchStatus`, puis une route de webhook. Le reste (packs, idempotence, journal, interface) est commun.

**Développement sans compte marchand** : `PAYMENT_MOCK=true` affiche un « Paiement de test » en `npm run dev`. Il est désactivé automatiquement en production.

## Limites restantes avant production

1. ~~Authentification et multi-utilisateur~~ ✅ fait.
2. **Stockage des fichiers en local.** Il faut passer sur S3 ou R2 avec des URL signées : il suffit de remplacer `storage.ts`, qui est déjà organisé par utilisateur.
3. **Jobs exécutés dans le processus Node.** L'app doit tourner sur une seule instance (`next start`, VPS, Railway, Render). Pour plusieurs instances ou du serverless, il faut une file de tâches (Inngest, Trigger.dev, pg-boss). La récupération des jobs interrompus suppose aussi une instance unique.
4. ~~Paiement~~ ✅ fait (PayDunya + Stripe). Reste à tester avec de vraies clés sandbox PayDunya et à prévoir les remboursements, qui se font aujourd'hui manuellement depuis le tableau de bord PayDunya.
5. **Pas de vérification d'email ni de « mot de passe oublié ».** Ils sont natifs dans Better Auth mais demandent un service d'envoi d'emails (Resend, Postmark).
6. **iPhone HEIC refusé**, avec un message explicite. On peut ajouter une conversion côté client.
7. **`npm audit`** signale 4 alertes « moderate » dans `drizzle-kit`, un outil de développement qui n'est pas embarqué en production.
