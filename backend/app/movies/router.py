"""Rotas HTTP do domínio de filmes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.movies import schemas, service

router = APIRouter()


# --------------------------------------------------------------------------- catálogo
@router.get("/movies", response_model=schemas.MoviePage, summary="Lista o catálogo (paginado e com busca)")
async def listar_filmes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Busca por título (contém, sem diferenciar maiúsculas)"),
    genero: str | None = Query(None, description="Filtra por nome exato do gênero"),
    sort: service.SortOption = Query("titulo"),
    db: AsyncSession = Depends(get_db),
) -> schemas.MoviePage:
    movies, total = await service.list_movies(
        db, page=page, page_size=page_size, search=search, genero=genero, sort=sort
    )
    return schemas.MoviePage(
        items=[schemas.MovieListItem.from_movie(m) for m in movies],
        meta=schemas.PageMeta(**service.paginate_meta(total, page, page_size)),
    )


@router.post(
    "/movies",
    response_model=schemas.MovieDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um filme",
)
async def criar_filme(
    payload: schemas.MovieCreate, db: AsyncSession = Depends(get_db)
) -> schemas.MovieDetail:
    movie = await service.create_movie(db, payload)
    return schemas.MovieDetail.from_movie(movie)


@router.get("/movies/{sk_movie_id}", response_model=schemas.MovieDetail, summary="Detalhe de um filme")
async def obter_filme(sk_movie_id: str, db: AsyncSession = Depends(get_db)) -> schemas.MovieDetail:
    movie = await service.get_movie(db, sk_movie_id)
    if movie is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado.")
    return schemas.MovieDetail.from_movie(movie)


@router.put("/movies/{sk_movie_id}", response_model=schemas.MovieDetail, summary="Atualiza um filme")
async def atualizar_filme(
    sk_movie_id: str, payload: schemas.MovieUpdate, db: AsyncSession = Depends(get_db)
) -> schemas.MovieDetail:
    try:
        movie = await service.update_movie(db, sk_movie_id, payload)
    except service.MovieNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado.") from exc
    return schemas.MovieDetail.from_movie(movie)


@router.delete("/movies/{sk_movie_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove um filme")
async def remover_filme(sk_movie_id: str, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await service.delete_movie(db, sk_movie_id)
    except service.MovieNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado.") from exc


# --------------------------------------------------------------------------- gêneros (catálogo auxiliar)
@router.get("/genres", response_model=list[schemas.GenreOut], summary="Lista os gêneros cadastrados")
async def listar_generos(db: AsyncSession = Depends(get_db)) -> list[schemas.GenreOut]:
    genres = await service.list_genres(db)
    return [schemas.GenreOut.model_validate(g) for g in genres]


# --------------------------------------------------------------------------- avaliações
@router.get(
    "/movies/{sk_movie_id}/reviews",
    response_model=schemas.ReviewPage,
    summary="Lista as avaliações de um filme",
)
async def listar_avaliacoes(
    sk_movie_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> schemas.ReviewPage:
    try:
        reviews, total = await service.list_reviews(db, sk_movie_id, page=page, page_size=page_size)
    except service.MovieNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado.") from exc
    return schemas.ReviewPage(
        items=[schemas.ReviewOut.model_validate(r) for r in reviews],
        meta=schemas.PageMeta(**service.paginate_meta(total, page, page_size)),
    )


@router.post(
    "/movies/{sk_movie_id}/reviews",
    response_model=schemas.ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Adiciona uma avaliação (nota de 1 a 5 estrelas + resenha)",
)
async def adicionar_avaliacao(
    sk_movie_id: str, payload: schemas.ReviewCreate, db: AsyncSession = Depends(get_db)
) -> schemas.ReviewOut:
    try:
        review = await service.add_review(db, sk_movie_id, payload)
    except service.MovieNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Filme não encontrado.") from exc
    return schemas.ReviewOut.model_validate(review)
