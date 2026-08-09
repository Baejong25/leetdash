import type { LineReference } from "@/lib/solution-assets";

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Split source text into lines, preserving a trailing empty string for a
 *  final newline so line-number count matches what editors display. */
export function splitLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.split("\n");
}

/** Clamp every reference to `[1, totalLines]` and sort ascending. Zero or
 *  negative `totalLines` yields an empty result. */
export function normalizeRanges(
  refs: readonly LineReference[],
  totalLines: number,
): LineReference[] {
  if (totalLines <= 0) {
    return [];
  }
  const clamped: LineReference[] = [];
  for (const ref of refs) {
    const start = Math.max(1, Math.min(ref.start, totalLines));
    const end = Math.max(start, Math.min(ref.end, totalLines));
    clamped.push({ start, end });
  }
  return clamped.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Return the first line of the first reference, or `null` when none exist. */
export function targetLine(refs: readonly LineReference[]): number | null {
  if (refs.length === 0) {
    return null;
  }
  return refs[0]!.start;
}

/** Compute the focus-target line number from source text and raw references
 *  using the same pipeline the renderer uses: splitLines → normalizeRanges →
 *  targetLine. Returns `null` when refs is undefined, empty, or the source
 *  has zero lines. */
export function focusLineForSource(
  text: string,
  refs: readonly LineReference[] | undefined,
): number | null {
  if (!refs || refs.length === 0) {
    return null;
  }
  const totalLines = splitLines(text).length;
  return targetLine(normalizeRanges(refs, totalLines));
}

/** Build a set of highlighted line numbers from clamped ranges. */
export function highlightSet(
  refs: readonly LineReference[],
  totalLines: number,
): Set<number> {
  const set = new Set<number>();
  for (const ref of normalizeRanges(refs, totalLines)) {
    for (let n = ref.start; n <= ref.end; n += 1) {
      set.add(n);
    }
  }
  return set;
}

// ── Discriminated state type ───────────────────────────────────────────────

export type SolutionCodeViewerState =
  | { status: "loading" }
  | { status: "unsolved" }
  | { status: "empty" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "oversize" }
  | { status: "mismatch" }
  | { status: "invalid-utf8" }
  | {
      status: "loaded";
      text: string;
      /** Optional line references for highlight / scroll-to. */
      lineRefs?: readonly LineReference[];
    };

// ── Props ──────────────────────────────────────────────────────────────────

export interface SolutionCodeViewerProps {
  state: SolutionCodeViewerState;
  /** GitHub permalink to the source file. Shown in every non-unsolved state. */
  permalink?: string | null;
  className?: string;
}
