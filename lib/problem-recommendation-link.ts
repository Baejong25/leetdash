const CHATGPT_SEARCH_URL = "https://chatgpt.com/";
const REPOSITORY_TREE_URL = "https://github.com/whoisyourbias/leetdash/tree/master";

export function getUserSubmissionRoute(submissionsPath: string): string {
  const encodedPath = submissionsPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${REPOSITORY_TREE_URL}/${encodedPath}`;
}

export function buildProblemRecommendationPrompt(submissionsPath: string): string {
  const submissionRoute = getUserSubmissionRoute(submissionsPath);

  return [
    "다음 GitHub 경로의 모든 하위 폴더를 탐색하여 이 사용자의 문제 풀이 이력을 분석하라.",
    submissionRoute,
    "",
    "분석 규칙:",
    "- solution.* 파일이 있는 완료 문제만 집계하고, 같은 문제의 중복 제출은 하나의 고유 문제로 합친다.",
    "- 경로, 문제 정보, 풀이 코드를 근거로 알고리즘 유형을 판정하되 확인할 수 없는 내용은 추측하지 않는다.",
    "- 각 문제에 주 유형 하나와 필요한 경우 보조 유형을 부여한다. 유형별 비율은 주 유형만 사용하여 합계가 100%가 되게 한다.",
    "- 유형은 배열/문자열, 해시, 스택/큐, 단조 스택, 투 포인터, 슬라이딩 윈도우, 누적합, 정렬, 이분 탐색, 구간, 힙, 그리디, 연결 리스트, 트리, 그래프, DFS/BFS, DP, 백트래킹, Trie, 비트, 수학, 행렬, 분할 정복, 시뮬레이션/설계를 기준으로 한다.",
    "- 풀이 수가 적다는 사실은 숙련도 부족이 아니라 학습 데이터의 공백 또는 낮은 노출로 표현한다.",
    "- 추천 문제는 확인된 미풀이 문제만 선택하고 이미 푼 문제는 추천하지 않는다.",
    "- 저장소를 충분히 확인할 수 없으면 누락 범위를 먼저 밝히고 확인하지 못한 사실이나 문제를 만들어내지 않는다.",
    "",
    "다음 형식으로 한국어로 답하라:",
    "1. 분석 범위: 확인한 고유 문제 수, 플랫폼별 문제 수, 제외하거나 확인하지 못한 항목.",
    "2. 유형별 분포: 주 유형별 문제 수와 비율 표를 제시하고 Mermaid pie 차트로 시각화. 각 유형의 대표 문제도 함께 표시.",
    "3. 비어 있는 영역: 풀이가 0개인 유형과 상대적으로 노출이 낮은 유형을 구분하고, 그렇게 판단한 근거와 우선순위를 설명.",
    "4. 문제 추천: 공백을 먼저 보완하고 현재 풀이 난이도에서 한 단계씩 확장하도록 미풀이 문제 6개를 순서대로 추천. 각 문제의 플랫폼, 난이도, 보강 유형, 추천 이유, 문제 링크를 표로 제공.",
    "5. 요약: 지금 가장 먼저 풀 문제 1개와 그 이유를 한 문장으로 제시.",
  ].join("\n");
}

export function getProblemRecommendationHref(submissionsPath: string): string {
  const url = new URL(CHATGPT_SEARCH_URL);
  url.searchParams.set("hints", "search");
  url.searchParams.set("q", buildProblemRecommendationPrompt(submissionsPath));
  return url.toString();
}
