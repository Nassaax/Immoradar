import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

/** GET admin : liste complète des sources (config de crawl incluse) pour le tableau de bord admin. */
export async function GET() {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { listings: true } },
      crawlRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ sources });
}
