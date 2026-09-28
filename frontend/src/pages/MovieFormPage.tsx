import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCreateMovie, useGenres, useMovie, useUpdateMovie } from "../api/hooks";
import { useToast } from "../components/Toast";
import { ApiError } from "../api/client";
import { STATUS_OPCOES, type StatusFilme } from "../api/types";

interface FormState {
  titulo: string;
  ano_lancamento: string;
  duracao_minutos: string;
  status_filme: StatusFilme;
  sinopse: string;
  url_poster: string;
  url_backdrop: string;
  diretor: string;
  generos: string[];
}

const ESTADO_INICIAL: FormState = {
  titulo: "",
  ano_lancamento: "",
  duracao_minutos: "",
  status_filme: "Lançado",
  sinopse: "",
  url_poster: "",
  url_backdrop: "",
  diretor: "",
  generos: [],
};

export function MovieFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: movie } = useMovie(id);
  const { data: genres } = useGenres();
  const createMovie = useCreateMovie();
  const updateMovie = useUpdateMovie(id ?? "");

  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [novoGenero, setNovoGenero] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // preenche o formulário assim que o filme (modo edição) chega da API
  useEffect(() => {
    if (movie) {
      setForm({
        titulo: movie.titulo,
        ano_lancamento: movie.ano_lancamento?.toString() ?? "",
        duracao_minutos: movie.duracao_minutos?.toString() ?? "",
        status_filme: (movie.status_filme as StatusFilme) ?? "Lançado",
        sinopse: movie.sinopse ?? "",
        url_poster: movie.url_poster ?? "",
        url_backdrop: movie.url_backdrop ?? "",
        diretor: movie.diretores[0]?.nome_pessoa ?? "",
        generos: movie.generos.map((g) => g.nome_genero),
      });
    }
  }, [movie]);

  function toggleGenero(nome: string) {
    setForm((f) => ({
      ...f,
      generos: f.generos.includes(nome) ? f.generos.filter((g) => g !== nome) : [...f.generos, nome],
    }));
  }

  function adicionarGeneroLivre() {
    const nome = novoGenero.trim();
    if (nome && !form.generos.includes(nome)) {
      setForm((f) => ({ ...f, generos: [...f.generos, nome] }));
    }
    setNovoGenero("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    if (!form.titulo.trim()) {
      setErro("O título é obrigatório.");
      return;
    }

    const payload = {
      titulo: form.titulo.trim(),
      ano_lancamento: form.ano_lancamento ? Number(form.ano_lancamento) : null,
      duracao_minutos: form.duracao_minutos ? Number(form.duracao_minutos) : null,
      status_filme: form.status_filme,
      sinopse: form.sinopse.trim() || null,
      url_poster: form.url_poster.trim() || null,
      url_backdrop: form.url_backdrop.trim() || null,
      diretor: form.diretor.trim() || null,
      generos: form.generos,
    };

    try {
      if (isEdit && id) {
        await updateMovie.mutateAsync(payload);
        notify("Filme atualizado com sucesso.");
        navigate(`/filmes/${id}`);
      } else {
        const criado = await createMovie.mutateAsync(payload);
        notify("Filme cadastrado com sucesso.");
        navigate(`/filmes/${criado.sk_movie_id}`);
      }
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o filme.");
    }
  }

  const salvando = createMovie.isPending || updateMovie.isPending;

  return (
    <div className="page form-page">
      <h1>{isEdit ? "Editar filme" : "Cadastrar filme"}</h1>

      <form onSubmit={handleSubmit} className="movie-form">
        <label className="field">
          <span>Título *</span>
          <input
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            maxLength={500}
            required
          />
        </label>

        <div className="movie-form__row">
          <label className="field">
            <span>Ano de lançamento</span>
            <input
              type="number"
              min={1888}
              max={2100}
              value={form.ano_lancamento}
              onChange={(e) => setForm((f) => ({ ...f, ano_lancamento: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Duração (minutos)</span>
            <input
              type="number"
              min={1}
              max={1200}
              value={form.duracao_minutos}
              onChange={(e) => setForm((f) => ({ ...f, duracao_minutos: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={form.status_filme}
              onChange={(e) => setForm((f) => ({ ...f, status_filme: e.target.value as StatusFilme }))}
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Diretor</span>
          <input
            value={form.diretor}
            onChange={(e) => setForm((f) => ({ ...f, diretor: e.target.value }))}
            placeholder="Nome do diretor (opcional)"
            maxLength={255}
          />
        </label>

        <label className="field">
          <span>Sinopse</span>
          <textarea
            value={form.sinopse}
            onChange={(e) => setForm((f) => ({ ...f, sinopse: e.target.value }))}
            rows={4}
            maxLength={4000}
          />
        </label>

        <div className="movie-form__row">
          <label className="field">
            <span>URL do pôster</span>
            <input
              value={form.url_poster}
              onChange={(e) => setForm((f) => ({ ...f, url_poster: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>URL da imagem de fundo</span>
            <input
              value={form.url_backdrop}
              onChange={(e) => setForm((f) => ({ ...f, url_backdrop: e.target.value }))}
              placeholder="https://…"
            />
          </label>
        </div>

        <fieldset className="field genre-picker">
          <legend>Gêneros</legend>
          <div className="genre-picker__options">
            {genres?.map((g) => (
              <label key={g.sk_genre_id} className="genre-chip">
                <input
                  type="checkbox"
                  checked={form.generos.includes(g.nome_genero)}
                  onChange={() => toggleGenero(g.nome_genero)}
                />
                {g.nome_genero}
              </label>
            ))}
          </div>
          <div className="genre-picker__custom">
            <input
              value={novoGenero}
              onChange={(e) => setNovoGenero(e.target.value)}
              placeholder="Adicionar outro gênero…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarGeneroLivre();
                }
              }}
            />
            <button type="button" className="button button--ghost" onClick={adicionarGeneroLivre}>
              Adicionar
            </button>
          </div>
          {form.generos.length > 0 && (
            <p className="genre-picker__selected">Selecionados: {form.generos.join(", ")}</p>
          )}
        </fieldset>

        {erro && <p className="field-error">{erro}</p>}

        <div className="movie-form__actions">
          <button type="button" className="button button--ghost" onClick={() => navigate(-1)}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={salvando}>
            {salvando ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar filme"}
          </button>
        </div>
      </form>
    </div>
  );
}
