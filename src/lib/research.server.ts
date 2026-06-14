import { z } from "zod";

import type { Source } from "./research.types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string | null;
  score?: number;
}

export async function tavilySearch(query: string, max: number): Promise<TavilyResult[]> {
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

export function classifySource(url: string): Source["source_type"] {
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

export async function repairStructuredJson({ text }: { text: string }) {
  return extractJsonFromResponse(text);
}

export const confidenceSchema = z.coerce
  .number()
  .transform((value) => (value > 1 ? value / 100 : value));

export const citationsSchema = z.array(z.coerce.number()).catch([]);