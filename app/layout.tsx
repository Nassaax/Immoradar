import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ListingRadar — annonces immobilières agrégées légalement",
  description:
    "ListingRadar agrège les annonces publiées directement par les agences immobilières (sitemaps, flux RSS, partenariats), dans le respect de robots.txt et des CGU.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Nav />
        <main>{children}</main>
        <footer>
          <div className="container">
            ListingRadar — agrégateur d'annonces publiées par les agences elles-mêmes. Voir la page{" "}
            <a href="/opt-out">Opt-out</a> pour toute demande de retrait.
          </div>
        </footer>
      </body>
    </html>
  );
}
