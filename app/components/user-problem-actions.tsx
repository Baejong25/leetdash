import Link from "next/link";
import { ExternalLink, GitCompare } from "lucide-react";
import type { CatalogProblem } from "@/lib/catalog";
import type { Submission } from "@/lib/types";

type ProviderLabels = Record<string, string>;

type Props = {
  problem: CatalogProblem;
  submission: Submission | null;
  comparisonHref: string | null;
  providerLabels: ProviderLabels;
};

export function UserProblemActions({
  problem,
  submission,
  comparisonHref,
  providerLabels,
}: Props) {
  return (
    <div className="actions">
      {comparisonHref ? (
        <Link className="button" href={comparisonHref}>
          <GitCompare size={16} aria-hidden="true" />
          비교
        </Link>
      ) : null}
      <a className="button" href={problem.sourceUrl} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden="true" />
        {providerLabels[problem.provider]}
      </a>
      {submission?.githubUrl ? (
        <a className="button" href={submission.githubUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          GitHub
        </a>
      ) : null}
    </div>
  );
}
