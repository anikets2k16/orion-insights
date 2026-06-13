"""Deterministic 4-axis confidence scoring (FR-7). No LLM involved.

score = 0.25*recency + 0.35*authority + 0.30*relevance + 0.10*cross_validation
All inputs are pure functions of the source dict, so the result is fully reproducible.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from infrastructure.determinism import now

AUTHORITY_DOMAINS: dict[str, float] = {
    "arxiv.org": 0.90, "pubmed.ncbi.nlm.nih.gov": 0.95, "nature.com": 0.92,
    "reuters.com": 0.88, "economist.com": 0.87, "ft.com": 0.86, "bbc.com": 0.85,
    "github.com": 0.80, "techcrunch.com": 0.75,
}

WEIGHTS = {"recency": 0.25, "authority": 0.35, "relevance": 0.30, "cross_val": 0.10}


def score_source(source: dict) -> float:
    recency = _recency_score(source.get("published_date"))
    authority = _authority_score(source.get("url", ""))
    relevance = _relevance_score(source.get("content", ""), source.get("query", ""))
    cross_val = float(source.get("cross_validation_score", 0.5))
    return round(
        WEIGHTS["recency"] * recency
        + WEIGHTS["authority"] * authority
        + WEIGHTS["relevance"] * relevance
        + WEIGHTS["cross_val"] * cross_val,
        3,
    )


def rank_sources(sources: list[dict]) -> list[dict]:
    """Score and sort. Tie-break by url asc for stable ordering (control C5)."""
    scored = [{**s, "confidence": score_source(s)} for s in sources]
    return sorted(scored, key=lambda s: (-s["confidence"], s.get("url", "")))


def _recency_score(date_str: str | None) -> float:
    if not date_str:
        return 0.5
    try:
        pub = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        days_old = (now() - pub).days
        if days_old < 30:
            return 1.0
        if days_old < 180:
            return 0.8
        if days_old < 365:
            return 0.6
        return max(0.2, 1.0 - (days_old / 3650))
    except Exception:
        return 0.5


def _authority_score(url: str) -> float:
    domain = urlparse(url).netloc.replace("www.", "")
    for known, score in AUTHORITY_DOMAINS.items():
        if known in domain:
            return score
    return 0.6


def _relevance_score(content: str, query: str) -> float:
    if not query or not content:
        return 0.5
    q = set(re.findall(r"\w+", query.lower()))
    c = set(re.findall(r"\w+", content.lower()))
    if not q:
        return 0.5
    return round(min(1.0, len(q & c) / len(q) * 1.5), 3)
