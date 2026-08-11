import { describe, expect, it } from "vitest";
import {
  buildProblemRecommendationPrompt,
  getProblemRecommendationHref,
  getUserSubmissionRoute,
} from "@/lib/problem-recommendation-link";

describe("problem recommendation link", () => {
  it("points at the user's submissions directory on the master branch", () => {
    expect(getUserSubmissionRoute("submissions/ada user")).toBe(
      "https://github.com/whoisyourbias/leetdash/tree/master/submissions/ada%20user",
    );
  });

  it("defines a grounded analysis and recommendation procedure", () => {
    const prompt = buildProblemRecommendationPrompt("submissions/ada");

    expect(prompt).toContain("https://github.com/whoisyourbias/leetdash/tree/master/submissions/ada");
    expect(prompt).toContain("모든 하위 폴더를 탐색");
    expect(prompt).toContain("같은 문제의 중복 제출은 하나의 고유 문제로 합친다");
    expect(prompt).toContain("주 유형만 사용하여 합계가 100%가 되게 한다");
    expect(prompt).toContain("숙련도 부족이 아니라 학습 데이터의 공백 또는 낮은 노출로 표현한다");
    expect(prompt).toContain("이미 푼 문제는 추천하지 않는다");
    expect(prompt).toContain("Mermaid pie 차트");
    expect(prompt).toContain("미풀이 문제 6개");
    expect(prompt).toContain("확인하지 못한 사실이나 문제를 만들어내지 않는다");
  });

  it("opens ChatGPT search with the complete prompt", () => {
    const href = getProblemRecommendationHref("submissions/ada");
    const url = new URL(href);

    expect(url.origin).toBe("https://chatgpt.com");
    expect(url.searchParams.get("hints")).toBe("search");
    expect(url.searchParams.get("q")).toBe(buildProblemRecommendationPrompt("submissions/ada"));
    expect(href.length).toBeLessThan(8_000);
  });
});
