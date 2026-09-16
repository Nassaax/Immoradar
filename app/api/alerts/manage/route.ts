import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AlertFiltersSchema } from "@/lib/types";

/** GET public : consulte une alerte via son token opaque (lien envoyé par email). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token manquant." }, { status: 400 });

  const subscription = await prisma.alertSubscription.findUnique({ where: { token } });
  if (!subscription) return NextResponse.json({ error: "Alerte introuvable." }, { status: 404 });

  return NextResponse.json({
    subscription: {
      email: subscription.email,
      filters: subscription.filters,
      active: subscription.active,
      createdAt: subscription.createdAt,
      lastSentAt: subscription.lastSentAt,
    },
  });
}

const UpdateSchema = z.object({
  active: z.boolean().optional(),
  filters: AlertFiltersSchema.optional(),
});

/** PATCH public (token requis) : mettre en pause/réactiver ou modifier les critères d'une alerte. */
export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token manquant." }, { status: 400 });

  const subscription = await prisma.alertSubscription.findUnique({ where: { token } });
  if (!subscription) return NextResponse.json({ error: "Alerte introuvable." }, { status: 404 });

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.alertSubscription.update({
    where: { token },
    data: {
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.filters !== undefined ? { filters: parsed.data.filters } : {}),
    },
  });

  return NextResponse.json({ ok: true, subscription: { active: updated.active, filters: updated.filters } });
}

/** DELETE public (token requis) : désinscription définitive. */
export async function DELETE(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token manquant." }, { status: 400 });

  const subscription = await prisma.alertSubscription.findUnique({ where: { token } });
  if (!subscription) return NextResponse.json({ error: "Alerte introuvable." }, { status: 404 });

  await prisma.alertSubscription.delete({ where: { token } });
  return NextResponse.json({ ok: true });
}
