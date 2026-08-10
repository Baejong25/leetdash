/** @vitest-environment jsdom */

import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionCodeViewer } from "@/app/components/solution-code-viewer";
import { findReviewIndexForLine } from "@/app/components/solution-code-viewer-helpers";
import { SolutionReviewPanel } from "@/app/components/solution-review-panel";
import type { ReviewItem } from "@/lib/solution-assets";

const pathKey = "a".repeat(64);
const contentKey = "b".repeat(64);
const reviews: ReviewItem[] = [
  {
    text: "L2-L4 범위 리뷰",
    lineReference: { start: 2, end: 4 },
  },
  {
    text: "L6 단일 줄 리뷰",
    lineReference: { start: 6, end: 6 },
  },
];
const artifact = {
  pathKey,
  contentKey,
  commentUrl: "https://github.com/whoisyourbias/leetdash/pull/1#issuecomment-1",
  updatedAt: "2026-08-10T00:00:00.000Z",
  text: reviews.map((review) => review.text).join("\n"),
  lineReferences: reviews.map((review) => review.lineReference),
  reviews,
};
const index = {
  status: "complete",
  keys: [{ pathKey, contentKey }],
};

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function SyncHarness() {
  const [loadedReviews, setLoadedReviews] = useState<readonly ReviewItem[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number | null>(null);
  const handleLineHover = useCallback((line: number | null) => {
    setActiveReviewIndex(
      line === null ? null : findReviewIndexForLine(loadedReviews, line),
    );
  }, [loadedReviews]);
  const activeRef = activeReviewIndex === null
    ? null
    : loadedReviews[activeReviewIndex]?.lineReference ?? null;

  return (
    <>
      <SolutionCodeViewer
        state={{ status: "loaded", text: "one\ntwo\nthree\nfour\nfive\nsix\nseven" }}
        activeLineRef={activeRef}
        onLineHover={handleLineHover}
      />
      <SolutionReviewPanel
        pathKey={pathKey}
        contentKey={contentKey}
        onFocusLine={() => undefined}
        activeReviewIndex={activeReviewIndex}
        onReviewHover={setActiveReviewIndex}
        onReviewsChange={setLoadedReviews}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("code viewer and review panel highlight synchronization", () => {
  function mockReviewFetch() {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(jsonResponse(url.endsWith("/index.json") ? index : artifact));
    }));
  }

  it("highlights the whole range and only its review item when a range line is hovered", async () => {
    mockReviewFetch();
    const { container } = render(<SyncHarness />);
    const items = await screen.findAllByTestId("review-item");

    fireEvent.mouseEnter(container.querySelector('[data-line="3"]')!);

    expect(items[0]?.getAttribute("data-active")).toBe("true");
    expect(items[1]?.getAttribute("data-active")).toBeNull();
    for (const line of [2, 3, 4]) {
      expect(container.querySelector(`[data-line="${line}"]`)?.getAttribute("data-review-active")).toBe("true");
    }
    expect(container.querySelector('[data-line="5"]')?.getAttribute("data-review-active")).toBeNull();
  });

  it("highlights the matching code range when a review item is hovered", async () => {
    mockReviewFetch();
    const { container } = render(<SyncHarness />);
    const items = await screen.findAllByTestId("review-item");

    fireEvent.mouseEnter(items[1]!);

    expect(container.querySelector('[data-line="6"]')?.getAttribute("data-review-active")).toBe("true");
    expect(container.querySelector('[data-line="5"]')?.getAttribute("data-review-active")).toBeNull();
    expect(items[1]?.getAttribute("data-active")).toBe("true");
    expect(items[0]?.getAttribute("data-active")).toBeNull();
  });
});
