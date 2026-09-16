import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

/** GET admin : historique des runs de crawl (logs, erreurs), filtrable par source. */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const sourceId = request.nextUrl.searchParams.get("sourceId") ?? undefined;

  const crawlRuns = await prisma.crawlRun.findMany({
    where: sourceId ? { sourceId } : undefined,
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { source: { select: { name: true } } },
  });

  return NextResponse.json({ crawlRuns });
}
