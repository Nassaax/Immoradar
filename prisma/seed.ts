/**
 * Seed de démonstration.
 *
 * IMPORTANT : les sources ci-dessous sont des EXEMPLES DE CONFIGURATION,
 * pas une liste d'agences vérifiées. Avant d'activer une vraie source en
 * production :
 *   1. Vérifiez robots.txt (https://<domaine>/robots.txt) et les CGU du site.
 *   2. Préférez un connecteur SITEMAP ou RSS (moins intrusif qu'un HTML_INDEX).
 *   3. Contactez l'agence si possible pour un accord explicite / partenariat.
 *   4. Ajoutez la source via l'admin (/admin/sources) avec robotsAllowed=true
 *      seulement après vérification manuelle.
 *
 * Voir README.md > "Ajouter une source".
 */
import { PrismaClient, ConnectorType, SourceStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.source.upsert({
    where: { id: "example-sitemap-source" },
    update: {},
    create: {
      id: "example-sitemap-source",
      name: "Exemple — Agence Demo (sitemap)",
      baseUrl: "https://exemple-agence.test",
      connectorType: ConnectorType.SITEMAP,
      config: {
        sitemapUrl: "https://exemple-agence.test/sitemap.xml",
        // Les URLs d'annonces contiennent ce segment ; adapter par site.
        urlIncludes: "/bien/",
      },
      status: SourceStatus.PAUSED, // ne pas crawler tant que non vérifié manuellement
      robotsAllowed: false,
      minDelayMs: 1500,
      notes:
        "Source d'exemple créée par le seed. À remplacer par une vraie source vérifiée (robots.txt + CGU) avant activation.",
    },
  });

  await prisma.source.upsert({
    where: { id: "example-rss-source" },
    update: {},
    create: {
      id: "example-rss-source",
      name: "Exemple — Agence Demo (flux RSS)",
      baseUrl: "https://exemple-agence-2.test",
      connectorType: ConnectorType.RSS,
      config: {
        feedUrl: "https://exemple-agence-2.test/annonces.rss",
      },
      status: SourceStatus.PAUSED,
      robotsAllowed: false,
      minDelayMs: 1500,
      notes: "Source d'exemple créée par le seed. À vérifier avant activation.",
    },
  });

  console.log("Seed terminé : 2 sources d'exemple créées (statut PAUSED).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
