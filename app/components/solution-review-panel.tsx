"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadReview,
  isAbortError,
  type ReviewArtifact,
  type ReviewItem,
  type ReviewLoadResult,
  type LineReference,
} from "@/lib/solution-assets";
import styles from "./solution-review-panel.module.css";

// ── Pure helpers (tested directly) ──────────────────────────────────────────

export type ReviewPanelView =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "available"; artifact: ReviewArtifact }
  | { kind: "none" }
  | { kind: "unavailable" }
  | { kind: "error" };

export function mapReviewToView(result: ReviewLoadResult): ReviewPanelView {
  switch (result.status) {
    case "available":
      return { kind: "available", artifact: result.artifact };
    case "none":
      return { kind: "none" };
    case "unavailable":
      return { kind: "unavailable" };
    case "error":
      return { kind: "error" };
    case "aborted":
      throw new Error("mapReviewToView: aborted must not be mapped to a view");
  }
}

export function lineLabel(reference: LineReference): string {
  if (reference.start === reference.end) {
    return `코드 L${reference.start}로 이동`;
  }
  return `코드 L${reference.start}–L${reference.end}으로 이동`;
}

// ── Component ───────────────────────────────────────────────────────────────

export type SolutionReviewPanelProps = {
  pathKey: string | null;
  contentKey: string | null;
  basePath?: string;
  onFocusLine: (ref: LineReference) => void;
  activeReviewIndex?: number | null;
  onReviewHover?: (index: number | null) => void;
  onReviewsChange?: (reviews: readonly ReviewItem[]) => void;
};

export function SolutionReviewPanel({
  pathKey,
  contentKey,
  basePath,
  onFocusLine,
  activeReviewIndex = null,
  onReviewHover,
  onReviewsChange,
}: SolutionReviewPanelProps) {
  const [view, setView] = useState<ReviewPanelView>(
    pathKey !== null && contentKey !== null ? { kind: "loading" } : { kind: "idle" },
  );
  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    const fetchId = ++fetchIdRef.current;
    onReviewsChange?.([]);

    if (pathKey === null || contentKey === null) {
      setView({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setView({ kind: "loading" });

    loadReview({ pathKey, contentKey, basePath, signal: controller.signal })
      .then((result) => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (result.status === "aborted") {
          return;
        }
        const nextView = mapReviewToView(result);
        setView(nextView);
        onReviewsChange?.(nextView.kind === "available" ? nextView.artifact.reviews : []);
      })
      .catch((error: unknown) => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        if (isAbortError(error)) {
          return;
        }
        setView({ kind: "error" });
        onReviewsChange?.([]);
      });
  }, [pathKey, contentKey, basePath, onReviewsChange]);

  useEffect(() => {
    return () => {
      ++fetchIdRef.current;
      abortRef.current?.abort();
    };
  }, []);

  const handleFocusLine = useCallback(
    (ref: LineReference) => {
      onFocusLine(ref);
    },
    [onFocusLine],
  );

  if (view.kind === "idle") {
    return null;
  }

  return (
    <section className="panel" aria-live="polite">
      <div className="panel-header">
        <h2>리뷰</h2>
      </div>
      <div className={styles.body} role="region" aria-label="솔루션 리뷰">
        <ReviewContentView
          view={view}
          onFocusLine={handleFocusLine}
          activeReviewIndex={activeReviewIndex}
          onReviewHover={onReviewHover}
        />
      </div>
    </section>
  );
}

// ── Sub-renderer ────────────────────────────────────────────────────────────

function ReviewContentView({
  view,
  onFocusLine,
  activeReviewIndex,
  onReviewHover,
}: {
  view: ReviewPanelView;
  onFocusLine: (ref: LineReference) => void;
  activeReviewIndex: number | null;
  onReviewHover?: (index: number | null) => void;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <p className={styles.status} aria-busy="true">
          리뷰를 불러오는 중…
        </p>
      );

    case "available": {
      const { artifact } = view;
      return (
        <div>
          {artifact.text === null ? (
            <p className={styles.noneComment} data-testid="review-none-comment">
              리뷰 코멘트 없음.
            </p>
          ) : artifact.reviews.length > 0 ? (
            <div className={styles.reviewList}>
              {artifact.reviews.map((review, index) => (
                <article
                  key={index}
                  className={activeReviewIndex === index ? styles.reviewBlockActive : styles.reviewBlock}
                  data-testid="review-item"
                  data-review-range={`${review.lineReference.start}:${review.lineReference.end}`}
                  data-active={activeReviewIndex === index ? "true" : undefined}
                  onMouseEnter={() => onReviewHover?.(index)}
                  onMouseLeave={(event) => {
                    if (!event.currentTarget.contains(document.activeElement)) {
                      onReviewHover?.(null);
                    }
                  }}
                  onFocus={() => onReviewHover?.(index)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      onReviewHover?.(null);
                    }
                  }}
                >
                  <p className={styles.text}>{review.text}</p>
                  <button
                    className={`${styles.lineButton} button`}
                    type="button"
                    aria-label={lineLabel(review.lineReference)}
                    onClick={() => onFocusLine(review.lineReference)}
                  >
                    {review.lineReference.start === review.lineReference.end
                      ? `L${review.lineReference.start}`
                      : `L${review.lineReference.start}–L${review.lineReference.end}`}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.text} data-testid="review-text">
              {artifact.text}
            </p>
          )}
          <a
            className={`${styles.commentLink} github-link`}
            href={artifact.commentUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub에서 리뷰 보기
          </a>
        </div>
      );
    }

    case "none":
      return (
        <p className={styles.status} data-testid="review-none">
          이 솔루션에 대한 리뷰가 없습니다.
        </p>
      );

    case "unavailable":
      return (
        <div className={styles.warning}>
          <p className={styles.status}>리뷰를 불러올 수 없습니다.</p>
          <p className={styles.statusDetail}>
            리뷰 동기화 서비스를 현재 사용할 수 없습니다. 다음 배포 후 다시 시도해 주세요.
          </p>
        </div>
      );

    case "error":
      return (
        <div className={styles.error}>
          <p className={styles.status} data-testid="review-error">
            리뷰를 불러오는 중 오류가 발생했습니다.
          </p>
        </div>
      );

    case "idle":
      return null;
  }
}
