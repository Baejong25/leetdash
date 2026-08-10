import { describe, expect, it } from "vitest";
import { filterProviderProblems, paginateProviderProblems } from "@/lib/provider-problem-filter";
import { SubmissionStatus, type Submission } from "@/lib/types";

function submission(problemKey: string, status: SubmissionStatus): Submission {
  return {
    id: `user:${problemKey}`,
    userId: "user",
    problemKey,
    sourceKey: "provider",
    submissionKey: problemKey,
    status,
    source: "solution-file",
    generatedAt: "2026-08-10T00:00:00.000Z",
  };
}

function item(index: number, difficulty: string, status?: SubmissionStatus) {
  const problemKey = `programmers:${index}`;
  return {
    problemKey,
    problem: { difficulty },
    submissions: {
      user: status ? submission(problemKey, status) : null,
    },
  };
}

describe("provider-wide problem filtering", () => {
  it("filters the full provider collection before pagination", () => {
    const items = [
      ...Array.from({ length: 50 }, (_, index) => item(index, "level-0")),
      ...Array.from({ length: 10 }, (_, index) => item(index + 50, "level-1")),
    ];

    const filtered = filterProviderProblems(items, {
      selectedUserId: "",
      status: "all",
      difficulty: "level-1",
    });
    const page = paginateProviderProblems(filtered, 1, 50);

    expect(filtered).toHaveLength(10);
    expect(page.items).toHaveLength(10);
    expect(page.items[0]?.problemKey).toBe("programmers:50");
  });

  it("combines user status and difficulty filters", () => {
    const items = [
      item(1, "medium", SubmissionStatus.SOLVED),
      item(2, "medium", SubmissionStatus.REVIEWING),
      item(3, "easy", SubmissionStatus.SOLVED),
      item(4, "medium"),
    ];

    expect(filterProviderProblems(items, {
      selectedUserId: "user",
      status: "SOLVED",
      difficulty: "medium",
    }).map((candidate) => candidate.problemKey)).toEqual(["programmers:1"]);

    expect(filterProviderProblems(items, {
      selectedUserId: "user",
      status: "UNSOLVED",
      difficulty: "medium",
    }).map((candidate) => candidate.problemKey)).toEqual(["programmers:4"]);
  });

  it("clamps a stale page after filtering reduces the result count", () => {
    const page = paginateProviderProblems([1, 2, 3], 10, 2);

    expect(page).toEqual({ currentPage: 2, totalPages: 2, items: [3] });
  });
});
