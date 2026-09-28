"""Schemas Pydantic (contratos de entrada/saída da API) do domínio de filmes.

Decisão de negócio — escala de avaliação: o banco (e o CSV de avaliações
já existente) guarda a nota em uma escala de 0 a 10 (`MovieReview.nota`),
igual à escala usada nas avaliações originais do TMDB/IMDb. Para a
experiência de "1 a 5 estrelas" pedida no escopo, a API aceita e devolve
`estrelas` (1 a 5, permitindo meia estrela) e converte internamente para a
escala 0-10 (`nota = estrelas * 2`). Assim o histórico de avaliações
importado dos CSVs continua compatível com as novas avaliações cadastradas
pela aplicação.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

PersonType = Literal["Ator", "Diretor", "Roteirista"]
StatusFilme = Literal["Lançado", "Pós-Produção", "Em Produção", "Planejado", "Rumores", "Cancelado"]


# --------------------------------------------------------------------------- catálogos simples
class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_genre_id: str
    nome_genero: str


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_company_id: str
    nome_produtora: str


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_person_id: str
    nome_pessoa: str
    tipo_pessoa: PersonType


# --------------------------------------------------------------------------- desempenho (fato)
class PerformanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    orcamento_usd: Decimal | None = None
    receita_usd: Decimal | None = None
    lucro_usd: Decimal
    orcamento_brl: Decimal | None = None
    receita_brl: Decimal | None = None
    lucro_brl: Decimal
    popularidade: float | None = None
    nota_tmdb: float | None = None
    qtd_tmdb: int | None = None
    nota_imdb: float | None = None
    qtd_imdb: int | None = None


class ReviewsSummary(BaseModel):
    """Resumo agregado das avaliações de usuários de um filme."""

    qtd_avaliacoes: int = 0
    nota_media_estrelas: float | None = None  # 0-5, já convertida


# --------------------------------------------------------------------------- filme: leitura
class MovieListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_movie_id: str
    id_filme: str
    titulo: str
    ano_lancamento: int | None
    duracao_minutos: int | None
    status_filme: str | None
    url_poster: str | None
    generos: list[str] = Field(default_factory=list)
    nota_media_estrelas: float | None = None
    qtd_avaliacoes: int = 0

    @classmethod
    def from_movie(cls, movie) -> MovieListItem:
        resumo = movie.reviews_summary
        media = None
        if resumo and resumo.nota_media_usuarios is not None:
            media = round(resumo.nota_media_usuarios / 2, 1)
        return cls(
            sk_movie_id=movie.sk_movie_id,
            id_filme=movie.id_filme,
            titulo=movie.titulo,
            ano_lancamento=movie.ano_lancamento,
            duracao_minutos=movie.duracao_minutos,
            status_filme=movie.status_filme,
            url_poster=movie.url_poster,
            generos=[g.nome_genero for g in movie.genres],
            nota_media_estrelas=media,
            qtd_avaliacoes=resumo.qtd_avaliacoes_usuarios if resumo else 0,
        )


class MovieDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_movie_id: str
    id_filme: str
    titulo: str
    data_lancamento: date | None
    ano_lancamento: int | None
    duracao_minutos: int | None
    status_filme: str | None
    sinopse: str | None
    url_poster: str | None
    url_backdrop: str | None
    generos: list[GenreOut] = Field(default_factory=list)
    produtoras: list[CompanyOut] = Field(default_factory=list)
    diretores: list[PersonOut] = Field(default_factory=list)
    roteiristas: list[PersonOut] = Field(default_factory=list)
    elenco: list[PersonOut] = Field(default_factory=list)
    performance: PerformanceOut | None = None
    avaliacoes: ReviewsSummary

    @classmethod
    def from_movie(cls, movie) -> MovieDetail:
        resumo = movie.reviews_summary
        media = None
        if resumo and resumo.nota_media_usuarios is not None:
            media = round(resumo.nota_media_usuarios / 2, 1)
        return cls(
            sk_movie_id=movie.sk_movie_id,
            id_filme=movie.id_filme,
            titulo=movie.titulo,
            data_lancamento=movie.data_lancamento,
            ano_lancamento=movie.ano_lancamento,
            duracao_minutos=movie.duracao_minutos,
            status_filme=movie.status_filme,
            sinopse=movie.sinopse,
            url_poster=movie.url_poster,
            url_backdrop=movie.url_backdrop,
            generos=[GenreOut.model_validate(g) for g in movie.genres],
            produtoras=[CompanyOut.model_validate(c) for c in movie.companies],
            diretores=[PersonOut.model_validate(p) for p in movie.people if p.tipo_pessoa == "Diretor"],
            roteiristas=[PersonOut.model_validate(p) for p in movie.people if p.tipo_pessoa == "Roteirista"],
            elenco=[PersonOut.model_validate(p) for p in movie.people if p.tipo_pessoa == "Ator"],
            performance=PerformanceOut.model_validate(movie.performance) if movie.performance else None,
            avaliacoes=ReviewsSummary(
                qtd_avaliacoes=resumo.qtd_avaliacoes_usuarios if resumo else 0,
                nota_media_estrelas=media,
            ),
        )


# --------------------------------------------------------------------------- filme: escrita
class MovieCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=500)
    ano_lancamento: int | None = Field(default=None, ge=1888, le=2100)
    duracao_minutos: int | None = Field(default=None, gt=0, le=1200)
    status_filme: StatusFilme | None = "Lançado"
    sinopse: str | None = Field(default=None, max_length=4000)
    url_poster: str | None = Field(default=None, max_length=2048)
    url_backdrop: str | None = Field(default=None, max_length=2048)
    diretor: str | None = Field(default=None, max_length=255, description="Nome do diretor")
    generos: list[str] = Field(default_factory=list, description="Nomes dos gêneros")

    @field_validator("titulo")
    @classmethod
    def titulo_sem_espacos_nas_pontas(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("O título não pode ficar em branco.")
        return v


class MovieUpdate(BaseModel):
    """Todos os campos são opcionais: só o que for enviado é alterado."""

    titulo: str | None = Field(default=None, min_length=1, max_length=500)
    ano_lancamento: int | None = Field(default=None, ge=1888, le=2100)
    duracao_minutos: int | None = Field(default=None, gt=0, le=1200)
    status_filme: StatusFilme | None = None
    sinopse: str | None = Field(default=None, max_length=4000)
    url_poster: str | None = Field(default=None, max_length=2048)
    url_backdrop: str | None = Field(default=None, max_length=2048)
    diretor: str | None = Field(default=None, max_length=255)
    generos: list[str] | None = None


# --------------------------------------------------------------------------- avaliações
class ReviewCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    estrelas: float = Field(ge=1, le=5, multiple_of=0.5, description="1 a 5 estrelas (permite meia estrela)")
    comentario: str = Field(min_length=1, max_length=4000)

    @computed_field  # type: ignore[misc]
    @property
    def nota(self) -> float:
        """Converte para a escala 0-10 usada no banco."""
        return round(self.estrelas * 2, 1)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_movie_review_id: str
    nome: str
    nota: float
    comentario: str
    created_at: datetime

    @computed_field  # type: ignore[misc]
    @property
    def estrelas(self) -> float:
        return round(self.nota / 2, 1)


# --------------------------------------------------------------------------- paginação genérica
class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class MoviePage(BaseModel):
    items: list[MovieListItem]
    meta: PageMeta


class ReviewPage(BaseModel):
    items: list[ReviewOut]
    meta: PageMeta
