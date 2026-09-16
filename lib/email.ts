import { logger } from "./logger";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envoi d'email via Resend. Si RESEND_API_KEY n'est pas configurée (ex: en
 * local), on se contente de logger le contenu au lieu d'échouer — pratique
 * pour développer les alertes sans compte Resend.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL ?? "ListingRadar <alertes@listingradar.example>";

  if (!apiKey) {
    logger.info("Email non envoyé (RESEND_API_KEY absente) — affiché ici à la place", {
      to,
      subject,
    });
    return;
  }

  // Import différé pour ne pas exiger la dépendance si elle n'est pas utilisée.
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    logger.error("Échec d'envoi d'email via Resend", { to, subject, error: String(error) });
    throw new Error(`Échec d'envoi d'email: ${String(error)}`);
  }
}
