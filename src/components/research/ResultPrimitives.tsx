import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function SectionCard({
  icon,
  title,
  delay = 0,
  children,
}: {
  icon: ReactNode;
  title: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <motion.section
      className="orion-section"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="orion-section-head">
        <span className="icon" aria-hidden>
          {icon}
        </span>
        <h2>{title}</h2>
      </header>
      {children}
    </motion.section>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = value < 0.4 ? "red" : value < 0.7 ? "amber" : "";
  return (
    <span className="orion-confbar" title={`Confidence ${pct}%`}>
      <span className="track">
        <motion.span
          className={`fill ${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "block", height: "100%" }}
        />
      </span>
      <span>{pct}%</span>
    </span>
  );
}

export function CitationChips({ ids }: { ids?: number[] }) {
  if (!ids || ids.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {ids.map((id) => (
        <a key={id} href={`#src-${id}`} className="orion-cite">
          [{id}]
        </a>
      ))}
    </span>
  );
}

const TYPE_TONE: Record<string, string> = {
  academic: "violet",
  news: "blue",
  report: "green",
  blog: "amber",
};

export function SourceTypeChip({ type }: { type: string }) {
  return <span className={`orion-chip ${TYPE_TONE[type] ?? ""}`}>{type}</span>;
}

export function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = value < 0.4 ? "red" : value < 0.7 ? "amber" : "green";
  return <span className={`orion-chip ${tone}`}>{pct}%</span>;
}