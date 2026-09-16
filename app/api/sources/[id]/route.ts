import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

const UpdateSourceSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "UNSUPPORTED"]).optional(),
  robotsAllowed: z.boolean().optional(),
  minDelayMs: z.number().int().min(200).max(60_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** PATCH admin : activer/mettre en pause une source, ajuster son rate-limit, etc. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.status === "ACTIVE" && parsed.data.robotsAllowed === undefined) {
    const source = await prisma.source.findUnique({ where: { id: params.id }, select: { robotsAllowed: true } });
    if (!source?.robotsAllowed) {
      return NextResponse.json(
        { error: "Impossible d'activer une source sans avoir confirmé robotsAllowed=true (vérification manuelle robots.txt/CGU requise)." },
        { status: 400 },
      );
    }
  }

  const source = await prisma.source.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ source });
}

/** DELETE admin : retire une source (ses annonces restent, orphelines de crawl futur). */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  await prisma.source.update({ where: { id: params.id }, data: { status: "PAUSED" } });
  return NextResponse.json({ ok: true });
}
