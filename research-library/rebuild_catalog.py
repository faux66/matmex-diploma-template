"""Validate catalog.json and refresh its Markdown and embedded HTML copies."""

from collections import Counter
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent


def main():
    data = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    meta, sources = data["meta"], data["sources"]
    for field in ("id", "key", "title_key"):
        values = [s[field] for s in sources]
        if len(values) != len(set(values)):
            raise ValueError(f"Duplicate {field}")
    ids = {s["id"] for s in sources}
    requirements = {f"F{i:02}" for i in range(1, 9)} | {f"Q{i:02}" for i in range(1, 7)}
    for source in sources:
        if source["group"] not in meta["groups"]:
            raise ValueError(f"Unknown group: {source['id']}")
        if not source["url"].startswith(("https://", "http://")):
            raise ValueError(f"Invalid source URL: {source['id']}")
        if not set(source["requirements"]) <= requirements:
            raise ValueError(f"Unknown requirement: {source['id']}")
    for route in meta["routes"]:
        if not set(route["ids"]) <= ids or len(route["ids"]) != len(set(route["ids"])):
            raise ValueError(f"Invalid route: {route['id']}")
    counts = dict(Counter(s["kind"] for s in sources))
    if meta["source_count"] != len(sources) or meta["type_counts"] != counts:
        raise ValueError("Update source_count and type_counts in catalog.json")

    lines = [
        "# Каталог источников PySATL-expert", "",
        f"Уникальных записей: **{len(sources)}**. Глубина проверки указана в карточках.", "",
        meta["provenance"], "",
        "[Открыть каталог для чтения](index.html) · [Цель и задачи](../docs/OBJECTIVE.md) · "
        "[Данные](catalog.json) · [Разбор ключевых работ](../docs/MATERIALS.md)", "",
    ]
    for group, title in meta["groups"].items():
        lines += [f"## {title}", ""]
        for s in sources:
            if s["group"] != group:
                continue
            lines += [
                f"### {s['id']}. {s['title']}", "",
                f"{s['authors'] or 'Авторы — в первоисточнике'} · "
                f"{s['year'] or 'год не указан'} · {s['kind']} · приоритет {s['priority']}.",
                f"[Первоисточник]({s['url']})", "",
                f"**Содержание:** {s['summary']}", "",
                f"**Для диплома:** {s['why']}", "",
                f"**Вопрос при чтении:** {s['question']}", "",
                f"**Проверка источника:** {s['verification']}.", "",
                f"**Ограничение:** {s['caution']}", "",
                f"**Требования:** {', '.join(s['requirements'])}.", "",
            ]
            for link in s["links"]:
                lines += [f"[{link['label']}]({link['url']})", ""]
    markdown = "\n".join(lines)
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    pattern = r'(<script type="application/json" id="catalog-data">).*?(</script>)'
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    html, replacements = re.subn(pattern, lambda m: m[1] + payload + "\n" + m[2], html, flags=re.S)
    if replacements != 1:
        raise ValueError("Expected exactly one embedded catalog")
    reader_path = ROOT / "reader.js"
    if reader_path.exists():
        script = reader_path.read_text(encoding="utf-8")
        if "</script" in script.lower():
            raise ValueError("Unsafe closing tag in reader.js")
        html, replacements = re.subn(r"<script>.*?</script>", lambda _: "<script>\n" + script + "\n</script>", html, flags=re.S)
        if replacements != 1:
            raise ValueError("Expected exactly one reader script")
    (ROOT / "catalog.md").write_text(markdown, encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")
    print(f"Validated {len(sources)} sources; refreshed catalog.md and index.html")


if __name__ == "__main__":
    main()
