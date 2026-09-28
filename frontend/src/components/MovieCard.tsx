import { Link } from "react-router-dom";
import type { MovieListItem } from "../api/types";
import { StarRatingDisplay } from "./StarRating";

const SEM_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%2317151388'/%3E%3C/svg%3E";

export function MovieCard({ movie }: { movie: MovieListItem }) {
  return (
    <Link to={`/filmes/${movie.sk_movie_id}`} className="movie-card">
      <div className="movie-card__poster-wrap">
        <img
          src={movie.url_poster || SEM_POSTER}
          alt=""
          loading="lazy"
          className="movie-card__poster"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = SEM_POSTER;
          }}
        />
        {movie.nota_media_estrelas !== null && (
          <span className="movie-card__badge">★ {movie.nota_media_estrelas.toFixed(1)}</span>
        )}
      </div>
      <div className="movie-card__info">
        <h3 className="movie-card__title">{movie.titulo}</h3>
        <p className="movie-card__meta">
          {movie.ano_lancamento ?? "Ano desconhecido"}
          {movie.generos.length > 0 && ` · ${movie.generos.slice(0, 2).join(", ")}`}
        </p>
        <StarRatingDisplay value={movie.nota_media_estrelas} size={12} showValue={false} />
      </div>
    </Link>
  );
}
