export type Persona = "researcher" | "product_manager" | "content_creator";

export interface Source {
  url: string;
  title: string;
  source_type: "academic" | "news" | "blog" | "report";
  confidence: number;
  rationale?: string;
  snippet?: string;
  citation?: number;
  hop?: number;
}

export interface Insight {
  title: string;
  summary: string;
  implications: string;
  confidence: number;
  citations?: number[];
}

export interface Contradiction {
  claim: string;
  sides: string;
  citations: number[];
}

export interface Gap {
  question: string;
  why_it_matters: string;
  suggested_next_step: string;
}

export interface Analysis {
  themes: string[];
  tensions: string[];
  narrative: string;
}