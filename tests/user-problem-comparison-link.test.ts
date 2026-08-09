import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserProblemActions } from "@/app/components/user-problem-actions";
import { getComparisonLinkHref } from "@/lib/user-problem-comparison-link";
import { getProblemComparisonHref } from "@/lib/routes";
import type { CatalogProblem } from "@/lib/catalog";
import type { Submission } from "@/lib/types";
import { SubmissionStatus } from "@/lib/types";

const baseProblem: CatalogProblem = {
  provider: "leetcode",
  problemId: "1",
  problemKey: "leetcode:1",
  title: "Two Sum",
  difficulty: "Easy",
  sourceUrl: "https://leetcode.com/problems/two-sum",
};

const providerLabels = {
  leetcode: "LeetCode",
  programmers: "Programmers",
  swea: "SWEA",
};

function renderActions(comparisonHref: string | null, overrides?: {
  submission?: Submission | null;
}) {
  const submission = overrides?.submission ?? null;
  return renderToStaticMarkup(
    createElement(UserProblemActions, {
      problem: baseProblem,
      submission,
      comparisonHref,
      providerLabels,
    }),
  );
}

/** Returns the Next Link-normalized comparison href (no trailing slash before ?). */
function normalizedComparisonHref(provider: string, problemId: string, profileUserId: string): string {
  return `/problems/${encodeURIComponent(provider)}/${encodeURIComponent(problemId)}?user=${encodeURIComponent(profileUserId)}`;
}

describe("route helpers", () => {
  it("builds comparison href with empty basePath for Next Link consumption", () => {
    const href = getProblemComparisonHref("leetcode", "1", "mygo", "");

    expect(href).toBe("/problems/leetcode/1/?user=mygo");
    expect(href).not.toContain("//");
  });

  it("preserves selected profile user in ?user= even when unsolved", () => {
    const href = getProblemComparisonHref("programmers", "12906", "grace", "");

    expect(href).toBe("/problems/programmers/12906/?user=grace");
    expect(href).toContain("?user=grace");
  });

  it("never doubles the basePath when consumed by Next Link", () => {
    const href = getProblemComparisonHref("swea", "1206", "yeochang", "");

    expect(href).toMatch(/^\/problems\//);
    expect(href).not.toContain("/leetdash/");
  });
});

describe("getComparisonLinkHref production helper", () => {
  it("returns href when communitySolutionCount > 0", () => {
    const href = getComparisonLinkHref("leetcode", "1", "mygo", 3);

    expect(href).toBe("/problems/leetcode/1/?user=mygo");
  });

  it("returns null when communitySolutionCount is zero", () => {
    const href = getComparisonLinkHref("leetcode", "1", "mygo", 0);

    expect(href).toBeNull();
  });

  it("returns null when communitySolutionCount is negative", () => {
    const href = getComparisonLinkHref("leetcode", "1", "mygo", -1);

    expect(href).toBeNull();
  });

  it("encodes profile user id in the returned href", () => {
    const href = getComparisonLinkHref("leetcode", "1", "user/name", 1);

    expect(href).toBe("/problems/leetcode/1/?user=user%2Fname");
  });
});

describe("UserProblemActions rendered output", () => {
  it("renders comparison link with correct href when community solutions exist", () => {
    const html = renderActions("/problems/leetcode/1/?user=mygo");

    expect(html).toContain('href="/problems/leetcode/1?user=mygo"');
    expect(html).toContain("비교");
  });

  it("renders comparison link for solved-own profile", () => {
    const html = renderActions("/problems/leetcode/1/?user=mygo");

    expect(html).toContain('href="/problems/leetcode/1?user=mygo"');
  });

  it("renders comparison link for other-user profile", () => {
    const html = renderActions("/problems/leetcode/48/?user=bob");

    expect(html).toContain('href="/problems/leetcode/48?user=bob"');
  });

  it("renders provider link as external anchor with correct target and rel", () => {
    const html = renderActions("/problems/leetcode/1/?user=mygo");

    expect(html).toContain("https://leetcode.com/problems/two-sum");
    expect(html).toContain("LeetCode");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("renders GitHub link as external anchor when submission has githubUrl", () => {
    const submission: Submission = {
      id: "mygo:leetcode:1",
      userId: "mygo",
      problemKey: "leetcode:1",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      status: SubmissionStatus.SOLVED,
      githubUrl: "https://github.com/user/repo/blob/main/Solution.java",
      source: "solution-file",
      generatedAt: "2024-01-01T00:00:00.000Z",
    };
    const html = renderActions("/problems/leetcode/1/?user=mygo", { submission });

    expect(html).toContain("https://github.com/user/repo/blob/main/Solution.java");
    expect(html).toContain("GitHub");
    expect(html).toContain('target="_blank"');
  });

  it("omits comparison link when comparisonHref is null", () => {
    const html = renderActions(null);

    expect(html).not.toContain("비교");
    // Anchor count should be provider-only
    const anchors = [...html.matchAll(/<a /g)];
    expect(anchors).toHaveLength(1);
  });

  it("keeps provider link present even when comparisonHref is null", () => {
    const html = renderActions(null);

    expect(html).toContain("https://leetcode.com/problems/two-sum");
    expect(html).toContain("LeetCode");
  });

  it("renders one comparison anchor and one provider anchor for eligible row", () => {
    const html = renderActions("/problems/leetcode/1/?user=mygo");

    const anchors = [...html.matchAll(/<a /g)];
    expect(anchors).toHaveLength(2);
  });

  it("renders comparison and provider and GitHub anchors for eligible row with githubUrl", () => {
    const submission: Submission = {
      id: "mygo:leetcode:1",
      userId: "mygo",
      problemKey: "leetcode:1",
      sourceKey: "top-interview-easy",
      submissionKey: "1",
      status: SubmissionStatus.SOLVED,
      githubUrl: "https://github.com/user/repo/blob/main/Solution.java",
      source: "solution-file",
      generatedAt: "2024-01-01T00:00:00.000Z",
    };
    const html = renderActions("/problems/leetcode/1/?user=mygo", { submission });

    const anchors = [...html.matchAll(/<a /g)];
    expect(anchors).toHaveLength(3);
  });
});

describe("title and action share same computed comparisonHref", () => {
  it("produces non-null href from a single helper call, used by actions component", () => {
    const comparisonHref = getComparisonLinkHref("leetcode", "1", "mygo", 3);

    expect(comparisonHref).not.toBeNull();
    const html = renderActions(comparisonHref);
    const expectedHref = normalizedComparisonHref("leetcode", "1", "mygo");
    expect(html).toContain(`href="${expectedHref}"`);
  });

  it("returns null from helper when count is zero, actions render no comparison", () => {
    const comparisonHref = getComparisonLinkHref("leetcode", "1", "grace", 0);

    expect(comparisonHref).toBeNull();

    const html = renderActions(null);
    expect(html).not.toContain("비교");
  });

  it("produces correct title-link href for solved-own profile with community solvers", () => {
    const href = getComparisonLinkHref("leetcode", "1", "mygo", 5);

    expect(href).toBe("/problems/leetcode/1/?user=mygo");
  });

  it("produces correct title-link href for other-user profile when community solutions exist", () => {
    const href = getComparisonLinkHref("leetcode", "48", "bob", 2);

    expect(href).toBe("/problems/leetcode/48/?user=bob");
  });

  it("returns null for unsolved profile when no community solutions exist", () => {
    const href = getComparisonLinkHref("leetcode", "42", "grace", 0);

    expect(href).toBeNull();
  });

  it("produces correct title-link href when the only solver is inactive", () => {
    const href = getComparisonLinkHref("leetcode", "136", "kim", 1);

    expect(href).toBe("/problems/leetcode/136/?user=kim");
  });
});
