/**
 * Rate limiter très simple, par domaine, en mémoire du process.
 *
 * Sur Vercel (fonctions serverless éphémères), la mémoire n'est PAS partagée
 * entre invocations concurrentes : ce limiteur protège donc surtout contre
 * les rafales *au sein d'un même run* de crawl (un run traite ses sources
 * séquentiellement, voir lib/crawler.ts). La politique de crawl reste polie
 * dans tous les cas car :
 *   - un seul cron /api/cron/crawl tourne à la fois (toutes les 2h),
 *   - le crawler traite les sources l'une après l'autre (pas de parallélisme),
 *   - chaque connecteur respecte `minDelayMs` entre deux requêtes vers le
 *     même domaine.
 */
const lastRequestAtByHost = new Map<string, number>();

function hostOf(url: string): string {
  return new URL(url).host;
}

/** Attend si nécessaire pour respecter le délai minimum depuis la dernière requête vers ce domaine. */
export async function waitForRateLimit(url: string, minDelayMs: number): Promise<void> {
  const host = hostOf(url);
  const last = lastRequestAtByHost.get(host);
  const now = Date.now();

  if (last !== undefined) {
    const elapsed = now - last;
    const remaining = minDelayMs - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  lastRequestAtByHost.set(host, Date.now());
}
