# TechFeed — agregador tech

Agrega **Hacker News** (top stories), **r/technews** e **r/singularity** (hot), **The Verge** e **TechCrunch** (RSS).

- **Destaques**: rankeamento que mistura popularidade (HN/Reddit, normalizada em log) com frescor; artigos RSS ganham peso por **similaridade de palavras** com os títulos em alta no HN/Reddit e por recência.
- **Cronológico**: uma única linha do tempo por data de publicação.

## Rodar localmente

Requer [Node.js](https://nodejs.org/) 20+ (com `npm`).

```bash
cd tech-news-aggregator
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Deploy na Vercel (recomendado)

O site usa `fetch` no servidor (Next.js) para contornar CORS e bloqueios de alguns feeds — **Vercel** é o caminho mais simples.

1. Envie o código para um repositório novo no GitHub (veja abaixo).
2. Em [vercel.com](https://vercel.com), **Add New Project** → importe o repo.
3. Framework: Next.js (detectado). Deploy.

Cache: `revalidate = 300` (5 minutos) na página principal.

## Repositório no GitHub

```bash
cd tech-news-aggregator
git init
git add .
git commit -m "Initial commit: TechFeed aggregator"
gh repo create tech-news-aggregator --private --source=. --remote=origin --push
```

Se não usar GitHub CLI (`gh`), crie o repositório vazio no site do GitHub e:

```bash
git remote add origin https://github.com/SEU_USUARIO/tech-news-aggregator.git
git branch -M main
git push -u origin main
```

## GitHub Pages

Next.js aqui depende de **servidor Node** para buscar APIs/RSS a cada request (ou ISR). GitHub Pages só hospeda estático; para Pages seria preciso **export estático** + outro lugar gerando JSON (Actions com cron) — mais trabalhoso. Por isso a recomendação é **Vercel**.

## Licença

MIT
