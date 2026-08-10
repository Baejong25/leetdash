import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readCss(path: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", path), "utf-8");
}

function uniqueTokens(css: string): string[] {
  const matches = css.matchAll(/var\((--[\w-]+)\)/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

const APPROVED_TOKENS = new Set([
  "--bg", "--surface", "--surface-muted", "--text", "--muted",
  "--muted-strong",
  "--border", "--strong-border", "--accent", "--accent-strong",
  "--accent-soft", "--warn", "--warn-soft", "--danger",
  "--danger-soft", "--ok", "--ok-soft", "--shadow",
  "--activity-cell-size",
]);

describe("CSS token contract", () => {
  const cases: [string, string][] = [
    ["explorer module", "app/components/problem-solution-explorer.module.css"],
    ["code-viewer module", "app/components/solution-code-viewer.module.css"],
    ["review-panel module", "app/components/solution-review-panel.module.css"],
    ["globals.css", "app/globals.css"],
  ];
  for (const [label, file] of cases) {
    it(`${label} uses only approved tokens`, () => {
      const css = readCss(file);
      for (const token of uniqueTokens(css)) {
        expect(APPROVED_TOKENS.has(token),
          `${file} references unapproved token: ${token}`,
        ).toBe(true);
      }
    });
  }
});

describe("CSS module structure contract", () => {
  it("explorer module defines all layout classes", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    const required = [
      "explorerRoot", "solverSection", "detailSection",
      "explorerDetailLayout", "codeColumn", "reviewColumn", "selectedSummary",
    ];
    for (const cls of required) {
      expect(css, `Missing .${cls}`).toContain(`.${cls}`);
    }
  });

  it("desktop split-view uses 2fr/1fr grid with sticky review", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    const preMedia = css.split("@media")[0];
    expect(preMedia).toContain("grid-template-columns");
    expect(preMedia).toContain("minmax(0, 2fr)");
    expect(preMedia).toContain("minmax(0, 1fr)");
    const review = preMedia.split(".reviewColumn")[1]?.split("}")[0];
    expect(review).toContain("position: sticky");
    expect(review).toContain("top:");
  });

  it("code column has min-width:0 to prevent overflow", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    const pre = css.split(".codeColumn")[1]?.split("}")[0];
    expect(pre).toContain("min-width: 0");
  });

  it("detailSection DOM order precedes solverSection", () => {
    const tsx = readCss("app/components/problem-solution-explorer.tsx");
    const stripped = tsx.replace(/\/\/.*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const detailIdx = stripped.indexOf("detailSection");
    const solverIdx = stripped.indexOf("solverSection");
    expect(detailIdx, "detailSection must appear in the TSX source").toBeGreaterThan(-1);
    expect(solverIdx, "solverSection must appear in the TSX source").toBeGreaterThan(-1);
    expect(detailIdx, "detailSection must precede solverSection in DOM order").toBeLessThan(solverIdx);
  });

  it("mobile (≤900px) uses single column with static review", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    expect(css).toContain("max-width: 900px");
    const mobile = css.split("@media (max-width: 900px)")[1]?.split("@media")[0] ?? "";
    expect(mobile).toContain("grid-template-columns: 1fr");
    expect(mobile).toContain("position: static");
  });

  it("explorer root has overflow-x: clip at ≤640px", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    expect(css).toContain("max-width: 640px");
    const small = css.split("@media (max-width: 640px)")[1]?.split("@media")[0] ?? "";
    expect(small).toContain("overflow-x: clip");
  });
});

describe("focus-visible contract", () => {
  it("copyButton has focus-visible with outline", () => {
    const css = readCss("app/components/solution-code-viewer.module.css");
    expect(css).toMatch(/\.copyButton:focus-visible\s*\{/);
    expect(css).toMatch(/\.copyButton[^{]*\{[^}]*outline/);
  });
  it("permalink has focus-visible", () => {
    expect(readCss("app/components/solution-code-viewer.module.css"))
      .toMatch(/\.permalink:focus-visible\s*\{/);
  });
  it("lineButton has focus-visible", () => {
    expect(readCss("app/components/solution-review-panel.module.css"))
      .toMatch(/\.lineButton:focus-visible\s*\{/);
  });
  it("commentLink has focus-visible", () => {
    expect(readCss("app/components/solution-review-panel.module.css"))
      .toMatch(/\.commentLink:focus-visible\s*\{/);
  });
  it("globals has focus-visible for link-button, github-link, problem-link", () => {
    const css = readCss("app/globals.css");
    expect(css).toMatch(/\.link-button:focus-visible\s*\{/);
    expect(css).toMatch(/\.github-link:focus-visible\s*\{/);
    expect(css).toMatch(/\.problem-link:focus-visible\s*\{/);
  });

  it("all focus-visible outlines use var(--accent)", () => {
    const files = [
      readCss("app/components/solution-code-viewer.module.css"),
      readCss("app/components/solution-review-panel.module.css"),
      readCss("app/globals.css"),
    ].join("\n");
    for (const block of files.matchAll(/focus-visible[^{]*\{[^}]*\}/gs)) {
      expect(block[0], `focus-visible block missing --accent: ${block[0].slice(0, 80)}`)
        .toMatch(/var\(--accent\)/);
    }
  });
});

describe("reduced-motion contract", () => {
  it("code-viewer disables skeleton animation when prefers-reduced-motion", () => {
    const css = readCss("app/components/solution-code-viewer.module.css");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css.split("prefers-reduced-motion: reduce")[1]).toContain("animation: none");
  });
});

describe("mobile overflow contract", () => {
  it("≤640px overflow-x:hidden targets .comparison-page, not html or body", () => {
    const css = readCss("app/globals.css");
    const parts = css.split("@media (max-width: 640px)");
    const all640 = parts.slice(1).join("");

    expect(all640).toContain(".comparison-page");
    expect(all640).toContain("overflow-x: hidden");

    // Assert no bare html selector carries overflow-x:hidden
    const htmlOvRx = /(?:^|})\s*html\s*\{[^}]*overflow-x\s*:\s*hidden/;
    expect(all640, "html selector must not carry overflow-x:hidden").not.toMatch(htmlOvRx);

    // Assert no bare body selector carries overflow-x:hidden
    const bodyOvRx = /(?:^|})\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/;
    expect(all640, "body selector must not carry overflow-x:hidden").not.toMatch(bodyOvRx);
  });

  it(".top-nav wraps at ≤640px to prevent header nav overflow", () => {
    const css = readCss("app/globals.css");
    const parts = css.split("@media (max-width: 640px)");
    const topNavBlock = parts.slice(1).find((b) => b.includes(".top-nav"));
    expect(topNavBlock, ".top-nav must appear in a 640px block").toBeDefined();
    expect(topNavBlock).toContain("flex-wrap: wrap");
  });

  it("explorer root has overflow-x: clip at ≤640px", () => {
    const css = readCss("app/components/problem-solution-explorer.module.css");
    const small = css.split("@media (max-width: 640px)")[1]?.split("@media")[0] ?? "";
    expect(small).toContain("overflow-x: clip");
  });
});

describe("solver-meta contract", () => {
  it("solver-meta is defined and uses flex layout", () => {
    const css = readCss("app/globals.css");
    expect(css).toContain(".solver-meta");
    const block = css.split(".solver-meta")[1]?.split("}")[0] ?? "";
    expect(block).toContain("display: flex");
    expect(block).toContain("gap");
  });
});

describe("link-button reset contract", () => {
  it("link-button has proper reset styles", () => {
    const css = readCss("app/globals.css");
    const block = css.split(".link-button")[1]?.split(".link-button:focus-visible")[0] ?? "";
    expect(block).toContain("background: none");
    expect(block).toContain("border: 0");
    expect(block).toContain("cursor: pointer");
    expect(block).toContain("font: inherit");
    expect(block).toContain("padding: 0");
  });
});

describe("Regressions: batch 2", () => {
  it("defines --muted-strong in :root for badge neutral contrast WCAG AA compliance", () => {
    const css = readCss("app/globals.css");
    const rootBlock = css.split(":root")[1]?.split("}")[0] ?? "";
    expect(rootBlock).toContain("--muted-strong: #586674");
    expect(APPROVED_TOKENS.has("--muted-strong")).toBe(true);
  });

  it("badge.neutral uses var(--muted-strong) not raw hex", () => {
    const css = readCss("app/globals.css");
    const block = css.split(".badge.neutral")[1]?.split("}")[0] ?? "";
    expect(block).toContain("var(--muted-strong)");
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("code-viewer surface has contain: layout paint for CLS isolation", () => {
    const css = readCss("app/components/solution-code-viewer.module.css");
    const block = css.split(".surface")[1]?.split("}")[0] ?? "";
    expect(block).toContain("contain: layout paint");
  });

  it("review-panel body has min-height for loading CLS stability", () => {
    const css = readCss("app/components/solution-review-panel.module.css");
    const block = css.split(".body")[1]?.split("}")[0] ?? "";
    expect(block).toContain("min-height: 80px");
  });

  it("Copy button aria-label includes visible text for label-content match", () => {
    const tsx = readCss("app/components/solution-code-viewer.tsx");
    expect(tsx).toContain('aria-label="Copy 소스 코드 복사"');
  });
});
