import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAddReview, useDeleteMovie, useMovie, useReviews } from "../api/hooks";
import { StarRatingDisplay, StarRatingInput } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { ApiError } from "../api/client";

function formatMoeda(valor: string | null, moeda: "USD" | "BRL"): string {
  if (valor === null) return "Não informado";
  const numero = Number(valor);
  return numero.toLocaleString("pt-BR", { style: "currency", currency: moeda });
}

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: movie, isLoading, isError } = useMovie(id);
  const [reviewPage, setReviewPage] = useState(1);
  const { data: reviews } = useReviews(id, reviewPage);
  const deleteMovie = useDeleteMovie();
  const addReview = useAddReview(id ?? "");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ nome: "", estrelas: 4, comentario: "" });
  const [reviewErro, setReviewErro] = useState<string | null>(null);

  if (isLoading) return <p className="state-message">Carregando filme…</p>;
  if (isError || !movie) {
    return (
      <div className="page">
        <p className="state-message state-message--error">
          Não encontramos esse filme. <Link to="/">Voltar para o catálogo</Link>.
        </p>
      </div>
    );
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteMovie.mutateAsync(id);
      notify(`"${movie!.titulo}" foi removido do catálogo.`);
      navigate("/");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível excluir o filme.", "error");
    }
  }

  async function handleReviewSubmit(event: React.FormEvent) {
    event.preventDefault();
    setReviewErro(null);
    if (!reviewForm.nome.trim() || !reviewForm.comentario.trim()) {
      setReviewErro("Preencha seu nome e a resenha antes de publicar.");
      return;
    }
    try {
      await addReview.mutateAsync(reviewForm);
      setReviewForm({ nome: "", estrelas: 4, comentario: "" });
      setReviewPage(1);
      notify("Avaliação publicada com sucesso.");
    } catch (err) {
      setReviewErro(err instanceof ApiError ? err.message : "Não foi possível publicar a avaliação.");
    }
  }

  const generosTexto = movie.generos.map((g) => g.nome_genero).join(", ");

  return (
    <div className="movie-detail">
      {movie.url_backdrop && (
        <div className="movie-detail__hero" style={{ backgroundImage: `url(${movie.url_backdrop})` }} />
      )}

      <div className="page movie-detail__content">
        <div className="movie-detail__header">
          {movie.url_poster && (
            <img src={movie.url_poster} alt="" className="movie-detail__poster" />
          )}
          <div className="movie-detail__headline">
            <p className="movie-detail__eyebrow">
              {movie.status_filme}
              {movie.ano_lancamento ? ` · ${movie.ano_lancamento}` : ""}
              {movie.duracao_minutos ? ` · ${movie.duracao_minutos} min` : ""}
            </p>
            <h1>{movie.titulo}</h1>
            {generosTexto && <p className="movie-detail__genres">{generosTexto}</p>}

            <div className="movie-detail__rating">
              <StarRatingDisplay value={movie.avaliacoes.nota_media_estrelas} size={20} />
              <span className="movie-detail__rating-count">
                {movie.avaliacoes.qtd_avaliacoes} avaliaç{movie.avaliacoes.qtd_avaliacoes === 1 ? "ão" : "ões"}
              </span>
            </div>

            <div className="movie-detail__actions">
              <Link to={`/filmes/${movie.sk_movie_id}/editar`} className="button button--ghost">
                Editar
              </Link>
              <button
                type="button"
                className="button button--danger"
                onClick={() => setConfirmOpen(true)}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        {movie.sinopse && (
          <section className="movie-detail__section">
            <h2>Sinopse</h2>
            <p className="movie-detail__sinopse">{movie.sinopse}</p>
          </section>
        )}

        <section className="movie-detail__section movie-detail__credits">
          {movie.diretores.length > 0 && (
            <div>
              <h3>Direção</h3>
              <p>{movie.diretores.map((p) => p.nome_pessoa).join(", ")}</p>
            </div>
          )}
          {movie.roteiristas.length > 0 && (
            <div>
              <h3>Roteiro</h3>
              <p>{movie.roteiristas.map((p) => p.nome_pessoa).join(", ")}</p>
            </div>
          )}
          {movie.elenco.length > 0 && (
            <div>
              <h3>Elenco</h3>
              <p>{movie.elenco.map((p) => p.nome_pessoa).join(", ")}</p>
            </div>
          )}
          {movie.produtoras.length > 0 && (
            <div>
              <h3>Produtoras</h3>
              <p>{movie.produtoras.map((c) => c.nome_produtora).join(", ")}</p>
            </div>
          )}
        </section>

        {movie.performance && (
          <section className="movie-detail__section">
            <h2>Números</h2>
            <dl className="movie-detail__stats">
              <div>
                <dt>Orçamento</dt>
                <dd>{formatMoeda(movie.performance.orcamento_usd, "USD")}</dd>
              </div>
              <div>
                <dt>Receita</dt>
                <dd>{formatMoeda(movie.performance.receita_usd, "USD")}</dd>
              </div>
              <div>
                <dt>Nota TMDB</dt>
                <dd>{movie.performance.nota_tmdb?.toFixed(1) ?? "—"}</dd>
              </div>
              <div>
                <dt>Nota IMDb</dt>
                <dd>{movie.performance.nota_imdb?.toFixed(1) ?? "—"}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="movie-detail__section">
          <h2>Avaliações</h2>

          <form className="review-form" onSubmit={handleReviewSubmit}>
            <div className="review-form__row">
              <label className="field">
                <span>Seu nome</span>
                <input
                  value={reviewForm.nome}
                  onChange={(e) => setReviewForm((f) => ({ ...f, nome: e.target.value }))}
                  maxLength={120}
                  placeholder="Como você quer assinar a resenha"
                />
              </label>
              <div className="field">
                <span>Sua nota</span>
                <StarRatingInput
                  value={reviewForm.estrelas}
                  onChange={(v) => setReviewForm((f) => ({ ...f, estrelas: v }))}
                />
              </div>
            </div>
            <label className="field">
              <span>Resenha</span>
              <textarea
                value={reviewForm.comentario}
                onChange={(e) => setReviewForm((f) => ({ ...f, comentario: e.target.value }))}
                rows={3}
                maxLength={4000}
                placeholder="O que você achou do filme?"
              />
            </label>
            {reviewErro && <p className="field-error">{reviewErro}</p>}
            <button type="submit" className="button button--primary" disabled={addReview.isPending}>
              {addReview.isPending ? "Publicando…" : "Publicar avaliação"}
            </button>
          </form>

          <ul className="review-list">
            {reviews?.items.map((review) => (
              <li key={review.sk_movie_review_id} className="review-item">
                <div className="review-item__header">
                  <strong>{review.nome}</strong>
                  <StarRatingDisplay value={review.estrelas} size={13} />
                </div>
                <p>{review.comentario}</p>
              </li>
            ))}
            {reviews && reviews.items.length === 0 && (
              <li className="state-message">Ainda não há avaliações. Seja o primeiro a avaliar.</li>
            )}
          </ul>

          {reviews && (
            <Pagination page={reviews.meta.page} totalPages={reviews.meta.total_pages} onChange={setReviewPage} />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir filme"
        description={`Tem certeza que deseja remover "${movie.titulo}" do catálogo? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
