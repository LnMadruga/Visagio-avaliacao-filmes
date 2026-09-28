"""Camada de serviço: regras de negócio e consultas do domínio de filmes.

Mantém a lógica de acesso a dados fora dos endpoints (`router.py`), para que
as rotas fiquem finas (validação de entrada/saída) e as regras fiquem
testáveis isoladamente.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from math import ceil
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.movies.models import (
    DimGenre,
    DimMovie,
    DimPerson,
    DimReview,
    FactMoviePerformance,
    MovieReview,
    generate_surrogate_key,
)
from app.movies.schemas import MovieCreate, MovieUpdate, ReviewCreate

SortOption = Literal["titulo", "ano_lancamento", "popularidade", "nota_media", "recentes"]


class MovieNotFoundError(Exception):
    """Filme não encontrado."""


def _movie_options():
    """Eager-loading padrão para não disparar N+1 queries."""
    return (
        selectinload(DimMovie.genres),
        selectinload(DimMovie.companies),
        selectinload(DimMovie.people),
        selectinload(DimMovie.performance),
        selectinload(DimMovie.reviews_summary),
    )


async def generate_unique_id_filme(db: AsyncSession) -> str:
    """Gera um id_filme único para filmes cadastrados manualmente pela aplicação."""
    for _ in range(5):
        candidate = f"custom-{uuid.uuid4().hex[:10]}"
        existing = await db.scalar(select(DimMovie.id_filme).where(DimMovie.id_filme == candidate))
        if existing is None:
            return candidate
    raise RuntimeError("Não foi possível gerar um id_filme único.")  # extremamente improvável


async def list_movies(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None,
    genero: str | None,
    sort: SortOption,
) -> tuple[Sequence[DimMovie], int]:
    """Lista filmes paginados, com busca por título e filtro opcional por gênero."""
    stmt = select(DimMovie)
    count_stmt = select(func.count()).select_from(DimMovie)

    if search:
        termo = f"%{search.strip()}%"
        stmt = stmt.where(DimMovie.titulo.ilike(termo))
        count_stmt = count_stmt.where(DimMovie.titulo.ilike(termo))

    if genero:
        stmt = stmt.join(DimMovie.genres).where(DimGenre.nome_genero.ilike(genero))
        count_stmt = count_stmt.join(DimMovie.genres).where(DimGenre.nome_genero.ilike(genero))

    if sort == "ano_lancamento":
        stmt = stmt.order_by(DimMovie.ano_lancamento.desc().nulls_last(), DimMovie.titulo)
    elif sort == "popularidade":
        stmt = stmt.outerjoin(FactMoviePerformance).order_by(
            FactMoviePerformance.popularidade.desc().nulls_last(), DimMovie.titulo
        )
    elif sort == "nota_media":
        stmt = stmt.outerjoin(DimMovie.reviews_summary).order_by(
            DimReview.nota_media_usuarios.desc().nulls_last(), DimMovie.titulo
        )
    elif sort == "recentes":
        stmt = stmt.order_by(DimMovie.data_lancamento.desc().nulls_last(), DimMovie.titulo)
    else:
        stmt = stmt.order_by(DimMovie.titulo)

    total = await db.scalar(count_stmt) or 0
    stmt = stmt.options(*_movie_options()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().unique().all()
    return items, total


async def get_movie(db: AsyncSession, sk_movie_id: str) -> DimMovie | None:
    stmt = select(DimMovie).where(DimMovie.sk_movie_id == sk_movie_id).options(*_movie_options())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_movie_or_raise(db: AsyncSession, sk_movie_id: str) -> DimMovie:
    movie = await get_movie(db, sk_movie_id)
    if movie is None:
        raise MovieNotFoundError(sk_movie_id)
    return movie


async def _find_or_create_genre(db: AsyncSession, nome: str) -> DimGenre:
    nome = nome.strip()
    genre = await db.scalar(select(DimGenre).where(DimGenre.nome_genero.ilike(nome)))
    if genre is None:
        genre = DimGenre(sk_genre_id=generate_surrogate_key(), nome_genero=nome)
        db.add(genre)
        await db.flush()
    return genre


async def _find_or_create_director(db: AsyncSession, nome: str) -> DimPerson:
    nome = nome.strip()
    person = await db.scalar(
        select(DimPerson).where(DimPerson.nome_pessoa.ilike(nome), DimPerson.tipo_pessoa == "Diretor")
    )
    if person is None:
        person = DimPerson(sk_person_id=generate_surrogate_key(), nome_pessoa=nome, tipo_pessoa="Diretor")
        db.add(person)
        await db.flush()
    return person


async def create_movie(db: AsyncSession, data: MovieCreate) -> DimMovie:
    # Resolve gêneros/diretor ANTES de instanciar o filme: em SQLAlchemy assíncrono,
    # ler uma relação (ex.: movie.genres.append(...)) de um objeto já persistente
    # (após um flush) dispara um lazy-load síncrono e derruba a request
    # (MissingGreenlet). Passando as listas já prontas no construtor evitamos
    # esse lazy-load, pois a coleção nunca fica "não carregada".
    genres = [
        await _find_or_create_genre(db, nome_genero)
        for nome_genero in dict.fromkeys(g.strip() for g in data.generos if g.strip())
    ]
    people = []
    if data.diretor and data.diretor.strip():
        people.append(await _find_or_create_director(db, data.diretor))

    movie = DimMovie(
        sk_movie_id=generate_surrogate_key(),
        id_filme=await generate_unique_id_filme(db),
        titulo=data.titulo,
        ano_lancamento=data.ano_lancamento,
        duracao_minutos=data.duracao_minutos,
        status_filme=data.status_filme,
        sinopse=data.sinopse,
        url_poster=data.url_poster,
        url_backdrop=data.url_backdrop,
        genres=genres,
        people=people,
    )
    db.add(movie)
    await db.commit()
    return await get_movie_or_raise(db, movie.sk_movie_id)


async def update_movie(db: AsyncSession, sk_movie_id: str, data: MovieUpdate) -> DimMovie:
    movie = await get_movie_or_raise(db, sk_movie_id)

    campos_simples = data.model_dump(exclude_unset=True, exclude={"diretor", "generos"})
    for campo, valor in campos_simples.items():
        setattr(movie, campo, valor)

    if data.generos is not None:
        movie.genres.clear()
        for nome_genero in dict.fromkeys(g.strip() for g in data.generos if g.strip()):
            movie.genres.append(await _find_or_create_genre(db, nome_genero))

    if "diretor" in data.model_fields_set:
        # remove apenas os vínculos de Diretor (preserva elenco/roteiristas já existentes)
        movie.people = [p for p in movie.people if p.tipo_pessoa != "Diretor"]
        if data.diretor and data.diretor.strip():
            movie.people.append(await _find_or_create_director(db, data.diretor))

    await db.commit()
    return await get_movie_or_raise(db, sk_movie_id)


async def delete_movie(db: AsyncSession, sk_movie_id: str) -> None:
    movie = await get_movie_or_raise(db, sk_movie_id)
    await db.delete(movie)
    await db.commit()


async def list_genres(db: AsyncSession) -> Sequence[DimGenre]:
    result = await db.execute(select(DimGenre).order_by(DimGenre.nome_genero))
    return result.scalars().all()


# --------------------------------------------------------------------------- avaliações
async def list_reviews(
    db: AsyncSession, sk_movie_id: str, *, page: int, page_size: int
) -> tuple[Sequence[MovieReview], int]:
    await get_movie_or_raise(db, sk_movie_id)  # 404 explícito se o filme não existe
    count_stmt = select(func.count()).select_from(MovieReview).where(MovieReview.sk_movie_id == sk_movie_id)
    total = await db.scalar(count_stmt) or 0

    stmt = (
        select(MovieReview)
        .where(MovieReview.sk_movie_id == sk_movie_id)
        .order_by(MovieReview.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return result.scalars().all(), total


async def _refresh_reviews_summary(db: AsyncSession, sk_movie_id: str) -> None:
    """Recalcula qtd_avaliacoes_usuarios/nota_media_usuarios em dim_reviews.

    dim_reviews é um resumo materializado (facilita listar/ordenar o catálogo
    sem agregar movie_reviews a cada requisição). Ele é recalculado a partir
    de movie_reviews sempre que uma avaliação nova é cadastrada, para que o
    resumo nunca fique desatualizado em relação às avaliações individuais.
    """
    agregados = await db.execute(
        select(func.count(MovieReview.sk_movie_review_id), func.avg(MovieReview.nota)).where(
            MovieReview.sk_movie_id == sk_movie_id
        )
    )
    qtd, media = agregados.one()

    resumo = await db.scalar(select(DimReview).where(DimReview.sk_movie_id == sk_movie_id))
    if resumo is None:
        resumo = DimReview(sk_review_id=generate_surrogate_key(), sk_movie_id=sk_movie_id)
        db.add(resumo)
    resumo.qtd_avaliacoes_usuarios = qtd or 0
    resumo.nota_media_usuarios = float(media) if media is not None else None


async def add_review(db: AsyncSession, sk_movie_id: str, data: ReviewCreate) -> MovieReview:
    await get_movie_or_raise(db, sk_movie_id)

    review = MovieReview(
        sk_movie_review_id=generate_surrogate_key(),
        sk_movie_id=sk_movie_id,
        nome=data.nome.strip(),
        nota=data.nota,
        comentario=data.comentario.strip(),
    )
    db.add(review)
    await db.flush()
    await _refresh_reviews_summary(db, sk_movie_id)
    await db.commit()
    await db.refresh(review)
    return review


def paginate_meta(total: int, page: int, page_size: int) -> dict[str, int]:
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, ceil(total / page_size)) if page_size else 1,
    }
