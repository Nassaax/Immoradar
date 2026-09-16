import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

function hrefFor(page: number, searchParams: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/?${params.toString()}`;
}

export function Pagination({ page, totalPages, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <Link href={hrefFor(Math.max(1, page - 1), searchParams)} className="btn btn-outline" aria-disabled={page <= 1}>
        ← Précédent
      </Link>
      <span style={{ alignSelf: "center", fontSize: 13, color: "var(--text-muted)" }}>
        Page {page} / {totalPages}
      </span>
      <Link
        href={hrefFor(Math.min(totalPages, page + 1), searchParams)}
        className="btn btn-outline"
        aria-disabled={page >= totalPages}
      >
        Suivant →
      </Link>
    </div>
  );
}
