# MatrUSP Scraper

JupiterWeb scraper for MatrUSP course scheduling application.

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)

## Usage

```bash
cd scraper

# Scrape all lectures (takes ~10-15 minutes)
uv run main.py ../public/db

# Scrape specific units only (e.g., IME = 45)
uv run main.py ../public/db --units 45 55

# Scrape course curricula
uv run main.py ../public/db --cursos
```

## Output

- `db.json` - All lectures combined (~7MB, ~500KB gzipped)
- `campi.json` - Campus to units mapping  
- `cursos.json` - Course curricula (with --cursos)

## CI/CD

Runs monthly via GitHub Actions. See `.github/workflows/scrape.yml`.
