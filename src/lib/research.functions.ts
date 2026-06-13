import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";

import type { Analysis, Contradiction, Gap, Insight, Persona, Source } from "./research";

// ---------- Tavily ----------

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string | null;
  score?: number;
}

async function tavilySearch(query: string, max: number): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not configured");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: max,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

function classifySource(url: string): Source["source_type"] {
  const u = url.toLowerCase();
  if (/arxiv\.org|doi\.org|nature\.com|sciencedirect|springer|acm\.org|ieee\.org|pubmed|ssrn/.test(u)) return "academic";
  if (/reuters|nytimes|bbc|guardian|bloomberg|wsj|ft\.com|economist|cnn|cnbc|theverge|wired|techcrunch/.test(u)) return "news";
  if (/mckinsey|gartner|forrester|deloitte|pwc|bain|statista|oecd|worldbank|imf|whitehouse\.gov|\.gov\//.test(u)) return "report";
  return "blog";
}

function extractJsonFromResponse(response: string): string | null {
  const cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  if (start === -1) return cleaned || null;

  const opening = cleaned[start];
  const closing = opening === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closing);
  const candidate = (end >= start ? cleaned.slice(start, end + 1) : cleaned.slice(start))
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\x00-\x1F\x7F]/g, "");

  return candidate || null;
}

async function repairStructuredJson({ text }: { text: string }) {
  return extractJsonFromResponse(text);
}

const confidenceSchema = z.coerce
  .number()
  .transform((value) => (value > 1 ? value / 100 : value));

const citationsSchema = z.array(z.coerce.number()).catch([]);

// ---------- Server fn: retrieve + score ----------

const RetrieveInput = z.object({
  topic: z.string().min(2),
  persona: z.enum(["researcher", "product_manager", "content_creator"]),
  threshold: z.number().min(0).max(1),
});

export const retrieveAndScoreSources = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RetrieveInput.parse(d))
  .handler(async ({ data }): Promise<{ sources: Source[] }> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const raw = await tavilySearch(data.topic, 10);
    if (raw.length === 0) return { sources: [] };

    const gateway = createLovableAiGatewayProvider(lovableKey);
    // Use the approved high-reasoning model for scoring
    const model = gateway("google/gemini-2.5-pro");

    const docs = raw.map((r, i) => ({
      idx: i + 1,
      title: r.title.slice(0, 200),
      url: r.url,
      snippet: (r.content ?? "").slice(0, 800),
    }));

    const ScoreSchema = z.object({
      scored: z.array(
        z.object({
          idx: z.coerce.number().describe("Source index"),
          confidence: confidenceSchema.describe("0.0-1.0 confidence score"),
          rationale: z.string().describe("One sentence rationale"),
        }),
      ).catch([]),
    });

    const { object: out } = await generateObject({
      model,
      schema: ScoreSchema,
      experimental_repairText: repairStructuredJson,
      temperature: 0,
      system:
        "You are a critical research analyst scoring sources for a multi-agent research assistant. " +
        "Rate each source from 0.0 to 1.0 on credibility, relevance to the topic, and recency. " +
        "Be conservative: marketing blogs and SEO listicles get low scores; peer-reviewed, primary, " +
        "or reputable journalism gets high scores. Give a one-sentence rationale per source. " +
        "IMPORTANT: You must output a valid JSON object matching the schema. Always include the 'scored' key.",
      prompt:
        `Topic: ${data.topic}\nPersona: ${data.persona}\n\n` +
        `Sources:\n` +
        docs.map((d) => `[${d.idx}] ${d.title}\n${d.url}\n${d.snippet}`).join("\n\n"),
    });

    const byIdx = new Map(out.scored.map((s) => [s.idx, s]));
    const sources: Source[] = docs
      .map((d, i) => {
        const s = byIdx.get(d.idx);
        const confidence = Math.max(0, Math.min(1, s?.confidence ?? 0));
        return {
          url: d.url,
          title: d.title,
          source_type: classifySource(d.url),
          confidence: Number(confidence.toFixed(2)),
          rationale: s?.rationale ?? "No rationale returned.",
          snippet: raw[i].content?.slice(0, 280),
          citation: d.idx,
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    return { sources };
  });

// ---------- Server fn: analyse + synthesise ----------

const SynthInput = z.object({
  topic: z.string().min(2),
  persona: z.enum(["researcher", "product_manager", "content_creator"]),
  threshold: z.number().min(0).max(1),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      source_type: z.string(),
      confidence: z.number(),
      snippet: z.string().optional(),
      citation: z.number().optional(),
    }),
  ),
});

export interface SynthesisOutput {
  analysis: Analysis;
  insights: Insight[];
  contradictions: Contradiction[];
  gaps: Gap[];
  executive_summary: string;
}

export const analyseAndSynthesize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SynthInput.parse(d))
  .handler(async ({ data }): Promise<SynthesisOutput> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(lovableKey);
    // Use the approved high-reasoning model for synthesis
    const model = gateway("google/gemini-2.5-pro");

    const Schema = z.object({
      executive_summary: z.string().catch("").describe("3-5 sentence summary of the findings"),
      analysis: z
        .object({
          themes: z.array(z.string()).catch([]).describe("Key themes identified"),
          tensions: z.array(z.string()).catch([]).describe("Conflicts or tensions between sources"),
          narrative: z.string().catch("").describe("Overall narrative synthesis"),
        })
        .catch({ themes: [], tensions: [], narrative: "" }),
      insights: z.array(
        z.object({
          title: z.string().catch("").describe("Insight title"),
          summary: z.string().catch("").describe("Concise summary"),
          implications: z.string().catch("").describe("Implications for the persona"),
          confidence: confidenceSchema.describe("0.0 to 1.0"),
          citations: citationsSchema.describe("Source indices"),
        }),
      ).catch([]).describe("3-5 key insights from sources"),
      contradictions: z.array(
        z.object({
          claim: z.string().catch("").describe("The conflicting claim"),
          sides: z.string().catch("").describe("The different perspectives"),
          citations: citationsSchema.describe("Source indices"),
        }),
      ).catch([]).describe("Significant disagreements found between sources"),
      gaps: z.array(
        z.object({
          question: z.string().catch("").describe("The open question"),
          why_it_matters: z.string().catch("").describe("Why this gap is important"),
          suggested_next_step: z.string().catch("").describe("Recommended next research step"),
        }),
      ).catch([]).describe("Areas where more information is needed"),
    });

    const corpus = data.sources
      .map(
        (s, i) =>
          `[${s.citation ?? i + 1}] ${s.title} (${s.source_type}, conf ${s.confidence})\n${s.url}\n${(s.snippet ?? "").slice(0, 600)}`,
      )
      .join("\n\n");

    const result = await generateObject({
      model,
      schema: Schema,
      experimental_repairText: repairStructuredJson,
      temperature: 0,
      system:
        "You are ORION, a multi-agent research synthesiser. Produce a rigorous, evidence-grounded " +
        "report from the curated sources only. Every insight and contradiction must cite the " +
        "source numbers in brackets. Confidence is 0.0-1.0. Highlight genuine disagreement, not " +
        "stylistic differences. Tailor tone to the persona. " +
        "IMPORTANT: You MUST return a valid JSON object matching the provided schema. " +
        "Always include all keys (executive_summary, analysis, insights, contradictions, gaps) " +
        "even if no content is found (return an empty array).",
      prompt:
        `Topic: ${data.topic}\nPersona: ${data.persona}\nThreshold: ${data.threshold}\n\n` +
        `Curated sources:\n${corpus}\n\n` +
        `Produce: executive_summary (3-5 sentences), analysis (themes, tensions, narrative), ` +
        `3-5 insights, 1-3 contradictions if present, and 2-4 open gaps with next steps.`,
    });
    const out = (result?.object ?? {}) as Partial<{
      executive_summary: string;
      analysis: Analysis;
      insights: Insight[];
      contradictions: Contradiction[];
      gaps: Gap[];
    }>;
    const analysis: Analysis = out.analysis ?? { themes: [], tensions: [], narrative: "" };

    // Clamp confidences and ensure citations array exists.
    const insights: Insight[] = (out.insights || []).map((i) => ({
      ...i,
      confidence: Math.max(0, Math.min(1, Number(i.confidence) || 0)),
      citations: i.citations ?? [],
    }));

    return {
      executive_summary: out.executive_summary ?? "",
      analysis,
      insights,
      contradictions: (out.contradictions || []) as Contradiction[],
      gaps: (out.gaps || []) as Gap[],
    };
  });
