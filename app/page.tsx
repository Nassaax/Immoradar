import { prisma } from "@/lib/db";
import { ListingSearchQuerySchema } from "@/lib/types";
import { buildListingWhere } from "@/lib/listingQuery";
import { ListingCard } from "@/components/ListingCard";
import { SearchFilters } from "@/components/SearchFilters";
import { Pagination } from "@/components/Pagination";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Record<string, string | undefined>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const parsed = ListingSearchQuerySchema.safeParse(searchParams);
  const query = parsed.success
    ? parsed.data
    : ListingSearchQuerySchema.parse({});

  const where = buildListingWhere(query);
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    query.sort === "price_asc" ? { price: "asc" } : query.sort === "price_desc" ? { price: "desc" } : { firstSeenAt: "desc" };

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
        source: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="container">
      <h1>Trouvez un bien détecté directement chez les agences</h1>
      <p className="subtitle">
        ListingRadar agrège les annonces publiées par les agences elles-mêmes (sitemaps, flux RSS, partenariats), dans le
        respect de leur robots.txt et de leurs CGU — voir la page <a href="/sources">Sources</a>.
      </p>

      <div className="grid">
        <SearchFilters searchParams={searchParams} />

        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              <strong>{total}</strong> annonce{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="card empty-state">Aucune annonce ne correspond à ces critères pour le moment.</div>
          ) : (
            <div className="listing-grid">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          <Pagination page={query.page} totalPages={totalPages} searchParams={searchParams} />
        </div>
      </div>
    </div>
  );
}
