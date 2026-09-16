"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AdminSource {
  id: string;
  name: string;
  baseUrl: string;
  connectorType: string;
  status: "ACTIVE" | "PAUSED" | "UNSUPPORTED";
  robotsAllowed: boolean;
  trustScore: number;
  minDelayMs: number;
  notes: string | null;
  _count: { listings: number };
  crawlRuns: Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    listingsFound: number;
    listingsNew: number;
    errorMessage: string | null;
  }>;
}

interface Takedown {
  id: string;
  url: string | null;
  requesterEmail: string;
  requesterName: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  listing: { id: string; title: string; externalUrl: string; isHidden: boolean } | null;
}

export default function AdminDashboardPage() {
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [takedowns, setTakedowns] = useState<Takedown[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawlingId, setCrawlingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [sourcesRes, takedownsRes] = await Promise.all([
      fetch("/api/admin/sources"),
      fetch("/api/admin/takedowns"),
    ]);
    if (sourcesRes.ok) setSources((await sourcesRes.json()).sources);
    if (takedownsRes.ok) setTakedowns((await takedownsRes.json()).takedowns);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSource(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await load();
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? "Échec de la mise à jour.");
    }
  }

  async function triggerCrawl(id?: string) {
    setCrawlingId(id ?? "all");
    setMessage("");
    const res = await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { sourceId: id } : {}),
    });
    setCrawlingId(null);
    if (res.ok) {
      setMessage("Crawl terminé.");
      await load();
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? "Échec du crawl.");
    }
  }

  async function resolveTakedown(id: string, status: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/admin/takedowns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  if (loading) return <div className="container">Chargement…</div>;

  const pendingTakedowns = takedowns.filter((t) => t.status === "PENDING");

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>Administration</h1>
        <div className="row">
          <Link href="/admin/sources" className="btn btn-outline">
            + Ajouter une source
          </Link>
          <button className="btn btn-outline" onClick={() => triggerCrawl()} disabled={crawlingId !== null}>
            {crawlingId === "all" ? "Crawl en cours…" : "Lancer un crawl global"}
          </button>
          <button className="btn btn-outline" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </div>

      {message && <p className="subtitle">{message}</p>}

      <h2 style={{ marginTop: 24 }}>Sources ({sources.length})</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Connecteur</th>
              <th>robots.txt vérifié</th>
              <th>Statut</th>
              <th>Annonces</th>
              <th>Dernier run</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const lastRun = source.crawlRuns[0];
              return (
                <tr key={source.id}>
                  <td>
                    {source.name}
                    <br />
                    <span className="listing-meta">{source.baseUrl}</span>
                  </td>
                  <td>{source.connectorType}</td>
                  <td>{source.robotsAllowed ? "✅" : "❌"}</td>
                  <td>{source.status}</td>
                  <td>{source._count.listings}</td>
                  <td>
                    {lastRun ? (
                      <>
                        {new Date(lastRun.startedAt).toLocaleString("fr-BE")}
                        <br />
                        <span className="listing-meta">
                          {lastRun.status} · {lastRun.listingsNew} nouvelles
                          {lastRun.errorMessage ? ` · ${lastRun.errorMessage}` : ""}
                        </span>
                      </>
                    ) : (
                      "Jamais"
                    )}
                  </td>
                  <td>
                    <div className="row">
                      {source.status !== "ACTIVE" && source.robotsAllowed && (
                        <button className="btn btn-outline" onClick={() => updateSource(source.id, { status: "ACTIVE" })}>
                          Activer
                        </button>
                      )}
                      {source.status === "ACTIVE" && (
                        <button className="btn btn-outline" onClick={() => updateSource(source.id, { status: "PAUSED" })}>
                          Pause
                        </button>
                      )}
                      {!source.robotsAllowed && (
                        <button
                          className="btn btn-outline"
                          onClick={() => updateSource(source.id, { robotsAllowed: true })}
                          title="À utiliser uniquement après vérification manuelle de robots.txt et des CGU"
                        >
                          Confirmer robots.txt OK
                        </button>
                      )}
                      {source.status === "ACTIVE" && (
                        <button
                          className="btn btn-outline"
                          onClick={() => triggerCrawl(source.id)}
                          disabled={crawlingId !== null}
                        >
                          {crawlingId === source.id ? "…" : "Crawler"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  Aucune source. <Link href="/admin/sources">Ajoutez-en une</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>Demandes de retrait en attente ({pendingTakedowns.length})</h2>
      <div className="card">
        {pendingTakedowns.length === 0 ? (
          <div className="empty-state">Aucune demande en attente.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Demandeur</th>
                <th>Annonce</th>
                <th>Motif</th>
                <th>Reçue le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingTakedowns.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.requesterName ?? "—"}
                    <br />
                    <span className="listing-meta">{t.requesterEmail}</span>
                  </td>
                  <td>{t.listing?.title ?? t.url ?? "—"}</td>
                  <td>{t.reason}</td>
                  <td>{new Date(t.createdAt).toLocaleString("fr-BE")}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-primary" onClick={() => resolveTakedown(t.id, "APPROVED")}>
                        Approuver (garder masquée)
                      </button>
                      <button className="btn btn-outline" onClick={() => resolveTakedown(t.id, "REJECTED")}>
                        Rejeter (réafficher)
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
