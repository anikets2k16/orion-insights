import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { PIPELINE, type Phase } from "@/lib/research";

const PHASE_COPY: Record<Phase, { running: string; done: string }> = {
  intake: { running: "Intaking your brief…", done: "Brief intake" },
  clarify: { running: "Clarifying intent…", done: "Clarified" },
  retrieve: { running: "Retrieving sources…", done: "Sources retrieved" },
  score: { running: "Scoring credibility…", done: "Sources scored" },
  analyse: { running: "Running critical analysis…", done: "Analysis ready" },
  contradict: { running: "Surfacing contradictions…", done: "Contradictions mapped" },
  insight: { running: "Generating insights…", done: "Insights generated" },
  gaps: { running: "Identifying open gaps…", done: "Gaps identified" },
  deepen: { running: "Deepening evidence…", done: "Evidence deepened" },
  guardrail: { running: "Running guardrails…", done: "Guardrails passed" },
  report: { running: "Composing report…", done: "Report ready" },
};

interface Props {
  phase: Phase;
  progress: number;
  status?: string;
}

export function PipelineStepper({ phase, progress, status }: Props) {
  const reduce = useReducedMotion();
  const idx = PIPELINE.indexOf(phase);
  const total = PIPELINE.length - 1;
  const fillPct = total > 0 ? Math.max(0, Math.min(100, (idx / total) * 100)) : 0;
  const isComplete = status === "complete";
  const isError = !!status && status.startsWith("error");
  const copy = PHASE_COPY[phase];
  const headline = isComplete
    ? "All phases complete"
    : isError
      ? "Pipeline halted"
      : copy?.running ?? phase;

  return (
    <div className="orion-stepper" aria-label="Pipeline progress">
      <div className="orion-phase-headline">
        {!isComplete && !isError && <span className="dot" aria-hidden />}
        <AnimatePresence mode="wait">
          <motion.span
            key={headline}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className={!isComplete && !isError ? "orion-shimmer" : undefined}
            style={isComplete ? { color: "var(--orion-success)" } : isError ? { color: "var(--orion-danger)" } : undefined}
          >
            {headline}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="orion-progress" style={{ marginTop: 14 }}>
        <motion.div
          initial={false}
          animate={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="orion-stepper-track">
        <motion.div
          className="orion-stepper-fill"
          initial={false}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        {!isComplete && !isError && !reduce && (
          <motion.div
            className="orion-stepper-beam"
            initial={{ left: "-12%" }}
            animate={{ left: `${fillPct + 6}%` }}
            transition={{
              left: { duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
            }}
          />
        )}
        <div className="orion-stepper-nodes">
          {PIPELINE.map((p, i) => {
            const state = i < idx || isComplete ? "done" : i === idx ? (isError ? "" : "active") : "";
            const labelCls = i < idx || isComplete ? "done" : i === idx ? "active" : "";
            return (
              <div key={p} className="orion-node-wrap">
                <div className={`orion-node ${state}`} title={p}>
                  {(i < idx || isComplete) && (
                    <Check
                      size={10}
                      strokeWidth={3.5}
                      style={{ color: "white", position: "absolute", inset: 0, margin: "auto" }}
                    />
                  )}
                </div>
                <span className={`orion-node-label ${labelCls}`}>{p}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}