import { describe, expect, it } from "vitest";
import { getProblemComparisonHref, getUserProfileHref } from "@/lib/routes";

describe("user profile routes", () => {
  it("builds a root-relative profile URL for local hosting", () => {
    expect(getUserProfileHref("mygo", "")).toBe("/users/mygo/");
  });

  it("keeps the deployment base path for static hosting", () => {
    expect(getUserProfileHref("yeochang", "/leetdash")).toBe("/leetdash/users/yeochang/");
  });

  it("encodes user IDs before placing them in the URL", () => {
    expect(getUserProfileHref("user/name", "/leetdash/")).toBe("/leetdash/users/user%2Fname/");
  });
});

describe("problem comparison routes", () => {
  it("builds a root-relative comparison URL with a user query", () => {
    expect(getProblemComparisonHref("leetcode", "1", "mygo", "")).toBe("/problems/leetcode/1/?user=mygo");
  });

  it("keeps the deployment base path for static hosting", () => {
    expect(getProblemComparisonHref("programmers", "12906", "yeochang", "/leetdash/")).toBe(
      "/leetdash/problems/programmers/12906/?user=yeochang",
    );
  });

  it("omits the user query when no user is selected", () => {
    expect(getProblemComparisonHref("swea", "1206", undefined, "/leetdash")).toBe(
      "/leetdash/problems/swea/1206/",
    );
  });

  it("encodes provider, problem id, and user id segments", () => {
    expect(getProblemComparisonHref("leet/co", "1 2", "user/name", "/leetdash")).toBe(
      "/leetdash/problems/leet%2Fco/1%202/?user=user%2Fname",
    );
  });
});
