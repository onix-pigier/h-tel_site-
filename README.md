# Résidences Les Chanaude

Application Next.js de gestion hôtelière avec site public, registre administratif central, gestion des chambres, suivi client, audit et notifications.

## Périmètre actuel

Le projet couvre deux surfaces:

- Un site public avec formulaire de demande de réservation.
- Un back-office protégé avec un registre  des séjours.

Le tableau de bord est le point d’entrée administratif principal. Le registre reste la page opérationnelle pour les réservations, arrivées, encaissements et clôtures. L’entrée `/admin` redirige vers `/admin/dashboard`.

## Flux métier implémentés

### Demande web

1. Le client remplit le formulaire public.
2. La demande est enregistrée en `en_attente`.
3. Le client reçoit un accusé de réception.
4. L’administration voit la demande dans le panneau de traitement.

### Traitement administratif

1. L’admin ou le gérant analyse la demande.
2. La demande peut passer en `confirmee`, `refusee`, `annulee` ou `reportee`.
3. Une demande confirmée peut ensuite être convertie en séjour planifié.

### Arrivée planifiée

Le registre pilote le tunnel d’arrivée:

1. Identité réelle et dossier.
2. Finances et encaissement.
3. Chambre, clé et activation.

À l’issue du tunnel, le séjour passe de `planifie` à `en_cours`.

### Vie du séjour

Le dashboard centralise:

- les KPIs clients, séjours et réservations,
- les alertes de départ, solde, arrivée et ménage,
- les graphiques d’affluence et de répartition clients,
- les cartes financières visibles uniquement par l’administrateur.

Le registre permet:

- l’encaissement de paiements supplémentaires,
- la prolongation,
- le report d’un séjour planifié,
- le rappel manuel du client,
- le suivi des retards,
- la clôture manuelle,
- le passage de la chambre en `attente_nettoyage`,
- la remise en `disponible` après validation du ménage.

### Rappels automatiques

Les rappels J-1 sont déclenchés par un cron quotidien, pas par l’ouverture du registre.

## Rôles

Deux rôles sont actifs:

- `admin`
- `gerant`

Les deux ont accès au back-office. Le système d’audit trace les actions critiques.

## Stack technique

- Next.js 15 App Router
- TypeScript
- Prisma ORM
- MySQL
- NextAuth v4 avec credentials
- Tailwind CSS
- shadcn/ui
- Zod
- Nodemailer

## Structure utile

```text
src/
  app/
    page.tsx
    auth/
    admin/
      dashboard/
      registre/
      chambres/
      clients/
      audit/
    api/
      reservations/
      auth/
      admin/
        reservations/
        stays/
        chambres/
        clients/
        audit/
  components/
    admin/
    landing/
    ui/
  lib/
    api-utils.ts
    audit.ts
    auth.ts
    client-utils.ts
    email.ts
    email-templates.ts
    pricing.ts
    prisma.ts
    stay-reminders.ts
    stay-utils.ts
prisma/
  schema.prisma
  seed.ts
  migrations/
scripts/
  run-stay-reminders.ts
```

## Modèle Prisma actuel

Les tables principales sont:

- `users`
- `user_roles`
- `chambres`
- `clients`
- `reservations`
- `sejours`
- `stay_extensions`
- `payments`
- `client_notes`
- `audit_logs`
- `discount_requests`
- `stay_deposits`

Remarque importante:

- `Reservation` représente la demande initiale.
- `Client` représente l’identité canonique.
- `Sejour` représente la réalité opérationnelle.

Ces recouvrements sont volontaires et servent à conserver les snapshots métier.

## États utiles

### Réservations

- `en_attente`
- `confirmee`
- `convertie`
- `refusee`
- `annulee`
- `reportee`

### Séjours

- `planifie`
- `en_cours`
- `termine`
- `annule`

### Chambres

- `disponible`
- `occupee`
- `attente_nettoyage`
- `maintenance`

## Installation locale

### Prérequis

- Node.js 18+
- npm 9+
- MySQL 8+

### Variables d’environnement minimales

Créer un `.env` avec au moins:

```env
DATABASE_URL="mysql://user:password@localhost:3306/chanaude"

NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://localhost:3000"

SEED_ADMIN_EMAIL="admin@chanaude.ci"
SEED_ADMIN_PASSWORD="ChanaudeAdmin!2026"
SEED_GERANT_EMAIL="gerant@chanaude.ci"
SEED_GERANT_PASSWORD="ChanaudeGerant!2026"

SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="Résidences Les Chanaude <noreply@chanaude.ci>"
ADMIN_EMAIL="admin@chanaude.ci"

SMS_PROVIDER=""
MANAGER_PHONE=""

CRON_SECRET="change-me-too"
```

### Installation

```bash
npm install
npm run prisma:generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

## Audit métier

Le suivi détaillé des fonctionnalités couvertes, partielles ou restantes est documenté dans [`docs/cahier-audit.md`](docs/cahier-audit.md).

## Comptes seed par défaut

Si aucune variable `SEED_*` n’est fournie:

- `admin@chanaude.ci` / `ChanaudeAdmin!2026`
- `gerant@chanaude.ci` / `ChanaudeGerant!2026`

## Scripts utiles

```bash
npm run dev
npm run dev:clean
npm run build
npm run start
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run cron:reminders
```

## Routes principales

### Public

- `GET /`
- `GET /auth`
- `POST /api/reservations`

### Back-office

- `GET /admin/registre`
- `GET /admin/chambres`
- `GET /admin/clients`
- `GET /admin/audit`

### API admin principales

- `GET /api/admin/reservations`
- `PATCH /api/admin/reservations`
- `GET /api/admin/stays`
- `POST /api/admin/stays`
- `PATCH /api/admin/stays/[id]`
- `POST /api/admin/stays/[id]/check-in`
- `POST /api/admin/stays/[id]/payments`
- `PATCH /api/admin/stays/[id]/report`
- `POST /api/admin/stays/[id]/reminder`
- `GET /api/admin/stays/reminders`
- `POST /api/admin/stays/reminders`
- `GET /api/admin/chambres`
- `PATCH /api/admin/chambres`

## Déploiement

### Vercel

Le projet inclut `vercel.json` avec un cron quotidien:

- chemin: `/api/admin/stays/reminders`
- horaire: `0 8 * * *`

À configurer côté plateforme:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`
- variables SMTP/SMS si utilisées

Le cron appelle la route avec `Authorization: Bearer <CRON_SECRET>`.

### VPS

Après build et lancement de l’application:

```bash
npm run build
pm2 start npm --name "residence-chanaude" -- start
```

Ajouter ensuite le cron système:

```bash
0 8 * * * cd /chemin/vers/hotel && npm run cron:reminders >> /var/log/residence-chanaude-reminders.log 2>&1
```

Sur VPS, le script exécute directement la logique métier et écrit l’audit en base.

## Notifications

### Emails

Les emails utilisent:

- un logo inline `cid:chanaude-logo`
- des templates HTML dans `src/lib/email-templates.ts`
- un envoi SMTP via `src/lib/email.ts`

Si le SMTP n’est pas configuré, les emails partent en mode preview dans la console.

### SMS

La couche SMS est abstraite dans `src/lib/sms.ts`.

Si aucun provider n’est configuré, les SMS restent en mode preview console.

## Vérifications recommandées

Avant livraison:

```bash
npm run lint
npm run build
npx tsc --noEmit
```

## Note Prisma

Le projet utilise Prisma 6.x.

`schema.prisma` conserve encore:

```prisma
url = env("DATABASE_URL")
```

car `prisma validate` et `prisma generate` l’exigent encore dans cette version. `prisma.config.ts` est déjà présent pour la partie Migrate, mais la suppression complète de `url` attend une migration propre vers Prisma 7 et son nouveau mode de configuration.
