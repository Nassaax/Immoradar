import * as cheerio from "cheerio";
import { fetchPolite } from "../httpClient";
import { extractListingMetadata } from "../extract";
import { HtmlIndexConnectorConfigSchema, NormalizedListingSchema, type NormalizedListing } from "../types";
import type { Connector, SourceForCrawl } from "./types";
import { logger } from "../logger";

/**
 * Connecteur "index HTML" : parcourt une page catalogue paginée avec des
 * sélecteurs CSS fournis par l'admin lors de l'ajout de la source.
 *
 * C'est le connecteur le plus intrusif (pas de structure de données dédiée
 * au crawl, contrairement à un sitemap/flux) : il ne doit être utilisé que
 * pour une source dont `robotsAllowed` a été vérifié manuellement, et avec
 * un `minDelayMs` prudent. Voir README > Légal.
 */
export const htmlIndexConnector: Connector = {
  async fetchListings(source: SourceForCrawl): Promise<NormalizedListing[]> {
    const config = HtmlIndexConnectorConfigSchema.parse(source.config);
    const listings: NormalizedListing[] = [];
    const seenUrls = new Set<string>();

    for (let page = 1; page <= config.maxPages; page++) {
      const pageUrl = buildPageUrl(config.indexUrl, config.pageParam, page);

      let html: string;
      try {
        html = await fetchPolite(pageUrl, { minDelayMs: source.minDelayMs });
      } catch (err) {
        logger.warn("htmlIndexConnector: échec récupération page d'index", {
          sourceId: source.id,
          pageUrl,
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }

      const $ = cheerio.load(html);
      const items = $(config.selectors.item);
      if (items.length === 0) break; // plus de résultats, on arrête la pagination

      for (const el of items.toArray()) {
        const $item = $(el);
        const hrefRaw = $item.find(config.selectors.link).first().attr("href");
        if (!hrefRaw) continue;

        let absoluteUrl: string;
        try {
          absoluteUrl = new URL(hrefRaw, source.baseUrl).toString();
        } catch {
          continue;
        }
        if (seenUrls.has(absoluteUrl)) continue;
        seenUrls.add(absoluteUrl);

        const listingFromIndex: Partial<NormalizedListing> = {
          externalUrl: absoluteUrl,
          title: config.selectors.title ? cleanText($item.find(config.selectors.title).first().text()) : undefined,
          price: config.selectors.price ? parsePriceText($item.find(config.selectors.price).first().text()) : undefined,
          address: config.selectors.address ? cleanText($item.find(config.selectors.address).first().text()) : undefined,
        };

        let detailMeta: Partial<NormalizedListing> = {};
        try {
          const detailHtml = await fetchPolite(absoluteUrl, { minDelayMs: source.minDelayMs });
          detailMeta = extractListingMetadata(detailHtml, absoluteUrl, {
            allowThumbnail: config.allowThumbnail,
          });
        } catch (err) {
          logger.warn("htmlIndexConnector: échec récupération détail annonce, on garde les données d'index", {
            sourceId: source.id,
            url: absoluteUrl,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        const merged: Partial<NormalizedListing> = {
          ...detailMeta,
          ...stripUndefined(listingFromIndex),
          externalUrl: absoluteUrl,
        };

        const parsedListing = NormalizedListingSchema.safeParse({
          ...merged,
          title: merged.title ?? absoluteUrl,
        });

        if (parsedListing.success) {
          listings.push(parsedListing.data);
        } else {
          logger.warn("htmlIndexConnector: annonce invalide, ignorée", {
            sourceId: source.id,
            url: absoluteUrl,
            issues: parsedListing.error.issues,
          });
        }
      }
    }

    return listings;
  },
};

function buildPageUrl(indexUrl: string, pageParam: string | undefined, page: number): string {
  if (!pageParam || page === 1) return indexUrl;
  const url = new URL(indexUrl);
  url.searchParams.set(pageParam, String(page));
  return url.toString();
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parsePriceText(text: string): number | undefined {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}
