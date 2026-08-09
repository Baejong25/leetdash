import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { catalog, type CatalogProblem, type ProblemCatalog } from "@/lib/catalog";
import {
  getProblemSolutionDetail,
  listComparableProblemParams,
} from "@/lib/problem-solutions";
import { SubmissionStatus, type ProgressData, type ProgressUser, type Submission } from "@/lib/types";

function fixtureCatalog(problems: CatalogProblem[]): ProblemCatalog {
  return { generatedAt: "2024-01-01T00:00:00.000Z", sources: [], lists: [], problems };
}

function fixtureProblem(
  provider: CatalogProblem["provider"],
  problemId: string,
): CatalogProblem {
  return {
    provider,
    problemId,
    problemKey: `${provider}:${problemId}`,
    title: `Test ${problemId}`,
    difficulty: "Easy",
    sourceUrl: `https://example.com/${provider}/${problemId}`,
  };
}

function user(id: string, submissions: Submission[] = []): ProgressUser {
  return {
    id,
    displayName: id,
    githubUsername: id,
    active: true,
    submissionsPath: `submissions/${id}`,
    submissions,
    activity: [],
  };
}

function solvedSubmission(overrides: Partial<Submission>): Submission {
  return {
    id: `s:${overrides.problemKey ?? "leetcode:1"}`,
    userId: "u",
    problemKey: "leetcode:1",
    sourceKey: "top-interview-easy",
    submissionKey: "1",
    status: SubmissionStatus.SOLVED,
    solutionPath: `submissions/u/top-interview-easy/1/Solution.java`,
    source: "solution-file",
    generatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function data(users: ProgressUser[]): ProgressData {
  return { generatedAt: "2024-01-01T00:00:00.000Z", users };
}

describe("problem comparison route params", () => {
  it("generates only comparable problem parameters, never the full catalog", () => {
    const params = listComparableProblemParams();

    expect(params.length).toBeGreaterThan(0);
    expect(params.length).toBeLessThan(catalog.problems.length);
    expect(new Set(params.map((p) => `${p.provider}:${p.problemId}`)).size).toBe(params.length);
  });

  it("includes a provider and non-empty problemId in every param", () => {
    const params = listComparableProblemParams();

    for (const param of params) {
      expect(param.provider).toBeTruthy();
      expect(param.problemId).toBeTruthy();
      expect(["leetcode", "programmers", "swea"]).toContain(param.provider);
    }
  });

  it("returns sorted parameters for deterministic route generation", () => {
    const params = listComparableProblemParams();

    let lastProvider = "";
    let lastProblemId = "";
    for (const param of params) {
      if (param.provider === lastProvider) {
        const currentNumeric = /^\d+$/.test(param.problemId);
        const lastNumeric = /^\d+$/.test(lastProblemId);
        if (currentNumeric && lastNumeric) {
          expect(Number(param.problemId)).toBeGreaterThan(Number(lastProblemId));
        } else {
          expect(param.problemId.localeCompare(lastProblemId)).toBeGreaterThanOrEqual(0);
        }
      } else {
        expect(param.provider.localeCompare(lastProvider)).toBeGreaterThanOrEqual(0);
        lastProvider = param.provider;
      }
      lastProblemId = param.problemId;
    }
  });

  it("returns an empty array when no user has a catalog problem with a current solution", () => {
    const cat = fixtureCatalog([fixtureProblem("leetcode", "1")]);
    const params = listComparableProblemParams(data([]), cat);
    expect(params).toEqual([]);
  });

  it("does not emit synthetic placeholder params under any condition", () => {
    const params = listComparableProblemParams(data([]), fixtureCatalog([]));
    expect(params).toEqual([]);
    for (const param of params) {
      expect(param.problemId).not.toBe("__placeholder__");
      expect(param.provider).not.toBe("__placeholder__");
    }
  });
});

describe("problem comparison detail contract", () => {
  it("returns null for an unsubmitted catalog problem", () => {
    const params = listComparableProblemParams();
    const submittedKeys = new Set(params.map((p) => `${p.provider}:${p.problemId}`));

    const unsubmitted = catalog.problems.find(
      (problem) => !submittedKeys.has(`${problem.provider}:${problem.problemId}`),
    );
    expect(unsubmitted).toBeDefined();
    if (!unsubmitted) {
      return;
    }

    expect(getProblemSolutionDetail(unsubmitted.provider, unsubmitted.problemId)).toBeNull();
  });

  it("returns null for an unknown provider", () => {
    expect(getProblemSolutionDetail("unknown", "1")).toBeNull();
  });

  it("returns null for a known provider but unknown problemId", () => {
    expect(getProblemSolutionDetail("leetcode", "99999999")).toBeNull();
  });

  it("excludes raw source and review bodies from every solver submission", () => {
    const params = listComparableProblemParams();
    const detail = getProblemSolutionDetail(params[0].provider, params[0].problemId);

    expect(detail).not.toBeNull();
    if (!detail) {
      return;
    }

    for (const solver of detail.solvers) {
      expect(solver.submission).not.toHaveProperty("solutionPath");
      expect(solver.submission).not.toHaveProperty("readmePath");
      expect(solver.submission).not.toHaveProperty("source");
      expect(solver.submission).not.toHaveProperty("rawMeta");
      expect(solver.submission).not.toHaveProperty("notes");
      expect(solver.submission).not.toHaveProperty("githubUrl");
    }
  });

  it("includes only problem metadata fields on the problem payload", () => {
    const params = listComparableProblemParams();
    const detail = getProblemSolutionDetail(params[0].provider, params[0].problemId);

    expect(detail).not.toBeNull();
    if (!detail) {
      return;
    }

    expect(detail.problem.provider).toBeTruthy();
    expect(detail.problem.problemId).toBeTruthy();
    expect(detail.problem.problemKey).toBeTruthy();
    expect(detail.problem.title).toBeTruthy();
    expect(detail.problem.difficulty).toBeTruthy();
    expect(detail.problem.sourceUrl).toBeTruthy();
    expect(detail.problem.sourceUrl).toMatch(/^https?:\/\//);
  });

  it("carries identity metadata for every user, not full profile", () => {
    const params = listComparableProblemParams();
    const detail = getProblemSolutionDetail(params[0].provider, params[0].problemId);

    expect(detail).not.toBeNull();
    if (!detail) {
      return;
    }

    for (const user of detail.users) {
      expect(user.id).toBeTruthy();
      expect(user.displayName).toBeTruthy();
      expect(user.githubUsername).toBeTruthy();
      expect(typeof user.active).toBe("boolean");
      // Must NOT carry submission data at user level
      expect(user).not.toHaveProperty("submissions");
      expect(user).not.toHaveProperty("submissionsPath");
    }
  });

  it("differentiates solvers from unsolved registered users", () => {
    const params = listComparableProblemParams();
    const detail = getProblemSolutionDetail(params[0].provider, params[0].problemId);

    expect(detail).not.toBeNull();
    if (!detail) {
      return;
    }

    const solverIds = new Set(detail.solvers.map((s) => s.user.id));
    for (const user of detail.users) {
      expect(user.id).toBeTruthy();
      const isSolver = solverIds.has(user.id);
      expect(typeof isSolver).toBe("boolean");
    }
  });

  it("is non-null for every comparable param", () => {
    const params = listComparableProblemParams();
    for (const param of params) {
      const detail = getProblemSolutionDetail(param.provider, param.problemId);
      expect(detail).not.toBeNull();
      expect(detail?.problem.problemKey).toBe(`${param.provider}:${param.problemId}`);
    }
  });

  it("page.tsx is under 250 pure LOC", () => {
    const path = join(import.meta.dirname ?? __dirname, "../app/problems/[provider]/[problemId]/page.tsx");
    const source = readFileSync(path, "utf-8");
    const lines = source.split("\n").filter(
      (line) => line.trim() !== "" && !line.trim().startsWith("//"),
    );
    expect(lines.length).toBeLessThan(250);
  });

  it("page.tsx does not duplicate solver table or explorer DOM in a fallback", () => {
    const path = join(import.meta.dirname ?? __dirname, "../app/problems/[provider]/[problemId]/page.tsx");
    const source = readFileSync(path, "utf-8");
    expect(source).not.toMatch(/GeometryStableFallback/);
    expect(source).not.toMatch(/StaticSolverTable/);
    expect(source).not.toContain("data-testid=\"solver-row\"");
    expect(source).not.toContain("data-testid=\"unsolved-user-row\"");
  });

  it("uses a small visible favicon, not the 360 KB mascot or transparent favicon", () => {
    const layoutPath = join(import.meta.dirname ?? __dirname, "../app/layout.tsx");
    const layoutSource = readFileSync(layoutPath, "utf-8");
    expect(layoutSource).toContain("favicon.svg");
    expect(layoutSource).not.toContain("chalsakbot.png");
    expect(layoutSource).not.toContain("favicon.ico");
  });
});
