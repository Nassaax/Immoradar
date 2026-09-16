import Link from "next/link";

export interface ListingCardData {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  city: string | null;
  postalCode: string | null;
  bedrooms: number | null;
  livingArea: number | null;
  propertyType: string | null;
  transactionType: "SALE" | "RENT" | null;
  thumbnailUrl: string | null;
  firstSeenAt: string | Date;
  source: { name: string };
}

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return "Prix sur demande";
  return `${price.toLocaleString("fr-BE")} ${currency}`;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const firstSeen = new Date(listing.firstSeenAt);
  const isNew = Date.now() - firstSeen.getTime() < NEW_THRESHOLD_MS;

  return (
    <Link href={`/listings/${listing.id}`} className="listing-card">
      {listing.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.thumbnailUrl} alt="" className="listing-thumb" loading="lazy" />
      ) : (
        <div className="listing-thumb" />
      )}
      {isNew && <span className="badge badge-new">Nouveau</span>}
      <div className="listing-title">{listing.title}</div>
      <div className="listing-meta">
        {[listing.city, listing.postalCode].filter(Boolean).join(" · ") || "Localisation non précisée"}
      </div>
      <div className="listing-meta">
        {[
          listing.propertyType,
          listing.transactionType === "SALE" ? "Vente" : listing.transactionType === "RENT" ? "Location" : null,
          listing.bedrooms != null ? `${listing.bedrooms} ch.` : null,
          listing.livingArea != null ? `${listing.livingArea} m²` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div className="listing-price">{formatPrice(listing.price, listing.currency)}</div>
      <div className="listing-meta">Détectée le {firstSeen.toLocaleDateString("fr-BE")} — {listing.source.name}</div>
    </Link>
  );
}
