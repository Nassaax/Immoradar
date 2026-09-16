import Link from "next/link";

export function Nav() {
  return (
    <div className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <span className="dot" />
          ListingRadar
        </Link>
        <nav className="nav-links">
          <Link href="/">Rechercher</Link>
          <Link href="/sources">Sources</Link>
          <Link href="/alerts">Alertes</Link>
          <Link href="/opt-out">Opt-out</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
    </div>
  );
}
