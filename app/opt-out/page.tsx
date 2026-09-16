"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function OptOutPage() {
  return (
    <Suspense fallback={<div className="container">Chargement…</div>}>
      <OptOutForm />
    </Suspense>
  );
}

function OptOutForm() {
  const searchParams = useSearchParams();
  const [listingId] = useState(searchParams.get("listingId") ?? "");
  const [url, setUrl] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const res = await fetch("/api/opt-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: listingId || undefined,
        url: url || undefined,
        requesterEmail,
        requesterName: requesterName || undefined,
        reason,
      }),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMessage(body.error ?? "Une erreur est survenue.");
      setStatus("error");
    }
  }

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 640 }}>
        <h1>Opt-out / demande de retrait</h1>
        <p className="subtitle">
          Vous êtes une agence immobilière (ou son mandataire) et souhaitez qu'une annonce soit retirée de
          ListingRadar ? Remplissez ce formulaire. L'annonce concernée est masquée immédiatement le temps que notre
          équipe examine la demande. Vous pouvez aussi nous écrire directement à l'adresse de contact indiquée dans
          l'en-tête HTTP User-Agent de notre robot (ListingRadarBot).
        </p>

        {status === "done" ? (
          <div className="card success-text">
            Demande enregistrée. L'annonce concernée a été masquée en attendant la revue de notre équipe. Vous
            recevrez une réponse à l'adresse email fournie.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card stack">
            <div className="field">
              <label htmlFor="url">URL de l'annonce sur votre site (recommandé)</label>
              <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            {listingId && (
              <div className="field">
                <label>Identifiant ListingRadar</label>
                <input value={listingId} disabled />
              </div>
            )}
            <div className="field">
              <label htmlFor="requesterEmail">Votre email</label>
              <input
                id="requesterEmail"
                type="email"
                required
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="requesterName">Votre nom / agence</label>
              <input id="requesterName" type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="reason">Motif de la demande</label>
              <textarea id="reason" required minLength={10} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            {status === "error" && <p className="error-text">{errorMessage}</p>}

            <button type="submit" className="btn btn-primary" disabled={status === "loading"}>
              {status === "loading" ? "Envoi…" : "Envoyer la demande"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
