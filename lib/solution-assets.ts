// BasePath-aware lazy review-asset infrastructure — pure client code.
//
// Nothing here touches the network at import time; every request starts only
// when the caller explicitly invokes loadReview for a selected solution.
//
// Asset layout (written by scripts/sync-review-artifacts.mjs):
//   <basePath>/generated/reviews/index.json
//   <basePath>/generated/reviews/<pathKey>/<contentKey>.json
// index.json carries `status` ("complete" | "unavailable") and, for complete
// syncs, `keys` — the list of `{pathKey, contentKey}` pairs that have a
// matching artifact file. This module only reads `status` and `keys`; all
// other index fields (schemaVersion, revision, generatedAt, counts, reason)
// are ignored for forward compatibility.
//
// Review requests are same-origin and use the default safe credentials
// policy with no headers; no Authorization header is ever attached.

declare const hex64Brand: unique symbol;

export type Hex64 = string & { [hex64Brand]: true };

export type LineReference = {
  start: number;
  end: number;
};

export type ReviewArtifact = {
  pathKey: Hex64;
  contentKey: Hex64;
  commentUrl: string;
  updatedAt: string;
  /** Plain text for React text nodes only; null = explicit "리뷰 코멘트 없음." */
  text: string | null;
  lineReferences: LineReference[];
};

export type ReviewLoadResult =
  | { status: "available"; artifact: ReviewArtifact }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "aborted" };

export type ReviewRequest = {
  pathKey: string;
  contentKey: string;
  basePath?: string;
  signal?: AbortSignal;
};

const hex64Pattern = /^[a-f0-9]{64}$/;

export function assertHex64(value: string, name: string): Hex64 {
  if (!hex64Pattern.test(value)) {
    throw new TypeError(`${name} must be a lowercase 64-hex SHA-256 key`);
  }
  return value as Hex64;
}

export function isTrustedGithubUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function normalizeBasePath(basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "") {
  const trimmed = basePath.replace(/\/+$/, "");
  return trimmed === "" || trimmed === "/" ? "" : trimmed;
}

export function getReviewIndexUrl(basePath?: string) {
  return `${normalizeBasePath(basePath)}/generated/reviews/index.json`;
}

export function getReviewArtifactUrl(pathKey: string, contentKey: string, basePath?: string) {
  const safePathKey = assertHex64(pathKey, "pathKey");
  const safeContentKey = assertHex64(contentKey, "contentKey");
  return `${normalizeBasePath(basePath)}/generated/reviews/${safePathKey}/${safeContentKey}.json`;
}

function parseReviewIndex(
  value: unknown,
): { status: "complete"; keys: Array<{ pathKey: Hex64; contentKey: Hex64 }> } | { status: "unavailable" } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.status !== "complete" && record.status !== "unavailable") {
    return null;
  }
  if (record.status === "unavailable") {
    return { status: "unavailable" };
  }
  if (!Array.isArray(record.keys)) {
    return null;
  }
  const keys: Array<{ pathKey: Hex64; contentKey: Hex64 }> = [];
  for (const entry of record.keys) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.pathKey !== "string" || !hex64Pattern.test(item.pathKey)) {
      return null;
    }
    if (typeof item.contentKey !== "string" || !hex64Pattern.test(item.contentKey)) {
      return null;
    }
    keys.push({ pathKey: item.pathKey as Hex64, contentKey: item.contentKey as Hex64 });
  }
  return { status: "complete", keys };
}

export function parseReviewArtifactJson(value: unknown): ReviewArtifact | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.pathKey !== "string" || !hex64Pattern.test(record.pathKey)) {
    return null;
  }
  if (typeof record.contentKey !== "string" || !hex64Pattern.test(record.contentKey)) {
    return null;
  }
  if (typeof record.commentUrl !== "string" || !isTrustedGithubUrl(record.commentUrl)) {
    return null;
  }
  if (typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) {
    return null;
  }
  if (record.text !== null && (typeof record.text !== "string" || record.text.length === 0)) {
    return null;
  }
  if (!Array.isArray(record.lineReferences)) {
    return null;
  }
  const lineReferences: LineReference[] = [];
  for (const reference of record.lineReferences) {
    if (typeof reference !== "object" || reference === null) {
      return null;
    }
    const item = reference as Record<string, unknown>;
    const start = item.start;
    const end = item.end;
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end < start
    ) {
      return null;
    }
    lineReferences.push({ start, end });
  }
  if (record.text === null && lineReferences.length > 0) {
    return null;
  }
  return {
    pathKey: record.pathKey as Hex64,
    contentKey: record.contentKey as Hex64,
    commentUrl: record.commentUrl,
    updatedAt: record.updatedAt,
    text: record.text,
    lineReferences,
  };
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadReview(request: ReviewRequest): Promise<ReviewLoadResult> {
  const safePathKey = assertHex64(request.pathKey, "pathKey");
  const safeContentKey = assertHex64(request.contentKey, "contentKey");
  if (request.signal?.aborted) {
    return { status: "aborted" };
  }

  let indexResponse: Response;
  try {
    indexResponse = await fetch(getReviewIndexUrl(request.basePath), { signal: request.signal });
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "aborted" };
    }
    return { status: "error" };
  }
  if (indexResponse.status === 404) {
    return { status: "unavailable" };
  }
  if (!indexResponse.ok) {
    return { status: "error" };
  }

  const index = parseReviewIndex(await readJson(indexResponse));
  if (!index) {
    return { status: "error" };
  }
  if (index.status === "unavailable") {
    return { status: "unavailable" };
  }

  if (!index.keys.some((pair) => pair.pathKey === safePathKey && pair.contentKey === safeContentKey)) {
    return { status: "none" };
  }

  let artifactResponse: Response;
  try {
    artifactResponse = await fetch(
      getReviewArtifactUrl(safePathKey, safeContentKey, request.basePath),
      { signal: request.signal },
    );
  } catch (error) {
    if (isAbortError(error)) {
      return { status: "aborted" };
    }
    return { status: "error" };
  }
  if (!artifactResponse.ok) {
    return { status: "error" };
  }

  const artifact = parseReviewArtifactJson(await readJson(artifactResponse));
  if (!artifact || artifact.pathKey !== safePathKey || artifact.contentKey !== safeContentKey) {
    return { status: "error" };
  }
  return { status: "available", artifact };
}
