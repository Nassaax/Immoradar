import type { Prisma } from "@prisma/client";
import type { AlertFilters } from "./types";

/**
 * Construit la clause Prisma `where` commune à la recherche publique
 * (/api/listings) et au matching des alertes, à partir d'un jeu de filtres
 * partagé. Exclut toujours les doublons (on ne montre que l'annonce
 * canonique) et les annonces masquées/retirées.
 */
export function buildListingWhere(filters: {
  q?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  propertyType?: string;
  transactionType?: "SALE" | "RENT";
}): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {
    isHidden: false,
    isRemoved: false,
    canonicalOfId: null,
  };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { city: { contains: filters.q, mode: "insensitive" } },
      { postalCode: { contains: filters.q, mode: "insensitive" } },
      { address: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
  if (filters.propertyType) where.propertyType = { equals: filters.propertyType, mode: "insensitive" };
  if (filters.transactionType) where.transactionType = filters.transactionType;
  if (filters.bedrooms !== undefined) where.bedrooms = { gte: filters.bedrooms };
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }

  return where;
}

export function alertFiltersToQuery(filters: AlertFilters) {
  return {
    city: filters.city,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    bedrooms: filters.bedrooms,
    propertyType: filters.propertyType,
    transactionType: filters.transactionType,
  };
}
