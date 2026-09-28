import type {
  MovieCreateInput,
  MovieDetail,
  MoviePage,
  MovieUpdateInput,
  Genre,
  Review,
  ReviewCreateInput,
  ReviewPage,
  SortOption,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

/** Erro de aplicação com a mensagem que o backend devolveu (`detail`). */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let message = `Erro ${response.status} ao falar com a API.`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body?.detail)) {
        // Erros de validação (422) do FastAPI vêm como lista de objetos
        message = body.detail
          .map((item: { loc?: string[]; msg?: string }) => {
            const campo = item.loc?.at(-1);
            return campo ? `${campo}: ${item.msg}` : item.msg;
          })
          .join(" | ");
      }
    } catch {
      // corpo sem JSON (ex.: 500 genérico) -> mantém a mensagem padrão
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface ListMoviesParams {
  page: number;
  pageSize: number;
  search?: string;
  genero?: string;
  sort?: SortOption;
}

export const api = {
  listMovies({ page, pageSize, search, genero, sort }: ListMoviesParams): Promise<MoviePage> {
    const qs = toQueryString({ page, page_size: pageSize, search, genero, sort });
    return request<MoviePage>(`/movies${qs}`);
  },

  getMovie(skMovieId: string): Promise<MovieDetail> {
    return request<MovieDetail>(`/movies/${skMovieId}`);
  },

  createMovie(data: MovieCreateInput): Promise<MovieDetail> {
    return request<MovieDetail>("/movies", { method: "POST", body: JSON.stringify(data) });
  },

  updateMovie(skMovieId: string, data: MovieUpdateInput): Promise<MovieDetail> {
    return request<MovieDetail>(`/movies/${skMovieId}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteMovie(skMovieId: string): Promise<void> {
    return request<void>(`/movies/${skMovieId}`, { method: "DELETE" });
  },

  listGenres(): Promise<Genre[]> {
    return request<Genre[]>("/genres");
  },

  listReviews(skMovieId: string, page: number, pageSize = 10): Promise<ReviewPage> {
    const qs = toQueryString({ page, page_size: pageSize });
    return request<ReviewPage>(`/movies/${skMovieId}/reviews${qs}`);
  },

  addReview(skMovieId: string, data: ReviewCreateInput): Promise<Review> {
    return request<Review>(`/movies/${skMovieId}/reviews`, { method: "POST", body: JSON.stringify(data) });
  },
};
