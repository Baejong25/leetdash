import type { Submission } from "@/lib/types";

export type ProviderProblemFilterItem = {
  problem: {
    difficulty: string;
  };
  submissions: Record<string, Submission | null>;
};

export type ProviderProblemFilters = {
  selectedUserId: string;
  status: string;
  difficulty: string;
};

export function filterProviderProblems<T extends ProviderProblemFilterItem>(
  items: T[],
  filters: ProviderProblemFilters,
): T[] {
  return items.filter((item) => {
    const submission = filters.selectedUserId ? item.submissions[filters.selectedUserId] : null;

    if (filters.difficulty !== "all" && item.problem.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.status === "UNSOLVED") {
      return !submission;
    }
    if (filters.status !== "all" && submission?.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function paginateProviderProblems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}
