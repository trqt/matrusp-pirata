#!/usr/bin/env python3
"""
MatrUSP JupiterWeb Scraper

Scrapes course data from USP's JupiterWeb system and outputs JSON files.

Usage:
    uv run main.py ../public/db
    uv run main.py ../public/db --units 45 55
    uv run main.py ../public/db --cursos
"""

import asyncio
import json
import re
import time
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from rich.console import Console
from rich.progress import Progress, TaskID

console = Console()


# Campus mapping by unit code
CAMPUS_BY_UNIT: dict[int, str] = {}
for codes, campus in [
    (
        (
            86,
            27,
            39,
            7,
            22,
            3,
            16,
            9,
            2,
            12,
            48,
            8,
            5,
            10,
            67,
            23,
            6,
            66,
            14,
            26,
            93,
            41,
            92,
            42,
            4,
            37,
            43,
            44,
            45,
            83,
            47,
            46,
            87,
            21,
            31,
            85,
            71,
            32,
            38,
            33,
        ),
        "São Paulo",
    ),
    ((98, 94, 60, 89, 81, 59, 96, 91, 17, 58, 95), "Ribeirão Preto"),
    ((88,), "Lorena"),
    ((18, 97, 99, 55, 76, 75, 90), "São Carlos"),
    ((11, 64), "Piracicaba"),
    ((25, 61), "Bauru"),
    ((74,), "Pirassununga"),
    ((30,), "São Sebastião"),
]:
    for code in codes:
        CAMPUS_BY_UNIT[code] = campus

# Global state
unit_codes: dict[str, str] = {}  # unit name -> code
semaphore: asyncio.Semaphore


def to_int(s: str) -> int:
    try:
        return int(s)
    except (ValueError, TypeError):
        return 0


def is_leaf_table(tag) -> bool:
    """Check if a table has no nested tables."""
    return tag.name == "table" and tag.table is None


# ============================================
# Lecture Parsing
# ============================================


def parse_schedule(table) -> list[dict]:
    """Parse schedule table into list of time slots."""
    schedule = []
    current = None

    for tr in table.find_all("tr"):
        tds = ["".join(x.stripped_strings).strip() for x in tr.find_all("td")]
        if not tds or tds[0] == "Horário":
            continue

        if tds[0]:  # New day
            if current:
                schedule.append(current)
            current = [tds[0], tds[1], tds[2], [tds[3]] if len(tds) > 3 else []]
        elif current:
            # Additional time or professor
            if tds[1] == "" and len(tds) > 2:
                if tds[2] > current[2]:
                    current[2] = tds[2]
                if len(tds) > 3 and tds[3]:
                    current[3].append(tds[3])
            elif tds[1] and len(tds) > 2:
                schedule.append(current)
                current = [current[0], tds[1], tds[2], [tds[3]] if len(tds) > 3 else []]

    if current:
        schedule.append(current)

    return [
        {"dia": h[0], "inicio": h[1], "fim": h[2], "professores": h[3]}
        for h in schedule
    ]


def parse_vacancies(table) -> dict:
    """Parse vacancy table."""
    vacancies = {}
    current_type = None
    current_data = None

    for tr in table.find_all("tr"):
        tds = ["".join(x.stripped_strings).strip() for x in tr.find_all("td")]

        if len(tds) == 5 and tds[0] == "":
            continue
        elif len(tds) == 5 and tds[0]:
            if current_type and current_data:
                vacancies[current_type] = current_data
            current_type = tds[0]
            current_data = {
                "vagas": to_int(tds[1]),
                "inscritos": to_int(tds[2]),
                "pendentes": to_int(tds[3]),
                "matriculados": to_int(tds[4]),
                "grupos": {},
            }
        elif len(tds) == 6 and current_data:
            current_data["grupos"][tds[1]] = {
                "vagas": to_int(tds[2]),
                "inscritos": to_int(tds[3]),
                "pendentes": to_int(tds[4]),
                "matriculados": to_int(tds[5]),
            }

    if current_type and current_data:
        vacancies[current_type] = current_data

    return vacancies


def parse_classroom_info(table) -> dict:
    """Parse classroom info table."""
    info = {}
    for tr in table.find_all("tr"):
        try:
            tds = [next(x.stripped_strings) for x in tr.find_all("td")]
            if len(tds) < 2:
                continue

            if re.search(r"Código\s+da\s+Turma\s+Teórica", tds[0], re.U):
                info["codigo_teorica"] = tds[1]
            elif re.search(r"Código\s+da\s+Turma", tds[0], re.U):
                match = re.match(r"^(\w+)", tds[1], re.U)
                if match:
                    info["codigo"] = match.group(1)
            elif re.search(r"Início", tds[0], re.U):
                info["inicio"] = dateparser.parse(tds[1], dayfirst=True).strftime(
                    "%d/%m/%Y"
                )
            elif re.search(r"Fim", tds[0], re.U):
                info["fim"] = dateparser.parse(tds[1], dayfirst=True).strftime(
                    "%d/%m/%Y"
                )
            elif re.search(r"Tipo\s+da\s+Turma", tds[0], re.U):
                info["tipo"] = tds[1]
            elif re.search(r"Observações", tds[0], re.U):
                info["observacoes"] = tds[1]
        except (StopIteration, IndexError):
            continue

    return info


def parse_classrooms(tables) -> list[dict]:
    """Parse all classrooms from leaf tables."""
    classrooms = []
    info = schedule = vacancies = None

    for table in tables:
        if table.find_all(string=re.compile(r"Código\s+da\s+Turma", re.U)):
            if info and info.get("codigo"):
                if schedule and vacancies:
                    info["horario"] = schedule
                    info["vagas"] = vacancies
                    classrooms.append(info)
            info = parse_classroom_info(table)
            schedule = vacancies = None
        elif table.find_all(string="Horário"):
            schedule = parse_schedule(table)
        elif table.find_all(string=re.compile(r"Atividades\s+Didáticas", re.U)):
            continue
        elif table.find_all(string="Vagas"):
            vacancies = parse_vacancies(table)

    if info and info.get("codigo") and schedule and vacancies:
        info["horario"] = schedule
        info["vagas"] = vacancies
        classrooms.append(info)

    return classrooms


def parse_credits(table) -> dict:
    """Parse credits table."""
    credits = {"creditos_aula": 0, "creditos_trabalho": 0}
    for tr in table.find_all("tr"):
        try:
            tds = [next(x.stripped_strings) for x in tr.find_all("td")]
            if len(tds) < 2:
                continue
            if re.search(r"Créditos\s+Aula:", tds[0], re.U):
                credits["creditos_aula"] = to_int(tds[1])
            elif re.search(r"Créditos\s+Trabalho:", tds[0], re.U):
                credits["creditos_trabalho"] = to_int(tds[1])
        except StopIteration:
            continue
    return credits


def parse_lecture_info(tables) -> dict:
    """Parse lecture info from leaf tables."""
    info = {}
    re_nome = re.compile(r"Disciplina:\s+.{7}\s+-.+")
    re_credits = re.compile(r"Créditos\s+Aula")

    for table in tables:
        if table.find(string=re_nome):
            strings = list(table.stripped_strings)
            info["unidade"] = strings[0]
            info["departamento"] = strings[1]
            unit_code = unit_codes.get(info["unidade"])
            info["campus"] = (
                CAMPUS_BY_UNIT.get(int(unit_code), "Outro") if unit_code else "Outro"
            )

            match = re.search(r"Disciplina:\s+([A-Z0-9\s]{7})\s-\s(.+)", strings[2])
            if match:
                info["codigo"] = match.group(1)
                info["nome"] = match.group(2)
        elif table.find(string=re_credits):
            info.update(parse_credits(table))

    return info


# ============================================
# Course Parsing
# ============================================


def parse_course_periods(table) -> dict:
    """Parse course curriculum periods."""
    periods: dict[str, list] = {}
    tipo_map = {
        "Disciplinas Obrigatórias": "obrigatoria",
        "Disciplinas Optativas Eletivas": "optativa_eletiva",
        "Disciplinas Optativas Livres": "optativa_livre",
    }

    current_tipo = ""
    current_period = ""

    for tr in table.find_all("tr"):
        text = re.sub(r"\s+", " ", next(tr.stripped_strings, ""))

        if text in tipo_map:
            current_tipo = tipo_map[text]
        elif match := re.search(r"(\d+)º Período Ideal", text):
            current_period = match.group(1)
            if current_period not in periods:
                periods[current_period] = []
        else:
            try:
                tds = [next(td.stripped_strings, "") for td in tr.find_all("td")]
            except AttributeError:
                continue

            if len(tds) > 0 and len(tds[0]) == 7:
                periods[current_period].append(
                    {
                        "codigo": tds[0],
                        "tipo": current_tipo,
                        "req_fraco": [],
                        "req_forte": [],
                        "ind_conjunto": [],
                    }
                )
            elif len(tds) >= 2 and periods.get(current_period):
                last = periods[current_period][-1] if periods[current_period] else None
                if last:
                    code = tds[0][:7]
                    if tds[1] == "Requisito fraco":
                        last["req_fraco"].append(code)
                    elif tds[1] == "Requisito":
                        last["req_forte"].append(code)
                    elif tds[1] == "Indicação de Conjunto":
                        last["ind_conjunto"].append(code)

    return periods


# ============================================
# Scraping Functions
# ============================================


async def fetch_units(client: httpx.AsyncClient) -> dict[str, str]:
    """Fetch all teaching units."""
    resp = await client.get(
        "https://uspdigital.usp.br/jupiterweb/jupColegiadoLista?tipo=T", timeout=60
    )
    soup = BeautifulSoup(resp.text, "html5lib")
    links = soup.find_all("a", href=re.compile("jupColegiadoMenu"))

    units = {}
    for link in links:
        match = re.search(r"codcg=(\d+)", link.get("href", ""))
        if match and link.string:
            units[link.string] = match.group(1)

    return units


async def fetch_unit_lectures(
    client: httpx.AsyncClient, unit_code: str
) -> list[tuple[str, str]]:
    """Fetch all lectures from a unit."""
    url = f"https://uspdigital.usp.br/jupiterweb/jupDisciplinaLista?letra=A-Z&tipo=T&codcg={unit_code}"
    resp = await client.get(url, timeout=120)
    soup = BeautifulSoup(resp.text, "html5lib")

    lectures = []
    for link in soup.find_all("a", href=re.compile("obterTurma")):
        match = re.search(r"sgldis=([A-Z0-9\s]{7})", link.get("href", ""))
        if match:
            lectures.append((match.group(1), link.string or ""))

    return lectures


async def fetch_lecture(
    client: httpx.AsyncClient,
    codigo: str,
    nome: str,
    timeout: int,
    progress: Progress,
    task: TaskID,
) -> dict | None:
    """Fetch and parse a single lecture."""
    async with semaphore:
        try:
            # Fetch classrooms
            url = f"https://uspdigital.usp.br/jupiterweb/obterTurma?print=true&sgldis={codigo}"
            resp = await client.get(url, timeout=timeout)
            soup = BeautifulSoup(resp.text, "html5lib")
            classrooms = parse_classrooms(soup.find_all(is_leaf_table))

            if not classrooms:
                progress.advance(task)
                return None

            # Fetch lecture info
            url = f"https://uspdigital.usp.br/jupiterweb/obterDisciplina?print=true&sgldis={codigo}"
            resp = await client.get(url, timeout=timeout)
            soup = BeautifulSoup(resp.text, "html5lib")
            info = parse_lecture_info(soup.find_all(is_leaf_table))

            if not info.get("codigo"):
                progress.advance(task)
                return None

            info["turmas"] = classrooms
            progress.advance(task)
            return info

        except Exception as e:
            console.print(f"[red]Error fetching {codigo}: {e}[/red]")
            progress.advance(task)
            return None


async def fetch_unit_courses(
    client: httpx.AsyncClient, unit_code: str
) -> list[tuple[str, str]]:
    """Fetch all courses from a unit."""
    url = f"https://uspdigital.usp.br/jupiterweb/jupCursoLista?tipo=N&codcg={unit_code}"
    resp = await client.get(url, timeout=120)
    soup = BeautifulSoup(resp.text, "html5lib")

    courses = []
    for link in soup.find_all("a", href=re.compile("listarGradeCurricular")):
        href = link.get("href", "")
        parent_tr = link.find_parent("tr")
        period = ""
        if parent_tr:
            tds = parent_tr.find_all("td")
            if tds:
                period = next(tds[-1].stripped_strings, "")
        courses.append((href, period))

    return courses


async def fetch_course(
    client: httpx.AsyncClient,
    link: str,
    period: str,
    timeout: int,
) -> dict | None:
    """Fetch and parse a single course."""
    async with semaphore:
        try:
            url = f"https://uspdigital.usp.br/jupiterweb/{link}"
            resp = await client.get(url, timeout=timeout)
            soup = BeautifulSoup(resp.text, "html5lib")

            course = {"periodo": period}

            # Extract course code
            match = re.search(r"codcur=(.+?)&codhab=(.+?)(&|$)", link)
            if match:
                course["codigo"] = f"{match.group(1)}-{match.group(2)}"

            # Extract course name
            names = re.findall(r"Curso:\s*(.+?)\s*(?:\n|$)", soup.get_text())
            course["nome"] = " - ".join(names)

            # Extract unit
            unit_match = re.search(r"codcg=(\d+)", link)
            if unit_match:
                unit_code = unit_match.group(1)
                for name, code in unit_codes.items():
                    if code == unit_code:
                        course["unidade"] = name
                        break

            # Parse periods
            for table in soup.find_all(is_leaf_table):
                if table.find(string=re.compile(r"Disciplinas\s+Obrigatórias")):
                    course["periodos"] = parse_course_periods(table)
                    break

            return course

        except Exception as e:
            console.print(f"[red]Error fetching course: {e}[/red]")
            return None


# ============================================
# Main Functions
# ============================================


async def scrape_lectures(
    output_dir: Path, units: list[str] | None, concurrency: int, timeout: int
):
    """Scrape all lectures and output db.json."""
    global unit_codes, semaphore
    semaphore = asyncio.Semaphore(concurrency)

    output_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(
        headers={"User-Agent": "MatrUSPbot/2.0 (+https://github.com/matrusp/matrusp)"},
        verify=False,
        follow_redirects=True,
    ) as client:
        # Fetch units
        console.print("[bold]Fetching teaching units...[/bold]")
        unit_codes = await fetch_units(client)
        console.print(f"Found {len(unit_codes)} units")

        # Save campi.json
        campi: dict[str, list[str]] = {}
        for unit_name, code in unit_codes.items():
            campus = CAMPUS_BY_UNIT.get(int(code), "Outro")
            if campus not in campi:
                campi[campus] = []
            campi[campus].append(unit_name)

        (output_dir / "campi.json").write_text(json.dumps(campi, ensure_ascii=False))

        # Filter units if specified
        target_units = units or list(unit_codes.values())
        if units:
            console.print(f"Filtering to {len(units)} units: {units}")

        # Fetch lecture list from all units
        console.print("[bold]Fetching lecture list from units...[/bold]")
        all_lectures: list[tuple[str, str]] = []

        with Progress() as progress:
            task = progress.add_task("Units", total=len(target_units))
            tasks = [fetch_unit_lectures(client, code) for code in target_units]
            results = await asyncio.gather(*tasks)
            for lectures in results:
                all_lectures.extend(lectures)
                progress.advance(task)

        console.print(f"Found {len(all_lectures)} lectures")

        # Fetch each lecture
        console.print("[bold]Fetching lecture data...[/bold]")
        with Progress() as progress:
            task = progress.add_task("Lectures", total=len(all_lectures))
            tasks = [
                fetch_lecture(client, codigo, nome, timeout, progress, task)
                for codigo, nome in all_lectures
            ]
            results = await asyncio.gather(*tasks)

        valid = [r for r in results if r]

        # Save combined db.json
        (output_dir / "db.json").write_text(json.dumps(valid, ensure_ascii=False))
        console.print(f"[green]Saved {len(valid)} lectures to db.json[/green]")


async def scrape_courses(
    output_dir: Path, units: list[str] | None, concurrency: int, timeout: int
):
    """Scrape all courses."""
    global unit_codes, semaphore
    semaphore = asyncio.Semaphore(concurrency)

    output_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(
        headers={"User-Agent": "MatrUSPbot/2.0 (+https://github.com/matrusp/matrusp)"},
        verify=False,
        follow_redirects=True,
    ) as client:
        # Fetch units
        console.print("[bold]Fetching teaching units...[/bold]")
        unit_codes = await fetch_units(client)
        console.print(f"Found {len(unit_codes)} units")

        # Filter units
        target_units = units or list(unit_codes.values())

        # Fetch course list
        console.print("[bold]Fetching course list...[/bold]")
        all_courses: list[tuple[str, str]] = []

        with Progress() as progress:
            task = progress.add_task("Units", total=len(target_units))
            tasks = [fetch_unit_courses(client, code) for code in target_units]
            results = await asyncio.gather(*tasks)
            for courses in results:
                all_courses.extend(courses)
                progress.advance(task)

        console.print(f"Found {len(all_courses)} courses")

        # Fetch each course
        console.print("[bold]Fetching course data...[/bold]")
        tasks = [
            fetch_course(client, link, period, timeout) for link, period in all_courses
        ]
        results = await asyncio.gather(*tasks)

        valid = [r for r in results if r]
        (output_dir / "cursos.json").write_text(json.dumps(valid, ensure_ascii=False))
        console.print(f"[green]Saved {len(valid)} courses to cursos.json[/green]")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="MatrUSP JupiterWeb Scraper")
    parser.add_argument("output_dir", type=Path, help="Output directory for JSON files")
    parser.add_argument(
        "--units", "-u", nargs="+", help="Specific unit codes to scrape"
    )
    parser.add_argument(
        "--concurrency", "-c", type=int, default=50, help="Max concurrent requests"
    )
    parser.add_argument(
        "--timeout", "-t", type=int, default=60, help="Request timeout in seconds"
    )
    parser.add_argument(
        "--cursos", action="store_true", help="Scrape courses instead of lectures"
    )

    args = parser.parse_args()

    start = time.perf_counter()

    if args.cursos:
        asyncio.run(
            scrape_courses(args.output_dir, args.units, args.concurrency, args.timeout)
        )
    else:
        asyncio.run(
            scrape_lectures(args.output_dir, args.units, args.concurrency, args.timeout)
        )

    elapsed = time.perf_counter() - start
    console.print(f"[bold]Done in {elapsed:.1f}s[/bold]")


if __name__ == "__main__":
    main()
