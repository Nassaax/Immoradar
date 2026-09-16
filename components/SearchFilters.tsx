interface SearchFiltersProps {
  searchParams: Record<string, string | undefined>;
}

export function SearchFilters({ searchParams }: SearchFiltersProps) {
  const { q, city, minPrice, maxPrice, bedrooms, propertyType, transactionType, sort } = searchParams;

  return (
    <form method="get" action="/" className="card stack">
      <h2>Filtres</h2>

      <div className="field">
        <label htmlFor="q">Recherche</label>
        <input id="q" name="q" type="text" placeholder="titre, ville, code postal…" defaultValue={q ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="city">Ville</label>
        <input id="city" name="city" type="text" placeholder="ex: Liège" defaultValue={city ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="transactionType">Type de transaction</label>
        <select id="transactionType" name="transactionType" defaultValue={transactionType ?? ""}>
          <option value="">Tous</option>
          <option value="SALE">Vente</option>
          <option value="RENT">Location</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="propertyType">Type de bien</label>
        <input id="propertyType" name="propertyType" type="text" placeholder="maison, appartement…" defaultValue={propertyType ?? ""} />
      </div>

      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="minPrice">Prix min</label>
          <input id="minPrice" name="minPrice" type="number" min={0} defaultValue={minPrice ?? ""} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="maxPrice">Prix max</label>
          <input id="maxPrice" name="maxPrice" type="number" min={0} defaultValue={maxPrice ?? ""} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="bedrooms">Chambres min.</label>
        <input id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={bedrooms ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="sort">Trier par</label>
        <select id="sort" name="sort" defaultValue={sort ?? "new"}>
          <option value="new">Nouveautés</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
        </select>
      </div>

      <button type="submit" className="btn btn-primary">
        Appliquer
      </button>
      <a href="/" className="btn btn-outline">
        Réinitialiser
      </a>
    </form>
  );
}
