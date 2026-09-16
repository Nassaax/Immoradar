import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TakedownRequestSchema } from "@/lib/types";
import { isRateLimited, clientKeyFromRequest } from "@/lib/publicRateLimit";
import { logger } from "@/lib/logger";

/**
 * POST public : demande de retrait ("opt-out" / DMCA-like) émise par une
 * agence ou un tiers concerné par une annonce agrégée.
 *
 * Pour aller vite et éviter qu'une annonce litigieuse reste visible pendant
 * l'examen manuel, on la masque immédiatement (isHidden=true) dès la
 * réception d'une demande référencée par listingId ou url, puis un admin
 * traite la demande (approve/reject) depuis /admin. Voir README > Légal.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(`opt-out:${clientKeyFromRequest(request)}`)) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard." }, { status: 429 });
  }

  const parsed = TakedownRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }
  if (!parsed.data.listingId && !parsed.data.url) {
    return NextResponse.json({ error: "Précisez listingId ou url." }, { status: 400 });
  }

  let listing = parsed.data.listingId
    ? await prisma.listing.findUnique({ where: { id: parsed.data.listingId } })
    : null;
  if (!listing && parsed.data.url) {
    listing = await prisma.listing.findUnique({ where: { externalUrl: parsed.data.url } });
  }

  const takedown = await prisma.takedownRequest.create({
    data: {
      listingId: listing?.id ?? null,
      url: parsed.data.url ?? listing?.externalUrl ?? null,
      requesterEmail: parsed.data.requesterEmail,
      requesterName: parsed.data.requesterName ?? null,
      reason: parsed.data.reason,
    },
  });

  if (listing) {
    await prisma.listing.update({ where: { id: listing.id }, data: { isHidden: true } });
    logger.info("opt-out: annonce masquée en attendant revue admin", { listingId: listing.id, takedownId: takedown.id });
  }

  return NextResponse.json({ ok: true, id: takedown.id }, { status: 201 });
}
