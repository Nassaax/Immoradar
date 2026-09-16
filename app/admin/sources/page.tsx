"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ConnectorType = "SITEMAP" | "RSS" | "HTML_INDEX";

export default function AddSourcePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [connectorType, setConnectorType] = useState<ConnectorType>("SITEMAP");
  const [robotsAllowed, setRobotsAllowed] = useState(false);
  const [minDelayMs, setMinDelayMs] = useState(1000);
  const [notes, setNotes] = useState("");

  // Champs spécifiques par connecteur.
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [urlIncludes, setUrlIncludes] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [indexUrl, setIndexUrl] = useState("");
  const [itemSelector, setItemSelector] = useState("");
  const [titleSelector, setTitleSelector] = useState("");
  const [priceSelector, setPriceSelector] = useState("");
  const [addressSelector, setAddressSelector] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  function buildConfig(): Record<string, unknown> {
    if (connectorType === "SITEMAP") {
      return { sitemapUrl, urlIncludes: urlIncludes || undefined };
    }
    if (connectorType === "RSS") {
      return { feedUrl };
    }
    return {
      indexUrl,
      selectors: {
        item: itemSelector,
        link: "a",
        title: titleSelector || undefined,
        price: priceSelector || undefined,
        address: addressSelector || undefined,
      },
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        baseUrl,
        contactEmail: contactEmail || undefined,
        connectorType,
        config: buildConfig(),
        robotsAllowed,
        minDelayMs,
        notes: notes || undefined,
      }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Échec de la création.");
      setStatus("error");
    }
  }

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 640 }}>
        <h1>Ajouter une source</h1>
        <p className="subtitle">
          Avant d'activer une source, vérifiez manuellement son <code>robots.txt</code> et ses CGU. La source est créée
          en pause par défaut ; cochez « robots.txt vérifié » puis activez-la depuis le tableau de bord.
        </p>

        <form onSubmit={handleSubmit} className="card stack">
          <div className="field">
            <label htmlFor="name">Nom de l'agence</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="baseUrl">URL du site</label>
            <input id="baseUrl" type="url" required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="contactEmail">Email de contact (optionnel)</label>
            <input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="connectorType">Type de connecteur</label>
            <select id="connectorType" value={connectorType} onChange={(e) => setConnectorType(e.target.value as ConnectorType)}>
              <option value="SITEMAP">Sitemap XML (recommandé)</option>
              <option value="RSS">Flux RSS/Atom (recommandé)</option>
              <option value="HTML_INDEX">Page catalogue HTML (à n'utiliser qu'en dernier recours)</option>
            </select>
          </div>

          {connectorType === "SITEMAP" && (
            <>
              <div className="field">
                <label htmlFor="sitemapUrl">URL du sitemap</label>
                <input id="sitemapUrl" type="url" required value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="urlIncludes">Filtre : les URLs d'annonces contiennent…</label>
                <input id="urlIncludes" value={urlIncludes} onChange={(e) => setUrlIncludes(e.target.value)} placeholder="/bien/" />
              </div>
            </>
          )}

          {connectorType === "RSS" && (
            <div className="field">
              <label htmlFor="feedUrl">URL du flux RSS/Atom</label>
              <input id="feedUrl" type="url" required value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
            </div>
          )}

          {connectorType === "HTML_INDEX" && (
            <>
              <div className="field">
                <label htmlFor="indexUrl">URL de la page catalogue</label>
                <input id="indexUrl" type="url" required value={indexUrl} onChange={(e) => setIndexUrl(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="itemSelector">Sélecteur CSS d'une annonce</label>
                <input id="itemSelector" required value={itemSelector} onChange={(e) => setItemSelector(e.target.value)} placeholder=".property-card" />
              </div>
              <div className="field">
                <label htmlFor="titleSelector">Sélecteur titre (optionnel)</label>
                <input id="titleSelector" value={titleSelector} onChange={(e) => setTitleSelector(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="priceSelector">Sélecteur prix (optionnel)</label>
                <input id="priceSelector" value={priceSelector} onChange={(e) => setPriceSelector(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="addressSelector">Sélecteur adresse (optionnel)</label>
                <input id="addressSelector" value={addressSelector} onChange={(e) => setAddressSelector(e.target.value)} />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="minDelayMs">Délai minimum entre requêtes (ms)</label>
            <input
              id="minDelayMs"
              type="number"
              min={200}
              value={minDelayMs}
              onChange={(e) => setMinDelayMs(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label htmlFor="notes">Notes internes</label>
            <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={robotsAllowed} onChange={(e) => setRobotsAllowed(e.target.checked)} />
              J'ai vérifié manuellement robots.txt et les CGU : le crawl est autorisé.
            </label>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={status === "loading"}>
            {status === "loading" ? "Création…" : "Créer la source"}
          </button>
        </form>
      </div>
    </div>
  );
}
