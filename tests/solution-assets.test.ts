import { describe, afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  getReviewArtifactUrl,
  getReviewIndexUrl,
  loadReview,
  type ReviewLoadResult,
} from "@/lib/solution-assets";
import {
  loadRawSource,
  resetSourceCache,
  type RawLoadResult,
} from "@/lib/raw-source-loader";

const MAX_BYTES = 256 * 1024;

function sha256Hex(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function validKey(text: string) {
  return sha256Hex(text);
}

function textResponse(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }
  return new Response(body, { ...init, headers });
}

function streamResponse(chunks: Uint8Array[], init: ResponseInit = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
    init,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type FetchCall = { url: string; init: RequestInit | undefined };

function mockFetch(handler: (url: string, init: RequestInit | undefined) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return Promise.resolve(handler(url, init));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function expectNoAuthorization(calls: FetchCall[]) {
  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    expect(headers.get("Authorization"), `request to ${call.url} must not carry Authorization`).toBeNull();
  }
}

function expectRawOk(result: RawLoadResult, text: string, contentKey: string) {
  expect(result).toEqual({ status: "ok", text, contentKey });
}

const javaSource = `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] { seen.get(complement), i };
            }
            seen.put(nums[i], i);
        }
        throw new IllegalArgumentException("no two-sum solution");
    }
}
`;

const rawUrl = "https://raw.githubusercontent.com/whoisyourbias/leetdash/0123456789abcdef0123456789abcdef01234567/submissions/ada/programmers/120583/Solution.java";
const rawKey = validKey(javaSource);

const pathKey = "a".repeat(64);
const contentKey = "b".repeat(64);
const completeIndex = {
  schemaVersion: 1,
  revision: "0123456789abcdef0123456789abcdef01234567",
  status: "complete",
  keys: [{ pathKey, contentKey }],
  generatedAt: "2026-08-08T00:00:00.000Z",
  counts: { reviews: 1 },
};
const artifactJson = {
  pathKey,
  contentKey,
  commentUrl: "https://github.com/whoisyourbias/leetdash/pull/126#issuecomment-5213445035",
  updatedAt: "2026-08-08T00:00:00.000Z",
  text: "리뷰 코멘트 없음.",
  lineReferences: [{ start: 15, end: 15 }, { start: 19, end: 19 }],
};

/** Mock that honors abort signals the way real fetch does (rejects with AbortError). */
function abortableFetch(handler: (url: string, init: RequestInit | undefined) => Promise<Response> | Response) {
  return (url: string, init: RequestInit | undefined) =>
    new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("The operation was aborted.", "AbortError")),
        { once: true },
      );
      Promise.resolve(handler(url, init)).then(resolve, reject);
    });
}

function waitFor(fn: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (fn()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("waitFor timed out"));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

beforeEach(() => {
  resetSourceCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("basePath-aware review asset URL helpers", () => {
  it("builds index and artifact URLs without a basePath", () => {
    expect(getReviewIndexUrl("")).toBe("/generated/reviews/index.json");
    expect(getReviewArtifactUrl(pathKey, contentKey, "")).toBe(
      `/generated/reviews/${pathKey}/${contentKey}.json`,
    );
  });

  it("prefixes URLs under a configured basePath", () => {
    expect(getReviewIndexUrl("/leetdash")).toBe("/leetdash/generated/reviews/index.json");
    expect(getReviewArtifactUrl(pathKey, contentKey, "/leetdash")).toBe(
      `/leetdash/generated/reviews/${pathKey}/${contentKey}.json`,
    );
  });

  it("normalizes trailing slashes in the basePath", () => {
    expect(getReviewIndexUrl("/leetdash/")).toBe("/leetdash/generated/reviews/index.json");
    expect(getReviewArtifactUrl(pathKey, contentKey, "/leetdash///")).toBe(
      `/leetdash/generated/reviews/${pathKey}/${contentKey}.json`,
    );
  });

  it("treats a root basePath as absent", () => {
    expect(getReviewIndexUrl("/")).toBe("/generated/reviews/index.json");
    expect(getReviewArtifactUrl(pathKey, contentKey, "/")).toBe(
      `/generated/reviews/${pathKey}/${contentKey}.json`,
    );
  });

  it("rejects malformed path/content keys in the artifact URL builder", () => {
    expect(() => getReviewArtifactUrl("short", contentKey, "")).toThrow(TypeError);
    expect(() => getReviewArtifactUrl(pathKey, "not-hex!", "")).toThrow(TypeError);
    expect(() => getReviewArtifactUrl("Z".repeat(64), contentKey, "")).toThrow(TypeError);
  });
});

describe("lazy raw source loader", () => {
  it("performs no network request at import or before an explicit call", () => {
    const calls = mockFetch(() => textResponse(javaSource));
    expect(calls).toHaveLength(0);
  });

  it("returns verified content for a matching raw response", async () => {
    const calls = mockFetch(() => textResponse(javaSource));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expectRawOk(result, javaSource, rawKey);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.credentials).toBe("omit");
    expectNoAuthorization(calls);
  });

  it("deduplicates concurrent identical requests into one network call", async () => {
    const gate = deferred<void>();
    const calls = mockFetch(() => {
      return gate.promise.then(() => textResponse(javaSource));
    });

    const first = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    const second = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    gate.resolve();

    expectRawOk(await first, javaSource, rawKey);
    expectRawOk(await second, javaSource, rawKey);
    expect(calls).toHaveLength(1);
  });

  it("serves a cache hit with no additional network request", async () => {
    const calls = mockFetch(() => textResponse(javaSource));
    await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    const second = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expectRawOk(second, javaSource, rawKey);
    expect(calls).toHaveLength(1);
  });

  it("evicts the oldest cache entry once the 20-entry FIFO limit is exceeded", async () => {
    const bodies = Array.from({ length: 21 }, (_, index) => `// solution ${index}\nclass S${index} {}`);
    const calls = mockFetch((url) => {
      const index = Number(url.match(/fixture-(\d+)/)?.[1]);
      return textResponse(bodies[index] ?? "");
    });

    const urls = bodies.map((_, index) => `https://raw.githubusercontent.com/x/y/0123456789abcdef0123456789abcdef01234567/submissions/fixture-${index}/Solution.java`);
    const keys = bodies.map((body) => validKey(body));

    for (let index = 0; index < 21; index += 1) {
      await loadRawSource({ url: urls[index] ?? "", expectedContentKey: keys[index] ?? "" });
    }

    expect(calls).toHaveLength(21);

    // The newest entry is still cached; the oldest was evicted.
    const newest = await loadRawSource({ url: urls[20] ?? "", expectedContentKey: keys[20] ?? "" });
    expectRawOk(newest, bodies[20] ?? "", keys[20] ?? "");
    expect(calls).toHaveLength(21);

    const oldest = await loadRawSource({ url: urls[0] ?? "", expectedContentKey: keys[0] ?? "" });
    expectRawOk(oldest, bodies[0] ?? "", keys[0] ?? "");
    expect(calls).toHaveLength(22);
  });

  it("returns not-found for a 404 response", async () => {
    const calls = mockFetch(() => new Response("nope", { status: 404, headers: { "content-type": "text/plain" } }));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "not-found" });
    expect(calls).toHaveLength(1);
  });

  it("returns network-error for non-404 HTTP failures", async () => {
    mockFetch(() => new Response("rate limited", { status: 403, headers: { "content-type": "text/plain" } }));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "network-error" });
  });

  it("rejects non-text content types", async () => {
    mockFetch(() => new Response("binary", { status: 200, headers: { "content-type": "application/octet-stream" } }));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "unsupported-type" });
  });

  it("rejects a missing content type", async () => {
    const encoder = new TextEncoder();
    mockFetch(() =>
      streamResponse([encoder.encode("plain")], { status: 200 }),
    );
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "unsupported-type" });
  });

  it("rejects oversize responses via the Content-Length precheck without reading the body", async () => {
    let captured: Response | undefined;
    mockFetch(() => {
      captured = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("tiny"));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/plain", "content-length": String(MAX_BYTES + 1) } },
      );
      return captured;
    });
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "oversize" });
    expect(captured?.body?.locked).toBe(false);
  });

  it("rejects a body that exceeds the cap when no Content-Length header exists", async () => {
    const chunk = new Uint8Array(64 * 1024).fill(97);
    mockFetch(() => streamResponse([chunk, chunk, chunk, chunk, chunk], { status: 200, headers: { "content-type": "text/plain" } }));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "oversize" });
  });

  it("accepts a body exactly at the cap boundary", async () => {
    const exact = "x".repeat(MAX_BYTES);
    mockFetch(() => textResponse(exact));
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: validKey(exact) });
    expect(result.status).toBe("ok");
  });

  it("rejects a SHA-256 mismatch and never caches it", async () => {
    const calls = mockFetch(() => textResponse(javaSource));
    const wrongKey = "c".repeat(64);
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: wrongKey });
    expect(result).toEqual({ status: "mismatch" });

    // Cache must be empty for this key: the next identical call re-fetches.
    const retry = await loadRawSource({ url: rawUrl, expectedContentKey: wrongKey });
    expect(retry).toEqual({ status: "mismatch" });
    expect(calls).toHaveLength(2);
  });

  it("rejects bytes that are not valid UTF-8", async () => {
    mockFetch(() => {
      return new Response(new Uint8Array([0xc3, 0x28]), {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    });
    const key = createHash("sha256").update(Buffer.from([0xc3, 0x28])).digest("hex");
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: key });
    expect(result).toEqual({ status: "invalid-utf8" });
  });

  it("throws TypeError for a malformed URL or malformed expected key", async () => {
    await expect(loadRawSource({ url: "not a url", expectedContentKey: rawKey })).rejects.toThrow(TypeError);
    await expect(loadRawSource({ url: "http://insecure.example/x", expectedContentKey: rawKey })).rejects.toThrow(TypeError);
    await expect(loadRawSource({ url: rawUrl, expectedContentKey: "short" })).rejects.toThrow(TypeError);
    await expect(loadRawSource({ url: rawUrl, expectedContentKey: "G".repeat(64) })).rejects.toThrow(TypeError);
  });

  it("returns aborted for a caller whose signal is already aborted", async () => {
    const calls = mockFetch(() => textResponse(javaSource));
    const controller = new AbortController();
    controller.abort();
    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: controller.signal });
    expect(result).toEqual({ status: "aborted" });
    expect(calls).toHaveLength(0);
  });

  it("aborts the in-flight fetch when a sole caller aborts", async () => {
    const gate = deferred<void>();
    const signals: AbortSignal[] = [];
    mockFetch((_url, init) => {
      signals.push(init?.signal as AbortSignal);
      return gate.promise.then(() => textResponse(javaSource));
    });

    const controller = new AbortController();
    const pending = loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: controller.signal });
    controller.abort();

    expect(await pending).toEqual({ status: "aborted" });
    await waitFor(() => signals[0]?.aborted === true);
  });

  it("does not corrupt a shared request when one of two callers aborts", async () => {
    const gate = deferred<void>();
    const calls = mockFetch(() => gate.promise.then(() => textResponse(javaSource)));

    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: firstController.signal });
    const second = loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: secondController.signal });

    firstController.abort();
    expect(await first).toEqual({ status: "aborted" });
    gate.resolve();

    expectRawOk(await second, javaSource, rawKey);
    expect(calls).toHaveLength(1);
    expectNoAuthorization(calls);
  });

  it("starts a fresh request after an aborted one (stale-request isolation)", async () => {
    const gate = deferred<void>();
    const calls = mockFetch(abortableFetch(() => gate.promise.then(() => textResponse(javaSource))));

    const firstController = new AbortController();
    const first = loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: firstController.signal });
    firstController.abort();
    expect(await first).toEqual({ status: "aborted" });

    gate.resolve();
    const fresh = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expectRawOk(fresh, javaSource, rawKey);
    expect(calls).toHaveLength(2);
  });

  it("repeated interruptions settle every caller with aborted", async () => {
    const gate = deferred<void>();
    const calls = mockFetch(() => gate.promise.then(() => textResponse(javaSource)));

    const controllers = Array.from({ length: 3 }, () => new AbortController());
    const pendings = controllers.map((controller) =>
      loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: controller.signal }),
    );
    for (const controller of controllers) {
      controller.abort();
    }
    gate.resolve();

    const results = await Promise.all(pendings);
    for (const result of results) {
      expect(result).toEqual({ status: "aborted" });
    }
    expect(calls).toHaveLength(1);
  });

  it("returns network-error when response body stream rejects mid-read and never caches it", async () => {
    const calls = mockFetch(() =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("partial"));
            controller.error(new TypeError("network reset"));
          },
        }),
        { status: 200, headers: { "content-type": "text/plain" } },
      ),
    );

    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "network-error" });

    // Failure must not be cached; retry triggers a fresh request.
    const retry = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(retry).toEqual({ status: "network-error" });
    expect(calls).toHaveLength(2);
  });

  it("returns network-error when crypto.subtle.digest rejects and retry succeeds after restore", async () => {
    const calls = mockFetch(() => textResponse(javaSource));
    const original = globalThis.crypto;
    const mockDigest = vi.fn().mockRejectedValue(new DOMException("OperationError"));

    vi.stubGlobal("crypto", {
      subtle: { digest: mockDigest },
      getRandomValues: original.getRandomValues.bind(original),
    });

    const result = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expect(result).toEqual({ status: "network-error" });
    expect(calls).toHaveLength(1);

    // Restore real crypto; retry must produce a fresh network call and succeed.
    vi.stubGlobal("crypto", original);
    const retry = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expectRawOk(retry, javaSource, rawKey);
    expect(calls).toHaveLength(2);
  });

  it("settles all concurrent callers when the shared fetch rejects internally", async () => {
    const gate = deferred<void>();
    const calls = mockFetch(() =>
      gate.promise.then(
        () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("half"));
                controller.error(new TypeError("reset"));
              },
            }),
            { status: 200, headers: { "content-type": "text/plain" } },
          ),
      ),
    );

    const first = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    const second = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    const third = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    gate.resolve();

    const results = await Promise.all([first, second, third]);
    for (const result of results) {
      expect(result).toEqual({ status: "network-error" });
    }
    expect(calls).toHaveLength(1);
  });

  it("never deletes a newer inflight entry when a stale request settles late", async () => {
    const gen1Gate = deferred<void>();
    const gen2Gate = deferred<void>();
    let activeGen = 0;
    const calls = mockFetch(() => {
      activeGen += 1;
      if (activeGen === 1) {
        return gen1Gate.promise.then(() => textResponse("mismatched body"));
      }
      return gen2Gate.promise.then(() => textResponse(javaSource));
    });

    // Gen 1: aborted by caller. finish() deletes inflight entry and calls
    // controller.abort(), but the plain mock ignores the signal.
    // fetchAndVerify stays pending on gen1Gate.
    const gen1Controller = new AbortController();
    const gen1 = loadRawSource({ url: rawUrl, expectedContentKey: rawKey, signal: gen1Controller.signal });
    await waitFor(() => calls.length === 1);
    gen1Controller.abort();
    expect(await gen1).toEqual({ status: "aborted" });

    // Gen 2 fills gen1's slot. Still pending on gen2Gate.
    const gen2 = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    await waitFor(() => calls.length === 2);

    // Make crypto.subtle.digest resolve synchronously via microtask so the
    // entire fetchAndVerify → verifySha256 → .finally chain drains
    // deterministically within microtask processing.
    const original = globalThis.crypto;
    const sha256 = createHash("sha256");
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn((_algo, bytes) => {
          const h = sha256.copy().update(new Uint8Array(bytes as ArrayBuffer)).digest();
          return Promise.resolve(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength));
        }),
      },
      getRandomValues: original.getRandomValues.bind(original),
    });

    // Resolve gen1's gate: gen1's fetchAndVerify proceeds through
    // SHA-256 verification, returns mismatch, and its .finally runs.
    // Without the identity guard, .finally deletes gen2's inflight entry.
    gen1Gate.resolve();
    // Yield so all nested microtasks (including .finally) are drained.
    await new Promise<void>((r) => setTimeout(r, 0));

    // Restore real crypto for gen2.
    vi.stubGlobal("crypto", original);

    // Gen 3 starts while gen2 is still pending on gen2Gate.
    // With the identity guard: gen2's inflight entry survived gen1's
    // .finally, so gen3 deduplicates onto gen2.
    // Without the guard: gen1's .finally deleted gen2's entry, forcing
    // gen3 to create a redundant third fetch.
    const gen3 = loadRawSource({ url: rawUrl, expectedContentKey: rawKey });

    gen2Gate.resolve();
    const [r2, r3] = await Promise.all([gen2, gen3]);
    expectRawOk(r2, javaSource, rawKey);
    expectRawOk(r3, javaSource, rawKey);
    expect(calls).toHaveLength(2);

    // Cache populated: a fourth caller hits the cache.
    const gen4 = await loadRawSource({ url: rawUrl, expectedContentKey: rawKey });
    expectRawOk(gen4, javaSource, rawKey);
    expect(calls).toHaveLength(2);
  });
});

describe("lazy review loader", () => {
  it("fetches nothing before a review is requested", () => {
    const calls = mockFetch(() => new Response("{}"));
    expect(calls).toHaveLength(0);
  });

  it("returns available when the index lists the composite and the artifact parses", async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith("/generated/reviews/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return textResponse(JSON.stringify(artifactJson), { headers: { "content-type": "application/json" } });
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.artifact).toEqual(artifactJson);
    }
    expect(calls).toHaveLength(2);
    expectNoAuthorization(calls);
  });

  it("keeps an explicit no-comment artifact as available with null text", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return textResponse(
        JSON.stringify({ ...artifactJson, text: null, lineReferences: [] }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.artifact.text).toBeNull();
    }
  });

  it("returns none when the index is complete but the composite key is missing", async () => {
    mockFetch(() => textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } }));
    const result = await loadReview({ pathKey, contentKey: "f".repeat(64) });
    expect(result).toEqual({ status: "none" });
  });

  it("returns unavailable for an unavailable index and never fetches an artifact", async () => {
    const calls = mockFetch(() =>
      textResponse(JSON.stringify({ ...completeIndex, status: "unavailable" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "unavailable" });
    expect(calls).toHaveLength(1);
  });

  it("returns unavailable when the index itself is missing (404)", async () => {
    const calls = mockFetch(() => new Response("not found", { status: 404 }));
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "unavailable" });
    expect(calls).toHaveLength(1);
  });

  it("returns error for a network failure on the index", async () => {
    mockFetch(() => {
      throw new TypeError("network down");
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error for malformed index JSON", async () => {
    mockFetch(() => textResponse("not json at all", { headers: { "content-type": "application/json" } }));
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when the index status is neither complete nor unavailable", async () => {
    mockFetch(() =>
      textResponse(JSON.stringify({ ...completeIndex, status: "exploded" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when a complete index carries malformed keys entries", async () => {
    mockFetch(() =>
      textResponse(JSON.stringify({ ...completeIndex, keys: [{ pathKey: "not-a-key", contentKey }] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when a complete index omits the keys array", async () => {
    mockFetch(() => {
      const { keys: _keys, ...withoutKeys } = completeIndex;
      return textResponse(JSON.stringify(withoutKeys), { headers: { "content-type": "application/json" } });
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error for a malformed artifact even though the index claims availability", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return textResponse("{\"broken\":", { headers: { "content-type": "application/json" } });
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when the artifact is missing despite the index claiming availability", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error when artifact keys do not match the requested composite", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return textResponse(
        JSON.stringify({ ...artifactJson, contentKey: "e".repeat(64) }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("returns error for an artifact with invalid shape (bad line reference)", async () => {
    mockFetch((url) => {
      if (url.endsWith("/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      return textResponse(
        JSON.stringify({ ...artifactJson, lineReferences: [{ start: 0, end: 5 }] }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const result = await loadReview({ pathKey, contentKey });
    expect(result).toEqual({ status: "error" });
  });

  it("uses the configured basePath for index and artifact requests", async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith("/leetdash/generated/reviews/index.json")) {
        return textResponse(JSON.stringify(completeIndex), { headers: { "content-type": "application/json" } });
      }
      expect(url).toBe(`/leetdash/generated/reviews/${pathKey}/${contentKey}.json`);
      return textResponse(JSON.stringify(artifactJson), { headers: { "content-type": "application/json" } });
    });
    const result = await loadReview({ pathKey, contentKey, basePath: "/leetdash/" });
    expect(result.status).toBe("available");
    expect(calls).toHaveLength(2);
  });

  it("returns aborted when the caller aborts during the index fetch", async () => {
    const gate = deferred<Response>();
    mockFetch(abortableFetch(() => gate.promise));
    const controller = new AbortController();
    const pending = loadReview({ pathKey, contentKey, signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result).toEqual({ status: "aborted" });
    gate.resolve(new Response("late", { status: 200 }));
  });

  it("throws TypeError for malformed path/content keys", async () => {
    await expect(loadReview({ pathKey: "x", contentKey })).rejects.toThrow(TypeError);
    await expect(loadReview({ pathKey, contentKey: "" })).rejects.toThrow(TypeError);
  });
});

describe("review result type narrowing", () => {
  it("exhaustively narrows review results", () => {
    function label(result: ReviewLoadResult): string {
      switch (result.status) {
        case "available":
          return result.artifact.text ?? "";
        case "none":
          return "none";
        case "unavailable":
          return "unavailable";
        case "error":
          return "error";
        case "aborted":
          return "aborted";
      }
    }

    const result: ReviewLoadResult = { status: "none" };
    expect(label(result)).toBe("none");
    expect(label({ status: "aborted" })).toBe("aborted");
  });
});
