/**
 * Tipos espelhando os schemas Pydantic do backend (`backend/app/movies/schemas.py`).
 * Mantidos manualmente e de propósito simples: o projeto é pequeno o
 * suficiente para não justificar geração automática (ex.: openapi-typescript).
 */

export type PersonType = "Ator" | "Diretor" | "Roteirista";

export type StatusFilme =
  | "Lançado"
  | "Pós-Produção"
  | "Em Produção"
  | "Planejado"
  | "Rumores"
  | "Cancelado";

export const STATUS_OPCOES: StatusFilme[] = [
  "Lançado",
  "Pós-Produção",
  "Em Produção",
  "Planejado",
  "Rumores",
  "Cancelado",
];

export interface Genre {
  sk_genre_id: string;
  nome_genero: string;
}

export interface Company {
  sk_company_id: string;
  nome_produtora: string;
}

export interface Person {
  sk_person_id: string;
  nome_pessoa: string;
  tipo_pessoa: PersonType;
}

export interface Performance {
  orcamento_usd: string | null;
  receita_usd: string | null;
  lucro_usd: string;
  orcamento_brl: string | null;
  receita_brl: string | null;
  lucro_brl: string;
  popularidade: number | null;
  nota_tmdb: number | null;
  qtd_tmdb: number | null;
  nota_imdb: number | null;
  qtd_imdb: number | null;
}

export interface ReviewsSummary {
  qtd_avaliacoes: number;
  nota_media_estrelas: number | null;
}

export interface MovieListItem {
  sk_movie_id: string;
  id_filme: string;
  titulo: string;
  ano_lancamento: number | null;
  duracao_minutos: number | null;
  status_filme: string | null;
  url_poster: string | null;
  generos: string[];
  nota_media_estrelas: number | null;
  qtd_avaliacoes: number;
}

export interface MovieDetail {
  sk_movie_id: string;
  id_filme: string;
  titulo: string;
  data_lancamento: string | null;
  ano_lancamento: number | null;
  duracao_minutos: number | null;
  status_filme: string | null;
  sinopse: string | null;
  url_poster: string | null;
  url_backdrop: string | null;
  generos: Genre[];
  produtoras: Company[];
  diretores: Person[];
  roteiristas: Person[];
  elenco: Person[];
  performance: Performance | null;
  avaliacoes: ReviewsSummary;
}

export interface MovieCreateInput {
  titulo: string;
  ano_lancamento?: number | null;
  duracao_minutos?: number | null;
  status_filme?: StatusFilme | null;
  sinopse?: string | null;
  url_poster?: string | null;
  url_backdrop?: string | null;
  diretor?: string | null;
  generos?: string[];
}

export type MovieUpdateInput = Partial<MovieCreateInput>;

export interface Review {
  sk_movie_review_id: string;
  nome: string;
  nota: number;
  estrelas: number;
  comentario: string;
  created_at: string;
}

export interface ReviewCreateInput {
  nome: string;
  estrelas: number;
  comentario: string;
}

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface MoviePage {
  items: MovieListItem[];
  meta: PageMeta;
}

export interface ReviewPage {
  items: Review[];
  meta: PageMeta;
}

export type SortOption = "titulo" | "ano_lancamento" | "popularidade" | "nota_media" | "recentes";

export const SORT_OPCOES: { value: SortOption; label: string }[] = [
  { value: "titulo", label: "Título (A-Z)" },
  { value: "ano_lancamento", label: "Ano de lançamento" },
  { value: "nota_media", label: "Nota dos usuários" },
  { value: "popularidade", label: "Popularidade" },
  { value: "recentes", label: "Lançamento mais recente" },
];
