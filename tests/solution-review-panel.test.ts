import { describe, afterEach, expect, it, vi } from "vitest";
import { mapReviewToView, lineLabel, type ReviewPanelView } from "@/app/components/solution-review-panel";
import { loadReview, assertHex64, type ReviewLoadResult, type ReviewArtifact, type Hex64, isAbortError } from "@/lib/solution-assets";

// ── Helpers ─────────────────────────────────────────────────────────────────

function validHex64(char: string, length = 64): Hex64 {
  return assertHex64(char.repeat(length), "key");
}

const pathKey = validHex64("a");
const contentKey = validHex64("b");
const otherKey = validHex64("c");

const artifact: ReviewArtifact = {
  pathKey,
  contentKey,
  commentUrl: "https://github.com/whoisyourbias/leetdash/pull/126#issuecomment-5213445035",
  updatedAt: "2026-08-08T00:00:00.000Z",
  text: "good approach",
  lineReferences: [{ start: 15, end: 15 }],
};

const noCommentArtifact: ReviewArtifact = {
  ...artifact,
  text: null,
  lineReferences: [],
};

const completeIndex = {
  schemaVersion: 1,
  revision: "0123456789abcdef0123456789abcdef01234567",
  status: "complete" as const,
  keys: [{ pathKey, contentKey }],
  generatedAt: "2026-08-08T00:00:00.000Z",
  counts: { reviews: 1 },
};

function jsonResponse(body: unknown, status = 200) {
  const headers = new Headers({ "content-type": "application/json" });
  return new Response(JSON.stringify(body), { status, headers });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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

function mockFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(handler(url, init));
  }));
}

function validIndexResponse() {
  return jsonResponse(completeIndex);
}

function validArtifactResponse() {
  return jsonResponse(artifact);
}

// ── Lifecycle tracker — mirrors the component pattern without React ─────────

/** Extracted version of the component's fetch-ID + abort lifecycle. */
export function createReviewFetchTrack() {
  let generation = 0;
  let abortCurrent: (() => void) | null = null;

  return {
    getGeneration(): number {
      return generation;
    },

    /** Advance generation, abort prior controller. Called on every selection change and unmount. */
    advance(controller: AbortController | null): number {
      abortCurrent?.();
      abortCurrent = null;
      generation += 1;
      if (controller) {
        abortCurrent = () => controller.abort();
      }
      return generation;
    },

    isStale(gen: number): boolean {
      return generation !== gen;
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapReviewToView", () => {
  it("maps available to available view with artifact", () => {
    const result: ReviewLoadResult = { status: "available", artifact };
    expect(mapReviewToView(result)).toEqual({ kind: "available", artifact });
  });

  it("maps none to none view", () => {
    const result: ReviewLoadResult = { status: "none" };
    expect(mapReviewToView(result)).toEqual({ kind: "none" });
  });

  it("maps unavailable to unavailable view", () => {
    const result: ReviewLoadResult = { status: "unavailable" };
    expect(mapReviewToView(result)).toEqual({ kind: "unavailable" });
  });

  it("maps error to error view", () => {
    const result: ReviewLoadResult = { status: "error" };
    expect(mapReviewToView(result)).toEqual({ kind: "error" });
  });

  it("throws when mapping aborted (callers must guard)", () => {
    const result: ReviewLoadResult = { status: "aborted" };
    expect(() => mapReviewToView(result)).toThrow("must not be mapped to a view");
  });

  it("exhaustively covers all ReviewLoadResult variants", () => {
    function exhaustive(input: ReviewLoadResult): ReviewPanelView {
      switch (input.status) {
        case "available":
          return { kind: "available", artifact: input.artifact };
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
    expect(exhaustive({ status: "none" })).toEqual({ kind: "none" });
  });

  it("distinguishes available-with-text from available-null-text via artifact shape", () => {
    const withText: ReviewLoadResult = { status: "available", artifact };
    const withNull: ReviewLoadResult = { status: "available", artifact: noCommentArtifact };

    const viewWithText = mapReviewToView(withText);
    const viewWithNull = mapReviewToView(withNull);

    expect(viewWithText.kind).toBe("available");
    expect(viewWithNull.kind).toBe("available");

    if (viewWithText.kind === "available" && viewWithNull.kind === "available") {
      expect(viewWithText.artifact.text).toBe("good approach");
      expect(viewWithNull.artifact.text).toBeNull();
    }
  });

  it("distinguishes none from unavailable as distinct views", () => {
    expect(mapReviewToView({ status: "none" })).toEqual({ kind: "none" });
    expect(mapReviewToView({ status: "unavailable" })).toEqual({ kind: "unavailable" });
  });
});

describe("lineLabel", () => {
  it("generates single-line Korean label with exact plan wording", () => {
    expect(lineLabel({ start: 15, end: 15 })).toBe("코드 L15로 이동");
  });

  it("generates range Korean label with exact plan wording", () => {
    expect(lineLabel({ start: 10, end: 20 })).toBe("코드 L10–L20으로 이동");
  });

  it("handles line 1 correctly", () => {
    expect(lineLabel({ start: 1, end: 1 })).toBe("코드 L1로 이동");
    expect(lineLabel({ start: 1, end: 5 })).toBe("코드 L1–L5으로 이동");
  });
});

describe("review load lifecycle (abort + stale suppression)", () => {
  it("resolves to available for a single selection", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) return validIndexResponse();
      return validArtifactResponse();
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result.status).toBe("available");
  });

  it("aborts previous fetch when selection changes", async () => {
    const blockGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) {
        return blockGate.promise;
      }
      if (url.endsWith("/index.json")) {
        return jsonResponse({ ...completeIndex, keys: [{ pathKey, contentKey: otherKey }] });
      }
      return jsonResponse({ ...artifact, contentKey: otherKey });
    }));

    const ctrl1 = new AbortController();
    const pending1 = loadReview({ pathKey, contentKey, signal: ctrl1.signal });
    ctrl1.abort();

    const ctrl2 = new AbortController();
    const pending2 = loadReview({ pathKey, contentKey: otherKey, signal: ctrl2.signal });

    const [result1, result2] = await Promise.all([pending1, pending2]);
    expect(result1.status).toBe("aborted");
    expect(result2.status).toBe("available");
    if (result2.status === "available") {
      expect(result2.artifact.contentKey).toBe(otherKey);
    }

    blockGate.resolve(new Response("late", { status: 200 }));
  });

  it("ignores stale promise result when network resolves out of order", async () => {
    const oldGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) {
        return oldGate.promise;
      }
      if (url.endsWith("/index.json")) {
        return jsonResponse({ ...completeIndex, keys: [{ pathKey, contentKey: otherKey }] });
      }
      return jsonResponse({ ...artifact, contentKey: otherKey });
    }));

    const ctrl1 = new AbortController();
    const pending1 = loadReview({ pathKey, contentKey, signal: ctrl1.signal });
    ctrl1.abort();

    const ctrl2 = new AbortController();
    const pending2 = loadReview({ pathKey, contentKey: otherKey, signal: ctrl2.signal });

    const result2 = await pending2;
    expect(result2.status).toBe("available");

    oldGate.resolve(jsonResponse(completeIndex));

    const result1 = await pending1;
    expect(result1.status).toBe("aborted");
  });

  it("returns error when index request fails with network error", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result.status).toBe("error");
  });

  it("distinguishes unavailable (404 index) from none (no matching key)", async () => {
    mockFetch(() => new Response("not found", { status: 404 }));
    expect((await loadReview({ pathKey, contentKey })).status).toBe("unavailable");

    vi.unstubAllGlobals();
    mockFetch(() => validIndexResponse());
    expect((await loadReview({ pathKey, contentKey: otherKey })).status).toBe("none");
  });

  it("maps available with null text as available view (explicit no-comment)", () => {
    const result: ReviewLoadResult = { status: "available", artifact: noCommentArtifact };
    const view = mapReviewToView(result);
    expect(view.kind).toBe("available");
    if (view.kind === "available") {
      expect(view.artifact.text).toBeNull();
    }
  });
});

describe("fetch-ID lifecycle (component pattern, no React)", () => {
  it("advances generation on every selection change", () => {
    const track = createReviewFetchTrack();
    expect(track.getGeneration()).toBe(0);

    track.advance(new AbortController());
    expect(track.getGeneration()).toBe(1);

    track.advance(new AbortController());
    expect(track.getGeneration()).toBe(2);
  });

  it("advances generation on null selection (prevents late promise from overwriting idle)", () => {
    const track = createReviewFetchTrack();

    const gen1 = track.advance(new AbortController());
    expect(track.getGeneration()).toBe(1);

    const gen2 = track.advance(null);
    expect(track.getGeneration()).toBe(2);

    expect(track.isStale(gen1)).toBe(true);
    expect(track.isStale(gen2)).toBe(false);
  });

  it("advances generation on unmount (prevents late promise after unmount)", () => {
    const track = createReviewFetchTrack();

    const gen1 = track.advance(new AbortController());
    expect(track.isStale(gen1)).toBe(false);

    track.advance(null);
    expect(track.getGeneration()).toBe(2);
    expect(track.isStale(gen1)).toBe(true);
  });

  it("late promise after null selection cannot pass staleness check", async () => {
    const track = createReviewFetchTrack();

    const blockGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) {
        return blockGate.promise;
      }
      return jsonResponse(completeIndex);
    }));

    const ctrl1 = new AbortController();
    const gen1 = track.advance(ctrl1);
    const pending1 = loadReview({ pathKey, contentKey, signal: ctrl1.signal });

    track.advance(null);

    blockGate.resolve(jsonResponse(completeIndex));
    await pending1;

    expect(track.isStale(gen1)).toBe(true);
  });

  it("late promise after unmount-like advance cannot pass staleness check", async () => {
    const track = createReviewFetchTrack();

    const blockGate = deferred<Response>();
    let callCount = 0;

    mockFetch(abortableFetch((url) => {
      callCount += 1;
      if (callCount === 1) {
        return blockGate.promise;
      }
      return jsonResponse(completeIndex);
    }));

    const ctrl1 = new AbortController();
    const gen1 = track.advance(ctrl1);
    const pending1 = loadReview({ pathKey, contentKey, signal: ctrl1.signal });

    track.advance(null);

    expect(track.isStale(gen1)).toBe(true);

    blockGate.resolve(jsonResponse(completeIndex));
    await pending1;
    expect(track.isStale(gen1)).toBe(true);
  });
});

describe("isAbortError", () => {
  it("recognizes DOMException AbortError", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  });

  it("rejects TypeError", () => {
    expect(isAbortError(new TypeError("network down"))).toBe(false);
  });

  it("rejects null", () => {
    expect(isAbortError(null)).toBe(false);
  });
});
