"""Jira integration (FR-12) — create stories from insights; priority by confidence."""
from __future__ import annotations

from config import get_settings


class JiraIntegration:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not (self.settings.jira_url and self.settings.jira_token):
                raise ValueError("JIRA_URL / JIRA_TOKEN not configured")
            from jira import JIRA

            if self.settings.jira_email:
                self._client = JIRA(
                    server=self.settings.jira_url,
                    basic_auth=(self.settings.jira_email, self.settings.jira_token),
                )
            else:
                self._client = JIRA(server=self.settings.jira_url, token_auth=self.settings.jira_token)
        return self._client

    def create_story_from_insight(self, project_key: str, insight: dict) -> dict:
        conf = insight.get("confidence", 0.5)
        priority = "High" if conf > 0.8 else "Medium" if conf > 0.6 else "Low"
        issue = self.client.create_issue(
            project={"key": project_key},
            summary=f"[Research] {insight['title']}",
            description=self._desc(insight),
            issuetype={"name": "Story"},
            priority={"name": priority},
        )
        return {"key": issue.key, "url": f"{self.settings.jira_url}/browse/{issue.key}"}

    @staticmethod
    def _desc(insight: dict) -> str:
        ac = "\n".join(f"* {a}" for a in insight.get("acceptance_criteria", []))
        sources = "\n".join(f"* [{s.get('title','src')}|{s.get('url','')}]" for s in insight.get("sources", []))
        return (
            f"h2. Research Insight\n\n*Confidence:* {insight.get('confidence','N/A')}\n\n"
            f"h3. Summary\n{insight.get('summary','')}\n\n"
            f"h3. Acceptance Criteria\n{ac}\n\nh3. Sources\n{sources}\n"
        )
