import { expect, test } from "@playwright/test";

// FR-24 smoke: sign in → start research → see the live pipeline. API is mocked so the
// test is deterministic and backend-free.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({ json: { access_token: "tok", token_type: "bearer", user_id: "u1" } })
  );
  await page.route("**/api/auth/signup", (r) =>
    r.fulfill({ json: { access_token: "tok", token_type: "bearer", user_id: "u1" } })
  );
  await page.route("**/api/agents/models", (r) =>
    r.fulfill({ json: { models: [{ name: "gpt-4o-2024-08-06", tier: "premium", recommended_for: ["report"] }] } })
  );
  await page.route("**/api/research/start", (r) =>
    r.fulfill({ json: { session_id: "sess-1", status: "queued", progress: 0 } })
  );
  await page.route("**/api/research/sess-1/status", (r) =>
    r.fulfill({
      json: { session_id: "sess-1", status: "report", progress: 1.0, current_phase: "report",
              report_url: "reports/phases/sess-1/output.html" },
    })
  );
  await page.route("**/api/research/sess-1/sources", (r) =>
    r.fulfill({
      json: { sources: [{ url: "https://arxiv.org/abs/1", title: "AI in care", source_type: "academic", confidence: 0.9 }] },
    })
  );
});

test("sign in, start research, see pipeline", async ({ page }) => {
  await page.goto("/");

  // Login screen (labels aren't htmlFor-associated, so target by input type)
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await page.locator('input[type="email"]').fill("demo@orion.ai");
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // New Research view
  await expect(page.getByRole("heading", { name: /new research/i })).toBeVisible();
  await page.getByPlaceholder(/AI trends in healthcare/i).fill("AI trends in healthcare 2026");
  await page.getByRole("button", { name: /start research/i }).click();

  // Session view: pipeline stages + source curation appear
  await expect(page.getByText("Research Session")).toBeVisible();
  await expect(page.getByText("guardrail")).toBeVisible();
  await expect(page.getByText(/source curation/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open report/i })).toBeVisible();
});
