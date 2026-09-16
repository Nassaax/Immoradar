import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SubscribeAlertSchema } from "@/lib/types";
import { generateToken } from "@/lib/token";
import { sendEmail } from "@/lib/email";
import { isRateLimited, clientKeyFromRequest } from "@/lib/publicRateLimit";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** POST public : créer une alerte email à partir de critères de recherche. */
export async function POST(request: NextRequest) {
  if (isRateLimited(`alerts-subscribe:${clientKeyFromRequest(request)}`)) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard." }, { status: 429 });
  }

  const parsed = SubscribeAlertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide.", issues: parsed.error.issues }, { status: 400 });
  }

  const token = generateToken();
  const subscription = await prisma.alertSubscription.create({
    data: {
      email: parsed.data.email,
      filters: parsed.data.filters,
      token,
    },
  });

  const manageUrl = `${SITE_URL}/alerts/manage?token=${token}`;
  await sendEmail({
    to: parsed.data.email,
    subject: "Confirmation de votre alerte ListingRadar",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>Votre alerte est active</h2>
        <p>Vous recevrez un résumé quotidien des nouvelles annonces correspondant à vos critères.</p>
        <p><a href="${manageUrl}">Gérer ou désactiver cette alerte</a></p>
      </div>`,
  });

  return NextResponse.json({ ok: true, id: subscription.id }, { status: 201 });
}
