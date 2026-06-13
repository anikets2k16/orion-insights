"""Integration Agent (FR-12) — pushes insights to GitHub / Jira / Confluence (write).

Delegates to the provider clients in `integrations/`. Only acts on explicitly requested
targets; never reads existing items (NFR-5, usage-docs "write-only by default").
"""
from __future__ import annotations

from typing import Any


class IntegrationAgent:
    role = "integration"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        targets = state.get("integration_targets", [])  # e.g. ["github:org/repo", "jira:PROD"]
        insights = state.get("insights", [])
        pushed: list[dict] = []
        for target in targets:
            provider, _, dest = target.partition(":")
            try:
                pushed.extend(self._push(provider, dest, insights))
            except Exception as exc:  # pragma: no cover - network dependent
                pushed.append({"provider": provider, "error": str(exc)})
        return {**state, "integration_results": pushed}

    def _push(self, provider: str, dest: str, insights: list[dict]) -> list[dict]:
        if provider == "github":
            from integrations.github import GitHubIntegration

            gh = GitHubIntegration()
            return [{"provider": "github", **gh.create_issue_from_insight(dest, i)} for i in insights]
        if provider == "jira":
            from integrations.jira import JiraIntegration

            jira = JiraIntegration()
            return [{"provider": "jira", **jira.create_story_from_insight(dest, i)} for i in insights]
        if provider == "confluence":
            from integrations.confluence import ConfluenceIntegration

            conf = ConfluenceIntegration()
            return [{"provider": "confluence", **conf.publish_report(dest, insights)}]
        return [{"provider": provider, "error": "unknown provider"}]
