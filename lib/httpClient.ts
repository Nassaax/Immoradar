import { isAllowedByRobots } from "./robots";
import { waitForRateLimit } from "./rateLimit";
import { logger } from "./logger";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt interdit l'accès à ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

const CONTACT_EMAIL = process.env.CRAWLER_CONTACT_EMAIL ?? "contact@listingradar.example";
export const USER_AGENT = `ListingRadarBot/1.0 (+mailto:${CONTACT_EMAIL}; agrégateur d'annonces, respecte robots.txt)`;

/**
 * Fetch "poli" : vérifie robots.txt, respecte le rate limit par domaine,
 * envoie un User-Agent identifiable, et lève une erreur explicite en cas
 * d'échec HTTP plutôt que de laisser un objet Response invalide se propager.
 */
export async function fetchPolite(
  url: string,
  opts: { minDelayMs: number; timeoutMs?: number },
): Promise<string> {
  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    throw new RobotsDisallowedError(url);
  }

  await waitForRateLimit(url, opts.minDelayMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml,text/xml,*/*" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} pour ${url}`);
    }
    return await res.text();
  } catch (err) {
    logger.warn("fetchPolite: échec de requête", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
