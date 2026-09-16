import { z } from "zod";

/**
 * Modèle normalisé produit par tous les connecteurs, avant upsert en base.
 * Toute donnée extraite d'une page HTML/flux passe par ce schéma Zod pour
 * être validée avant d'atteindre la base (défense en profondeur contre du
 * HTML mal formé ou hostile).
 */
export const NormalizedListingSchema = z.object({
  externalUrl: z.string().url(),
  title: z.string().min(1).max(500),
  price: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("EUR"),
  city: z.string().max(200).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bedrooms: z.number().int().nonnegative().max(100).nullable().optional(),
  bathrooms: z.number().int().nonnegative().max(100).nullable().optional(),
  livingArea: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  plotArea: z.number().int().nonnegative().max(10_000_000).nullable().optional(),
  propertyType: z.string().max(100).nullable().optional(),
  transactionType: z.enum(["SALE", "RENT"]).nullable().optional(),
  description: z.string().max(20_000).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  publishedAt: z.date().nullable().optional(),
});
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;

/** Configuration du connecteur SITEMAP. */
export const SitemapConnectorConfigSchema = z.object({
  sitemapUrl: z.string().url(),
  /** Sous-chaîne devant apparaître dans l'URL pour être considérée comme une annonce. */
  urlIncludes: z.string().optional(),
  /** Regex alternative (prioritaire sur urlIncludes si fournie). */
  urlPattern: z.string().optional(),
  /** Limite le nombre d'URLs traitées par run (protection contre les sitemaps énormes). */
  maxUrls: z.number().int().positive().max(5000).default(500),
});
export type SitemapConnectorConfig = z.infer<typeof SitemapConnectorConfigSchema>;

/** Configuration du connecteur RSS/Atom. */
export const RssConnectorConfigSchema = z.object({
  feedUrl: z.string().url(),
  maxItems: z.number().int().positive().max(1000).default(200),
});
export type RssConnectorConfig = z.infer<typeof RssConnectorConfigSchema>;

/**
 * Configuration du connecteur HTML_INDEX : une page catalogue paginée, avec
 * des sélecteurs CSS explicites. Ce connecteur est le plus intrusif — à
 * n'utiliser que si la source est explicitement autorisée (robotsAllowed=true
 * vérifié manuellement) et sans alternative sitemap/RSS.
 */
export const HtmlIndexConnectorConfigSchema = z.object({
  indexUrl: z.string().url(),
  /** Paramètre de pagination ajouté en query string, ex: "page". */
  pageParam: z.string().optional(),
  maxPages: z.number().int().positive().max(50).default(1),
  selectors: z.object({
    item: z.string(),
    link: z.string().default("a"),
    title: z.string().optional(),
    price: z.string().optional(),
    address: z.string().optional(),
    thumbnail: z.string().optional(),
  }),
  /** Si false (défaut), thumbnail n'est jamais extraite même si le sélecteur est fourni. */
  allowThumbnail: z.boolean().default(false),
});
export type HtmlIndexConnectorConfig = z.infer<typeof HtmlIndexConnectorConfigSchema>;

export const SourceConfigSchema = z.discriminatedUnion("connectorType", [
  z.object({ connectorType: z.literal("SITEMAP"), config: SitemapConnectorConfigSchema }),
  z.object({ connectorType: z.literal("RSS"), config: RssConnectorConfigSchema }),
  z.object({ connectorType: z.literal("HTML_INDEX"), config: HtmlIndexConnectorConfigSchema }),
]);

/** Corps de requête pour POST /api/sources */
export const CreateSourceSchema = z.object({
  name: z.string().min(1).max(200),
  baseUrl: z.string().url(),
  contactEmail: z.string().email().nullable().optional(),
  connectorType: z.enum(["SITEMAP", "RSS", "HTML_INDEX"]),
  config: z.record(z.unknown()),
  robotsAllowed: z.boolean().default(false),
  minDelayMs: z.number().int().min(200).max(60_000).default(1000),
  notes: z.string().max(2000).nullable().optional(),
});

/** Query params pour GET /api/listings */
export const ListingSearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  propertyType: z.string().max(100).optional(),
  transactionType: z.enum(["SALE", "RENT"]).optional(),
  sort: z.enum(["new", "price_asc", "price_desc"]).default("new"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
});
export type ListingSearchQuery = z.infer<typeof ListingSearchQuerySchema>;

/** Filtres d'alerte, réutilise le même vocabulaire que la recherche. */
export const AlertFiltersSchema = z.object({
  city: z.string().max(200).optional(),
  minPrice: z.number().int().nonnegative().optional(),
  maxPrice: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  propertyType: z.string().max(100).optional(),
  transactionType: z.enum(["SALE", "RENT"]).optional(),
});
export type AlertFilters = z.infer<typeof AlertFiltersSchema>;

export const SubscribeAlertSchema = z.object({
  email: z.string().email(),
  filters: AlertFiltersSchema,
});

export const TakedownRequestSchema = z.object({
  listingId: z.string().optional(),
  url: z.string().url().optional(),
  requesterEmail: z.string().email(),
  requesterName: z.string().max(200).optional(),
  reason: z.string().min(10).max(5000),
});
