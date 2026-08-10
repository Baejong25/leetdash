"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type SolutionCodeViewerState,
} from "@/app/components/solution-code-viewer-helpers";
import {
  mapRawResultToViewerState,
  resolveSelection,
} from "@/app/components/problem-explorer-helpers";
import { ProblemSolverTable, statusBadgeClass } from "@/app/components/problem-solver-table";
import { getGithubProfileUrl } from "@/lib/github";
import { statusLabel } from "@/lib/format";
import type { ProblemSolutionDetail } from "@/lib/problem-solutions";
import { loadRawSource, type RawLoadResult } from "@/lib/raw-source-loader";
import { isAbortError, type LineReference } from "@/lib/solution-assets";
import { useClientQuery } from "@/app/components/use-client-query";
import styles from "./problem-solution-explorer.module.css";

const SolutionCodeViewer = dynamic(
  () => import("@/app/components/solution-code-viewer").then((m) => ({ default: m.SolutionCodeViewer })),
  { ssr: true },
);

const SolutionReviewPanel = dynamic(
  () => import("@/app/components/solution-review-panel").then((m) => ({ default: m.SolutionReviewPanel })),
  { ssr: true },
);

export function ProblemSolutionExplorer({
  detail,
}: {
  detail: ProblemSolutionDetail;
}) {
  const [query, handleSelectUser] = useClientQuery();

  const outcome = useMemo(() => resolveSelection(query, detail), [query, detail]);
  const unsolvedUsers = useMemo(
    () => {
      const solverIds = new Set(detail.solvers.map((s) => s.user.id));
      return detail.users.filter((u) => !solverIds.has(u.id));
    },
    [detail],
  );

  // ── Stable selected-identity key for source-loading effect ──
  // Derived from outcome so the effect only re-fires when the actual
  // solver/user changes, not when useClientQuery resolves null→same-solver.
  const sourceKey = useMemo(() => {
    switch (outcome.kind) {
      case "selected-solver": {
        const s = outcome.solver;
        return `s:${s.user.id}:${s.submission.solutionRawUrl ?? ""}:${s.submission.solutionContentKey ?? ""}`;
      }
      case "selected-unsolved":
        return `u:${outcome.user.id}`;
      case "no-query":
        return "nq";
      case "unknown-user":
        return `??:${outcome.rawQuery}`;
    }
  }, [outcome]);

  // ── Source loading state ──
  const [viewerState, setViewerState] = useState<SolutionCodeViewerState>({
    status: "loading",
  });
  const [reviewLineRefs, setReviewLineRefs] = useState<
    readonly LineReference[] | undefined
  >(undefined);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const userInitiatedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Merge review focus line refs into viewer state when loaded
  const displayViewerState = useMemo<SolutionCodeViewerState>(() => {
    if (viewerState.status !== "loaded") return viewerState;
    return { ...viewerState, lineRefs: reviewLineRefs };
  }, [viewerState, reviewLineRefs]);

  // ── Source loading effect ──
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    const fetchId = ++fetchIdRef.current;

    if (outcome.kind !== "selected-solver") {
      if (outcome.kind === "selected-unsolved") {
        setViewerState({ status: "unsolved" });
      } else {
        setViewerState({ status: "loading" });
      }
      setReviewLineRefs(undefined);
      setHoveredLine(null);
      return;
    }

    const { solver } = outcome;
    const rawUrl = solver.submission.solutionRawUrl;
    const contentKey = solver.submission.solutionContentKey;

    if (!rawUrl || !contentKey) {
      setViewerState({ status: "error" });
      setReviewLineRefs(undefined);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setViewerState({ status: "loading" });
    setReviewLineRefs(undefined);
    setHoveredLine(null);

    loadRawSource({
      url: rawUrl,
      expectedContentKey: contentKey,
      signal: controller.signal,
    }).then((result: RawLoadResult) => {
      if (fetchId !== fetchIdRef.current) return;
      if (result.status === "aborted") return;
      setViewerState(mapRawResultToViewerState(result));
    }).catch((error: unknown) => {
      if (fetchId !== fetchIdRef.current) return;
      if (isAbortError(error)) return;
      setViewerState({ status: "error" });
    });
  }, [sourceKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      ++fetchIdRef.current;
      abortRef.current?.abort();
    };
  }, []);

  // ── Focus management: only after explicit user click, not hydration/history ──
  useEffect(() => {
    if (!userInitiatedRef.current) return;
    userInitiatedRef.current = false;
    requestAnimationFrame(() => {
      headingRef.current?.focus();
    });
  }, [outcome]);

  // ── Handlers ──
  const onSelectUser = useCallback(
    (userId: string) => {
      userInitiatedRef.current = true;
      handleSelectUser(userId);
    },
    [handleSelectUser],
  );

  const handleReviewFocus = useCallback(
    (ref: LineReference) => {
      setReviewLineRefs([ref]);
    },
    [],
  );

  // ── Derived ──
  const selectedUserId =
    outcome.kind === "selected-solver"
      ? outcome.solver.user.id
      : outcome.kind === "selected-unsolved"
        ? outcome.user.id
        : null;

  const selectedSolver =
    outcome.kind === "selected-solver" ? outcome.solver : null;

  // ── Render ──
  return (
    <div className={styles.explorerRoot}>
      <div className={styles.detailSection}>
        {outcome.kind === "no-query" && (
          <section className="panel" aria-label="풀이 선택 안내">
            <div className="empty">아래 목록에서 풀이를 선택해 주세요.</div>
          </section>
        )}
        {outcome.kind === "unknown-user" && (
          <section className="panel" aria-label="알 수 없는 사용자">
            <div className="panel-header">
              <h2
                ref={headingRef}
                tabIndex={-1}
                data-testid="unknown-user-heading"
              >
                알 수 없는 사용자
              </h2>
            </div>
            <div className="empty" data-testid="unknown-user-message">
              <code>{outcome.rawQuery}</code>님은 이 문제의 등록된 사용자가 아닙니다.
            </div>
          </section>
        )}

        {/* ── Selected unsolved detail ── */}
        {outcome.kind === "selected-unsolved" && (
          <section className="panel" aria-label="미제출 사용자">
            <div className="panel-header">
              <h2 ref={headingRef} tabIndex={-1} data-testid="unsolved-heading">
                {outcome.user.displayName} — 아직 풀지 않은 문제
              </h2>
            </div>
            <div className="unsolved-detail">
              <p>
                <a
                  className="github-link"
                  href={getGithubProfileUrl(outcome.user.githubUsername)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  @{outcome.user.githubUsername}
                </a>
              </p>
              <SolutionCodeViewer
                state={{ status: "unsolved" }}
                permalink={null}
              />
            </div>
          </section>
        )}

        {/* ── Selected solver detail ── */}
        {outcome.kind === "selected-solver" && selectedSolver && (
          <div>
            <section
              className={`${styles.selectedSummary} panel`}
              aria-label="선택한 풀이"
            >
              <div className="panel-header">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  data-testid="solver-heading"
                  aria-current="true"
                >
                  {selectedSolver.user.displayName}의 풀이
                </h2>
                <div className="solver-meta">
                  <span
                    className={`badge ${statusBadgeClass(selectedSolver.submission.status)}`}
                  >
                    {statusLabel(selectedSolver.submission.status)}
                  </span>
                  {selectedSolver.submission.language && (
                    <span className="badge neutral">
                      {selectedSolver.submission.language}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <div className={styles.explorerDetailLayout}>
              <div className={styles.codeColumn}>
                <SolutionCodeViewer
                  state={displayViewerState}
                  language={selectedSolver.submission.language}
                  permalink={selectedSolver.submission.solutionPermalink ?? null}
                  onLineHover={setHoveredLine}
                />
              </div>
              <div className={styles.reviewColumn}>
                <SolutionReviewPanel
                  pathKey={selectedSolver.submission.solutionPathKey ?? null}
                  contentKey={selectedSolver.submission.solutionContentKey ?? null}
                  onFocusLine={handleReviewFocus}
                  hoveredLine={hoveredLine}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.solverSection}>
        <ProblemSolverTable
          detail={detail}
          unsolvedUsers={unsolvedUsers}
          selectedUserId={selectedUserId}
          onSelectUser={onSelectUser}
        />
      </div>
    </div>
  );
}
