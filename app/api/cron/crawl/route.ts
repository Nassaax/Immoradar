import { NextRequest, NextResponse } from "next/server";
import { crawlAllActiveSources } from "@/lib/crawler";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

/**
 * Déclenché par Vercel Cron (voir vercel.json). Vercel envoie automatiquement
 * l'en-tête `Authorization: Bearer $CRON_SECRET` pour les crons configurés,
 * ce qui nous permet de vérifier que l'appel n'est pas arbitraire.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  logger.info("cron/crawl: démarrage");
  const summaries = await crawlAllActiveSources();
  logger.info("cron/crawl: terminé", { sources: summaries.length });

  return NextResponse.json({ summaries });
}

// Vercel Cron envoie des requêtes GET par défaut pour certains plans ; on accepte les deux.
export const GET = POST;
