// Safe review artifact parser.
//
// Converts managed Chalsakbot (opencode-review) GitHub issue comments into a
// JSON-safe review artifact consumed by the comparison pages. Comments are
// untrusted external text: this module never emits raw GitHub response
// objects, HTML, remote image URLs, tokens, workflow metadata, or
// author-controlled links.
//
// Contract:
//   - Input comments look like GitHub issue-comment objects:
//     { id, user: { login }, html_url, updated_at, body }.
//   - Only comments from the exact login `github-actions[bot]` with a managed
//     kind=file marker pair (path + content SHA-256 markers) are accepted.
//   - Artifacts are emitted ONLY with the six safe fields:
//     { pathKey, contentKey, commentUrl, updatedAt, text, lineReferences }.
//   - `text` is entity-escaped plain text safe for React text-node rendering.
//     `text === null` is the explicit no-comment representation
//     (`리뷰 코멘트 없음.`); `lineReferences` is then empty.
//   - `lineReferences` are numeric GitHub source anchors extracted ONLY from
//     the model's prose (`L<num>` / `L<start>-L<end>`); markdown/HTML links in
//     the body are never emitted as anchors or links.
//   - `parseReviewArtifacts` maps comments against current solution metadata
//     and selects the newest comment by `updated_at`, then the highest safe
//     numeric comment id for deterministic ties.

import { parseManagedReviewMarker } from "./opencode-review-core.mjs";

const managedBotLogin = "github-actions[bot]";
const hex64Pattern = /^[a-f0-9]{64}$/;
const fileMarkerPattern = /^<!-- leetdash-opencode-review-file:([a-f0-9]{64}) -->$/;
const contentMarkerPattern = /^<!-- leetdash-opencode-review-content:([a-f0-9]{64}) -->$/;
const mascotImagePattern = /^<img\b/;
const brandedHeadingPattern = /^##\s+/;
const metadataLinePattern = /^(?:파일|커밋|워크플로):\s*/;
const lineAnchorPattern = /L(\d{1,6})-L(\d{1,6})|L(\d{1,6})\b/g;
const maxLineReferences = 100;
const noCommentText = "리뷰 코멘트 없음.";

function toPlainText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\]\s*\(/g, "\\](")
    .replace(/\]\s*\[/g, "\\][")
    .replace(/\b(https?|mailto):/gi, "$1&#58;")
    .replace(/\bwww\./gi, "www&#46;");
}

function stripManagedPrefix(body) {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const isPrefixLine = fileMarkerPattern.test(line)
      || contentMarkerPattern.test(line)
      || mascotImagePattern.test(line)
      || brandedHeadingPattern.test(line)
      || metadataLinePattern.test(line)
      || line.trim() === "";
    if (!isPrefixLine) break;
    index += 1;
  }
  return lines.slice(index).join("\n");
}

function extractLineReferences(text) {
  const refs = [];
  for (const match of text.matchAll(lineAnchorPattern)) {
    const [, rangeStart, rangeEnd, single] = match;
    const start = rangeStart !== undefined ? Number(rangeStart) : Number(single);
    const end = rangeStart !== undefined ? Number(rangeEnd) : start;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) continue;
    refs.push({ start, end });
  }
  refs.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped = [];
  const seen = new Set();
  for (const ref of refs) {
    const key = `${ref.start}:${ref.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ref);
    if (deduped.length >= maxLineReferences) break;
  }
  return deduped;
}

function isTrustedCommentUrl(value) {
  if (typeof value !== "string") return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.hostname === "github.com";
}

/**
 * Validate a single raw GitHub comment and project it to a safe review
 * artifact, or return null when the comment is not a managed file review.
 * Never throws for untrusted input.
 */
export function parseReviewArtifact(comment) {
  if (!comment || typeof comment !== "object") return null;
  if (comment.user?.login !== managedBotLogin) return null;
  if (!Number.isSafeInteger(comment.id)) return null;

  const marker = parseManagedReviewMarker(comment.body);
  if (!marker || marker.kind !== "file") return null;
  if (!hex64Pattern.test(marker.key) || !hex64Pattern.test(marker.contentKey)) return null;

  if (!isTrustedCommentUrl(comment.html_url)) return null;
  const updatedAt = comment.updated_at;
  if (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) return null;

  const text = toPlainText(stripManagedPrefix(comment.body));
  if (text === noCommentText) {
    return {
      pathKey: marker.key,
      contentKey: marker.contentKey,
      commentUrl: comment.html_url,
      updatedAt,
      text: null,
      lineReferences: [],
    };
  }
  if (text.length === 0) return null;

  return {
    pathKey: marker.key,
    contentKey: marker.contentKey,
    commentUrl: comment.html_url,
    updatedAt,
    text,
    lineReferences: extractLineReferences(text),
  };
}

/**
 * Map raw comments against current solution metadata (pathKey/contentKey
 * computed from the solution path and file bytes). Returns at most one
 * artifact: the newest matching comment by `updated_at`, with the highest
 * safe numeric comment id as the deterministic tie-breaker.
 * Throws TypeError only for invalid programmer inputs, never for untrusted
 * comment content.
 */
export function parseReviewArtifacts(comments, current) {
  if (!Array.isArray(comments)) throw new TypeError("comments must be an array");
  if (!current || typeof current !== "object") throw new TypeError("current must include pathKey and contentKey");
  const { pathKey, contentKey } = current;
  if (!hex64Pattern.test(pathKey) || !hex64Pattern.test(contentKey)) {
    throw new TypeError("current pathKey/contentKey must be 64-char hex SHA-256 keys");
  }

  const matched = comments
    .map((comment) => ({ comment, artifact: parseReviewArtifact(comment) }))
    .filter(({ artifact }) => artifact && artifact.pathKey === pathKey && artifact.contentKey === contentKey)
    .sort((a, b) => {
      const timeDelta = Date.parse(b.artifact.updatedAt) - Date.parse(a.artifact.updatedAt);
      if (timeDelta !== 0) return timeDelta;
      return b.comment.id - a.comment.id;
    });

  const artifacts = [];
  const seen = new Set();
  for (const { artifact } of matched) {
    const pair = `${artifact.pathKey}:${artifact.contentKey}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    artifacts.push(artifact);
  }
  return artifacts;
}
