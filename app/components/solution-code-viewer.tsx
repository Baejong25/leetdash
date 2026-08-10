"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  focusLineForSource,
  highlightSet,
  normalizeRanges,
  splitLines,
  targetLine,
  tokenizeCodeLine,
  type SolutionCodeViewerProps,
} from "@/app/components/solution-code-viewer-helpers";
import styles from "./solution-code-viewer.module.css";

// ── State-to-message mapping (CSS lives in the module; text is the data) ──

type MessageStatus = Exclude<
  SolutionCodeViewerProps["state"]["status"],
  "loading" | "loaded"
>;

const MESSAGE_CLASS: Record<MessageStatus, string> = {
  unsolved: styles.stateMessage,
  empty: styles.stateMessage,
  "not-found": styles.errorMessage,
  error: styles.errorMessage,
  oversize: styles.oversizeMessage,
  mismatch: styles.errorMessage,
  "invalid-utf8": styles.errorMessage,
};

const MESSAGE_TEXT: Record<MessageStatus, string> = {
  unsolved: "이 문제는 아직 풀지 않았습니다.",
  empty: "소스 파일이 비어 있습니다.",
  "not-found": "소스 파일을 찾을 수 없습니다.",
  error: "소스를 불러오지 못했습니다.",
  oversize: "파일 크기가 256 KiB를 초과하여 표시할 수 없습니다.",
  mismatch: "소스 내용이 메타데이터와 일치하지 않습니다.",
  "invalid-utf8": "유효한 UTF-8 텍스트가 아닙니다.",
};

// ── Shared surface wrapper ──────────────────────────────────────────────────

function surfaceClass(className?: string) {
  return [styles.surface, className].filter(Boolean).join(" ");
}

// ── Component ───────────────────────────────────────────────────────────────

export function SolutionCodeViewer({
  state,
  language,
  permalink,
  className,
  activeLineRef,
  onLineHover,
}: SolutionCodeViewerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "loaded" || !state.lineRefs || state.lineRefs.length === 0) {
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const line = focusLineForSource(state.text, state.lineRefs);
    if (line === null) {
      return;
    }
    const animationFrame = window.requestAnimationFrame(() => {
      const target = scroller.querySelector<HTMLElement>(
        `[data-line="${line}"]`,
      );
      if (!target) {
        return;
      }
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.tabIndex = -1;
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    state.status === "loaded" ? state.text : null,
    state.status === "loaded" ? state.lineRefs : null,
  ]);

  const handleCopy = useCallback(() => {
    if (state.status !== "loaded") {
      return;
    }
    navigator.clipboard.writeText(state.text).then(
      () => setCopyStatus("복사 완료"),
      () => setCopyStatus("복사 실패"),
    );
  }, [state]);

  // ── Shared header ──
  const header = (
    <div className={styles.header}>
      <span className={styles.headerLabel}>Solution Source</span>
      <div className={styles.headerActions}>
        {state.status === "loaded" && (
          <button
            type="button"
            className={styles.copyButton}
            onClick={handleCopy}
            aria-label="Copy 소스 코드 복사"
          >
            Copy
          </button>
        )}
        {permalink && state.status !== "unsolved" && (
          <a
            href={permalink}
            className={styles.permalink}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        )}
      </div>
    </div>
  );

  // ── State switch ──
  switch (state.status) {
    case "loading": {
      return (
        <div className={surfaceClass(className)}>
          {header}
          <div className={styles.loadingSkeleton}>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={styles.skeletonLine} />
            ))}
          </div>
        </div>
      );
    }

    case "unsolved":
    case "empty":
    case "not-found":
    case "error":
    case "oversize":
    case "mismatch":
    case "invalid-utf8": {
      return (
        <div className={surfaceClass(className)}>
          {header}
          <div className={MESSAGE_CLASS[state.status]}>
            {MESSAGE_TEXT[state.status]}
          </div>
        </div>
      );
    }

    case "loaded": {
      const lines = splitLines(state.text);
      const refs = state.lineRefs
        ? normalizeRanges(state.lineRefs, lines.length)
        : [];
      const highlights = highlightSet(refs, lines.length);
      const activeHighlights = activeLineRef
        ? highlightSet([activeLineRef], lines.length)
        : new Set<number>();
      const focusLine = targetLine(refs);

      return (
        <div className={surfaceClass(className)}>
          {header}
          <div ref={scrollerRef} className={styles.scroller}>
            <div className={styles.lineTable} role="table" aria-label="소스 코드">
              {lines.map((content, index) => {
                const lineNumber = index + 1;
                const isHighlight = highlights.has(lineNumber);
                const isTarget = focusLine === lineNumber;
                const isActive = activeHighlights.has(lineNumber);
                const rowClasses = [
                  styles.lineRow,
                  isHighlight && !isTarget ? styles.highlight : "",
                  isTarget ? styles.target : "",
                  isActive ? styles.activeReview : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={lineNumber}
                    id={`solution-line-${lineNumber}`}
                    data-line={lineNumber}
                    data-review-active={isActive ? "true" : undefined}
                    className={rowClasses}
                    role="row"
                    onMouseEnter={() => onLineHover?.(lineNumber)}
                    onMouseLeave={(event) => {
                      if (document.activeElement !== event.currentTarget) {
                        onLineHover?.(null);
                      }
                    }}
                    onFocus={() => onLineHover?.(lineNumber)}
                    onBlur={() => onLineHover?.(null)}
                    tabIndex={onLineHover ? 0 : undefined}
                  >
                    <span
                      className={styles.lineNumber}
                      role="rowheader"
                      aria-hidden="true"
                    >
                      {lineNumber}
                    </span>
                    <span className={styles.lineContent} role="cell">
                      {tokenizeCodeLine(content, language ?? "").map((token, tokenIndex) => (
                        <span key={`${lineNumber}-${tokenIndex}`} className={styles[`token-${token.kind}`]}>
                          {token.text}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.copyStatus} aria-live="polite" role="status">
            {copyStatus}
          </div>
        </div>
      );
    }

    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
