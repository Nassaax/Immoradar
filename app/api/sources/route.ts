import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateSourceSchema, SourceConfigSchema } from "@/lib/types";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

/** GET public : statut des sources (pour la page /sources), sans exposer la config de crawl. */
export async function GET() {
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      connectorType: true,
      status: true,
      trustScore: true,
      updatedAt: true,
      _count: { select: { listings: true } },
      crawlRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true, finishedAt: true, status: true, listingsFound: true, listingsNew: true, errorMessage: true },
      },
    },
  });

  const payload = sources.map((s) => ({
    id: s.id,
    name: s.name,
    baseUrl: s.baseUrl,
    connectorType: s.connectorType,
    status: s.status,
    trustScore: s.trustScore,
    listingsCount: s._count.listings,
    lastCrawl: s.crawlRuns[0] ?? null,
  }));

  return NextResponse.json({ sources: payload });
}

/** POST admin : ajout d'une nouvelle source de crawl. */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  const configCheck = SourceConfigSchema.safeParse({
    connectorType: parsed.data.connectorType,
    config: parsed.data.config,
  });
  if (!configCheck.success) {
    return NextResponse.json(
      { error: "Configuration de connecteur invalide pour ce type.", issues: configCheck.error.issues },
      { status: 400 },
    );
  }

  const source = await prisma.source.create({
    data: {
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      contactEmail: parsed.data.contactEmail ?? null,
      connectorType: parsed.data.connectorType,
      config: parsed.data.config as object,
      // Toute nouvelle source démarre en PAUSED : un admin doit vérifier robots.txt/CGU
      // et l'activer explicitement (voir README > Ajouter une source).
      status: "PAUSED",
      robotsAllowed: parsed.data.robotsAllowed,
      minDelayMs: parsed.data.minDelayMs,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ source }, { status: 201 });
}
