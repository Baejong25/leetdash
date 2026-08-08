// Bounded lazy raw source loader — pure client infrastructure.
//
// Fetches solution source at commit-pinned raw.githubusercontent.com URLs on
// explicit caller request (never at import), enforces status/content-type
// checks, a Content-Length precheck plus a post-read 256 KiB byte cap,
// Web Crypto SHA-256 verification of the exact fetched UTF-8 bytes against
// the metadata `solutionContentKey`, and a 20-entry FIFO memory cache of
// verified content only. Failures and mismatches are never cached.
//
// Concurrent identical requests share one fetch. An individual caller abort
// never aborts the shared request while another caller still waits; the
// shared fetch is aborted only once the last caller gives up.
//
// Raw requests use `credentials: "omit"` and no headers; no Authorization
// header is ever attached, and no token is exposed.

import { assertHex64, isAbortError, type Hex64 } from "@/lib/solution-assets";

export type RawLoadResult =
  | { status: "ok"; text: string; contentKey: Hex64 }
  | { status: "not-found" }
  | { status: "unsupported-type" }
  | { status: "oversize" }
  | { status: "mismatch" }
  | { status: "invalid-utf8" }
  | { status: "aborted" }
  | { status: "network-error" };

export type RawSourceRequest = {
  url: string;
  expectedContentKey: string;
  signal?: AbortSignal;
};

export const MAX_SOURCE_BYTES = 256 * 1024;
export const SOURCE_CACHE_LIMIT = 20;

const textPlainPattern = /^text\/plain(?:;|$)/i;

type CachedSource = { text: string; contentKey: Hex64 };

type InflightSource = {
  promise: Promise<RawLoadResult>;
  callers: Set<AbortSignal>;
  controller: AbortController;
};

const sourceCache = new Map<string, CachedSource>();
const inflightSources = new Map<string, InflightSource>();

export function resetSourceCache() {
  sourceCache.clear();
  for (const entry of inflightSources.values()) {
    entry.controller.abort();
  }
  inflightSources.clear();
}

function cacheKey(url: string, contentKey: string) {
  return `${url}#${contentKey}`;
}

function verifySha256(bytes: Uint8Array<ArrayBuffer>, expected: Hex64) {
  return crypto.subtle.digest("SHA-256", bytes).then((digest) => {
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return hex === expected;
  });
}

/** Reads at most maxBytes bytes; a larger body returns oversize without buffering it. */
async function readBodyBounded(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array<ArrayBuffer> } | { oversize: true }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    return buffer.byteLength > maxBytes ? { oversize: true } : { bytes: new Uint8Array(buffer) };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { oversize: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

async function fetchAndVerify(request: RawSourceRequest, controller: AbortController, key: string) {
  let response: Response;
  try {
    response = await fetch(request.url, { credentials: "omit", signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "aborted" } as const;
    }
    return { status: "network-error" } as const;
  }

  if (response.status === 404) {
    return { status: "not-found" } as const;
  }
  if (!response.ok) {
    return { status: "network-error" } as const;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!textPlainPattern.test(contentType.trim())) {
    return { status: "unsupported-type" } as const;
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    return { status: "oversize" } as const;
  }

  const read = await readBodyBounded(response, MAX_SOURCE_BYTES);
  if ("oversize" in read) {
    return { status: "oversize" } as const;
  }

  const expected = assertHex64(request.expectedContentKey, "expectedContentKey");
  const matches = await verifySha256(read.bytes, expected);
  if (!matches) {
    return { status: "mismatch" } as const;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(read.bytes);
  } catch {
    return { status: "invalid-utf8" } as const;
  }

  sourceCache.set(key, { text, contentKey: expected });
  if (sourceCache.size > SOURCE_CACHE_LIMIT) {
    const oldest = sourceCache.keys().next().value;
    if (oldest !== undefined) {
      sourceCache.delete(oldest);
    }
  }
  return { status: "ok", text, contentKey: expected } as const;
}

function attachCaller(key: string, entry: InflightSource, signal?: AbortSignal) {
  if (signal) {
    entry.callers.add(signal);
  }

  return new Promise<RawLoadResult>((resolve) => {
    let finished = false;
    const finish = (result: RawLoadResult) => {
      if (finished) {
        return;
      }
      finished = true;
      if (signal) {
        entry.callers.delete(signal);
      }
      if (inflightSources.get(key) === entry && entry.callers.size === 0) {
        entry.controller.abort();
        inflightSources.delete(key);
      }
      resolve(result);
    };

    entry.promise.then((result) => finish(result));

    if (signal) {
      if (signal.aborted) {
        finish({ status: "aborted" });
        return;
      }
      signal.addEventListener("abort", () => finish({ status: "aborted" }), { once: true });
    }
  });
}

export async function loadRawSource(request: RawSourceRequest): Promise<RawLoadResult> {
  if (!/^[a-f0-9]{64}$/.test(request.expectedContentKey)) {
    throw new TypeError("expectedContentKey must be a lowercase 64-hex SHA-256 key");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    throw new TypeError("url must be an absolute https URL");
  }
  if (parsedUrl.protocol !== "https:") {
    throw new TypeError("url must be an absolute https URL");
  }
  if (request.signal?.aborted) {
    return { status: "aborted" };
  }

  const key = cacheKey(request.url, request.expectedContentKey);
  const cached = sourceCache.get(key);
  if (cached) {
    return { status: "ok", ...cached };
  }

  const existing = inflightSources.get(key);
  if (existing) {
    return attachCaller(key, existing, request.signal);
  }

  const controller = new AbortController();
  const entry: InflightSource = {
    promise: fetchAndVerify(request, controller, key).then((result) => {
      inflightSources.delete(key);
      return result;
    }),
    callers: new Set<AbortSignal>(),
    controller,
  };
  inflightSources.set(key, entry);
  return attachCaller(key, entry, request.signal);
}
