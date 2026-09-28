# Visagio — Sistema de Avaliação de Filmes

Projeto do **Rocket Lab 2026.2 (Visagio) — Atividade DEV**.

Construído sobre a base fornecida (`SQLAlchemy 2.0` assíncrono + `Alembic` já
modelados em Star Schema), sem alterar o schema existente.

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + SQLite
- **Frontend:** Vite + React + TypeScript + React Router + TanStack Query
- **Dados:** os 9 CSVs da camada Gold do projeto CineData (95.645 filmes) +
  `movies_reviews.csv` (43.666 avaliações), fornecidos pelo professor

> `RocketLab`/`Visagio` são apenas nomes de referência; o pacote, o título da
> API e o arquivo do banco podem ser renomeados livremente.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Passo a passo rápido](#passo-a-passo-rápido)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [API — referência rápida](#api--referência-rápida)
- [Decisões de design e de negócio](#decisões-de-design-e-de-negócio)
- [Testes](#testes)
- [Solução de problemas](#solução-de-problemas)

## Pré-requisitos

- Python 3.11+
- Node.js 20+ e npm
- Os 10 arquivos CSV fornecidos pelo professor, copiados para `backend/data/`
  (a pasta já existe, mas os CSVs **não são versionados** — veja a nota
  abaixo)

## Passo a passo rápido

### 1. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/alembic upgrade head          # cria o schema (rocketlab.db)
.venv/bin/python scripts/load_csv.py    # popula as tabelas com os 10 CSVs (~30s)
.venv/bin/uvicorn app.main:app --reload
```

A API sobe em `http://localhost:8000`. Documentação interativa (Swagger) em
`http://localhost:8000/docs`. `GET /health` confirma que subiu.

> **Sobre os CSVs:** `backend/data/*.csv` está no `.gitignore` de propósito —
> `bridge_movie_person.csv` sozinho tem ~97 MB, e o GitHub recusa arquivos
> acima de 100 MB. Copie os 10 CSVs fornecidos pelo professor para
> `backend/data/` antes de rodar `load_csv.py`; eles não fazem parte deste
> repositório.

### 2. Frontend (em outro terminal)

```bash
cd frontend
npm install
cp .env.example .env    # já aponta para http://localhost:8000/api/v1
npm run dev
```

A aplicação sobe em `http://localhost:5173`. O CORS do backend já libera
essa origem por padrão (`backend/app/core/config.py`).

### 3. Usar a aplicação

Abra `http://localhost:5173`, navegue pelo catálogo, clique em um filme para
ver os detalhes e avaliações, ou em **+ Novo filme** para cadastrar.

## Estrutura do projeto

```text
.
├── backend/
│   ├── app/
│   │   ├── api/v1/         
│   │   ├── core/            
│   │   ├── db/               
│   │   └── movies/
│   │       ├── models.py     
│   │       ├── schemas.py    
│   │       ├── service.py    
│   │       └── router.py     
│   ├── scripts/load_csv.py   
│   ├── data/                 
│   ├── migrations/           
│   └── tests/                
└── frontend/
    └── src/
        ├── api/               
        ├── components/        
        ├── pages/             
        └── styles/index.css   
```

## Funcionalidades

Todos os requisitos do escopo foram implementados:

- [x] Cadastrar filme (título, diretor, ano, gênero(s), sinopse, duração, status, pôster/backdrop)
- [x] Catálogo paginado (24 por página)
- [x] Detalhe do filme com elenco, direção, roteiro, produtoras e avaliações
- [x] Busca por título (com *debounce*, refletida na URL)
- [x] Editar e remover filmes individualmente (com confirmação)
- [x] Adicionar avaliação (1 a 5 estrelas, com meia estrela + resenha em texto)
- [x] Média geral das avaliações por filme (recalculada a cada nova avaliação)

Bônus incluídos: filtro por gênero, 5 opções de ordenação, cache de consultas
(TanStack Query — catálogo/detalhe ficam instantâneos ao voltar), estados de
carregamento/vazio/erro, testes automatizados de API (pytest) e verificação
de tipos (TypeScript) + lint (ruff) sem erros.

## API — referência rápida

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/movies` | Catálogo paginado (`page`, `page_size`, `search`, `genero`, `sort`) |
| POST | `/api/v1/movies` | Cadastra um filme |
| GET | `/api/v1/movies/{sk_movie_id}` | Detalhe completo |
| PUT | `/api/v1/movies/{sk_movie_id}` | Atualiza um filme |
| DELETE | `/api/v1/movies/{sk_movie_id}` | Remove um filme |
| GET | `/api/v1/genres` | Lista de gêneros cadastrados |
| GET | `/api/v1/movies/{sk_movie_id}/reviews` | Avaliações paginadas do filme |
| POST | `/api/v1/movies/{sk_movie_id}/reviews` | Adiciona uma avaliação |

Documentação completa e testável em `/docs` (Swagger UI).

## Decisões de design e de negócio

- **Escala de avaliação:** o banco guarda a nota em 0–10 (mesma escala do
  CSV `movies_reviews.csv`, herdada do TMDB/IMDb). A API recebe/devolve
  `estrelas` (1 a 5, com meia estrela) e converte para 0–10 internamente
  (`nota = estrelas * 2`), preservando a compatibilidade com o histórico
  importado.
- **`dim_reviews` como resumo materializado:** a cada nova avaliação, o
  backend recalcula `qtd_avaliacoes_usuarios`/`nota_media_usuarios` a partir
  de `movie_reviews` (fonte da verdade) e grava o resumo em `dim_reviews`.
  Isso mantém o catálogo rápido de ordenar/listar sem agregar milhares de
  avaliações a cada requisição.
- **Cadastro/edição de gênero e diretor:** ao criar ou editar um filme, o
  backend faz *find-or-create* em `dim_genres`/`dim_people` — evita duplicar
  "Drama" com grafias diferentes e reaproveita pessoas já cadastradas.
- **Chaves substitutas (`sk_*`):** mantidas como `SHA-256` (herdadas do
  projeto CineData anterior); novos registros usam a mesma função
  (`generate_surrogate_key`, já existente em `models.py`).
- **Sem autenticação:** fora de escopo explícito da atividade (usuário único
  Administrador); documentado aqui como decisão consciente.
- **Identidade visual "Visagio":** tema escuro inspirado em cinemas de rua —
  preto quente, dourado de marquise como destaque, serifada `Instrument
  Serif` para títulos e `Bricolage Grotesque` para a interface.

## Testes

```bash
cd backend
.venv/bin/python -m pytest -q      # 13 testes (modelos + API de filmes/avaliações)
.venv/bin/ruff check app scripts tests
```

Os testes de API sobem a aplicação real (`httpx.ASGITransport`) contra um
SQLite isolado em memória — não tocam em `rocketlab.db`.

No frontend:

```bash
cd frontend
npx tsc -b        # checagem de tipos
npm run build     # build de produção
```

## Solução de problemas

- **`Failed to fetch` no frontend:** confirme que o backend está rodando em
  `http://localhost:8000/health` e que `frontend/.env` aponta para a URL
  certa.
- **Erro de CORS:** o backend libera `http://localhost:5173` por padrão
  (`backend/app/core/config.py`, `cors_origins`). Ajuste se o frontend rodar
  em outra porta.
- **`alembic upgrade head` falha:** confira se `backend/.env` existe
  (`cp .env.example .env`) e se está na pasta `backend/`.
- **Carga dos CSVs demorada/travada:** o script imprime o progresso tabela a
  tabela; a carga completa leva ~30s. Se precisar recarregar sem perder
  avaliações cadastradas pela aplicação, use
  `python scripts/load_csv.py --keep-app-reviews`.
- **Pôsteres não aparecem:** as URLs de imagem apontam para o CDN do TMDB
  (`image.tmdb.org`); um bloqueio de rede local ou ad-blocker pode impedir o
  carregamento — a interface usa um retângulo de placeholder nesse caso.
