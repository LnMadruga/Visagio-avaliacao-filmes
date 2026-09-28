interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Paginação simples: anterior/próxima + números próximos à página atual. */
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const paginas: number[] = [];
  const inicio = Math.max(1, page - 2);
  const fim = Math.min(totalPages, page + 2);
  for (let p = inicio; p <= fim; p++) paginas.push(p);

  return (
    <nav className="pagination" aria-label="Paginação">
      <button
        type="button"
        className="pagination__button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Anterior
      </button>

      {inicio > 1 && (
        <>
          <button type="button" className="pagination__page" onClick={() => onChange(1)}>
            1
          </button>
          {inicio > 2 && <span className="pagination__ellipsis">…</span>}
        </>
      )}

      {paginas.map((p) => (
        <button
          key={p}
          type="button"
          className={`pagination__page ${p === page ? "pagination__page--active" : ""}`}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      {fim < totalPages && (
        <>
          {fim < totalPages - 1 && <span className="pagination__ellipsis">…</span>}
          <button type="button" className="pagination__page" onClick={() => onChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className="pagination__button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Próxima
      </button>
    </nav>
  );
}
