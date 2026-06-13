# Session UI polish + advanced pipeline animations

Goal: make the live session page (`src/routes/_authenticated/session.$sid.tsx`) feel like a premium research console — refined cards for Analysis / Insights / Contradictions / Gaps / Report, and a far more advanced pipeline phase visualisation.

Scope is presentation-only. No changes to `research.ts` logic, server functions, or schemas.

## 1. Pipeline phase strip → animated "constellation"

Replace the current flat tag row with a horizontal animated stepper that fits ORION's space/constellation theme.

- Each phase is a node on a connecting line; nodes glow when active, fill when complete.
- Animated beam of light travels along the connector between the last completed node and the current node (loop while running).
- Active node: pulsing halo + subtle rotation of an outer ring. Completed nodes: solid filled with a check. Pending: dim outline.
- Phase label morphs in/out with `framer-motion` `AnimatePresence` when `session.phase` changes.
- A live "current phase" headline above the strip (e.g. "Scoring sources…") with shimmer text while running, fades to "Complete" with a success accent when done.
- Progress bar is preserved but restyled: thin, gradient fill (`--orion-blue` → violet), animated stripes while in progress.

Implementation: new component `src/components/PipelineStepper.tsx` using `framer-motion` (already a common dep — add if missing). Pure presentational, receives `phase`, `progress`, `status`.

## 2. Result section visual system

Introduce a small shared visual language for all result cards instead of plain `<h2>` + `<ul>`.

- New `SectionCard` wrapper: subtle gradient border, hairline divider, section icon (lucide), and `motion` fade-up on mount with stagger for children.
- New `Pill` and `ConfidenceBar` primitives (e.g. confidence rendered as a tiny gradient bar + numeric, not just `conf 0.74` text).
- Citations rendered as small clickable chips `[3]` that scroll/highlight the matching source in the curation list.

Apply to each block:

- **Critical analysis**: narrative as lead paragraph with drop-cap. Themes / Tensions as two-column chip clouds instead of bullet lists.
- **Insights**: card grid (1 col mobile, 2 col desktop). Each card: title, confidence bar, summary, "Implications" italic footer, citation chips. Hover lift + border-glow.
- **Contradictions**: split "vs" layout — claim at top, two sides separated by a vertical divider with a small "⚡" marker, citation chips at the bottom.
- **Gaps**: numbered timeline (vertical) — question / why-it-matters / suggested next step in a stepper rail.
- **Report**: framed in a "document" container with paper-like background tint and max-width for readability; existing HTML rendered inside.

## 3. Source curation polish (light touches)

- Confidence pill becomes a colored chip (red < 0.4, amber 0.4–0.7, green > 0.7).
- Source type tag gets distinct color per type (academic / news / report / blog).
- "Use selected sources & continue" button: gradient + subtle glow, disabled state when 0 selected (instead of error message after click — keep the error too as fallback).

## 4. Motion details

- Use `framer-motion`'s `LayoutGroup` so cards reflow smoothly as new sections appear during the pipeline.
- Stagger children appearance (0.05s) within each section.
- Respect `prefers-reduced-motion`: collapse to fades only.

## Technical notes

- Files touched:
  - `src/routes/_authenticated/session.$sid.tsx` (compose new components, keep all state/effects intact)
  - `src/components/PipelineStepper.tsx` (new)
  - `src/components/research/SectionCard.tsx`, `ConfidenceBar.tsx`, `CitationChip.tsx` (new)
  - `src/styles.css` (add tokens: `--orion-violet`, `--orion-success`, `--orion-warn`, `--orion-danger`, gradient + shadow tokens)
- Add `framer-motion` via `bun add framer-motion` if not already installed.
- No server-side, no schema, no `research.ts` changes.

## Out of scope

- Changing pipeline behaviour, polling cadence, or data shape.
- Editing the saved-report HTML template (`reports/templates/*`).
- Re-doing the curation flow logic.
