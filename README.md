# MatrUSP

Course schedule planner for USP students. Pick your classes, see what fits.

## Quick Start

```bash
bun install
cd scraper && uv run main.py ../public/db && cd ..  # fetch course data (~10 min)
bun run dev
```

## Commands

```bash
bun run dev       # dev server
bun run build     # production build
bun run check     # typecheck
bun run test      # tests
```

## Stack

Svelte 5, TypeScript, TailwindCSS v4, Dexie.js, Vite, Bun.

## Scraper

Fetches course data from JupiterWeb. Runs monthly via GitHub Actions.

```bash
cd scraper
uv run main.py ../public/db           # all courses
uv run main.py ../public/db -u 45     # just IME
uv run main.py ../public/db --cursos  # curricula
```
