import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useGenres, useMovies } from "../api/hooks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { MovieCard } from "../components/MovieCard";
import { Pagination } from "../components/Pagination";
import type { SortOption } from "../api/types";
import { SORT_OPCOES } from "../api/types";

const PAGE_SIZE = 24;

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1");
  const search = params.get("q") ?? "";
  const genero = params.get("genero") ?? "";
  const sort = (params.get("sort") as SortOption) ?? "titulo";

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  // propaga a busca (já com debounce) para a URL, voltando sempre para a página 1
  if (debouncedSearch !== search) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set("q", debouncedSearch);
        else next.delete("q");
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  }

  const { data, isLoading, isError, isPlaceholderData } = useMovies({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    genero: genero || undefined,
    sort,
  });
  const { data: genres } = useGenres();

  function updateParam(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set("page", "1");
      return next;
    });
  }

  function goToPage(nextPage: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(nextPage));
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="page catalog-page">
      <div className="catalog-page__toolbar">
        <div className="search-field">
          <input
            type="search"
            placeholder="Buscar por título…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar filmes por título"
          />
        </div>

        <select
          value={genero}
          onChange={(e) => updateParam("genero", e.target.value)}
          aria-label="Filtrar por gênero"
        >
          <option value="">Todos os gêneros</option>
          {genres?.map((g) => (
            <option key={g.sk_genre_id} value={g.nome_genero}>
              {g.nome_genero}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          aria-label="Ordenar catálogo"
        >
          {SORT_OPCOES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <Link to="/filmes/novo" className="button button--primary">
          + Novo filme
        </Link>
      </div>

      {isError && (
        <p className="state-message state-message--error">
          Não foi possível carregar o catálogo. Confira se a API está rodando e tente novamente.
        </p>
      )}

      {isLoading && <p className="state-message">Carregando catálogo…</p>}

      {data && data.items.length === 0 && (
        <p className="state-message">
          Nenhum filme encontrado{search && ` para "${search}"`}
          {genero && ` em ${genero}`}. Ajuste a busca ou cadastre um novo filme.
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="catalog-page__count">
            {data.meta.total.toLocaleString("pt-BR")} filme{data.meta.total !== 1 ? "s" : ""} encontrado
            {data.meta.total !== 1 ? "s" : ""}
          </p>
          <div className={`movie-grid ${isPlaceholderData ? "movie-grid--loading" : ""}`}>
            {data.items.map((movie) => (
              <MovieCard key={movie.sk_movie_id} movie={movie} />
            ))}
          </div>
          <Pagination page={data.meta.page} totalPages={data.meta.total_pages} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
