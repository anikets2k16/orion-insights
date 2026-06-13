import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
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

/**
 * Robust JSON extraction. Gemini through openai-compatible doesn't support
 * structured outputs reliably, so we ask for JSON and parse defensively.
 */
function parseJson<T = unknown>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = s.search(/[\[{]/);
  if (first === -1) return fallback;
  const opener = s[first];
  const closer = opener === "[" ? "]" : "}";
  const last = s.lastIndexOf(closer);
  if (last === -1 || last < first) return fallback;
  s = s.slice(first, last + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    try {
      const cleaned = s
        .replace(/,\s*}/g, "}")
        .replace(/,\s*\]/g, "]")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, " ");
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
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

    // Ask the Retriever agent to rank + rationalize (JSON via prompt; parsed defensively).
    const { text } = await generateText({
      model: model(),
      system: `You are the Contextual Retriever agent. ${persona} Rank these real web results by relevance and credibility. Reply with ONLY a JSON object, no prose, of shape:\n{"ranked":[{"url":"...","confidence":0.0,"rationale":"..."}]}\nOne entry per url. confidence is a number in [0,1].`,
      prompt:
        `Topic: ${data.topic}\n\nResults:\n` +
        raw
          .map(
            (r, i) =>
              `${i + 1}. ${r.title ?? r.url}\n   ${r.url}\n   ${(r.description ?? "").slice(0, 220)}`,
          )
          .join("\n"),
    });
    const parsed = parseJson<{ ranked?: { url: string; confidence: number; rationale: string }[] }>(
      text,
      { ranked: [] },
    );
    const ranks = new Map<string, { confidence: number; rationale: string }>();
    for (const r of parsed.ranked ?? []) {
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
      const { text } = await generateText({
        model: model(),
        system: `You are the Contradiction Detector agent. Read the source snippets and surface 0-4 explicit disagreements across them. Reply with ONLY a JSON object, no prose, of shape:\n{"contradictions":[{"claim":"...","sides":"...","citations":[1,2]}]}\nReturn {"contradictions":[]} if sources broadly agree.`,
        prompt: `Topic: ${data.topic}\n\nSources:\n${list}`,
      });
      const parsed = parseJson<{
        contradictions?: { claim: string; sides: string; citations: number[] }[];
      }>(text, { contradictions: [] });
      return (parsed.contradictions ?? []).map((c) => ({
        claim: String(c.claim),
        sides: String(c.sides),
        citations: (c.citations ?? []).map((n) => Number(n)).filter(Number.isFinite),
      }));
    } catch {
      return [];
    }
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
    const { text } = await generateText({
      model: model(),
      system: `You are the Insight Generator agent. ${persona} Distill 3-5 sharp, non-obvious insights grounded in the analysis. Reply with ONLY a JSON object, no prose, of shape:\n{"insights":[{"title":"...","summary":"...","implications":"...","confidence":0.0,"citations":[1,2]}]}\nconfidence is in [0,1]. citations are the [n] numbers from the analysis.`,
      prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}${
        contraText ? `\n\nKnown contradictions:\n${contraText}` : ""
      }`,
    });
    const parsed = parseJson<{
      insights?: {
        title: string;
        summary: string;
        implications: string;
        confidence: number;
        citations: number[];
      }[];
    }>(text, { insights: [] });
    return (parsed.insights ?? []).map((i) => ({
      title: String(i.title),
      summary: String(i.summary),
      implications: String(i.implications),
      confidence: clamp01(Number(i.confidence)),
      citations: (i.citations ?? []).map((n) => Number(n)).filter(Number.isFinite),
    }));
  });

// ---------- Multi-hop: gap detection + follow-up retrieval ----------

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
      const { text } = await generateText({
        model: model(),
        system: `You are the Gap Analyst agent. Identify 0-3 evidence gaps or weakly supported claims, and propose specific follow-up web search queries. Reply with ONLY a JSON object, no prose:\n{"queries":["...","..."]}\nReturn {"queries":[]} if the research is solid.`,
        prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}\n\nInsights:\n${data.insights
          .map((i) => `- ${i.title} (${i.confidence.toFixed(2)}): ${i.summary}`)
          .join("\n")}`,
      });
      const parsed = parseJson<{ queries?: string[] }>(text, { queries: [] });
      return (parsed.queries ?? []).map(String).filter(Boolean).slice(0, 3);
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

export const runGuardrail = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { insights: { title: string; summary: string }[] }) => d,
  )
  .handler(async ({ data }) => {
    try {
      const { text } = await generateText({
        model: model(),
        system: `You are the Guardrail agent. Check insights for unsupported claims, defamation, PII, or unsafe content. Reply with ONLY a JSON object, no prose:\n{"pass":true,"reason":"..."}\nReturn pass=true unless there is a real concern.`,
        prompt: data.insights.map((i) => `- ${i.title}: ${i.summary}`).join("\n"),
      });
      const parsed = parseJson<{ pass?: boolean; reason?: string }>(text, { pass: true, reason: "ok" });
      return {
        pass: Boolean(parsed.pass ?? true),
        reason: String(parsed.reason ?? "ok"),
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