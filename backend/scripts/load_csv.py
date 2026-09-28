"""Carrega os 10 CSVs da camada Gold (CineData) no banco SQLite local.

Uso:
    cd backend
    .venv/bin/python scripts/load_csv.py
    .venv/bin/python scripts/load_csv.py --data-dir data --keep-app-reviews

O script assume que o schema já existe (rode `alembic upgrade head` antes).
Ele lê o caminho do banco a partir de DATABASE_URL (.env) e faz a carga com
sqlite3 puro (executemany em lote), pois os arquivos maiores têm centenas de
milhares de linhas (bridge_movie_person, dim_people) e a carga via ORM
linha a linha seria muito mais lenta.

Ordem de carga: dimensões -> pontes -> fato -> avaliações individuais
(respeita as chaves estrangeiras). Por padrão o script LIMPA as tabelas antes
de recarregar (idempotente); use --keep-app-reviews para preservar as
avaliações que você já tiver cadastrado pela aplicação durante o
desenvolvimento.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402


def db_path_from_url(database_url: str) -> Path:
    """Extrai o caminho do arquivo SQLite a partir da DATABASE_URL."""
    url = database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    path = Path(url)
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def s(value: str | None) -> str | None:
    """Normaliza string vazia -> None (NULL)."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def n(value: str | None) -> float | None:
    """Converte texto -> float; vazio/ausente -> None."""
    value = s(value)
    return None if value is None else float(value)


def i(value: str | None) -> int | None:
    value = s(value)
    return None if value is None else int(float(value))


def carregar(conn: sqlite3.Connection, data_dir: Path, keep_app_reviews: bool) -> None:
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys=OFF")  # desliga durante a carga em massa (religa ao final)

    tabelas_para_limpar = [
        "movie_reviews",
        "dim_reviews",
        "fact_movies_performance",
        "bridge_movie_person",
        "bridge_movie_genre",
        "bridge_movie_company",
        "dim_people",
        "dim_movies",
        "dim_genres",
        "dim_companies",
    ]
    if keep_app_reviews:
        tabelas_para_limpar.remove("movie_reviews")
    for tabela in tabelas_para_limpar:
        cur.execute(f"DELETE FROM {tabela}")

    def carregar_tabela(nome_csv: str, sql: str, montar_linha):
        linhas = read_csv(data_dir / nome_csv)
        params = [montar_linha(row) for row in linhas]
        cur.executemany(sql, params)
        print(f"  {nome_csv:<32} -> {len(params):>7} linhas")

    print("Carregando dimensões...")
    carregar_tabela(
        "dim_companies.csv",
        "INSERT INTO dim_companies (sk_company_id, nome_produtora) VALUES (?, ?)",
        lambda r: (r["sk_company_id"], r["nome_produtora"]),
    )
    carregar_tabela(
        "dim_genres.csv",
        "INSERT INTO dim_genres (sk_genre_id, nome_genero) VALUES (?, ?)",
        lambda r: (r["sk_genre_id"], r["nome_genero"]),
    )
    carregar_tabela(
        "dim_movies.csv",
        """INSERT INTO dim_movies
           (sk_movie_id, id_filme, titulo, data_lancamento, ano_lancamento, duracao_minutos,
            status_filme, sinopse, url_poster, url_backdrop)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        lambda r: (
            r["sk_movie_id"],
            r["id_filme"],
            r["titulo"],
            s(r["data_lancamento"]),
            i(r["ano_lancamento"]),
            i(r["duracao_minutos"]),
            s(r["status_filme"]),
            s(r["sinopse"]),
            s(r["url_poster"]),
            s(r["url_backdrop"]),
        ),
    )
    carregar_tabela(
        "dim_people.csv",
        "INSERT INTO dim_people (sk_person_id, nome_pessoa, tipo_pessoa) VALUES (?, ?, ?)",
        lambda r: (r["sk_person_id"], r["nome_pessoa"], r["tipo_pessoa"]),
    )

    print("Carregando tabelas-ponte...")
    carregar_tabela(
        "bridge_movie_genre.csv",
        "INSERT INTO bridge_movie_genre (sk_movie_id, sk_genre_id) VALUES (?, ?)",
        lambda r: (r["sk_movie_id"], r["sk_genre_id"]),
    )
    carregar_tabela(
        "bridge_movie_company.csv",
        "INSERT INTO bridge_movie_company (sk_movie_id, sk_company_id) VALUES (?, ?)",
        lambda r: (r["sk_movie_id"], r["sk_company_id"]),
    )
    carregar_tabela(
        "bridge_movie_person.csv",
        "INSERT INTO bridge_movie_person (sk_movie_id, sk_person_id) VALUES (?, ?)",
        lambda r: (r["sk_movie_id"], r["sk_person_id"]),
    )

    print("Carregando fato e avaliações...")
    carregar_tabela(
        "fact_movies_performance.csv",
        """INSERT INTO fact_movies_performance
           (sk_movie_id, orcamento_usd, receita_usd, lucro_usd, orcamento_brl, receita_brl,
            lucro_brl, popularidade, nota_tmdb, qtd_tmdb, nota_imdb, qtd_imdb)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        lambda r: (
            r["sk_movie_id"],
            n(r["orcamento_usd"]),
            n(r["receita_usd"]),
            n(r["lucro_usd"]) or 0,
            n(r["orcamento_brl"]),
            n(r["receita_brl"]),
            n(r["lucro_brl"]) or 0,
            n(r["popularidade"]),
            n(r["nota_tmdb"]),
            i(r["qtd_tmdb"]),
            n(r["nota_imdb"]),
            i(r["qtd_imdb"]),
        ),
    )
    carregar_tabela(
        "dim_reviews.csv",
        """INSERT INTO dim_reviews (sk_review_id, sk_movie_id, qtd_avaliacoes_usuarios, nota_media_usuarios)
           VALUES (?, ?, ?, ?)""",
        lambda r: (
            r["sk_review_id"],
            r["sk_movie_id"],
            i(r["qtd_avaliacoes_usuarios"]) or 0,
            n(r["nota_media_usuarios"]),
        ),
    )
    if keep_app_reviews:
        print("  movies_reviews.csv               -> ignorado (--keep-app-reviews)")
    else:
        carregar_tabela(
            "movies_reviews.csv",
            """INSERT INTO movie_reviews (sk_movie_review_id, sk_movie_id, nome, nota, comentario)
               VALUES (?, ?, ?, ?, ?)""",
            lambda r: (r["sk_movie_review_id"], r["sk_movie_id"], r["nome"], n(r["nota"]), r["comentario"]),
        )

    cur.execute("PRAGMA foreign_keys=ON")
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--data-dir", default="data", help="Pasta com os 10 CSVs (padrão: backend/data)")
    parser.add_argument(
        "--keep-app-reviews",
        action="store_true",
        help="Não recarrega movie_reviews/dim_reviews (preserva avaliações cadastradas pela aplicação)",
    )
    args = parser.parse_args()

    settings = get_settings()
    db_path = db_path_from_url(settings.database_url)
    if not db_path.exists():
        raise SystemExit(
            f"Banco não encontrado em {db_path}. Rode 'alembic upgrade head' antes de carregar os dados."
        )
    data_dir = Path(args.data_dir)
    if not data_dir.is_absolute():
        data_dir = BACKEND_DIR / data_dir
    if not data_dir.exists():
        raise SystemExit(f"Pasta de dados não encontrada: {data_dir}")

    print(f"Banco: {db_path}")
    print(f"Dados: {data_dir}\n")
    inicio = time.time()
    conn = sqlite3.connect(db_path)
    try:
        carregar(conn, data_dir, args.keep_app_reviews)
    finally:
        conn.close()
    print(f"\nCarga concluída em {time.time() - inicio:.1f}s")


if __name__ == "__main__":
    main()
