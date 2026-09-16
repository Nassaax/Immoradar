import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return "Prix sur demande";
  return `${price.toLocaleString("fr-BE")} ${currency}`;
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const requested = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { source: true, priceHistory: { orderBy: { recordedAt: "asc" } } },
  });

  if (!requested || requested.isHidden) notFound();

  const listing = requested.canonicalOfId
    ? await prisma.listing.findUnique({
        where: { id: requested.canonicalOfId },
        include: { source: true, priceHistory: { orderBy: { recordedAt: "asc" } } },
      })
    : requested;

  if (!listing) notFound();

  const duplicates = await prisma.listing.findMany({
    where: { canonicalOfId: listing.id },
    select: { id: true, externalUrl: true, source: { select: { name: true } } },
  });

  const firstSeen = new Date(listing.firstSeenAt);
  const lastSeen = new Date(listing.lastSeenAt);

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="row" style={{ gap: 8 }}>
          {Date.now() - firstSeen.getTime() < 48 * 60 * 60 * 1000 && <span className="badge badge-new">Nouveau</span>}
          {listing.isRemoved && <span className="badge badge-amber">Probablement retirée</span>}
        </div>

        <h1>{listing.title}</h1>
        <div className="listing-price" style={{ fontSize: 22 }}>
          {formatPrice(listing.price, listing.currency)}
        </div>

        {listing.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.thumbnailUrl} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 10 }} />
        )}

        <div className="card">
          <table>
            <tbody>
              <tr>
                <th>Localisation</th>
                <td>{[listing.address, listing.postalCode, listing.city].filter(Boolean).join(", ") || "Non précisée"}</td>
              </tr>
              <tr>
                <th>Type</th>
                <td>{listing.propertyType ?? "—"}</td>
              </tr>
              <tr>
                <th>Transaction</th>
                <td>{listing.transactionType === "SALE" ? "Vente" : listing.transactionType === "RENT" ? "Location" : "—"}</td>
              </tr>
              <tr>
                <th>Chambres</th>
                <td>{listing.bedrooms ?? "—"}</td>
              </tr>
              <tr>
                <th>Surface habitable</th>
                <td>{listing.livingArea ? `${listing.livingArea} m²` : "—"}</td>
              </tr>
              <tr>
                <th>Détectée le</th>
                <td>{firstSeen.toLocaleString("fr-BE")}</td>
              </tr>
              <tr>
                <th>Mise à jour le</th>
                <td>{lastSeen.toLocaleString("fr-BE")}</td>
              </tr>
              <tr>
                <th>Source</th>
                <td>{listing.source.name}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {listing.priceHistory.length > 1 && (
          <div className="card">
            <h2>Historique de prix</h2>
            <table>
              <tbody>
                {listing.priceHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.recordedAt).toLocaleDateString("fr-BE")}</td>
                    <td>{entry.price != null ? `${entry.price.toLocaleString("fr-BE")} ${listing.currency}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="card">
            <h2>Également publiée par</h2>
            <ul>
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.source.name} —{" "}
                  <a href={d.externalUrl} target="_blank" rel="noopener noreferrer nofollow">
                    voir l'annonce
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="row">
          <a href={listing.externalUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary">
            Voir l'annonce sur le site de l'agence
          </a>
          <a href={`/opt-out?listingId=${listing.id}`} className="btn btn-outline">
            Signaler / demander un retrait
          </a>
        </div>

        <p className="subtitle" style={{ fontSize: 12 }}>
          ListingRadar affiche uniquement des métadonnées et un lien vers l'annonce originale. L'annonce complète, ses
          photos et les modalités de contact restent sur le site de l'agence.
        </p>
      </div>
    </div>
  );
}
