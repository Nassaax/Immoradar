import type { NormalizedListing } from "../types";

export interface SourceForCrawl {
  id: string;
  name: string;
  baseUrl: string;
  /** Configuration brute (JSON) stockée en base ; chaque connecteur la valide avec son propre schéma Zod. */
  config: unknown;
  minDelayMs: number;
}

/** Un connecteur transforme la configuration d'une source en liste d'annonces normalisées. */
export interface Connector {
  fetchListings(source: SourceForCrawl): Promise<NormalizedListing[]>;
}
