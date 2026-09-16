import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ListingSearchQuerySchema } from "@/lib/types";
import { buildListingWhere } from "@/lib/listingQuery";
import type { Prisma } from "@prisma/client";

/** GET public : recherche paginée d'annonces (page d'accueil / résultats). */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = ListingSearchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }
  const query = parsed.data;

  const where = buildListingWhere(query);

  const orderBy: Prisma.ListingOrderByWithRelationInput =
    query.sort === "price_asc"
      ? { price: "asc" }
      : query.sort === "price_desc"
        ? { price: "desc" }
        : { firstSeenAt: "desc" };

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        city: true,
        postalCode: true,
        bedrooms: true,
        livingArea: true,
        propertyType: true,
        transactionType: true,
        thumbnailUrl: true,
        firstSeenAt: true,
        lastSeenAt: true,
        source: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    listings,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  });
}
