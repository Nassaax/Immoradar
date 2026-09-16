import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { crawlAllActiveSources, crawlSource } from "@/lib/crawler";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

export const maxDuration = 300; // 5 min — un crawl manuel peut prendre du temps (rate limit poli inclus).

const BodySchema = z.object({ sourceId: z.string().optional() });

/** POST admin : déclenchement manuel d'un crawl (une source, ou toutes les sources actives). */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (parsed.data.sourceId) {
    const source = await prisma.source.findUnique({ where: { id: parsed.data.sourceId } });
    if (!source) {
      return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
    }
    if (source.status !== "ACTIVE") {
      return NextResponse.json({ error: "La source n'est pas active (ACTIVE requis pour crawler)." }, { status: 400 });
    }
    const summary = await crawlSource(source);
    return NextResponse.json({ summaries: [summary] });
  }

  const summaries = await crawlAllActiveSources();
  return NextResponse.json({ summaries });
}
