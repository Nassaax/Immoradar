/**
 * Anti-abus basique en mémoire pour les endpoints publics d'écriture
 * (inscription alerte, opt-out). Best-effort seulement : sur Vercel, chaque
 * instance de fonction a sa propre mémoire, donc ceci ralentit un abus
 * évident sans garantir une limite stricte globale. Suffisant pour un MVP ;
 * à remplacer par un store partagé (Upstash Redis, etc.) si l'abus devient
 * un problème réel en production.
 */
const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
