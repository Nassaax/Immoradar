# ListingRadar

ListingRadar est un agrégateur d'annonces immobilières **publiées directement
par les agences sur leurs propres sites**. Le produit permet de rechercher un
bien sur un portail unique, d'être alerté rapidement des nouvelles annonces,
et de rediriger systématiquement vers l'annonce originale sur le site de
l'agence.

Ce dépôt contient un MVP complet : ingestion (connecteurs), normalisation,
déduplication, recherche, alertes email, et un espace admin minimal.

## ⚖️ Positionnement légal & éthique (à lire avant tout déploiement)

ListingRadar **n'agrège pas** les portails tiers (Immoweb, etc.) et ne
contourne aucune protection technique. Le produit est conçu pour ne crawler
que des sources où c'est explicitement permis :

- **robots.txt respecté systématiquement** (`lib/robots.ts`) : toute requête
  passe par `fetchPolite()`, qui vérifie `robots.txt` avant chaque appel et
  refuse d'aller plus loin si le chemin est interdit pour notre user-agent
  (`ListingRadarBot`, identifiable et avec une adresse de contact).
- **Une source est PAUSED par défaut** à sa création et ne peut être activée
  (`ACTIVE`) que si un admin a coché `robotsAllowed=true`, ce qui suppose une
  **vérification manuelle** préalable de `robots.txt` et des CGU du site (voir
  [Ajouter une source](#ajouter-une-source)).
- **Rate limiting par domaine** (`lib/rateLimit.ts`), délai minimum
  configurable par source (`minDelayMs`, 1 req/s par défaut).
- **Aucune photo republiée par défaut** : `thumbnailUrl` n'est extraite que si
  la source active explicitement `allowThumbnail` dans sa configuration.
  Seules les métadonnées (titre, prix, surface, ville…) et l'URL canonique
  sont stockées ; le clic renvoie toujours vers le site de l'agence.
- **Page Opt-out / retrait** (`/opt-out`) : toute agence ou tiers peut demander
  le retrait d'une annonce. La demande masque **immédiatement** l'annonce
  (`isHidden=true`) en attendant la revue d'un admin — voir
  `app/api/opt-out/route.ts` et le tableau de bord admin.
- **Site non supporté** : si `robots.txt`/les CGU interdisent le crawl, la
  source reste au statut `UNSUPPORTED` et n'est jamais crawlée. La page
  publique `/sources` explique qu'une intégration via flux officiel ou
  partenariat reste possible.
- Le User-Agent envoyé (`ListingRadarBot/1.0 (+mailto:...)`) est identifiable
  et donne un contact, conformément aux bonnes pratiques de crawl.

Avant toute mise en production, faites relire ces choix par un juriste : ce
document et le code ne constituent pas un avis juridique.

## Fonctionnalités du MVP

- **Ingestion** via 3 connecteurs (adapter pattern) : `SITEMAP`, `RSS`,
  `HTML_INDEX` (ce dernier à n'utiliser qu'en dernier recours, avec
  sélecteurs CSS explicites et `robotsAllowed` vérifié).
- **Normalisation** en un modèle commun (`lib/types.ts`,
  `NormalizedListingSchema`), validé avec Zod à chaque extraction.
- **Déduplication** par empreinte heuristique (`lib/fingerprint.ts`) :
  ville + code postal + surface + chambres + prix arrondi + type de
  transaction. Les doublons pointent vers une annonce canonique
  (`canonicalOfId`) ; l'URL source de chaque doublon reste toujours visible.
- **Historique de prix** léger (`PriceHistoryEntry`) à chaque changement
  détecté.
- **Recherche** avec filtres (ville, prix, chambres, type de bien, type de
  transaction) et tri (nouveautés / prix).
- **Alertes email quotidiennes** sans compte : un token opaque envoyé par
  email permet de gérer/désinscrire l'alerte (`/alerts`, `/alerts/manage`).
- **Page "Source status"** (`/sources`) : transparence sur la fraîcheur de
  chaque source (dernier crawl, nombre d'annonces, statut).
- **Admin minimal** (`/admin`, protégé par mot de passe) : ajout de sources,
  activation après vérification robots.txt, déclenchement manuel de crawl,
  traitement des demandes de retrait.
- **Observabilité** : logs JSON structurés (`lib/logger.ts`) + table
  `CrawlRun` journalisant chaque exécution (succès, erreurs, nombre
  d'annonces trouvées/nouvelles).

## Architecture technique

- **Next.js 14 (App Router) + TypeScript**, API routes pour le backend.
- **Postgres** via Prisma ORM (`prisma/schema.prisma`) — compatible Supabase
  ou Neon.
- **Jobs** : pas de file de messages dédiée pour ce MVP ; les crawls et
  l'envoi d'alertes sont déclenchés par **Vercel Cron** (`vercel.json`) qui
  appelle `/api/cron/crawl` et `/api/cron/alerts`. Chaque exécution est
  journalisée dans la table `CrawlRun`.
- **Cheerio** pour le parsing HTML, **fast-xml-parser** pour les sitemaps,
  **rss-parser** pour les flux RSS/Atom.
- **Zod** pour toute validation (config de source, requêtes API, données
  extraites).
- **Resend** pour l'envoi d'email (avec repli "log console" si la clé API
  n'est pas configurée, pratique en local).
- **Déploiement** : Vercel.

### Arborescence

```
app/
  page.tsx                      Accueil + recherche
  listings/[id]/page.tsx        Détail d'une annonce
  sources/page.tsx              Statut des sources (public)
  alerts/page.tsx                Inscription à une alerte
  alerts/manage/page.tsx         Gestion d'une alerte (token)
  opt-out/page.tsx               Formulaire de retrait
  admin/page.tsx                 Tableau de bord admin
  admin/login/page.tsx           Connexion admin
  admin/sources/page.tsx         Ajout d'une source
  robots.ts                      robots.txt de ListingRadar lui-même
  api/
    sources/route.ts             GET (public) / POST (admin)
    sources/[id]/route.ts        PATCH/DELETE (admin)
    crawl/route.ts               POST (admin, déclenchement manuel)
    listings/route.ts            GET (recherche publique)
    listings/[id]/route.ts       GET (détail public)
    alerts/subscribe/route.ts    POST (public)
    alerts/manage/route.ts       GET/PATCH/DELETE (public, via token)
    opt-out/route.ts             POST (public)
    cron/crawl/route.ts          POST (Vercel Cron)
    cron/alerts/route.ts         POST (Vercel Cron)
    admin/login/route.ts         POST/DELETE (session admin)
    admin/sources/route.ts       GET (admin, config complète)
    admin/takedowns/route.ts     GET (admin)
    admin/takedowns/[id]/route.ts PATCH (admin)
    admin/crawl-runs/route.ts    GET (admin, logs)
lib/
  db.ts                          Client Prisma singleton
  types.ts                       Schémas Zod (modèle normalisé, requêtes)
  crawler.ts                     Orchestrateur de crawl
  connectors/
    types.ts
    sitemapConnector.ts
    rssConnector.ts
    htmlIndexConnector.ts
  httpClient.ts                  fetch "poli" (robots.txt + rate limit)
  robots.ts                      Vérification robots.txt
  rateLimit.ts                   Rate limiter par domaine
  extract.ts                     Extraction générique (JSON-LD, Open Graph)
  fingerprint.ts                 Déduplication
  listingQuery.ts                Clause de recherche partagée (API + alertes)
  alerts.ts                      Envoi du digest quotidien
  email.ts                       Envoi via Resend
  auth.ts / adminGuard.ts        Session admin (cookie signé HMAC)
  token.ts                       Génération de tokens opaques
  publicRateLimit.ts             Anti-abus basique sur les endpoints publics
  logger.ts                      Logs JSON structurés
components/
  Nav.tsx, ListingCard.tsx, SearchFilters.tsx, Pagination.tsx
prisma/
  schema.prisma
  seed.ts                        Sources d'exemple (statut PAUSED)
```

## Setup local

Prérequis : Node.js ≥ 18.18, une base Postgres (locale, Supabase ou Neon).

```bash
npm install
cp .env.example .env
# Éditez .env : DATABASE_URL, DIRECT_URL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, CRON_SECRET…

npx prisma migrate dev --name init   # crée les tables
npm run seed                         # sources d'exemple (PAUSED, à vérifier avant activation)

npm run dev                          # http://localhost:3000
```

Sans `RESEND_API_KEY`, les emails (confirmation d'alerte, digest quotidien)
sont simplement loggés en console au lieu d'être envoyés — pratique pour
développer sans compte Resend.

### Déclencher un crawl manuellement en local

Depuis `/admin` (après connexion avec `ADMIN_PASSWORD`), utilisez le bouton
« Lancer un crawl global » ou « Crawler » sur une source, ou en ligne de
commande :

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  --cookie "lr_admin_session=<valeur du cookie après connexion>"
```

## Variables d'environnement

Voir `.env.example` pour la liste complète et des commentaires. Résumé :

| Variable                | Rôle                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `DATABASE_URL`           | Connexion Postgres (pooled, pour l'app)                          |
| `DIRECT_URL`             | Connexion Postgres directe (pour les migrations Prisma)          |
| `ADMIN_PASSWORD`         | Mot de passe de l'espace `/admin`                                 |
| `ADMIN_SESSION_SECRET`   | Secret HMAC pour signer le cookie de session admin                |
| `CRON_SECRET`            | Secret vérifié sur les appels `/api/cron/*` (Vercel Cron)         |
| `RESEND_API_KEY`         | Clé API Resend (emails). Vide = emails loggés en console          |
| `ALERTS_FROM_EMAIL`      | Adresse d'expéditeur des emails d'alerte                          |
| `NEXT_PUBLIC_SITE_URL`   | URL publique (liens absolus dans les emails)                      |
| `CRAWLER_CONTACT_EMAIL`  | Adresse affichée dans le User-Agent du crawler et sur `/opt-out`  |
| `CRAWLER_MIN_DELAY_MS`   | Délai par défaut entre deux requêtes vers un même domaine         |

## Ajouter une source

1. **Vérifiez `https://<domaine>/robots.txt`** : le chemin du sitemap/flux/
   page catalogue que vous comptez utiliser ne doit pas être `Disallow` pour
   `*` ou pour un user-agent générique de robot. Vérifiez aussi les CGU du
   site (mentions "toute reproduction interdite", scraping explicitement
   interdit, etc.).
2. **Priorisez** dans cet ordre : un flux sitemap (`SITEMAP`), un flux RSS/
   Atom (`RSS`), et en tout dernier recours une page catalogue HTML
   (`HTML_INDEX`, le plus intrusif).
3. Si possible, **contactez l'agence** pour un accord explicite ou un
   partenariat (voir l'idée "Partenariats agents" ci-dessous) — c'est la
   voie la plus sûre et la plus qualitative.
4. Dans `/admin/sources`, remplissez le formulaire (nom, URL, type de
   connecteur, configuration). La source est créée en statut **PAUSED**.
5. Ne cochez **« robots.txt vérifié »** qu'après l'étape 1. Depuis
   `/admin`, cliquez « Confirmer robots.txt OK » puis « Activer ».
6. Lancez un crawl manuel pour vérifier que les annonces sont bien
   extraites, avant de laisser le cron automatique prendre le relais.

La configuration de chaque connecteur est validée par Zod
(`lib/types.ts`) :

- `SITEMAP` : `{ sitemapUrl, urlIncludes?, urlPattern?, maxUrls? }`
- `RSS` : `{ feedUrl, maxItems? }`
- `HTML_INDEX` : `{ indexUrl, pageParam?, maxPages?, selectors: { item, link, title?, price?, address?, thumbnail? }, allowThumbnail? }`

## Déduplication

Chaque annonce reçoit une empreinte (`fingerprint`) basée sur ville + code
postal + surface arrondie + chambres + prix arrondi + type de transaction.
Si une annonce partage son empreinte avec une annonce déjà connue (mandat
partagé entre agences, republication), elle est marquée comme doublon
(`canonicalOfId`) : la page de détail affiche l'annonce canonique et liste
les sources alternatives, chacune avec son lien d'origine. Si les données
sont insuffisantes pour dédupliquer en confiance (pas de ville/prix/
surface), l'annonce reste unique par défaut — on préfère un faux négatif
(deux fiches pour le même bien) à un faux positif (fusion abusive de deux
biens différents).

## Déploiement Vercel + cron

1. Connectez le dépôt à Vercel.
2. Configurez les variables d'environnement (voir `.env.example`) dans
   Project Settings → Environment Variables.
3. `vercel.json` déclare deux crons :
   - `/api/cron/crawl` tous les jours à 5h,
   - `/api/cron/alerts` tous les jours à 7h.
   Le plan Vercel Hobby limite les cron jobs à une exécution par jour ; passez
   au plan Pro si vous avez besoin d'un crawl plus fréquent (ex: `0 */2 * * *`).
   Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET` sur ces
   appels ; la route le vérifie si `CRON_SECRET` est défini.
4. Exécutez les migrations en production : `npx prisma migrate deploy`
   (à lancer depuis votre CI/CD ou manuellement contre `DIRECT_URL`).
5. Le build Vercel exécute `prisma generate && next build` (voir
   `package.json > scripts.build`).

## Limitations connues du MVP

- La détection des annonces "retirées" (`isRemoved`) est basée sur
  l'ancienneté de `lastSeenAt` (7 jours par défaut), pas sur une comparaison
  exhaustive du catalogue à chaque run (les connecteurs plafonnent le nombre
  d'URLs traitées par run pour rester polis).
- Le rate limiter est en mémoire de process : suffisant pour un crawl
  séquentiel mono-instance, mais pas une garantie distribuée stricte.
  Idem pour l'anti-abus des endpoints publics (`lib/publicRateLimit.ts`).
- L'extraction générique (connecteurs `SITEMAP`/`RSS`) s'appuie sur les
  données structurées que le site publie déjà pour le SEO (JSON-LD,
  Open Graph) : la qualité dépend de ce que chaque site expose.

## Idées de suite (non implémentées dans ce MVP)

- **Watchlist** : sauvegarder des recherches sans créer d'alerte email.
- **Source trust score** : calculer `trustScore` (déjà en base) à partir du
  taux d'erreur des `CrawlRun` et de la fraîcheur des annonces.
- **Partenariats agents** : page dédiée invitant les agences à fournir un
  flux officiel (meilleure qualité de données, logo affiché, `HTML_INDEX`
  évité).
- **Claim listing** : permettre à une agence de revendiquer/corriger une
  annonce sans passer par une demande de retrait complète.
