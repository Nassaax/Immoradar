import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** GET public : détail d'une annonce. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      source: { select: { id: true, name: true, baseUrl: true } },
      priceHistory: { orderBy: { recordedAt: "asc" } },
    },
  });

  if (!listing || listing.isHidden) {
    return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  }

  // Si cette annonce est un doublon, on redirige les infos vers la canonique
  // pour éviter d'afficher deux pages différentes pour le même bien.
  const canonical = listing.canonicalOfId
    ? await prisma.listing.findUnique({
        where: { id: listing.canonicalOfId },
        include: { source: { select: { id: true, name: true, baseUrl: true } }, priceHistory: true },
      })
    : null;

  const duplicates = await prisma.listing.findMany({
    where: { OR: [{ canonicalOfId: listing.id }, { id: listing.canonicalOfId ?? "__none__" }] },
    select: { id: true, source: { select: { name: true } }, externalUrl: true },
  });

  return NextResponse.json({ listing: canonical ?? listing, duplicates, isDuplicateView: Boolean(canonical) });
}
