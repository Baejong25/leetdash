import { describe, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  resolveSelection,
  mapRawResultToViewerState,
  type SelectionOutcome,
} from "@/app/components/problem-explorer-helpers";
import {
  loadRawSource,
  resetSourceCache,
  type RawLoadResult,
} from "@/lib/raw-source-loader";
import { isAbortError, getReviewIndexUrl, getReviewArtifactUrl } from "@/lib/solution-assets";
import type {
  ProblemSolutionDetail,
  ProblemSolver,
  ProblemDetailUser,
} from "@/lib/problem-solutions";

// ── Fixture builders ────────────────────────────────────────────────────────

function fixtureUser(overrides: Partial<ProblemDetailUser> = {}): ProblemDetailUser {
  return {
    id: "alice",
    displayName: "Alice",
    githubUsername: "alice",
    active: true,
    ...overrides,
  };
}

function fixtureSolver(overrides: Partial<ProblemSolver> = {}): ProblemSolver {
  return {
    user: fixtureUser(),
    submission: {
      id: "s:lec:two-sum",
      status: "SOLVED",
      language: "TypeScript",
      submittedAt: "2024-01-01T00:00:00.000Z",
      solutionRawUrl: "https://raw.githubusercontent.com/org/repo/main/solution.ts",
      solutionPermalink: "https://github.com/org/repo/blob/main/solution.ts",
      solutionPathKey: "a".repeat(64),
      solutionContentKey: "b".repeat(64),
    },
    ...overrides,
  };
}

function fixtureDetail(overrides: {
  users?: ProblemDetailUser[];
  solvers?: ProblemSolver[];
} = {}): ProblemSolutionDetail {
  return {
    problem: {
      provider: "leetcode",
      problemId: "1",
      problemKey: "leetcode:1",
      title: "Two Sum",
      difficulty: "Easy",
      sourceUrl: "https://leetcode.com/problems/two-sum/",
    },
    users: overrides.users ?? [
      fixtureUser(),
      fixtureUser({ id: "bob", displayName: "Bob", githubUsername: "bob" }),
      fixtureUser({ id: "charlie", displayName: "Charlie", githubUsername: "charlie", active: false }),
    ],
    solvers: overrides.solvers ?? [fixtureSolver()],
  };
}

// ── Raw source fixture helpers ──────────────────────────────────────────────

function sha256Hex(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function textResponse(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }
  return new Response(body, { ...init, headers });
}

function abortableFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  return (url: string, init: RequestInit | undefined) =>
    new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
      Promise.resolve(handler(url, init)).then(resolve, reject);
    });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// ── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllGlobals();
  resetSourceCache();
});

// ═════════════════════════════════════════════════════════════════════════════
// resolveSelection
// ═════════════════════════════════════════════════════════════════════════════

describe("resolveSelection", () => {
  it("returns first solver for null query when solvers exist", () => {
    const detail = fixtureDetail({
      solvers: [
        fixtureSolver({ user: fixtureUser({ id: "alice", displayName: "Alice" }) }),
      ],
    });
    const outcome = resolveSelection(null, detail);
    expect(outcome.kind).toBe("selected-solver");
    if (outcome.kind === "selected-solver") {
      expect(outcome.solver.user.id).toBe("alice");
    }
  });

  it("auto-selects the first solver when query is absent", () => {
    const firstSolver = fixtureSolver({
      user: fixtureUser({ id: "charlie", displayName: "Charlie" }),
    });
    const detail = fixtureDetail({
      users: [
        fixtureUser({ id: "charlie" }),
        fixtureUser({ id: "alice" }),
      ],
      solvers: [
        firstSolver,
        fixtureSolver({ user: fixtureUser({ id: "alice", displayName: "Alice" }) }),
      ],
    });
    const outcome = resolveSelection(null, detail);
    expect(outcome.kind).toBe("selected-solver");
    if (outcome.kind === "selected-solver") {
      expect(outcome.solver.user.id).toBe("charlie");
    }
  });

  it("returns no-query for null query when no solvers exist (theoretical guard)", () => {
    const detail = fixtureDetail({
      users: [],
      solvers: [],
    });
    const outcome = resolveSelection(null, detail);
    expect(outcome).toEqual({ kind: "no-query" });
  });

  it("returns unknown-user for empty string query (explicit invalid, not absent)", () => {
    const detail = fixtureDetail();
    const outcome = resolveSelection("", detail);
    expect(outcome).toEqual({ kind: "unknown-user", rawQuery: "" });
  });

  it("empty string does not silently select a solver even when solvers exist", () => {
    const detail = fixtureDetail({
      solvers: [
        fixtureSolver({ user: fixtureUser({ id: "alice", displayName: "Alice" }) }),
        fixtureSolver({ user: fixtureUser({ id: "bob", displayName: "Bob" }) }),
      ],
    });
    const outcome = resolveSelection("", detail);
    expect(outcome.kind).toBe("unknown-user");
    expect(outcome).not.toHaveProperty("solver");
  });

  it("returns selected-solver for a valid solver user ID", () => {
    const detail = fixtureDetail();
    const outcome = resolveSelection("alice", detail);
    expect(outcome.kind).toBe("selected-solver");
    if (outcome.kind === "selected-solver") {
      expect(outcome.solver.user.id).toBe("alice");
    }
  });

  it("returns selected-unsolved for a registered user who has not solved", () => {
    const detail = fixtureDetail({
      users: [
        fixtureUser(),
        fixtureUser({ id: "bob", displayName: "Bob", githubUsername: "bob" }),
      ],
      solvers: [fixtureSolver()],
    });
    const outcome = resolveSelection("bob", detail);
    expect(outcome.kind).toBe("selected-unsolved");
    if (outcome.kind === "selected-unsolved") {
      expect(outcome.user.id).toBe("bob");
    }
  });

  it("does not silently default when a solver exists for a different user", () => {
    const detail = fixtureDetail({
      users: [
        fixtureUser({ id: "bob", displayName: "Bob", githubUsername: "bob" }),
      ],
      solvers: [fixtureSolver({ user: fixtureUser({ id: "alice", displayName: "Alice" }) })],
    });
    const outcome = resolveSelection("bob", detail);
    expect(outcome.kind).toBe("selected-unsolved");
    if (outcome.kind === "selected-unsolved") {
      expect(outcome.user.id).toBe("bob");
    }
  });

  it("returns unknown-user for a query that does not match any registered user", () => {
    const detail = fixtureDetail();
    const outcome = resolveSelection("nonexistent", detail);
    expect(outcome).toEqual({ kind: "unknown-user", rawQuery: "nonexistent" });
  });

  it("never returns selected-solver for a non-solver user", () => {
    const detail = fixtureDetail({
      users: [
        fixtureUser(),
        fixtureUser({ id: "charlie", displayName: "Charlie", githubUsername: "charlie" }),
      ],
      solvers: [fixtureSolver()],
    });
    const outcome = resolveSelection("charlie", detail);
    expect(outcome.kind).not.toBe("selected-solver");
  });

  it("preserves the raw unknown query for callers to display", () => {
    const detail = fixtureDetail();
    const outcome = resolveSelection("  ghost-user  ", detail);
    expect(outcome).toEqual({ kind: "unknown-user", rawQuery: "  ghost-user  " });
  });

  it("exhaustively covers all outcome branches including default-first-solver and empty-as-unknown", () => {
    function exhaustive(outcome: SelectionOutcome): string {
      switch (outcome.kind) {
        case "no-query":
          return "no-query";
        case "selected-solver":
          return `solver:${outcome.solver.user.id}`;
        case "selected-unsolved":
          return `unsolved:${outcome.user.id}`;
        case "unknown-user":
          return `unknown:${outcome.rawQuery}`;
      }
    }
    const detail = fixtureDetail({
      users: [
        fixtureUser(),
        fixtureUser({ id: "bob", displayName: "Bob", githubUsername: "bob" }),
      ],
      solvers: [fixtureSolver()],
    });
    expect(exhaustive(resolveSelection(null, detail))).toBe("solver:alice");
    expect(exhaustive(resolveSelection("", detail))).toBe("unknown:");
    expect(exhaustive(resolveSelection("alice", detail))).toBe("solver:alice");
    expect(exhaustive(resolveSelection("bob", detail))).toBe("unsolved:bob");
    expect(exhaustive(resolveSelection("ghost", detail))).toBe("unknown:ghost");

    // Empty solver list: null → no-query
    const emptyDetail = fixtureDetail({ users: [], solvers: [] });
    expect(exhaustive(resolveSelection(null, emptyDetail))).toBe("no-query");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// mapRawResultToViewerState
// ═════════════════════════════════════════════════════════════════════════════

describe("mapRawResultToViewerState", () => {
  it("maps ok with text to loaded", () => {
    const result: RawLoadResult = {
      status: "ok",
      text: "function foo() {}",
      contentKey: "a".repeat(64) as never,
    };
    const state = mapRawResultToViewerState(result);
    expect(state).toEqual({ status: "loaded", text: "function foo() {}" });
  });

  it("maps ok with empty text to empty", () => {
    const result: RawLoadResult = {
      status: "ok",
      text: "",
      contentKey: "a".repeat(64) as never,
    };
    const state = mapRawResultToViewerState(result);
    expect(state).toEqual({ status: "empty" });
  });

  it("maps not-found to not-found", () => {
    const result: RawLoadResult = { status: "not-found" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "not-found" });
  });

  it("maps unsupported-type to error", () => {
    const result: RawLoadResult = { status: "unsupported-type" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "error" });
  });

  it("maps network-error to error", () => {
    const result: RawLoadResult = { status: "network-error" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "error" });
  });

  it("maps oversize to oversize", () => {
    const result: RawLoadResult = { status: "oversize" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "oversize" });
  });

  it("maps mismatch to mismatch", () => {
    const result: RawLoadResult = { status: "mismatch" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "mismatch" });
  });

  it("maps invalid-utf8 to invalid-utf8", () => {
    const result: RawLoadResult = { status: "invalid-utf8" };
    expect(mapRawResultToViewerState(result)).toEqual({ status: "invalid-utf8" });
  });

  it("throws on aborted (callers must guard before mapping)", () => {
    const result: RawLoadResult = { status: "aborted" };
    expect(() => mapRawResultToViewerState(result)).toThrow(
      "aborted must not be mapped to a view",
    );
  });

  it("exhaustively maps every non-aborted RawLoadResult status", () => {
    function exhaustive(result: RawLoadResult): string {
      switch (result.status) {
        case "ok":
          return result.text.length === 0 ? "empty" : "loaded";
        case "not-found":
          return "not-found";
        case "unsupported-type":
          return "error";
        case "network-error":
          return "error";
        case "oversize":
          return "oversize";
        case "mismatch":
          return "mismatch";
        case "invalid-utf8":
          return "invalid-utf8";
        case "aborted":
          throw new Error("caller must guard aborted");
      }
    }

    const okWithText: RawLoadResult = { status: "ok", text: "x", contentKey: "a".repeat(64) as never };
    const okEmpty: RawLoadResult = { status: "ok", text: "", contentKey: "a".repeat(64) as never };

    expect(exhaustive(okWithText)).toBe("loaded");
    expect(exhaustive(okEmpty)).toBe("empty");
    expect(exhaustive({ status: "not-found" })).toBe("not-found");
    expect(exhaustive({ status: "unsupported-type" })).toBe("error");
    expect(exhaustive({ status: "network-error" })).toBe("error");
    expect(exhaustive({ status: "oversize" })).toBe("oversize");
    expect(exhaustive({ status: "mismatch" })).toBe("mismatch");
    expect(exhaustive({ status: "invalid-utf8" })).toBe("invalid-utf8");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Source-loader lifecycle: abort + stale suppression
// ═════════════════════════════════════════════════════════════════════════════

describe("source loader abort and stale suppression", () => {
  const sourceUrl = "https://raw.githubusercontent.com/org/repo/main/sol.ts";
  const sourceText = "function solve() { return 42; }";
  const contentKey = sha256Hex(sourceText);

  function mockFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(handler(url, init));
    }));
  }

  it("aborts prior request on new selection", async () => {
    const blockGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) return blockGate.promise;
      return textResponse(sourceText);
    }));

    const ctrl1 = new AbortController();
    const pending1 = loadRawSource({ url: sourceUrl, expectedContentKey: contentKey, signal: ctrl1.signal });
    ctrl1.abort();

    const ctrl2 = new AbortController();
    const pending2 = loadRawSource({ url: sourceUrl, expectedContentKey: contentKey, signal: ctrl2.signal });

    const [result1, result2] = await Promise.all([pending1, pending2]);
    expect(result1.status).toBe("aborted");
    expect(result2.status).toBe("ok");

    blockGate.resolve(new Response("late", { status: 200 }));
  });

  it("ignores stale promise that resolves after new selection completes", async () => {
    const oldGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) return oldGate.promise;
      return textResponse(sourceText);
    }));

    const ctrl1 = new AbortController();
    const pending1 = loadRawSource({ url: sourceUrl, expectedContentKey: contentKey, signal: ctrl1.signal });
    ctrl1.abort();

    const ctrl2 = new AbortController();
    const pending2 = loadRawSource({ url: sourceUrl, expectedContentKey: contentKey, signal: ctrl2.signal });

    const result2 = await pending2;
    expect(result2.status).toBe("ok");

    oldGate.resolve(textResponse("stale body"));
    const result1 = await pending1;
    expect(result1.status).toBe("aborted");
  });

  it("rejects mocks that ignore abort", async () => {
    mockFetch(abortableFetch(() => textResponse(sourceText)));

    const ctrl = new AbortController();
    ctrl.abort();

    const result = await loadRawSource({
      url: sourceUrl,
      expectedContentKey: contentKey,
      signal: ctrl.signal,
    });
    expect(result.status).toBe("aborted");
  });

  it("resolves to ok for a valid fetch", async () => {
    mockFetch(() => textResponse(sourceText));

    const result = await loadRawSource({
      url: sourceUrl,
      expectedContentKey: contentKey,
    });
    expect(result.status).toBe("ok");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Review URL / basePath integration contract
// ═════════════════════════════════════════════════════════════════════════════

describe("review URL basePath contract", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  const pathKey = "a".repeat(64);
  const contentKey = "b".repeat(64);

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
  });

  it("uses NEXT_PUBLIC_BASE_PATH in review URLs when configured", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/leetdash";
    const indexUrl = getReviewIndexUrl();
    expect(indexUrl).toBe("/leetdash/generated/reviews/index.json");

    const artifactUrl = getReviewArtifactUrl(pathKey, contentKey);
    expect(artifactUrl).toBe(`/leetdash/generated/reviews/${pathKey}/${contentKey}.json`);
  });

  it("never produces root /generated when NEXT_PUBLIC_BASE_PATH is /leetdash", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/leetdash";
    const indexUrl = getReviewIndexUrl();
    expect(indexUrl).not.toMatch(/^\/generated/);
  });

  it("does not double-prefix basePath", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/leetdash";
    // getReviewIndexUrl is called without an explicit basePath argument,
    // relying on the env default — same as the explorer's SolutionReviewPanel.
    const indexUrl = getReviewIndexUrl();
    // Must NOT produce /leetdash/leetdash/...
    expect(indexUrl).not.toMatch(/\/leetdash\/leetdash/);
  });

  it("returns root-generated URLs when NEXT_PUBLIC_BASE_PATH is unset", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const indexUrl = getReviewIndexUrl();
    expect(indexUrl).toBe("/generated/reviews/index.json");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Helper: isAbortError (verified in solution-review-panel test; sanity check)
// ═════════════════════════════════════════════════════════════════════════════

describe("isAbortError", () => {
  it("recognizes DOMException AbortError", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  });

  it("rejects generic Error", () => {
    expect(isAbortError(new Error("something"))).toBe(false);
  });
});
