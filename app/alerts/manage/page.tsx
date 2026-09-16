"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Subscription {
  email: string;
  filters: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  lastSentAt: string | null;
}

export default function ManageAlertPage() {
  return (
    <Suspense fallback={<div className="container">Chargement…</div>}>
      <ManageAlertForm />
    </Suspense>
  );
}

function ManageAlertForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien invalide : token manquant.");
      setLoading(false);
      return;
    }
    fetch(`/api/alerts/manage?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Alerte introuvable.");
        return res.json();
      })
      .then((data) => setSubscription(data.subscription))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleActive() {
    if (!subscription) return;
    const res = await fetch(`/api/alerts/manage?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !subscription.active }),
    });
    if (res.ok) {
      setSubscription({ ...subscription, active: !subscription.active });
      setMessage(subscription.active ? "Alerte mise en pause." : "Alerte réactivée.");
    }
  }

  async function unsubscribe() {
    const res = await fetch(`/api/alerts/manage?token=${encodeURIComponent(token)}`, { method: "DELETE" });
    if (res.ok) {
      setSubscription(null);
      setMessage("Vous avez été désinscrit(e) définitivement.");
    }
  }

  if (loading) return <div className="container">Chargement…</div>;

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 560 }}>
        <h1>Gérer mon alerte</h1>

        {error && <div className="card error-text">{error}</div>}
        {message && <div className="card success-text">{message}</div>}

        {subscription && (
          <div className="card stack">
            <div>
              <strong>Email :</strong> {subscription.email}
            </div>
            <div>
              <strong>Statut :</strong> {subscription.active ? "Active" : "En pause"}
            </div>
            <div>
              <strong>Critères :</strong> <code>{JSON.stringify(subscription.filters)}</code>
            </div>
            <div>
              <strong>Dernier envoi :</strong>{" "}
              {subscription.lastSentAt ? new Date(subscription.lastSentAt).toLocaleString("fr-BE") : "Jamais"}
            </div>

            <div className="row">
              <button className="btn btn-outline" onClick={toggleActive}>
                {subscription.active ? "Mettre en pause" : "Réactiver"}
              </button>
              <button className="btn btn-danger" onClick={unsubscribe}>
                Se désinscrire définitivement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
