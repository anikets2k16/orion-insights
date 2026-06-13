"""Contextual Retriever (FR-6) — multi-source parallel retrieval + scoring.

Retrieval (Tavily/Arxiv) is the one non-deterministic input (specs/determinism.md);
results are captured into state so re-runs of an existing session stay deterministic.
"""
from __future__ import annotations

import asyncio
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from agents.base_agent import BaseAgent
from infrastructure.confidence_scorer import rank_sources


class ContextualRetrieverAgent(BaseAgent):
    role = "retrieval"

    def _default_model(self) -> str:
        return self.settings.retriever_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        topic = state["topic"]
        max_sources = int(state.get("max_sources", self.settings.max_sources))
        # Determinism (specs/determinism.md, retrieval isolation): if this session already
        # captured sources, replay them instead of re-fetching. Live search is the one
        # non-deterministic input and is captured exactly once per session.
        if state.get("raw_sources"):
            sources = state["raw_sources"]
        else:
            sources = await self._multi_source_retrieve(topic)
        for s in sources:
            s.setdefault("query", topic)
        ranked = rank_sources(sources)[:max_sources]
        return {**state, "raw_sources": sources, "scored_sources": ranked, "status": "retrieve"}

    async def _multi_source_retrieve(self, topic: str) -> list[dict]:
        results = await asyncio.gather(
            self._tavily(topic), self._arxiv(topic), return_exceptions=True
        )
        out: list[dict] = []
        for batch in results:
            if isinstance(batch, list):
                out.extend(batch)
        return out

    async def _tavily(self, topic: str) -> list[dict]:
        if not self.settings.tavily_api_key:
            return []
        from tavily import TavilyClient

        client = TavilyClient(api_key=self.settings.tavily_api_key)
        res = await asyncio.to_thread(
            client.search, topic, max_results=10, include_raw_content=True
        )
        return [
            {
                "url": r["url"],
                "title": r.get("title", ""),
                "content": (r.get("raw_content") or r.get("content") or "")[:8000],
                "source_type": "web",
                "published_date": r.get("published_date"),
            }
            for r in res.get("results", [])
        ]

    async def _arxiv(self, topic: str) -> list[dict]:
        url = (
            "https://export.arxiv.org/api/query?search_query=all:"
            f"{topic.replace(' ', '+')}&max_results=5"
        )
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(url, timeout=aiohttp.ClientTimeout(total=12)) as r:
                    xml = await r.text()
        except Exception:
            return []
        soup = BeautifulSoup(xml, "xml")
        papers = []
        for entry in soup.find_all("entry")[:5]:
            papers.append(
                {
                    "url": entry.id.text.strip() if entry.id else "",
                    "title": entry.title.text.strip() if entry.title else "",
                    "content": (entry.summary.text.strip() if entry.summary else "")[:8000],
                    "source_type": "academic",
                    "published_date": entry.published.text.strip() if entry.published else None,
                }
            )
        return papers
