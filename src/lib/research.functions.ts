import { createServerFn } from "@tanstack/react-start";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

function model() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return createLovableAiGatewayProvider(key)(MODEL);
}

const PERSONA_GUIDE: Record<string, string> = {
  researcher: "Prioritize methodological rigor, evidence chains, and academic perspectives.",
  product_manager: "Frame in terms of market opportunities, risks, user needs, and strategic bets.",
  content_creator: "Focus on narrative hooks, audience appeal, and shareable angles.",
};

const SourceSchema = z.object({
  sources: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        source_type: z.enum(["academic", "news", "blog", "report"]),
        confidence: z.number().min(0).max(1),
        rationale: z.string(),
      }),
    )
    .min(4)
    .max(8),
});

export const generateSources = createServerFn({ method: "POST" })
  .inputValidator((d: { topic: string; persona: string; threshold: number }) => d)
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const { object } = await generateObject({
      model: model(),
      schema: SourceSchema,
      system: `You are the Contextual Retriever agent in the ORION research pipeline. ${persona} Propose 6 high-signal sources covering diverse perspectives on the topic. Mix academic, industry, news. Provide realistic URLs to known publishers (arxiv.org, nature.com, hbr.org, mckinsey.com, techcrunch.com, stratechery.com, a16z.com, wired.com, etc). Score each source's confidence 0-1.`,
      prompt: `Topic: ${data.topic}\nPersona: ${data.persona}\nConfidence threshold: ${data.threshold}`,
    });
    return object.sources.sort((a, b) => b.confidence - a.confidence);
  });

export const generateAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      persona: string;
      sources: { url: string; title: string; rationale?: string }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const list = data.sources
      .map((s, i) => `${i + 1}. ${s.title} (${s.url})${s.rationale ? `\n   ${s.rationale}` : ""}`)
      .join("\n");
    const { text } = await generateText({
      model: model(),
      system: `You are the Critical Analysis agent. ${persona} Produce a tight, well-structured analysis (markdown, ~350 words) of the topic given the curated sources. Identify themes, tensions, and gaps.`,
      prompt: `Topic: ${data.topic}\n\nCurated sources:\n${list}`,
    });
    return { analysis: text };
  });

const InsightsSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        confidence: z.number().min(0).max(1),
        implications: z.string(),
      }),
    )
    .min(3)
    .max(5),
});

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((d: { topic: string; persona: string; analysis: string }) => d)
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const { object } = await generateObject({
      model: model(),
      schema: InsightsSchema,
      system: `You are the Insight Generator agent. ${persona} Distill 3-5 sharp, non-obvious insights grounded in the analysis.`,
      prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}`,
    });
    return object.insights;
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
    const { object } = await generateObject({
      model: model(),
      schema: GuardrailSchema,
      system:
        "You are the Guardrail agent. Check the insights for unsupported claims, defamation, PII, or unsafe content. Return pass=true unless there is a real concern.",
      prompt: data.insights.map((i) => `- ${i.title}: ${i.summary}`).join("\n"),
    });
    return object;
  });

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      topic: string;
      persona: string;
      analysis: string;
      insights: { title: string; summary: string; implications: string; confidence: number }[];
      sources: { url: string; title: string }[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const persona = PERSONA_GUIDE[data.persona] ?? PERSONA_GUIDE.researcher;
    const { text } = await generateText({
      model: model(),
      system: `You are the Report Builder agent. ${persona} Produce a polished markdown research report with: title, executive summary, key insights (each with implications & confidence), analysis section, and a sources section with links.`,
      prompt: `Topic: ${data.topic}\n\nAnalysis:\n${data.analysis}\n\nInsights:\n${JSON.stringify(
        data.insights,
        null,
        2,
      )}\n\nSources:\n${data.sources.map((s) => `- [${s.title}](${s.url})`).join("\n")}`,
    });
    return { markdown: text };
  });