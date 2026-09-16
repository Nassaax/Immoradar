import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminRequestAuthenticated } from "@/lib/adminGuard";

/** GET admin : liste des demandes de retrait (opt-out) à traiter. */
export async function GET() {
  if (!(await isAdminRequestAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const takedowns = await prisma.takedownRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { id: true, title: true, externalUrl: true, isHidden: true } } },
  });

  return NextResponse.json({ takedowns });
}
