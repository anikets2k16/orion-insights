import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

function model() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return createLovableAiGatewayProvider(key)(MODEL);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}

function normalizeType(t: unknown): "academic" | "news" | "blog" | "report" {
  const s = String(t ?? "").toLowerCase();
  if (s.includes("academ") || s.includes("paper") || s.includes("journal")) return "academic";
  if (s.includes("news")) return "news";
  if (s.includes("report") || s.includes("white")) return "report";
  return "blog";
}

function inferType(url: string): "academic" | "news" | "blog" | "report" {
  const u = url.toLowerCase();
  if (/arxiv\.org|nature\.com|sciencedirect|springer|ssrn|acm\.org|ieee\.org|\.edu\b/.test(u))
    return "academic";
  if (/news|reuters|bloomberg|nytimes|wsj|guardian|bbc|cnn|techcrunch|theverge|ft\.com/.test(u))
    return "news";
  if (/mckinsey|bcg|deloitte|gartner|forrester|whitepaper|report|\.gov\b|oecd|worldbank/.test(u))
    return "report";
  return "blog";
}

const PERSONA_GUIDE: Record<string, string> = {
  researcher: "Prioritize methodological rigor, evidence chains, and academic perspectives.",
  product_manager: "Frame in terms of market opportunities, risks, user needs, and strategic bets.",
  content_creator: "Focus on narrative hooks, audience appeal, and shareable angles.",
};

// ---------- Firecrawl real web retrieval ----------

interface FCResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

async function firecrawlSearch(query: string, limit = 8): Promise<FCResult[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { web?: FCResult[] } | FCResult[];
  };
  const data = json.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.web ?? [];
}

const RankSchema = z.object({
  ranked: z.array(
    z.object({
      url: z.string(),
      confidence: z.number(),
      rationale: z.string(),
    }),
  ),
});

export const generateSources = createServerFn({ method: "POST" })
  .inputValidator((d: { topic: string; persona: string; threshold: number }) => d)
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    // Hit Firecrawl twice for breadth (general + a persona angle).
    const angle =
      data.persona === "researcher"
        ? "research paper OR study"
        : data.persona === "product_manager"
          ? "market OR strategy OR analysis"
          : "trend OR explainer";
    const [a, b] = await Promise.all([
      firecrawlSearch(data.topic, 6),
      firecrawlSearch(`${data.topic} ${angle}`, 6),
    ]);
    const seen = new Set<string>();
    const raw = [...a, ...b].filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
    if (raw.length === 0) return [];

    // Ask the Retriever agent to rank + rationalize.
    const { experimental_output } = await generateText({
      model: model(),
      experimental_output: Output.object({ schema: RankSchema }),
      system: `You are the Contextual Retriever agent. ${persona} Rank these real web results by relevance and credibility for the topic. Return one entry per url, confidence in [0,1], and a one-sentence rationale.`,
      prompt:
        `Topic: ${data.topic}\n\nResults:\n` +
        raw
          .map(
            (r, i) =>
              `${i + 1}. ${r.title ?? r.url}\n   ${r.url}\n   ${(r.description ?? "").slice(0, 220)}`,
          )
          .join("\n"),
    });
    const ranks = new Map<string, { confidence: number; rationale: string }>();
    for (const r of experimental_output?.ranked ?? []) {
      ranks.set(String(r.url), {
        confidence: clamp01(Number(r.confidence)),
        rationale: String(r.rationale ?? ""),
      });
    }
    return raw
      .map((r, i) => {
        const rank = ranks.get(r.url) ?? { confidence: 0.6, rationale: "" };
        return {
          url: r.url,
          title: r.title || r.url,
          source_type: inferType(r.url),
          confidence: rank.confidence,
          rationale: rank.rationale,
          snippet: (r.description ?? r.markdown ?? "").slice(0, 400),
          citation: i + 1,
          hop: 1,
        };
      })
      .filter((s) => s.confidence >= data.threshold * 0.7)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
  });

export const generateAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      persona: string;
      sources: { url: string; title: string; snippet?: string; citation?: number; rationale?: string }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const list = data.sources
      .map(
        (s, i) =>
          `[${s.citation ?? i + 1}] ${s.title} (${s.url})${
            s.snippet ? `\n    "${s.snippet.slice(0, 300)}"` : ""
          }`,
      )
      .join("\n");
    const { text } = await generateText({
      model: model(),
      system: `You are the Critical Analysis agent. ${persona} Produce a tight, well-structured analysis (markdown, ~350 words) grounded in the curated sources. Identify themes, tensions, and gaps. Cite sources inline as [n] using the bracket numbers provided. Every non-trivial claim needs at least one citation.`,
      prompt: `Topic: ${data.topic}\n\nCurated sources:\n${list}`,
    });
    return { analysis: text };
  });

// ---------- Contradictions agent ----------

const ContradictionsSchema = z.object({
  contradictions: z.array(
    z.object({
      claim: z.string(),
      sides: z.string(),
      citations: z.array(z.number()),
    }),
  ),
});

export const findContradictions = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      sources: { url: string; title: string; snippet?: string; citation?: number }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const list = data.sources
      .map(
        (s, i) =>
          `[${s.citation ?? i + 1}] ${s.title}\n    ${(s.snippet ?? "").slice(0, 300)}`,
      )
      .join("\n");
    try {
      const { experimental_output } = await generateText({
        model: model(),
        experimental_output: Output.object({ schema: ContradictionsSchema }),
        system: `You are the Contradiction Detector agent. Read the source snippets and surface 0-4 explicit disagreements, tension points, or contradicting claims across them. For each, provide the contested claim, both sides in one sentence, and the citation numbers involved. If sources broadly agree, return an empty list.`,
        prompt: `Topic: ${data.topic}\n\nSources:\n${list}`,
      });
      return (experimental_output?.contradictions ?? []).map((c) => ({
        claim: String(c.claim),
        sides: String(c.sides),
        citations: (c.citations ?? []).map((n) => Number(n)).filter(Number.isFinite),
      }));
    } catch {
      return [];
    }
  });

const InsightsSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        confidence: z.number(),
        implications: z.string(),
        citations: z.array(z.number()),
      }),
    ),
});

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      persona: string;
      analysis: string;
      contradictions?: { claim: string; sides: string; citations: number[] }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const contraText = (data.contradictions ?? [])
      .map((c) => `- ${c.claim} (sides: ${c.sides}) [${c.citations.join(",")}]`)
      .join("\n");
    const { experimental_output } = await generateText({
      model: model(),
      experimental_output: Output.object({ schema: InsightsSchema }),
      system: `You are the Insight Generator agent. ${persona} Distill 3-5 sharp, non-obvious insights grounded in the analysis. Each insight must include the citation numbers (from the analysis's [n] markers) that support it. confidence is in [0,1].`,
      prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}${
        contraText ? `\n\nKnown contradictions:\n${contraText}` : ""
      }`,
    });
    return (experimental_output?.insights ?? []).map((i) => ({
      title: String(i.title),
      summary: String(i.summary),
      implications: String(i.implications),
      confidence: clamp01(Number(i.confidence)),
      citations: (i.citations ?? []).map((n) => Number(n)).filter(Number.isFinite),
    }));
  });

// ---------- Multi-hop: gap detection + follow-up retrieval ----------

const GapsSchema = z.object({
  queries: z.array(z.string()),
});

export const identifyGaps = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      analysis: string;
      insights: { title: string; summary: string; confidence: number }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    try {
      const { experimental_output } = await generateText({
        model: model(),
        experimental_output: Output.object({ schema: GapsSchema }),
        system: `You are the Gap Analyst agent. Identify 0-3 evidence gaps or weakly supported claims in this research, and propose specific follow-up web search queries that would strengthen or refute them. Return [] if confident the research is complete.`,
        prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}\n\nInsights:\n${data.insights
          .map((i) => `- ${i.title} (${i.confidence.toFixed(2)}): ${i.summary}`)
          .join("\n")}`,
      });
      return (experimental_output?.queries ?? []).map(String).filter(Boolean).slice(0, 3);
    } catch {
      return [];
    }
  });

export const deepenResearch = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { queries: string[]; startCitation: number }) => d,
  )
  .handler(async ({ data }) => {
    if (data.queries.length === 0) return [];
    const results = await Promise.all(data.queries.map((q) => firecrawlSearch(q, 3)));
    const seen = new Set<string>();
    const out: {
      url: string;
      title: string;
      source_type: "academic" | "news" | "blog" | "report";
      confidence: number;
      snippet: string;
      citation: number;
      hop: number;
      rationale: string;
    }[] = [];
    let n = data.startCitation;
    results.forEach((arr, qi) => {
      for (const r of arr) {
        if (!r.url || seen.has(r.url)) continue;
        seen.add(r.url);
        out.push({
          url: r.url,
          title: r.title || r.url,
          source_type: inferType(r.url),
          confidence: 0.7,
          snippet: (r.description ?? "").slice(0, 400),
          citation: n++,
          hop: 2,
          rationale: `Follow-up for: ${data.queries[qi]}`,
        });
        if (out.length >= 6) break;
      }
    });
    return out;
  });

const GuardrailSchema = z.object({
  pass: z.boolean(),
  reason: z.string(),
});

export const runGuardrail = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { insights: { title: string; summary: string }[] }) => d,
  )
  .handler(async ({ data }) => {
    try {
      const { experimental_output } = await generateText({
        model: model(),
        experimental_output: Output.object({ schema: GuardrailSchema }),
        system:
          "You are the Guardrail agent. Check the insights for unsupported claims, defamation, PII, or unsafe content. Return pass=true unless there is a real concern.",
        prompt: data.insights.map((i) => `- ${i.title}: ${i.summary}`).join("\n"),
      });
      return {
        pass: Boolean(experimental_output?.pass ?? true),
        reason: String(experimental_output?.reason ?? "ok"),
      };
    } catch {
      return { pass: true, reason: "guardrail skipped" };
    }
  });

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      persona: string;
      analysis: string;
      insights: {
        title: string;
        summary: string;
        implications: string;
        confidence: number;
        citations?: number[];
      }[];
      contradictions?: { claim: string; sides: string; citations: number[] }[];
      sources: { url: string; title: string; citation?: number; hop?: number }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const srcList = data.sources
      .map((s, i) => `[${s.citation ?? i + 1}]${s.hop && s.hop > 1 ? " (follow-up)" : ""} ${s.title} — ${s.url}`)
      .join("\n");
    const insightList = data.insights
      .map(
        (i) =>
          `- ${i.title} (conf ${i.confidence.toFixed(2)}) ${
            i.citations?.length ? `[${i.citations.join(",")}]` : ""
          }\n  ${i.summary}\n  implications: ${i.implications}`,
      )
      .join("\n");
    const contraList = (data.contradictions ?? [])
      .map((c) => `- ${c.claim} — ${c.sides} [${c.citations.join(",")}]`)
      .join("\n");
    const { text } = await generateText({
      model: model(),
      system: `You are the Report Builder agent. ${persona} Produce a polished markdown research report with these sections:
1. Title
2. Executive summary
3. Key insights — each with inline citations [n] that match the source list, plus implications & confidence
4. Contradictions & open questions
5. Analysis (preserve [n] citations from input)
6. Sources — numbered list with links, mark follow-up hops

Preserve all [n] citation markers exactly. Never invent citation numbers.`,
      prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}\n\nInsights:\n${insightList}\n\nContradictions:\n${contraList || "(none surfaced)"}\n\nSources:\n${srcList}`,
    });
    return { markdown: text };
  });

// kept for backwards-compat; not currently used
void normalizeType;