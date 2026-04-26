# 🏨 Hotel.ci — Institut Hôtelier d'Excellence

> Plateforme SaaS moderne de gestion hôtelière avec landing page client et panneau d'administration complet.

---

## 📋 Vue d'ensemble

**Hôtel.ci** est une plateforme web complète pour un institut hôtelier, composée de :

- **Un site vitrine public** — présentation premium de l'institut, des services et résidences, avec formulaire de réservation en ligne
- **Un panneau d'administration protégé** — gestion des réservations, chambres et attributions avec notifications automatisées (email + SMS)

**Public cible :** Étudiants/clients recherchant des résidences hôtelières et administrateurs gérant les réservations et chambres.

---

## 🛠️ Stack Technique

| Couche | Technologie |
|--------|------------|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, SSR/SSG) |
| **Langage** | TypeScript |
| **Base de données** | MySQL via [Prisma ORM](https://www.prisma.io/) |
| **Authentification** | [NextAuth.js v4](https://next-auth.js.org/) (JWT + Credentials) |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Data Fetching** | [TanStack React Query](https://tanstack.com/query) |
| **Validation** | [Zod](https://zod.dev/) |
| **Email** | [Nodemailer](https://nodemailer.com/) (SMTP) |
| **SMS** | Twilio / Vonage (optionnel) |
| **Graphiques** | [Recharts](https://recharts.org/) |

---

## ✨ Fonctionnalités

### Landing Page (Public)
- 🎨 Design premium avec glassmorphism, gradients et micro-animations
- 📱 Responsive mobile-first
- 🏠 Sections : Hero (Bento grid), À Propos, Services, Résidences, FAQ, Localisation
- 📝 Modal de réservation avec validation Zod
- 🔍 SEO optimisé (JSON-LD, sitemap, robots.txt, Open Graph)

### Panneau d'Administration (Protégé)
- 📊 **Dashboard** — Liste paginée des réservations avec filtres par statut
- 🛏️ **Chambres** — CRUD complet (numéro, type, prix, capacité, statut)
- 🔑 **Attributions** — Affectation chambre ↔ réservation acceptée (transaction atomique)
- ✅ Accepter / ❌ Refuser des réservations en un clic

### Notifications Automatisées
| Canal | Déclencheur | Destinataire |
|-------|------------|--------------|
| 📧 Email | Réservation reçue | Client + Admin |
| 📧 Email | Réservation acceptée/refusée | Client |
| 📱 SMS | Réservation reçue | Client + Manager |
| 📱 SMS | Réservation acceptée/refusée | Client + Manager |

### Sécurité
- 🔐 Authentification JWT (bcryptjs)
- 👥 Système de rôles : `admin`, `manager`, `user`
- 🛡️ Middleware NextAuth protégeant `/admin` et `/api/admin`
- 🔒 Headers de sécurité (HSTS, X-Frame-Options, X-Content-Type-Options)

---

## 📁 Architecture du Projet

```
hotel/
├── .github/workflows/       # CI/CD GitHub Actions
│   └── ci.yml
├── docs/
│   └── https-setup.md       # Guide HTTPS / Certbot
├── prisma/
│   ├── schema.prisma         # Schéma BDD (5 modèles)
│   ├── seed.ts               # Données initiales (admins, chambres, réservations)
│   └── migrations/
├── public/                   # Assets statiques
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── layout.tsx        # Root layout (SEO, JSON-LD)
│   │   ├── sitemap.ts        # Sitemap dynamique
│   │   ├── robots.ts         # Robots.txt
│   │   ├── auth/page.tsx     # Login admin
│   │   ├── admin/            # Back-office
│   │   │   ├── page.tsx      # Réservations
│   │   │   ├── chambres/     # Gestion chambres
│   │   │   ├── attribuer/    # Attributions
│   │   │   └── loading.tsx   # Skeleton loading
│   │   └── api/
│   │       ├── auth/         # NextAuth endpoint
│   │       ├── reservations/ # POST public
│   │       └── admin/        # Routes protégées
│   │           ├── reservations/
│   │           ├── chambres/
│   │           └── attributions/
│   ├── components/
│   │   ├── landing/          # Navbar, Hero, About, Services, etc.
│   │   ├── admin/            # AdminSidebar
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts           # Config NextAuth
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── api-utils.ts      # Error handler, validation, auth helpers
│   │   ├── email.ts          # Service email
│   │   ├── email-templates.ts # Templates HTML premium
│   │   ├── sms.ts            # Service SMS
│   │   └── utils.ts          # Utilitaires (cn)
│   ├── hooks/                # Custom hooks (useAuth)
│   └── middleware.ts         # Protection routes admin
├── next.config.ts            # Config optimisée (headers, images, compression)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🗃️ Modèle de Données

| Table | Description |
|-------|-----------|
| `users` | Utilisateurs admin/manager |
| `user_roles` | Rôles associés (admin, manager, user) |
| `chambres` | Chambres avec numéro, type, prix, capacité, statut |
| `reservations` | Demandes de réservation clients |
| `attributions` | Liaison chambre ↔ réservation (avec checkIn/checkOut) |

---

## 🚀 Installation & Démarrage

### Prérequis

- **Node.js** ≥ 18
- **MySQL** ≥ 8.0
- **npm** ≥ 9

### 1. Cloner le projet

```bash
git clone https://github.com/votre-repo/Hôtel.ci.git
cd Hôtel.ci
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Copier et adapter `.env` :

```env
# Base de données
DATABASE_URL="mysql://root:pigierCIV01@localhost:3306/hotels_db"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Admins (seed)
SEED_ADMIN1_EMAIL="onix@Hôtel.ci"
SEED_ADMIN1_PASSWORD="Admin123!"
SEED_ADMIN2_EMAIL="admin@Hôtel.ci"
SEED_ADMIN2_PASSWORD="Admin123!"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Hôtel.ci <noreply@Hôtel.ci>"
ADMIN_EMAIL="admin@Hôtel.ci"

# SMS (optionnel)
SMS_PROVIDER=""
SMS_ACCOUNT_SID=""
SMS_AUTH_TOKEN=""
SMS_FROM_NUMBER=""
MANAGER_PHONE=""
```

### 4. Initialiser la base de données

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application est accessible sur **http://localhost:3000**.

---

## 📡 API Reference

### Routes Publiques

| Méthode | Endpoint | Description |
|---------|----------|-----------|
| `POST` | `/api/reservations` | Créer une réservation client |

### Routes Admin (JWT requis — rôle `admin` ou `manager`)

| Méthode | Endpoint | Description |
|---------|----------|-----------|
| `GET` | `/api/admin/reservations` | Liste paginée des réservations |
| `PATCH` | `/api/admin/reservations` | Changer le statut (accepter/refuser) |
| `DELETE` | `/api/admin/reservations?id=` | Supprimer une réservation |
| `GET` | `/api/admin/chambres` | Liste paginée des chambres |
| `POST` | `/api/admin/chambres` | Créer une chambre |
| `PATCH` | `/api/admin/chambres` | Modifier une chambre |
| `DELETE` | `/api/admin/chambres?id=` | Supprimer une chambre |
| `GET` | `/api/admin/attributions` | Liste des attributions |
| `POST` | `/api/admin/attributions` | Attribuer une chambre |
| `DELETE` | `/api/admin/attributions?id=&chambreId=` | Supprimer une attribution |
| `GET` | `/api/admin/attributions/available` | Réservations & chambres disponibles |

---

## 🔧 Scripts

| Script | Commande | Description |
|--------|---------|-----------|
| Dev | `npm run dev` | Serveur de développement |
| Build | `npm run build` | Build de production |
| Start | `npm run start` | Serveur de production |
| Lint | `npm run lint` | Vérification ESLint |
| Prisma Generate | `npm run prisma:generate` | Génère le client Prisma |
| Prisma Migrate | `npm run prisma:migrate` | Applique les migrations |
| Prisma Seed | `npm run prisma:seed` | Seed des données initiales |

---

## 🚢 Déploiement

### Vercel (recommandé pour Next.js)

1. Connecter le repo GitHub à [Vercel](https://vercel.com)
2. Configurer les variables d'environnement dans le dashboard Vercel
3. Vercel détecte automatiquement Next.js et déploie

### Serveur VPS (avec Nginx)

1. Cloner le projet sur le serveur
2. Configurer Nginx comme reverse proxy (voir `docs/https-setup.md`)
3. Obtenir un certificat SSL via Certbot
4. Lancer l'application avec PM2 :

```bash
npm run build
pm2 start npm --name "Hôtel.ci" -- start
```

---

## 🔄 CI/CD

Le pipeline GitHub Actions (`.github/workflows/ci.yml`) exécute automatiquement :

1. **Install** — `npm ci`
2. **Prisma Generate** — Génère le client
3. **Type-check** — `tsc --noEmit`
4. **Build** — Production build

Déclenché sur push `main`/`develop` et pull requests.

---

## 📄 Licence

Projet privé — © Hôtel.ci. Tous droits réservés.
