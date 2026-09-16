import * as cheerio from "cheerio";
import type { NormalizedListing } from "./types";

/**
 * Extraction générique de métadonnées d'annonce à partir d'une page HTML,
 * utilisée par les connecteurs SITEMAP et RSS (qui ne fournissent que des
 * URLs, pas de sélecteurs CSS spécifiques au site).
 *
 * Stratégie, par ordre de préférence :
 *  1. JSON-LD schema.org (balises <script type="application/ld+json">) —
 *     données structurées que le site publie lui-même à destination des
 *     moteurs de recherche : source la plus fiable et la moins intrusive.
 *  2. Balises Open Graph (og:title, og:description, og:image).
 *  3. Repli sur <title> et un texte devinant vente/location par mots-clés.
 *
 * Aucune photo n'est extraite sauf si `allowThumbnail` est explicitement
 * activé sur la source (voir README > Légal).
 */
export function extractListingMetadata(
  html: string,
  url: string,
  opts: { allowThumbnail: boolean } = { allowThumbnail: false },
): Partial<NormalizedListing> {
  const $ = cheerio.load(html);
  const result: Partial<NormalizedListing> = { externalUrl: url };

  const jsonLd = extractJsonLd($);
  if (jsonLd) {
    Object.assign(result, jsonLd);
  }

  if (!result.title) {
    const ogTitle = $('meta[property="og:title"]').attr("content");
    result.title = ogTitle?.trim() || $("title").first().text().trim() || url;
  }

  if (!result.description) {
    const ogDesc = $('meta[property="og:description"]').attr("content");
    if (ogDesc) result.description = ogDesc.trim();
  }

  if (opts.allowThumbnail && !result.thumbnailUrl) {
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      try {
        result.thumbnailUrl = new URL(ogImage, url).toString();
      } catch {
        // URL relative invalide : on ignore silencieusement.
      }
    }
  }

  if (!result.transactionType) {
    const text = `${result.title ?? ""} ${url}`.toLowerCase();
    if (/(a-louer|à-louer|location|te-huur|for-rent|\/rent\/|\/louer\/)/.test(text)) {
      result.transactionType = "RENT";
    } else if (/(a-vendre|à-vendre|vente|te-koop|for-sale|\/sale\/|\/vente\/)/.test(text)) {
      result.transactionType = "SALE";
    }
  }

  return result;
}

function extractJsonLd($: cheerio.CheerioAPI): Partial<NormalizedListing> | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    const raw = $(el).text();
    if (!raw?.trim()) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      const node = candidate as Record<string, unknown>;
      const type = String(node["@type"] ?? "").toLowerCase();
      if (!["product", "offer", "realestatelisting", "residence", "house", "apartment"].some((t) => type.includes(t))) {
        continue;
      }

      const out: Partial<NormalizedListing> = {};

      if (typeof node.name === "string") out.title = node.name;
      if (typeof node.description === "string") out.description = node.description;

      const offers = (node.offers ?? node) as Record<string, unknown>;
      const priceRaw = offers?.price ?? offers?.priceSpecification;
      const price = parsePrice(priceRaw);
      if (price !== null) out.price = price;
      if (typeof offers?.priceCurrency === "string") out.currency = offers.priceCurrency as string;

      const address = node.address as Record<string, unknown> | undefined;
      if (address) {
        if (typeof address.addressLocality === "string") out.city = address.addressLocality;
        if (typeof address.postalCode === "string") out.postalCode = address.postalCode;
        if (typeof address.streetAddress === "string") out.address = address.streetAddress;
      }

      const floorSize = node.floorSize as Record<string, unknown> | undefined;
      const floorValue = floorSize?.value;
      if (typeof floorValue === "number") out.livingArea = Math.round(floorValue);
      else if (typeof floorValue === "string" && !Number.isNaN(Number(floorValue))) {
        out.livingArea = Math.round(Number(floorValue));
      }

      if (typeof node.numberOfRooms === "number") out.bedrooms = Math.round(node.numberOfRooms);

      if (Object.keys(out).length > 0) return out;
    }
  }
  return null;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  if (value && typeof value === "object") {
    const spec = value as Record<string, unknown>;
    return parsePrice(spec.price ?? spec.minPrice ?? null);
  }
  return null;
}
