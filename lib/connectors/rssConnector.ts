import Parser from "rss-parser";
import { fetchPolite } from "../httpClient";
import { extractListingMetadata } from "../extract";
import { RssConnectorConfigSchema, NormalizedListingSchema, type NormalizedListing } from "../types";
import type { Connector, SourceForCrawl } from "./types";
import { logger } from "../logger";

const rssParser = new Parser();

/**
 * Connecteur RSS/Atom : le plus adapté quand une agence expose déjà un flux
 * de ses nouvelles annonces. On complète les champs manquants (prix,
 * surface...) en visitant la page de l'annonce, comme pour le connecteur
 * sitemap.
 */
export const rssConnector: Connector = {
  async fetchListings(source: SourceForCrawl): Promise<NormalizedListing[]> {
    const config = RssConnectorConfigSchema.parse(source.config);

    const xml = await fetchPolite(config.feedUrl, { minDelayMs: source.minDelayMs });
    const feed = await rssParser.parseString(xml);

    const items = (feed.items ?? []).slice(0, config.maxItems);
    const listings: NormalizedListing[] = [];

    for (const item of items) {
      const link = item.link;
      if (!link) continue;

      let meta: Partial<NormalizedListing> = {
        title: item.title,
        description: item.contentSnippet ?? item.content,
      };

      try {
        const html = await fetchPolite(link, { minDelayMs: source.minDelayMs });
        meta = { ...meta, ...extractListingMetadata(html, link) };
      } catch (err) {
        logger.warn("rssConnector: échec récupération page annonce, on garde les données du flux", {
          sourceId: source.id,
          url: link,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const publishedAt = item.isoDate ? new Date(item.isoDate) : undefined;
      const parsedListing = NormalizedListingSchema.safeParse({
        ...meta,
        externalUrl: link,
        title: meta.title ?? link,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      });

      if (parsedListing.success) {
        listings.push(parsedListing.data);
      } else {
        logger.warn("rssConnector: annonce invalide, ignorée", {
          sourceId: source.id,
          url: link,
          issues: parsedListing.error.issues,
        });
      }
    }

    return listings;
  },
};
