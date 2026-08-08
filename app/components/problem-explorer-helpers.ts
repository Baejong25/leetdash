import type {
  ProblemDetailUser,
  ProblemSolutionDetail,
  ProblemSolver,
} from "@/lib/problem-solutions";
import type { RawLoadResult } from "@/lib/raw-source-loader";
import type { SolutionCodeViewerState } from "@/app/components/solution-code-viewer-helpers";

// ── Selection resolution ────────────────────────────────────────────────────

/** Exhaustive typed outcome of resolving `?user=` against a problem's detail.
 *  Every branch encodes exactly one semantic situation; the explorer renders a
 *  different UI for each. */
export type SelectionOutcome =
  | { kind: "no-query" }
  | { kind: "selected-solver"; solver: ProblemSolver }
  | { kind: "selected-unsolved"; user: ProblemDetailUser }
  | { kind: "unknown-user"; rawQuery: string };

/**
 * Resolve a `?user=` query parameter against the problem detail.
 *
 * - `null` (param absent) → first solver when solvers exist, otherwise `no-query`.
 *   The caller must not steal focus for this default selection.
 * - `""` (explicit empty param, e.g. `?user=`) → `unknown-user` — explicit
 *   invalid request, never silently default.
 * - A registered solver ID → `selected-solver` with that solver's data.
 * - A registered user ID who has NOT solved → `selected-unsolved` with their identity.
 * - Any other non-empty string → `unknown-user` — the caller MUST show an
 *   explicit invalid state and never silently default.
 */
export function resolveSelection(
  query: string | null,
  detail: ProblemSolutionDetail,
): SelectionOutcome {
  if (query === null) {
    if (detail.solvers.length > 0) {
      return { kind: "selected-solver", solver: detail.solvers[0] };
    }
    return { kind: "no-query" };
  }

  if (query === "") {
    return { kind: "unknown-user", rawQuery: "" };
  }

  const solver = detail.solvers.find((s) => s.user.id === query);
  if (solver) {
    return { kind: "selected-solver", solver };
  }

  const solverIds = new Set(detail.solvers.map((s) => s.user.id));
  const user = detail.users.find((u) => u.id === query && !solverIds.has(u.id));
  if (user) {
    return { kind: "selected-unsolved", user };
  }

  return { kind: "unknown-user", rawQuery: query };
}

// ── Raw result → viewer state mapping ────────────────────────────────────────

/**
 * Map a `RawLoadResult` to the corresponding `SolutionCodeViewerState`.
 *
 * Mapping:
 * | RawLoadResult     | Viewer state     | Notes                              |
 * |-------------------|------------------|-------------------------------------|
 * | ok (non-empty)    | loaded           | text is set; lineRefs from caller   |
 * | ok (empty string) | empty            | file exists but is empty            |
 * | not-found         | not-found        | 404 from raw URL                    |
 * | unsupported-type  | error            | non-text/plain contentType          |
 * | network-error     | error            | fetch failure / non-ok response     |
 * | oversize          | oversize         | >256 KiB                            |
 * | mismatch          | mismatch         | SHA-256 verification failed         |
 * | invalid-utf8      | invalid-utf8     | non-UTF-8 bytes in body             |
 *
 * `aborted` is never mapped — the caller must guard before passing to this function.
 */
export function mapRawResultToViewerState(result: RawLoadResult): SolutionCodeViewerState {
  switch (result.status) {
    case "ok":
      return result.text.length === 0
        ? { status: "empty" }
        : { status: "loaded", text: result.text };

    case "not-found":
      return { status: "not-found" };

    case "unsupported-type":
      return { status: "error" };

    case "network-error":
      return { status: "error" };

    case "oversize":
      return { status: "oversize" };

    case "mismatch":
      return { status: "mismatch" };

    case "invalid-utf8":
      return { status: "invalid-utf8" };

    case "aborted":
      throw new Error("mapRawResultToViewerState: aborted must not be mapped to a view");
  }
}
