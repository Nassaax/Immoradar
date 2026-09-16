import crypto from "crypto";
import type { NormalizedListing } from "./types";

/**
 * Génère une empreinte de déduplication pour une annonce normalisée.
 *
 * Heuristique volontairement simple pour un MVP : on combine une adresse
 * approximative (ville + code postal, en minuscules et sans accents), la
 * surface habitable arrondie à 5 m² près, le nombre de chambres, le prix
 * arrondi à 5 000 € près, et le type de transaction. Deux annonces qui
 * partagent ces caractéristiques sont très probablement le même bien publié
 * par deux agences (mandat partagé) ou republié par la même agence sur deux
 * pages.
 *
 * Le titre n'entre pas dans l'empreinte : les agences rédigent des titres
 * différents pour le même bien. On expose séparément `titleSimilarityKey`
 * pour un futur raffinement (similarité de chaînes) si les faux positifs/
 * négatifs de l'empreinte stricte s'avèrent trop fréquents en production.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roundOrNull(value: number | null | undefined, step: number): string {
  if (value === null || value === undefined) return "na";
  return String(Math.round(value / step) * step);
}

export function computeFingerprint(listing: NormalizedListing): string {
  const hasLocation = Boolean(listing.city || listing.postalCode);
  const hasSizeSignal = listing.livingArea != null || listing.price != null;

  if (!hasLocation || !hasSizeSignal) {
    // Données insuffisantes pour dédupliquer en toute confiance : on retombe
    // sur une empreinte dérivée de l'URL, qui ne matchera jamais une autre
    // annonce (pas de faux positif de déduplication).
    return crypto.createHash("sha256").update(`url:${listing.externalUrl}`).digest("hex");
  }

  const parts = [
    normalizeText(listing.city),
    normalizeText(listing.postalCode),
    roundOrNull(listing.livingArea ?? null, 5),
    roundOrNull(listing.bedrooms ?? null, 1),
    roundOrNull(listing.price ?? null, 5000),
    listing.transactionType ?? "na",
    listing.propertyType ? normalizeText(listing.propertyType) : "na",
  ];

  const raw = parts.join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Clé de normalisation du titre, utile pour un futur scoring de similarité. */
export function titleSimilarityKey(title: string): string {
  return normalizeText(title).split(" ").sort().join(" ");
}
