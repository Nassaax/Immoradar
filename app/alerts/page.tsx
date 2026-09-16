"use client";

import { useState } from "react";

export default function AlertsSubscribePage() {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const filters: Record<string, unknown> = {};
    if (city) filters.city = city;
    if (minPrice) filters.minPrice = Number(minPrice);
    if (maxPrice) filters.maxPrice = Number(maxPrice);
    if (bedrooms) filters.bedrooms = Number(bedrooms);
    if (propertyType) filters.propertyType = propertyType;
    if (transactionType) filters.transactionType = transactionType;

    const res = await fetch("/api/alerts/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, filters }),
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
      <div className="stack" style={{ maxWidth: 560 }}>
        <h1>Créer une alerte email</h1>
        <p className="subtitle">
          Recevez chaque jour un résumé des nouvelles annonces correspondant à vos critères. Aucun compte requis : un
          lien de gestion vous sera envoyé par email.
        </p>

        {status === "done" ? (
          <div className="card success-text">
            Alerte créée ! Vérifiez votre boîte mail pour confirmer et accéder au lien de gestion.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card stack">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="city">Ville</label>
              <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="minPrice">Prix min</label>
                <input id="minPrice" type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="maxPrice">Prix max</label>
                <input id="maxPrice" type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="bedrooms">Chambres min.</label>
              <input id="bedrooms" type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="propertyType">Type de bien</label>
              <input id="propertyType" type="text" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="transactionType">Transaction</label>
              <select id="transactionType" value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="">Toutes</option>
                <option value="SALE">Vente</option>
                <option value="RENT">Location</option>
              </select>
            </div>

            {status === "error" && <p className="error-text">{errorMessage}</p>}

            <button type="submit" className="btn btn-primary" disabled={status === "loading"}>
              {status === "loading" ? "Création…" : "Créer l'alerte"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
