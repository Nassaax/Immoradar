import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PAUSED: "En pause",
  UNSUPPORTED: "Non supportée",
};

const RUN_STATUS_BADGE: Record<string, string> = {
  SUCCESS: "badge-green",
  PARTIAL: "badge-amber",
  ERROR: "badge-red",
  SKIPPED_ROBOTS: "badge-amber",
};

const RUN_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "OK",
  PARTIAL: "Partiel",
  ERROR: "Erreur",
  SKIPPED_ROBOTS: "Bloqué par robots.txt",
};

export default async function SourcesStatusPage() {
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      connectorType: true,
      status: true,
      trustScore: true,
      _count: { select: { listings: true } },
      crawlRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true, finishedAt: true, status: true, listingsFound: true, listingsNew: true },
      },
    },
  });

  return (
    <div className="container">
      <h1>Statut des sources</h1>
      <p className="subtitle">
        Transparence sur la fraîcheur de nos données : quand chaque site a été crawlé pour la dernière fois, et combien
        d'annonces y ont été trouvées.
      </p>

      <div className="legal-banner">
        Chaque source est crawlée dans le respect de son robots.txt, avec une limite de requêtes par seconde. Une source
        marquée « Non supportée » est bloquée par le site (robots.txt/CGU) — nous proposons alors une intégration via
        flux officiel ou partenariat. Voir <a href="/opt-out">la page Opt-out</a> pour toute demande de retrait.
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Connecteur</th>
              <th>Statut</th>
              <th>Annonces indexées</th>
              <th>Dernier crawl</th>
              <th>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const lastRun = source.crawlRuns[0];
              return (
                <tr key={source.id}>
                  <td>
                    <a href={source.baseUrl} target="_blank" rel="noopener noreferrer nofollow">
                      {source.name}
                    </a>
                  </td>
                  <td>{source.connectorType}</td>
                  <td>{STATUS_LABEL[source.status] ?? source.status}</td>
                  <td>{source._count.listings}</td>
                  <td>{lastRun ? new Date(lastRun.startedAt).toLocaleString("fr-BE") : "Jamais"}</td>
                  <td>
                    {lastRun ? (
                      <span className={`badge ${RUN_STATUS_BADGE[lastRun.status] ?? ""}`}>
                        {RUN_STATUS_LABEL[lastRun.status] ?? lastRun.status} ({lastRun.listingsNew} nouvelles)
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucune source configurée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="subtitle" style={{ marginTop: 20 }}>
        Vous êtes une agence et souhaitez apparaître ici avec un flux officiel (données plus fiables, logo affiché) ?
        Contactez-nous à l'adresse indiquée sur la page <a href="/opt-out">Opt-out</a>.
      </p>
    </div>
  );
}
