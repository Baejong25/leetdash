import { getProblemComparisonHref } from "@/lib/routes";

export function getComparisonLinkHref(
  provider: string,
  problemId: string,
  profileUserId: string,
  communitySolutionCount: number,
): string | null {
  if (communitySolutionCount <= 0) {
    return null;
  }

  return getProblemComparisonHref(provider, problemId, profileUserId, "");
}
