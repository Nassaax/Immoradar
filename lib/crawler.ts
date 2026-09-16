import type { ConnectorType, Source } from "@prisma/client";
import { prisma } from "./db";
import { sitemapConnector } from "./connectors/sitemapConnector";
import { rssConnector } from "./connectors/rssConnector";
import { htmlIndexConnector } from "./connectors/htmlIndexConnector";
import type { Connector, SourceForCrawl } from "./connectors/types";
import { computeFingerprint } from "./fingerprint";
import { logger } from "./logger";
import { RobotsDisallowedError } from "./httpClient";

const CONNECTORS: Record<ConnectorType, Connector> = {
  SITEMAP: sitemapConnector,
  RSS: rssConnector,
  HTML_INDEX: htmlIndexConnector,
};

/** Une annonce non revue depuis ce délai est marquée comme probablement retirée du marché. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface CrawlSummary {
  sourceId: string;
  sourceName: string;
  status: "SUCCESS" | "PARTIAL" | "ERROR" | "SKIPPED_ROBOTS";
  listingsFound: number;
  listingsNew: number;
  errorMessage?: string;
}

/** Choisit l'annonce canonique existante pour une empreinte donnée, s'il y en a une. */
async function findCanonicalId(fingerprint: string, externalUrl: string): Promise<string | null> {
  const existingCanonical = await prisma.listing.findFirst({
    where: { fingerprint, externalUrl: { not: externalUrl }, canonicalOfId: null, isHidden: false },
    orderBy: { firstSeenAt: "asc" },
    select: { id: true },
  });
  return existingCanonical?.id ?? null;
}

/** Exécute un crawl pour une source unique. Journalise un CrawlRun dans tous les cas. */
export async function crawlSource(source: Source): Promise<CrawlSummary> {
  const crawlRun = await prisma.crawlRun.create({
    data: { sourceId: source.id, status: "ERROR" },
  });

  if (!source.robotsAllowed) {
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: "SKIPPED_ROBOTS",
        finishedAt: new Date(),
        errorMessage: "robotsAllowed=false : vérification manuelle du robots.txt/CGU requise avant activation.",
      },
    });
    return { sourceId: source.id, sourceName: source.name, status: "SKIPPED_ROBOTS", listingsFound: 0, listingsNew: 0 };
  }

  const connector = CONNECTORS[source.connectorType];
  const sourceForCrawl: SourceForCrawl = {
    id: source.id,
    name: source.name,
    baseUrl: source.baseUrl,
    config: source.config,
    minDelayMs: source.minDelayMs,
  };

  try {
    const normalizedListings = await connector.fetchListings(sourceForCrawl);
    let newCount = 0;

    for (const listing of normalizedListings) {
      const fingerprint = computeFingerprint(listing);
      const canonicalOfId = await findCanonicalId(fingerprint, listing.externalUrl);
      const existing = await prisma.listing.findUnique({ where: { externalUrl: listing.externalUrl } });

      if (!existing) {
        newCount++;
        await prisma.listing.create({
          data: {
            sourceId: source.id,
            externalUrl: listing.externalUrl,
            fingerprint,
            canonicalOfId,
            title: listing.title,
            price: listing.price ?? null,
            currency: listing.currency,
            city: listing.city ?? null,
            postalCode: listing.postalCode ?? null,
            address: listing.address ?? null,
            bedrooms: listing.bedrooms ?? null,
            bathrooms: listing.bathrooms ?? null,
            livingArea: listing.livingArea ?? null,
            plotArea: listing.plotArea ?? null,
            propertyType: listing.propertyType ?? null,
            transactionType: listing.transactionType ?? null,
            description: listing.description ?? null,
            thumbnailUrl: listing.thumbnailUrl ?? null,
            publishedAt: listing.publishedAt ?? null,
            priceHistory: listing.price != null ? { create: [{ price: listing.price }] } : undefined,
          },
        });
      } else {
        const priceChanged = listing.price != null && existing.price !== listing.price;
        await prisma.listing.update({
          where: { id: existing.id },
          data: {
            fingerprint,
            canonicalOfId,
            title: listing.title,
            price: listing.price ?? existing.price,
            currency: listing.currency,
            city: listing.city ?? existing.city,
            postalCode: listing.postalCode ?? existing.postalCode,
            address: listing.address ?? existing.address,
            bedrooms: listing.bedrooms ?? existing.bedrooms,
            bathrooms: listing.bathrooms ?? existing.bathrooms,
            livingArea: listing.livingArea ?? existing.livingArea,
            plotArea: listing.plotArea ?? existing.plotArea,
            propertyType: listing.propertyType ?? existing.propertyType,
            transactionType: listing.transactionType ?? existing.transactionType,
            description: listing.description ?? existing.description,
            thumbnailUrl: listing.thumbnailUrl ?? existing.thumbnailUrl,
            publishedAt: listing.publishedAt ?? existing.publishedAt,
            lastSeenAt: new Date(),
            isRemoved: false,
            ...(priceChanged ? { priceHistory: { create: [{ price: listing.price }] } } : {}),
          },
        });
      }
    }

    // Annonces de cette source non revues depuis longtemps : probablement vendues/retirées.
    await prisma.listing.updateMany({
      where: {
        sourceId: source.id,
        isRemoved: false,
        lastSeenAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
      },
      data: { isRemoved: true },
    });

    const status: CrawlSummary["status"] = "SUCCESS";
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: { status, finishedAt: new Date(), listingsFound: normalizedListings.length, listingsNew: newCount },
    });

    logger.info("crawlSource: run terminé", {
      sourceId: source.id,
      listingsFound: normalizedListings.length,
      listingsNew: newCount,
    });

    return { sourceId: source.id, sourceName: source.name, status, listingsFound: normalizedListings.length, listingsNew: newCount };
  } catch (err) {
    const isRobots = err instanceof RobotsDisallowedError;
    const message = err instanceof Error ? err.message : String(err);
    logger.error("crawlSource: échec du run", { sourceId: source.id, error: message });

    const status: CrawlSummary["status"] = isRobots ? "SKIPPED_ROBOTS" : "ERROR";
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: { status, finishedAt: new Date(), errorMessage: message },
    });

    return { sourceId: source.id, sourceName: source.name, status, listingsFound: 0, listingsNew: 0, errorMessage: message };
  }
}

/**
 * Exécute un crawl pour toutes les sources actives, séquentiellement (pas de
 * parallélisme entre sources, pour rester simple et éviter toute rafale
 * inter-domaines qui ressemblerait à une attaque distribuée).
 */
export async function crawlAllActiveSources(): Promise<CrawlSummary[]> {
  const sources = await prisma.source.findMany({ where: { status: "ACTIVE" } });
  const summaries: CrawlSummary[] = [];
  for (const source of sources) {
    summaries.push(await crawlSource(source));
  }
  return summaries;
}
