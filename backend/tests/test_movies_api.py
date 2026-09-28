"""Testes de integração dos endpoints do domínio de filmes.

Cada teste sobe a aplicação ASGI real (via httpx.ASGITransport) contra um
banco SQLite isolado em memória (ver `conftest.py`), exercitando o mesmo
caminho de código que roda em produção: rotas -> serviço -> ORM.
"""


async def _criar_filme(client, **overrides):
    payload = {
        "titulo": "Filme de Teste",
        "ano_lancamento": 2024,
        "duracao_minutos": 100,
        "sinopse": "Sinopse de teste.",
        "diretor": "Diretora Exemplo",
        "generos": ["Drama", "Ficção Científica"],
    }
    payload.update(overrides)
    response = await client.post("/api/v1/movies", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_criar_filme_cria_genero_e_diretor_automaticamente(client):
    filme = await _criar_filme(client)

    assert filme["titulo"] == "Filme de Teste"
    assert {g["nome_genero"] for g in filme["generos"]} == {"Drama", "Ficção Científica"}
    assert [p["nome_pessoa"] for p in filme["diretores"]] == ["Diretora Exemplo"]
    assert filme["avaliacoes"] == {"qtd_avaliacoes": 0, "nota_media_estrelas": None}


async def test_criar_filme_titulo_vazio_falha_validacao(client):
    response = await client.post("/api/v1/movies", json={"titulo": "   "})
    assert response.status_code == 422


async def test_catalogo_paginado_e_busca_por_titulo(client):
    await _criar_filme(client, titulo="Duna: Parte Dois")
    await _criar_filme(client, titulo="Duna")
    await _criar_filme(client, titulo="Outro Filme Qualquer")

    pagina = await client.get("/api/v1/movies", params={"page_size": 2, "page": 1})
    assert pagina.status_code == 200
    corpo = pagina.json()
    assert corpo["meta"]["total"] == 3
    assert corpo["meta"]["total_pages"] == 2
    assert len(corpo["items"]) == 2

    busca = await client.get("/api/v1/movies", params={"search": "duna"})
    titulos = {item["titulo"] for item in busca.json()["items"]}
    assert titulos == {"Duna: Parte Dois", "Duna"}


async def test_atualizar_filme_substitui_generos_e_remove_diretor(client):
    filme = await _criar_filme(client)
    sk = filme["sk_movie_id"]

    resp = await client.put(
        f"/api/v1/movies/{sk}",
        json={"generos": ["Comédia"], "diretor": None},
    )
    assert resp.status_code == 200
    atualizado = resp.json()
    assert [g["nome_genero"] for g in atualizado["generos"]] == ["Comédia"]
    assert atualizado["diretores"] == []
    # título não foi enviado no PUT: deve permanecer inalterado
    assert atualizado["titulo"] == "Filme de Teste"


async def test_atualizar_filme_inexistente_retorna_404(client):
    resp = await client.put("/api/v1/movies/nao-existe", json={"titulo": "X"})
    assert resp.status_code == 404


async def test_adicionar_avaliacao_recalcula_media_em_estrelas(client):
    filme = await _criar_filme(client)
    sk = filme["sk_movie_id"]

    body1 = {"nome": "A", "estrelas": 5, "comentario": "Ótimo"}
    r1 = await client.post(f"/api/v1/movies/{sk}/reviews", json=body1)
    assert r1.status_code == 201
    assert r1.json()["nota"] == 10.0  # 5 estrelas -> escala 0-10

    body2 = {"nome": "B", "estrelas": 1, "comentario": "Ruim"}
    r2 = await client.post(f"/api/v1/movies/{sk}/reviews", json=body2)
    assert r2.status_code == 201

    detalhe = await client.get(f"/api/v1/movies/{sk}")
    avaliacoes = detalhe.json()["avaliacoes"]
    assert avaliacoes["qtd_avaliacoes"] == 2
    assert avaliacoes["nota_media_estrelas"] == 3.0  # média de 5 e 1 estrelas

    lista = await client.get(f"/api/v1/movies/{sk}/reviews")
    assert lista.json()["meta"]["total"] == 2


async def test_avaliacao_com_estrelas_fora_da_faixa_falha_validacao(client):
    filme = await _criar_filme(client)
    resp = await client.post(
        f"/api/v1/movies/{filme['sk_movie_id']}/reviews",
        json={"nome": "A", "estrelas": 7, "comentario": "x"},
    )
    assert resp.status_code == 422


async def test_avaliar_filme_inexistente_retorna_404(client):
    resp = await client.post(
        "/api/v1/movies/nao-existe/reviews",
        json={"nome": "A", "estrelas": 3, "comentario": "x"},
    )
    assert resp.status_code == 404


async def test_remover_filme(client):
    filme = await _criar_filme(client)
    sk = filme["sk_movie_id"]

    resp = await client.delete(f"/api/v1/movies/{sk}")
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/v1/movies/{sk}")
    assert resp2.status_code == 404


async def test_listar_generos(client):
    await _criar_filme(client, generos=["Terror"])
    resp = await client.get("/api/v1/genres")
    assert resp.status_code == 200
    assert "Terror" in {g["nome_genero"] for g in resp.json()}
