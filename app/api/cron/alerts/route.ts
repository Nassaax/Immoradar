import { NextRequest, NextResponse } from "next/server";
import { sendDailyAlertDigests } from "@/lib/alerts";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  logger.info("cron/alerts: démarrage");
  const result = await sendDailyAlertDigests();
  logger.info("cron/alerts: terminé", result);

  return NextResponse.json(result);
}

export const GET = POST;
