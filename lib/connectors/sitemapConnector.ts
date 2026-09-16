import { XMLParser } from "fast-xml-parser";
import { fetchPolite } from "../httpClient";
import { extractListingMetadata } from "../extract";
import { SitemapConnectorConfigSchema } from "../types";
import { NormalizedListingSchema, type NormalizedListing } from "../types";
import type { Connector, SourceForCrawl } from "./types";
import { logger } from "../logger";

const parser = new XMLParser({ ignoreAttributes: false });

interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
}

function flattenSitemap(xml: unknown): { urls: SitemapUrlEntry[]; nestedSitemaps: string[] } {
  const urls: SitemapUrlEntry[] = [];
  const nestedSitemaps: string[] = [];
  const doc = xml as Record<string, unknown>;

  const urlset = doc.urlset as { url?: unknown } | undefined;
  if (urlset?.url) {
    const entries = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      if (typeof e.loc === "string") {
        urls.push({ loc: e.loc, lastmod: typeof e.lastmod === "string" ? e.lastmod : undefined });
      }
    }
  }

  const sitemapindex = doc.sitemapindex as { sitemap?: unknown } | undefined;
  if (sitemapindex?.sitemap) {
    const entries = Array.isArray(sitemapindex.sitemap) ? sitemapindex.sitemap : [sitemapindex.sitemap];
    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      if (typeof e.loc === "string") nestedSitemaps.push(e.loc);
    }
  }

  return { urls, nestedSitemaps };
}

/**
 * Connecteur "sitemap" : lit un sitemap.xml (ou sitemap-index), en déduit les
 * URLs d'annonces via un filtre simple (sous-chaîne ou regex), puis récupère
 * chaque page pour en extraire les métadonnées publiques (JSON-LD / Open
 * Graph). C'est la méthode la moins intrusive : le sitemap est publié par le
 * site précisément pour être parcouru par des robots.
 */
export const sitemapConnector: Connector = {
  async fetchListings(source: SourceForCrawl): Promise<NormalizedListing[]> {
    const config = SitemapConnectorConfigSchema.parse(source.config);

    const rootXml = await fetchPolite(config.sitemapUrl, { minDelayMs: source.minDelayMs });
    const rootParsed = parser.parse(rootXml);
    let { urls, nestedSitemaps } = flattenSitemap(rootParsed);

    // Sitemap-index : on parcourt les sous-sitemaps jusqu'à obtenir assez d'URLs (limité pour rester poli).
    for (const nested of nestedSitemaps.slice(0, 10)) {
      if (urls.length >= config.maxUrls) break;
      try {
        const xml = await fetchPolite(nested, { minDelayMs: source.minDelayMs });
        const parsed = flattenSitemap(parser.parse(xml));
        urls = urls.concat(parsed.urls);
      } catch (err) {
        logger.warn("sitemapConnector: échec sous-sitemap", {
          sourceId: source.id,
          nested,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const pattern = config.urlPattern ? new RegExp(config.urlPattern) : null;
    const filtered = urls
      .filter((u) => {
        if (pattern) return pattern.test(u.loc);
        if (config.urlIncludes) return u.loc.includes(config.urlIncludes);
        return true;
      })
      .slice(0, config.maxUrls);

    const listings: NormalizedListing[] = [];
    for (const entry of filtered) {
      try {
        const html = await fetchPolite(entry.loc, { minDelayMs: source.minDelayMs });
        const meta = extractListingMetadata(html, entry.loc);
        const publishedAt = entry.lastmod ? new Date(entry.lastmod) : undefined;
        const parsedListing = NormalizedListingSchema.safeParse({
          ...meta,
          externalUrl: entry.loc,
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        });
        if (parsedListing.success) {
          listings.push(parsedListing.data);
        } else {
          logger.warn("sitemapConnector: annonce invalide, ignorée", {
            sourceId: source.id,
            url: entry.loc,
            issues: parsedListing.error.issues,
          });
        }
      } catch (err) {
        logger.warn("sitemapConnector: échec récupération annonce", {
          sourceId: source.id,
          url: entry.loc,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return listings;
  },
};
