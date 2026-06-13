"""HTML/PDF report generator (FR-11, FR-21, FR-22, ADR-007).

One Jinja2 template renders HTML; WeasyPrint (optional) converts the same HTML to PDF.
Report hashing uses the deterministic helpers so signatures are stable (NFR-1).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from infrastructure.determinism import now_iso, stable_hash

TEMPLATES_DIR = Path(__file__).parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _render(template: str, **ctx: Any) -> str:
    try:
        tpl = _env.get_template(template)
    except Exception:
        tpl = _env.get_template("phase_generic.html")
    return tpl.render(**ctx)


def _write(html: str, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    return output_path


def to_pdf(html_path: Path) -> Path | None:
    """Best-effort PDF via WeasyPrint (FR-23). Returns None if unavailable."""
    try:
        from weasyprint import HTML

        pdf_path = html_path.with_suffix(".pdf")
        HTML(string=html_path.read_text("utf-8")).write_pdf(str(pdf_path))
        return pdf_path
    except Exception:
        return None


def generate_research_report(session: dict, output_path: Path, template: str = "research_output.html") -> Path:
    html = _render(
        template,
        session=session,
        generated_at=now_iso(),
        content_hash=stable_hash(session)[:16],
    )
    return _write(html, output_path)


def generate_phase_report(phase: str, data: dict, output_path: Path) -> Path:
    html = _render(
        f"phase_{phase.lower()}.html",
        phase=phase,
        data=data,
        generated_at=now_iso(),
        content_hash=stable_hash(data)[:16],
    )
    return _write(html, output_path)


def generate_validation_report(session: dict, audit_log: list[dict], output_path: Path) -> Path:
    """Executive validation report with SHA-256 signature (FR-22)."""
    signature = stable_hash({"session": session, "audit_log": audit_log})
    html = _render(
        "validation.html",
        session=session,
        audit_log=audit_log,
        generated_at=now_iso(),
        sha256=signature,
    )
    return _write(html, output_path)
