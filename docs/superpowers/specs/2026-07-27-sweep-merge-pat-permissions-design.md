# Submission Sweep PAT Permission Design

## Context

`Sweep Submission PRs` merges eligible submission pull requests through
`PUT /pulls/{number}/merge` using the `SWEEP_MERGE_TOKEN` Actions secret.
PR #91 contained only submission files, but its fork branch predated workflow
changes on `master`. GitHub treated the merge as creating or updating those
workflow files and rejected the Personal Access Token because it lacked
workflow-write permission.

A fallback to the workflow's built-in `GITHUB_TOKEN` did not solve the
incident. GitHub accepted the fallback attempt but rejected the merge with
`Resource not accessible by integration`. Updating the fork branch with an
administrator credential removed the workflow delta, after which the existing
sweep merged PR #91.

The durable fix is to give the dedicated sweep PAT every permission required
by the operations the sweeper already performs, including workflow-file
updates, while limiting that PAT to this repository.

## Goals

- Merge eligible pull requests even when a stale fork predates workflow changes
  on the base branch.
- Keep sweep authentication separate from the operator's GitHub CLI token.
- Limit the credential to `whoisyourbias/leetdash` and the minimum repository
  permissions used by the sweeper.
- Preserve exact-head checks, required-check provenance, review freshness,
  submission ownership validation, branch protection, and merge-failure
  visibility.
- Make token rotation and permission requirements discoverable.

## Non-goals

- Replacing the PAT with a GitHub App.
- Automatically updating contributor fork branches.
- Bypassing required checks, review conversations, or branch protection.
- Reusing a developer's `gh` OAuth token in GitHub Actions.
- Changing submission eligibility rules.

## Credential Model

Create a dedicated fine-grained Personal Access Token owned by
`whoisyourbias` with:

- Resource owner: `whoisyourbias`
- Repository access: only `whoisyourbias/leetdash`
- Expiration: 90 days
- Repository permissions:
  - Actions: Read and write
  - Commit statuses: Read
  - Contents: Read and write
  - Pull requests: Read
  - Workflows: Read and write

Metadata read access is implicit. No account permissions are required.
GitHub's fine-grained PAT form does not expose a Checks permission for this
token. Because `whoisyourbias/leetdash` is public, the Check Runs read endpoint
used by the sweeper remains available without that permission.

These permissions map to the sweeper's existing REST calls:

| Operation | Permission |
| --- | --- |
| List PRs and PR files | Pull requests: Read |
| Read validation Check Runs | Public repository access; no selectable PAT permission |
| Read `opencode-review-gate` statuses | Commit statuses: Read |
| Read review workflow runs | Actions: Read |
| Merge a pull request | Contents: Write |
| Dispatch `deploy-pages.yml` | Actions: Write |
| Merge a commit whose tree updates `.github/workflows/**` | Workflows: Write |

Store only this token in the repository Actions secret
`SWEEP_MERGE_TOKEN`. The token value must never be written to a source file,
shell history, test fixture, workflow summary, or Actions log.

## Application Architecture

The sweep job uses one credential for all GitHub API operations:

```text
SWEEP_MERGE_TOKEN
        |
        v
GitHubClient
  |-- read PR/check/status/workflow state
  |-- merge exact refreshed head SHA
  `-- dispatch deploy workflow after successful merges
```

Remove `GITHUB_TOKEN` from the merge step environment. Remove
`workflowMergeToken` and the retry path from `GitHubClient`. A missing
workflow permission must remain a visible merge failure with its GitHub request
ID, rather than being converted into a second, less informative integration
failure.

The workflow-level `permissions` block remains unchanged because it governs the
built-in `GITHUB_TOKEN`, which checkout and GitHub-managed actions may still
use. It does not grant permissions to the PAT.

## Secret Migration

1. Create the dedicated fine-grained PAT with the exact settings above.
2. Replace `SWEEP_MERGE_TOKEN` through GitHub's encrypted Actions-secret
   interface.
3. Confirm the secret's updated timestamp without attempting to read its value.
4. Deploy the fallback-removal commit to `master`.
5. Manually dispatch `Sweep Submission PRs`.
6. Confirm the run can read all required state and exits successfully when
   there are no eligible pull requests.
7. On the next eligible PR, verify merge and deploy dispatch from the run log.
8. Revoke the superseded PAT after the replacement has been verified.

Secret replacement happens before old-token revocation so the workflow never
has a credential-free interval.

## Failure Handling

- A missing `SWEEP_MERGE_TOKEN` fails before any GitHub request.
- Any GitHub API failure preserves HTTP status, sanitized response body,
  request ID, retry delay, and rate-limit metadata.
- A merge failure remains attached to the individual PR, scanning continues,
  and the CLI exits non-zero after writing the complete summary.
- No alternate credential is attempted.
- An expired or revoked PAT produces a red sweep run and is resolved by rotating
  `SWEEP_MERGE_TOKEN`, not by weakening branch protection.

## Testing

Automated tests will:

- require `GH_TOKEN: ${{ secrets.SWEEP_MERGE_TOKEN }}`;
- reject a `GITHUB_TOKEN` environment mapping in the merge step;
- verify `GitHubClient` sends one merge request with the configured PAT;
- verify the exact workflow-scope 403 remains the reported merge failure;
- verify unrelated 403 responses are not retried;
- preserve all existing eligibility, refresh, continuation, summary, and deploy
  tests.

Repository verification will run:

```bash
npm test -- --exclude '.worktrees/**'
npm run typecheck
npm run build
git diff --check
```

Live verification will confirm:

- the manual sweep uses the new default-branch workflow;
- the sweep finishes successfully;
- a subsequent eligible PR merges at its refreshed head SHA;
- `deploy-pages.yml` is dispatched after the merge;
- no PAT or authorization header appears in logs.

## Operational Documentation

The README deployment section will document:

- the secret name;
- the exact fine-grained permissions;
- the 90-day expiration policy;
- rotation before expiration;
- the expected failure message when Workflows permission is missing;
- the rule that personal GitHub CLI tokens must not be reused.

## Acceptance Criteria

- `SWEEP_MERGE_TOKEN` is a dedicated fine-grained PAT limited to
  `whoisyourbias/leetdash`.
- The PAT has the six repository permissions listed above and no account
  permissions.
- The built-in-token merge fallback is absent from workflow, implementation,
  and tests.
- The full local verification suite passes.
- A live manual sweep passes with the replacement token.
- The superseded token is revoked after verification.
- The setup and rotation procedure is committed to the repository.
