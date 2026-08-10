import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildMascotUrl,
  buildSourcePermalink,
  injectLinePermalinks,
  renderReviewFileComment,
  reviewContentKey,
  reviewFileKey,
  reviewSummaryMarker,
  sanitizeReviewMarkdown,
} from "../scripts/opencode-review-core.mjs";
import {
  parseReviewArtifact,
  parseReviewArtifacts,
} from "../scripts/review-artifacts-core.mjs";

// Fixtures model the REAL producer pipeline (scripts/opencode-review.mjs:258,389-393):
// model text is sanitized first (entities escaped, markdown links broken, URL
// schemes neutralized), then commit-pinned line permalinks are injected
// (`L15` -> `https://github.com/<owner>/<repo>/blob/<sha>/<path>#L15`), then the
// comment is rendered via renderReviewFileComment and posted by the bot.
const path = "submissions/whoisyourbias/programmers/12906/solution.java";
const source = Array.from({ length: 42 }, (_value, index) => `int value${index} = ${index};`).join("\n");
const pathKey = reviewFileKey(path);
const contentKey = reviewContentKey(source);
const headSha = "0a134a1";
const serverUrl = "https://github.com";
const repository = "whoisyourbias/leetdash";
const runUrl = "https://github.com/whoisyourbias/leetdash/actions/runs/1234";
const sourceUrl = buildSourcePermalink({ serverUrl, repository, headSha, path });
const mascotUrl = buildMascotUrl({ serverUrl, repository, baseSha: headSha });
const commentUrl = "https://github.com/whoisyourbias/leetdash/pull/126#issuecomment-5213445035";

const pr126Prose = [
  "L15 `if (arr[i] === target) {` [분류: 정확성] `target`이 배열에 두 번 이상 등장하면 첫 번째 인덱스만 반환합니다. 찾은 뒤 바로 `return` 하도록 명시해주세요.",
  "",
  "L19 `return -1;` [분류: 스타일] 매직 넘버 `-1` 대신 `NOT_FOUND` 상수를 사용하면 의도가 명확해집니다.",
].join("\n");

// Build the exact body the producer posts: sanitize -> inject permalinks -> render.
function producerBody(prose, content = contentKey) {
  const markdown = injectLinePermalinks(sanitizeReviewMarkdown(prose), sourceUrl);
  return renderReviewFileComment({
    path,
    sourceUrl,
    contentKey: content,
    headSha,
    runUrl,
    mascotUrl,
    markdown,
    lineCount: 42,
  });
}

function managedComment({
  id,
  updatedAt,
  prose = pr126Prose,
  login = "github-actions[bot]",
  content = contentKey,
  htmlUrl = commentUrl,
  body,
}) {
  return {
    id,
    user: { login },
    html_url: htmlUrl,
    updated_at: updatedAt,
    body: body ?? producerBody(prose, content),
  };
}

const current = { pathKey, contentKey };

describe("parseReviewArtifact: managed bot comment gate", () => {
  it("accepts only the exact github-actions[bot] login", () => {
    const artifact = parseReviewArtifact(managedComment({ id: 1, updatedAt: "2026-08-08T09:00:00Z" }));
    expect(artifact).not.toBeNull();

    for (const login of ["github-actions", "octocat", "chalsakbot", "GitHub-Actions[bot]", null]) {
      expect(parseReviewArtifact(managedComment({ id: 2, updatedAt: "2026-08-08T09:00:00Z", login }))).toBeNull();
    }
    expect(parseReviewArtifact(managedComment({ id: 3, updatedAt: "2026-08-08T09:00:00Z", login: "" }))).toBeNull();
    expect(parseReviewArtifact({ ...managedComment({ id: 4, updatedAt: "2026-08-08T09:00:00Z" }), user: undefined })).toBeNull();
    expect(parseReviewArtifact(undefined)).toBeNull();
    expect(parseReviewArtifact(null)).toBeNull();
  });

  it("requires a safe integer comment id", () => {
    for (const id of [1.5, Number.MAX_SAFE_INTEGER + 1, "5", undefined, NaN]) {
      expect(parseReviewArtifact(managedComment({ id, updatedAt: "2026-08-08T09:00:00Z" }))).toBeNull();
    }
  });

  it("requires managed file markers (rejects summary, malformed, partial, and reversed markers)", () => {
    const summaryBody = [
      reviewSummaryMarker,
      `<img src="${mascotUrl}" width="72" alt="찰싹봇 캐릭터" align="left">`,
      "## 찰싹봇 리뷰 경고",
      `커밋: ${headSha}`,
      "단계: model-response",
      "사유: MODEL_RESPONSE_INVALID",
      "상세: OpenCode response is missing review Markdown.",
      "재시도 가능: 아니요",
      `워크플로: ${runUrl}`,
    ].join("\n");
    expect(parseReviewArtifact(managedComment({ id: 10, updatedAt: "2026-08-08T09:00:00Z", body: summaryBody }))).toBeNull();

    expect(parseReviewArtifact(managedComment({ id: 11, updatedAt: "2026-08-08T09:00:00Z", body: "not a managed comment" }))).toBeNull();
    expect(parseReviewArtifact(managedComment({ id: 12, updatedAt: "2026-08-08T09:00:00Z", body: "<!-- leetdash-opencode-review-file:nothex -->\nprose" }))).toBeNull();
    expect(parseReviewArtifact(managedComment({
      id: 13,
      updatedAt: "2026-08-08T09:00:00Z",
      body: "<!-- leetdash-opencode-review-file:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef -->",
    }))).toBeNull();
    expect(parseReviewArtifact(managedComment({
      id: 14,
      updatedAt: "2026-08-08T09:00:00Z",
      body: "<!-- leetdash-opencode-review-content:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef -->\nprose",
    }))).toBeNull();
    expect(parseReviewArtifact(managedComment({
      id: 15,
      updatedAt: "2026-08-08T09:00:00Z",
      body: [
        `<!-- leetdash-opencode-review-content:${contentKey} -->`,
        `<!-- leetdash-opencode-review-file:${pathKey} -->`,
        "prose",
      ].join("\n"),
    }))).toBeNull();
  });

  it("accepts only trusted GitHub comment URLs", () => {
    for (const htmlUrl of [
      "http://github.com/whoisyourbias/leetdash/pull/126#issuecomment-1",
      "https://evil.example/pull/126#issuecomment-1",
      "https://github.com.evil.example/pull/126",
      "javascript:alert(1)",
      null,
    ]) {
      expect(parseReviewArtifact(managedComment({ id: 20, updatedAt: "2026-08-08T09:00:00Z", htmlUrl }))).toBeNull();
    }
  });

  it("requires a parseable updated_at timestamp", () => {
    for (const updatedAt of [undefined, "not-a-date", 12345]) {
      expect(parseReviewArtifact(managedComment({ id: 21, updatedAt }))).toBeNull();
    }
  });

  it("rejects a managed file comment with no review prose", () => {
    const headerOnlyBody = renderReviewFileComment({
      path,
      sourceUrl,
      contentKey,
      headSha,
      runUrl,
      mascotUrl,
      markdown: "",
      lineCount: 42,
    });
    expect(parseReviewArtifact(managedComment({ id: 22, updatedAt: "2026-08-08T09:00:00Z", body: headerOnlyBody }))).toBeNull();
  });
});

describe("parseReviewArtifact: safe artifact shape", () => {
  it("emits only the six safe fields for a current file review", () => {
    const updatedAt = "2026-08-08T09:00:00Z";
    const artifact = parseReviewArtifact(managedComment({ id: 5213445035, updatedAt }));

    expect(artifact).toEqual({
      pathKey,
      contentKey,
      commentUrl,
      updatedAt,
      text: pr126Prose,
      lineReferences: [
        { start: 15, end: 15 },
        { start: 19, end: 19 },
      ],
    });
    expect(Object.keys(artifact).sort()).toEqual(["commentUrl", "contentKey", "lineReferences", "pathKey", "text", "updatedAt"]);
    expect(artifact.text).not.toContain("워크플로");
    expect(artifact.text).not.toContain("커밋:");
    expect(artifact.text).not.toContain("파일:");
    expect(artifact.text).not.toContain("찰싹봇의 코드 리뷰");
    expect(artifact.text).not.toContain("<img");
    expect(artifact.text).not.toContain("https://");
    expect(artifact.text).not.toContain("github.com");
    expect(artifact.text).not.toContain(headSha);
  });

  it("handles the explicit no-comment representation", () => {
    const artifact = parseReviewArtifact(
      managedComment({ id: 30, updatedAt: "2026-08-08T09:00:00Z", prose: "리뷰 코멘트 없음." }),
    );
    expect(artifact).toEqual({
      pathKey,
      contentKey,
      commentUrl,
      updatedAt: "2026-08-08T09:00:00Z",
      text: null,
      lineReferences: [],
    });

    const padded = parseReviewArtifact(
      managedComment({ id: 31, updatedAt: "2026-08-08T09:00:00Z", prose: "\r\n  리뷰 코멘트 없음. \r\n" }),
    );
    expect(padded?.text).toBeNull();
  });

  it("extracts multiline ranges and deduplicates line anchors", () => {
    const prose = [
      "L17-L19 ```java\nfor (int i = 0; i < n; i++) {\n  sum += arr[i];\n}\n``` [분류: 효율성] 한 번 순회로 합계를 구할 수 있습니다.",
      "L15 `sum = 0;` [분류: 스타일]",
      "L15 `sum = 0;` [분류: 스타일] (중복 앵커)",
    ].join("\n");
    const artifact = parseReviewArtifact(managedComment({ id: 40, updatedAt: "2026-08-08T09:00:00Z", prose }));
    expect(artifact?.lineReferences).toEqual([
      { start: 15, end: 15 },
      { start: 17, end: 19 },
    ]);
    expect(artifact?.text).toContain("i < n");
  });

  it("drops invalid line anchors (line zero, reversed ranges, oversized numbers)", () => {
    const prose = "L0 `x` L19-L15 `y` L9999999999 `z` L15 `ok`";
    const artifact = parseReviewArtifact(managedComment({ id: 41, updatedAt: "2026-08-08T09:00:00Z", prose }));
    expect(artifact?.lineReferences).toEqual([{ start: 15, end: 15 }]);
  });

  it("decodes exactly one layer of producer entities so text is readable", () => {
    const prose = [
      "L15 `if (i < n && arr[i] >= 0) {` [분류: 정확성] @see java.util.List 참고",
      "`&lt;`와 `&#64;`는 모델이 쓴 리터럴 엔티티",
    ].join("\n");
    const artifact = parseReviewArtifact(managedComment({ id: 42, updatedAt: "2026-08-08T09:00:00Z", prose }));

    expect(artifact?.text).toContain("i < n && arr[i] >= 0");
    expect(artifact?.text).toContain("@see java.util.List");
    expect(artifact?.text).not.toContain("&amp;");
    expect(artifact?.text).not.toContain("&#64;see");
    // Literal entity text the model wrote survives exactly one decode layer.
    expect(artifact?.text).toContain("`&lt;`와 `&#64;`는");
    expect(artifact?.lineReferences).toEqual([{ start: 15, end: 15 }]);
  });

  it("restores injected blob permalinks to bare labels and strips remote URLs", () => {
    const prose = [
      "L15 `if (x) return;` [분류: 정확성] 조기 반환 확인",
      "L17-L19 ```java\nfor (int i = 0; i < n; i++) { sum += arr[i]; }\n``` [분류: 효율성] 범위 리뷰",
      "모델이 인용한 https://evil.example/docs 참고와 www.example.com 링크는 제거된다",
    ].join("\n");
    const artifact = parseReviewArtifact(managedComment({ id: 43, updatedAt: "2026-08-08T09:00:00Z", prose }));

    expect(artifact?.text).toContain("L15");
    expect(artifact?.text).toContain("L17-L19");
    expect(artifact?.text).toContain("조기 반환 확인");
    expect(artifact?.text).toContain("링크는 제거된다");
    for (const leaked of ["github.com", "blob/", headSha, path, "https://", "www.", "actions/runs", "&#58;", "&#46;"]) {
      expect(artifact?.text).not.toContain(leaked);
    }
    expect(artifact?.lineReferences).toEqual([
      { start: 15, end: 15 },
      { start: 17, end: 19 },
    ]);
  });

  it("renders hostile prose as inert React text nodes (no HTML or Markdown rendering)", () => {
    const prose = [
      "L5 `x` [분류: 정확성] <script>alert(\"xss\")</script> <img src=x onerror=alert(1)> a && b @user",
      "[click](https://evil.example/payload) https://evil.example/raw www.evil.example <b>bold</b>",
    ].join("\n");
    const artifact = parseReviewArtifact(managedComment({ id: 50, updatedAt: "2026-08-08T09:00:00Z", prose }));

    // Readable one-layer text: angle brackets, ampersands, and at signs survive
    // as plain characters; React's text-node escaping is the only safety layer.
    expect(artifact?.text).toContain('<script>alert("xss")</script>');
    expect(artifact?.text).toContain("a && b");
    expect(artifact?.text).toContain("@user");
    expect(artifact?.text).toContain("[click]()");
    for (const leaked of ["https://", "www.", "github.com", "&amp;", "&#58;", "&#46;", "&#64;"]) {
      expect(artifact?.text).not.toContain(leaked);
    }

    const rendered = renderToStaticMarkup(createElement("div", null, artifact.text));
    expect(rendered).toContain("&lt;script&gt;");
    expect(rendered).toContain("&lt;img");
    expect(rendered).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(rendered).not.toContain("<script");
    expect(rendered).not.toContain("<img");
    expect(rendered).not.toContain("<b>");
    expect(rendered).not.toContain("href=");

    expect(artifact?.lineReferences).toEqual([{ start: 5, end: 5 }]);
  });
});

describe("parseReviewArtifacts: mapping against current solution metadata", () => {
  it("returns the artifact for the current path/content keys", () => {
    const comments = [
      { id: 900, user: { login: "octocat" }, html_url: commentUrl, updated_at: "2026-08-08T09:00:00Z", body: "human noise" },
      managedComment({ id: 901, updatedAt: "2026-08-08T09:00:00Z" }),
      { id: 902, user: { login: "github-actions[bot]" }, html_url: commentUrl, updated_at: "2026-08-08T09:00:00Z", body: reviewSummaryMarker },
    ];
    expect(parseReviewArtifacts(comments, current)).toEqual([
      expect.objectContaining({ pathKey, contentKey, lineReferences: [{ start: 15, end: 15 }, { start: 19, end: 19 }] }),
    ]);
  });

  it("yields no artifact for a stale content hash", () => {
    const staleContentKey = reviewContentKey(`${source}\n// changed`);
    expect(staleContentKey).not.toBe(contentKey);
    const comments = [managedComment({ id: 910, updatedAt: "2026-08-08T09:00:00Z", content: staleContentKey })];
    expect(parseReviewArtifacts(comments, current)).toEqual([]);
  });

  it("yields no artifact for a stale path key", () => {
    const stalePathKey = reviewFileKey(`${path}/extra.java`);
    expect(stalePathKey).not.toBe(pathKey);
    const comments = [managedComment({ id: 911, updatedAt: "2026-08-08T09:00:00Z" })];
    expect(parseReviewArtifacts(comments, { pathKey: stalePathKey, contentKey })).toEqual([]);
  });

  it("selects the newest comment and breaks ties by highest id (latest wins)", () => {
    const newest = managedComment({ id: 920, updatedAt: "2026-08-08T10:00:00Z", prose: "L15 `a` [분류: 스타일] 최신 리뷰" });
    const older = managedComment({ id: 921, updatedAt: "2026-08-08T09:00:00Z", prose: "L15 `a` [분류: 스타일] 이전 리뷰" });
    const results = parseReviewArtifacts([older, newest], current);
    expect(results).toHaveLength(1);
    expect(results[0].updatedAt).toBe("2026-08-08T10:00:00Z");
    expect(results[0].text).toContain("최신 리뷰");

    const tieA = managedComment({ id: 930, updatedAt: "2026-08-08T11:00:00Z", prose: "L15 `a` [분류: 스타일] A" });
    const tieB = managedComment({ id: 931, updatedAt: "2026-08-08T11:00:00Z", prose: "L15 `a` [분류: 스타일] B" });
    const tieResults = parseReviewArtifacts([tieA, tieB], current);
    expect(tieResults).toHaveLength(1);
    expect(tieResults[0].text).toContain("B");
  });

  it("throws a TypeError for invalid inputs", () => {
    expect(() => parseReviewArtifacts("not-an-array", current)).toThrow(TypeError);
    expect(() => parseReviewArtifacts([], undefined)).toThrow(TypeError);
    expect(() => parseReviewArtifacts([], {})).toThrow(TypeError);
    expect(() => parseReviewArtifacts([], { pathKey: "short", contentKey })).toThrow(TypeError);
    expect(() => parseReviewArtifacts([], { pathKey, contentKey: "not-hex" })).toThrow(TypeError);
  });
});
