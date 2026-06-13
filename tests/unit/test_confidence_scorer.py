"""FR-7 — deterministic confidence scoring."""
from infrastructure.confidence_scorer import _authority_score, rank_sources, score_source


def test_arxiv_authority():
    assert _authority_score("https://arxiv.org/abs/2401.12345") == 0.90


def test_score_in_range():
    s = {"url": "https://arxiv.org/abs/1", "content": "AI research", "query": "AI"}
    assert 0.0 <= score_source(s) <= 1.0


def test_ranking_orders_by_confidence_then_url():
    sources = [
        {"url": "https://b.blog/x", "content": "x", "query": "AI"},
        {"url": "https://arxiv.org/abs/1", "content": "AI deep learning", "query": "AI"},
    ]
    ranked = rank_sources(sources)
    assert ranked[0]["url"] == "https://arxiv.org/abs/1"


def test_scoring_is_deterministic():
    s = {"url": "https://nature.com/x", "content": "AI", "query": "AI"}
    assert score_source(s) == score_source(s)
