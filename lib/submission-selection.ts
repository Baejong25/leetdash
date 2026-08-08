import { type ProgressData, type Submission } from "@/lib/types";

export const SUBMISSION_RANK: Record<Submission["status"], number> = {
  SOLVED: 3,
  REVIEWING: 2,
  SKIPPED: 1,
};

export function getSelectedSubmission(
  user: ProgressData["users"][number],
  problemKey: string,
): Submission | null {
  let selected: Submission | null = null;
  for (const submission of user.submissions) {
    if (submission.problemKey !== problemKey) {
      continue;
    }
    if (selected === null || SUBMISSION_RANK[submission.status] > SUBMISSION_RANK[selected.status]) {
      selected = submission;
    }
  }
  return selected;
}
