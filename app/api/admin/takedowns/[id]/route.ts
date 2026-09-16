import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

const BodySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().max(2000).optional(),
});

/**
 * PATCH admin : traite une demande de retrait.
 * - APPROVED : l'annonce reste masquée définitivement (isHidden=true déjà appliqué à la réception).
 * - REJECTED : l'annonce est réaffichée (isHidden=false) — la demande n'était pas légitime.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  const takedown = await prisma.takedownRequest.update({
    where: { id: params.id },
    data: { status: parsed.data.status, adminNote: parsed.data.adminNote ?? null, resolvedAt: new Date() },
  });

  if (takedown.listingId && parsed.data.status === "REJECTED") {
    await prisma.listing.update({ where: { id: takedown.listingId }, data: { isHidden: false } });
  }

  return NextResponse.json({ takedown });
}
