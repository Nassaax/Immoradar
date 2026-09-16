import { prisma } from "./db";
import { sendEmail } from "./email";
import { buildListingWhere, alertFiltersToQuery } from "./listingQuery";
import { AlertFiltersSchema } from "./types";
import { logger } from "./logger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const MAX_LISTINGS_PER_EMAIL = 20;

/** Envoie le digest quotidien à chaque abonné actif ayant de nouveaux résultats depuis son dernier envoi. */
export async function sendDailyAlertDigests(): Promise<{ sent: number; skipped: number; errors: number }> {
  const subscriptions = await prisma.alertSubscription.findMany({ where: { active: true } });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const subscription of subscriptions) {
    try {
      const filtersResult = AlertFiltersSchema.safeParse(subscription.filters);
      if (!filtersResult.success) {
        logger.warn("sendDailyAlertDigests: filtres invalides, abonnement ignoré", { id: subscription.id });
        skipped++;
        continue;
      }

      const since = subscription.lastSentAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      const where = {
        ...buildListingWhere(alertFiltersToQuery(filtersResult.data)),
        firstSeenAt: { gt: since },
      };

      const newListings = await prisma.listing.findMany({
        where,
        orderBy: { firstSeenAt: "desc" },
        take: MAX_LISTINGS_PER_EMAIL,
      });

      if (newListings.length === 0) {
        skipped++;
        continue;
      }

      const manageUrl = `${SITE_URL}/alerts/manage?token=${subscription.token}`;
      const rows = newListings
        .map(
          (l) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            <a href="${SITE_URL}/listings/${l.id}" style="color:#1d4ed8;font-weight:600;text-decoration:none;">${escapeHtml(l.title)}</a><br/>
            <span style="color:#555;font-size:13px;">${escapeHtml(l.city ?? "")} ${l.price ? "· " + l.price.toLocaleString("fr-BE") + " " + l.currency : ""}</span>
          </td>
        </tr>`,
        )
        .join("");

      await sendEmail({
        to: subscription.email,
        subject: `${newListings.length} nouvelle(s) annonce(s) — ListingRadar`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Nouvelles annonces correspondant à votre alerte</h2>
            <table style="width:100%;border-collapse:collapse;">${rows}</table>
            <p style="margin-top:24px;font-size:12px;color:#888;">
              Vous recevez cet email car vous êtes inscrit(e) à une alerte ListingRadar.
              <a href="${manageUrl}">Gérer ou désactiver cette alerte</a>.
            </p>
          </div>`,
      });

      await prisma.alertSubscription.update({
        where: { id: subscription.id },
        data: { lastSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      errors++;
      logger.error("sendDailyAlertDigests: échec pour un abonnement", {
        id: subscription.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("sendDailyAlertDigests: terminé", { sent, skipped, errors, total: subscriptions.length });
  return { sent, skipped, errors };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
